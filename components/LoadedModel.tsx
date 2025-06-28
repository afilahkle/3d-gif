'use client';

import { useEffect, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ModelData } from '@/app/page';
import { ModelLoader } from '@/lib/modelLoader';
import { MaterialProcessor } from '@/lib/materialProcessor';
import { UnrealEngineProcessor } from '@/lib/unrealEngineProcessor';

interface LoadedModelProps {
  modelData: ModelData;
  autoRotate: boolean;
  rotationSpeed: number;
  isRecording?: boolean;
  recordingProgress?: number;
}

// Utility: Normalize (center and scale) a model to fit a target size
function normalizeModel(object: THREE.Object3D, targetSize = 2) {
  // Compute bounding box of all descendants
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = box.getCenter(new THREE.Vector3());

  // Compute scale factor to fit target size
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? targetSize / maxDim : 1;

  // Center and scale the object
  object.position.sub(center); // Center at origin
  object.scale.setScalar(scale); // Uniform scale
}

// Main component for loading and displaying 3D models
export function LoadedModel({
  modelData,
  autoRotate,
  rotationSpeed,
  isRecording = false,
  recordingProgress = 0,
}: LoadedModelProps) {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [normalizedGroup, setNormalizedGroup] = useState<THREE.Group | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      if (isRecording) {
        // During recording, rotate based on recording progress for smooth full circle
        const normalizedProgress = recordingProgress / 100;
        const targetRotation = normalizedProgress * Math.PI * 2;
        groupRef.current.rotation.y = targetRotation;

        // Reset rotation on other axes to prevent unwanted movement
        groupRef.current.rotation.x = 0;
        groupRef.current.rotation.z = 0;

        // Keep position locked during recording
        groupRef.current.position.set(0, 0, 0);
      } else if (autoRotate) {
        // Normal auto-rotation when not recording
        groupRef.current.rotation.y += delta * rotationSpeed;
      }
    }
  });

  useEffect(() => {
    const loadModel = async () => {
      if (!modelData) {
        setModel(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('Starting model load with new architecture:', {
          name: modelData.name,
          type: modelData.type,
          hasEmbeddedMaterials: modelData.hasEmbeddedMaterials,
        });

        // Load the model using the new ModelLoader
        const modelLoader = new ModelLoader();
        const loadedModel = await modelLoader.loadModel(modelData);

        // Process materials using the new MaterialProcessor
        const materialProcessor = new MaterialProcessor(
          modelData.textures || {}
        );
        materialProcessor.processModel(
          loadedModel,
          modelData.hasEmbeddedMaterials || false,
          modelData.type
        );

        // Apply Unreal Engine specific processing for GLTF/GLB files
        if (modelData.type === 'gltf' || modelData.type === 'glb') {
          console.log('Applying Unreal Engine optimizations...');

          // Handle special Unreal Engine extensions first
          UnrealEngineProcessor.handleUnrealExtensions(loadedModel);

          // Then apply general UE processing
          UnrealEngineProcessor.processUnrealModel(loadedModel);
          UnrealEngineProcessor.applyLightingCorrections(loadedModel);
        }

        setModel(loadedModel);
        console.log('Model loaded and processed successfully');
      } catch (err) {
        console.error('Error loading model:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, [modelData]);

  useEffect(() => {
    if (!model) {
      setNormalizedGroup(null);
      return;
    }
    // Wrap model in a group and normalize
    const group = new THREE.Group();
    group.add(model);
    normalizeModel(group, 8); // Target size = 6 units
    setNormalizedGroup(group);
  }, [model]);

  if (error) {
    console.error('Model loading error:', error);
    return null; // Or you could return an error component
  }

  if (isLoading || !normalizedGroup) {
    return null; // Loading state handled by parent
  }

  return (
    <group ref={groupRef}>
      <primitive object={normalizedGroup} />
    </group>
  );
}
