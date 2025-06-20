'use client';

import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Center, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ModelData, GifSettings } from '@/app/page';
import { LoadedModel } from '@/components/LoadedModel';
import { recordGif } from '@/lib/gifRecorder';
import { Loader2, Download, Camera, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModelViewerProps {
  modelData: ModelData | null;
  settings: GifSettings;
}

function LoadingFallback() {
  return (
    <div className='flex flex-col items-center justify-center h-full space-y-4'>
      <Loader2 className='h-8 w-8 animate-spin text-blue-500' />
      <p className='text-sm text-gray-600'>Loading 3D scene...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <mesh>
      <Text
        position={[0, 0, 0]}
        fontSize={0.5}
        color='#9CA3AF'
        anchorX='center'
        anchorY='middle'
      >
        Upload a 3D model to preview
      </Text>
    </mesh>
  );
}

export function ModelViewer({ modelData, settings }: ModelViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Check if model has lightmaps to adjust lighting accordingly
  const hasLightmaps =
    modelData?.textures &&
    (modelData.textures.lightmap || modelData.textures.light);

  const startRecording = async () => {
    if (!canvasRef.current) return;

    setIsRecording(true);
    setRecordingProgress(0);
    setGifUrl(null);
    setShowPreview(false);

    // Wait a bit longer to ensure the scene is fully rendered
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      // Debug: Test if we can capture a single frame first
      console.log(
        'Canvas dimensions:',
        canvasRef.current.width,
        'x',
        canvasRef.current.height
      );
      const testCanvas = document.createElement('canvas');
      testCanvas.width = canvasRef.current.width;
      testCanvas.height = canvasRef.current.height;
      const testCtx = testCanvas.getContext('2d');

      if (testCtx) {
        testCtx.drawImage(canvasRef.current, 0, 0);
        const imageData = testCtx.getImageData(
          0,
          0,
          testCanvas.width,
          testCanvas.height
        );
        const hasContent = imageData.data.some(
          (value, index) => index % 4 !== 3 && value > 0
        );
        console.log('Test frame has content:', hasContent);
      }

      const gifBlob = await recordGif(canvasRef.current, settings, (progress) =>
        setRecordingProgress(progress)
      );

      const url = URL.createObjectURL(gifBlob);
      setGifUrl(url);
      setShowPreview(true);
    } catch (error) {
      console.error('Error recording GIF:', error);
    } finally {
      setIsRecording(false);
      setRecordingProgress(0);
    }
  };

  const downloadGif = () => {
    if (gifUrl) {
      const link = document.createElement('a');
      link.href = gifUrl;
      link.download = `3d-model-animation-${Date.now()}.gif`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    if (gifUrl) {
      URL.revokeObjectURL(gifUrl);
      setGifUrl(null);
    }
  };

  return (
    <div className='h-full w-full bg-white rounded-lg overflow-hidden relative'>
      {/* Generate GIF Button */}
      {modelData && !isRecording && (
        <div className='absolute top-4 left-4 z-10'>
          <Button
            onClick={startRecording}
            className='bg-blue-500 hover:bg-blue-600 text-white shadow-lg'
          >
            <Camera className='mr-2 h-4 w-4' />
            Generate GIF
          </Button>
        </div>
      )}

      {/* Recording Status */}
      {isRecording && (
        <div className='absolute top-4 left-4 z-10 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 shadow-lg'>
          <div className='w-2 h-2 bg-white rounded-full animate-pulse'></div>
          <span>Recording {recordingProgress}%</span>
        </div>
      )}

      {/* GIF Preview Modal */}
      {showPreview && gifUrl && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-lg font-semibold'>GIF Preview</h3>
              <Button
                variant='ghost'
                size='sm'
                onClick={closePreview}
                className='p-1'
              >
                <X className='h-4 w-4' />
              </Button>
            </div>

            <div className='mb-4 flex justify-center'>
              <img
                src={gifUrl}
                alt='Generated GIF preview'
                className='max-w-full max-h-96 rounded-lg shadow-md'
              />
            </div>

            <div className='flex gap-2 justify-end'>
              <Button variant='outline' onClick={closePreview}>
                Close
              </Button>
              <Button
                onClick={downloadGif}
                className='bg-green-500 hover:bg-green-600 text-white'
              >
                <Download className='mr-2 h-4 w-4' />
                Download GIF
              </Button>
            </div>
          </div>
        </div>
      )}

      <Canvas
        ref={canvasRef}
        camera={{
          position: [
            settings.cameraDistance,
            settings.cameraDistance,
            settings.cameraDistance,
          ],
          fov: 50,
        }}
        shadows
        className='h-full w-full'
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.8, // Sketchfab-style bright exposure
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        scene={{ background: new THREE.Color(0xf5f5f5) }}
      >
        <Suspense fallback={null}>
          {/* Adaptive lighting setup - reduce intensity when lightmaps are present */}

          {/* Ambient light - reduced when lightmaps are present to preserve baked lighting */}
          <ambientLight intensity={hasLightmaps ? 0.4 : 1.5} color={0xffffff} />

          {/* Main key light - reduced when lightmaps are present */}
          <directionalLight
            position={[5, 8, 5]}
            intensity={hasLightmaps ? 1.0 : 2.5}
            color={0xffffff}
            castShadow={!hasLightmaps}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />

          {/* Fill light - reduced when lightmaps are present */}
          <directionalLight
            position={[-5, 6, -3]}
            intensity={hasLightmaps ? 0.6 : 1.5}
            color={0xffeedd}
          />

          {/* Rim light - reduced when lightmaps are present */}
          <directionalLight
            position={[0, 2, -8]}
            intensity={hasLightmaps ? 0.5 : 1.2}
            color={0xddddff}
          />

          {/* Bottom light - reduced when lightmaps are present */}
          <directionalLight
            position={[0, -10, 10]}
            intensity={hasLightmaps ? 0.3 : 1.0}
            color={0xffffff}
          />

          {/* Hemisphere light - reduced when lightmaps are present */}
          <hemisphereLight
            color={0xffffff}
            groundColor={0x888888}
            intensity={hasLightmaps ? 0.3 : 1.0}
          />

          {/* Point lights - reduced when lightmaps are present */}
          <pointLight
            position={[10, 10, 10]}
            intensity={hasLightmaps ? 0.3 : 0.8}
            color={0xffffff}
          />
          <pointLight
            position={[-10, 10, -10]}
            intensity={hasLightmaps ? 0.3 : 0.8}
            color={0xffffff}
          />
          <pointLight
            position={[0, -5, 0]}
            intensity={hasLightmaps ? 0.2 : 0.6}
            color={0xffffff}
          />
          <pointLight
            position={[5, 0, -5]}
            intensity={hasLightmaps ? 0.2 : 0.6}
            color={0xffffff}
          />

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            dampingFactor={0.05}
          />

          {/* Environment mapping - less intense when lightmaps are present */}
          <Environment preset='city' background={false} />

          <Center>
            {modelData ? (
              <LoadedModel
                modelData={modelData}
                autoRotate={settings.autoRotate}
                rotationSpeed={settings.rotationSpeed}
                isRecording={isRecording}
                recordingProgress={recordingProgress}
              />
            ) : (
              <EmptyState />
            )}
          </Center>

          {/* Only show ground plane and shadows if no lightmaps */}
          {!hasLightmaps && (
            <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -2, 0]}>
              <planeGeometry args={[20, 20]} />
              <shadowMaterial opacity={0.1} />
            </mesh>
          )}
        </Suspense>
      </Canvas>

      {!modelData && (
        <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
          <div className='text-center space-y-2'>
            <div className='w-16 h-16 mx-auto bg-gray-200 rounded-full flex items-center justify-center'>
              <Loader2 className='w-8 h-8 text-gray-400' />
            </div>
            <p className='text-gray-500 font-medium'>
              Upload a 3D model to get started
            </p>
            <p className='text-sm text-gray-400'>
              Supports OBJ, FBX, GLTF, GLB, and ZIP files
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
