'use client';

import { useEffect, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { ModelData } from '@/app/page';

interface LoadedModelProps {
  modelData: ModelData;
  autoRotate: boolean;
  rotationSpeed: number;
  isRecording?: boolean;
  recordingProgress?: number;
}

class ModelFinalizer {
  private textureLoader: THREE.TextureLoader;
  private textures: Record<string, string>;

  constructor(textures: Record<string, string> = {}) {
    this.textureLoader = new THREE.TextureLoader();
    this.textures = textures;
  }

  // From threeconverter.js SetTextureParameters function
  private configureTexture(
    texture: THREE.Texture,
    colorSpace: THREE.ColorSpace
  ): void {
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping; // threeTexture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping; // threeTexture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.flipY = false;

    // Note: rotation, offset, repeat are set when loading the texture
    // texture.rotation = texture.rotation;
    // texture.offset.x = texture.offset.x;
    // texture.offset.y = texture.offset.y;
    // texture.repeat.x = texture.scale.x;
    // texture.repeat.y = texture.scale.y;
  }

  // Check if geometry has vertex colors
  private hasVertexColors(geometry: THREE.BufferGeometry): boolean {
    return geometry?.attributes?.color !== undefined;
  }

  private convertColorToThreeColor(
    r: number,
    g: number,
    b: number
  ): THREE.Color {
    return new THREE.Color(r / 255.0, g / 255.0, b / 255.0);
  }

  private convertToStandardMaterial(
    originalMaterial: THREE.Material,
    hasVertexColors: boolean,
    fileType: string
  ): THREE.MeshStandardMaterial {
    // Default color for OBJ/FBX files without materials is (200, 200, 200) - the viewer's default
    let baseColor = this.convertColorToThreeColor(200, 200, 200);

    // Extract color from original material if it exists and is not a default material
    const isDefaultMaterial = this.isDefaultMaterial(originalMaterial);

    if ((originalMaterial as any).color && !isDefaultMaterial) {
      const origColor = (originalMaterial as any).color as THREE.Color;
      baseColor = origColor.clone();
      console.log(
        'Using material color from:',
        originalMaterial.name || 'unnamed',
        'color:',
        baseColor.getHexString()
      );
    } else if (isDefaultMaterial) {
      baseColor = this.convertColorToThreeColor(200, 200, 200);
      console.log(
        'Using default color (200,200,200) for default material:',
        originalMaterial.name || 'unnamed material'
      );
    }

    // if (material.vertexColors) { baseColor.setRGB (1.0, 1.0, 1.0); }
    if (hasVertexColors) {
      baseColor.setRGB(1.0, 1.0, 1.0); // WHITE base color for vertex colors
      console.log('Setting base color to white due to vertex colors');
    }

    const materialParams = {
      color: baseColor,
      vertexColors: hasVertexColors,
      opacity:
        (originalMaterial as any).opacity !== undefined
          ? (originalMaterial as any).opacity
          : 1.0,
      transparent: (originalMaterial as any).transparent || false,
      alphaTest: (originalMaterial as any).alphaTest || 0.0,
      side: THREE.DoubleSide,
    };

    const material = new THREE.MeshStandardMaterial(materialParams);

    // GLTF: explicitly sets multiplyDiffuseMap = true
    // OBJ/FBX: defaults to false (not set)
    const multiplyDiffuseMap =
      fileType.toLowerCase() === 'gltf' || fileType.toLowerCase() === 'glb';
    (material as any).multiplyDiffuseMap = multiplyDiffuseMap;

    this.applyTextureWithMultiplyLogic(
      material,
      originalMaterial,
      multiplyDiffuseMap
    );

    // Copy additional material properties
    this.copyMaterialProperties(material, originalMaterial);

    console.log(`Final material conversion result:`, {
      hasVertexColors,
      baseColorHex: material.color.getHexString(),
      vertexColors: material.vertexColors,
      transparent: material.transparent,
      opacity: material.opacity,
      side: 'DoubleSide',
      originalType: originalMaterial.type,
      hasTexture: !!material.map,
      multiplyDiffuseMap,
      fileType,
    });

    return material;
  }

  private isDefaultMaterial(material: THREE.Material): boolean {
    // if (threeMaterial.name === THREE.Loader.DEFAULT_MATERIAL_NAME) { return null; }
    const isThreeDefault =
      !material.name ||
      material.name === '' ||
      material.name === 'default' ||
      material.name === 'Material' ||
      material.name === THREE.Loader.DEFAULT_MATERIAL_NAME ||
      !!(material as any).isDefaultMaterial;

    // Check for materials that have the default white color (1,1,1) that Three.js assigns
    const hasDefaultWhiteColor =
      (material as any).color &&
      (material as any).color.r === 1 &&
      (material as any).color.g === 1 &&
      (material as any).color.b === 1;

    // Also check for black default colors (some formats use black as default)
    const hasDefaultBlackColor =
      (material as any).color &&
      (material as any).color.r === 0 &&
      (material as any).color.g === 0 &&
      (material as any).color.b === 0;

    const result =
      isThreeDefault || hasDefaultWhiteColor || hasDefaultBlackColor;

    if (result) {
      console.log('Identified default material (pattern):', {
        name: material.name || 'unnamed',
        type: material.type,
        hasWhiteColor: hasDefaultWhiteColor,
        hasBlackColor: hasDefaultBlackColor,
        isThreeDefault: isThreeDefault,
        willReplaceWith: 'RGB(200,200,200)',
      });
    }

    return result;
  }

  private applyTextureWithMultiplyLogic(
    targetMaterial: THREE.MeshStandardMaterial,
    sourceMaterial: THREE.Material,
    multiplyDiffuseMap: boolean
  ): void {
    if ((sourceMaterial as any).map) {
      const diffuseMap = (sourceMaterial as any).map;
      targetMaterial.map = diffuseMap;

      // this.LoadFaceTexture (threeMaterial, material.diffuseMap, (threeTexture) => {
      //     if (!material.multiplyDiffuseMap) {
      //         threeMaterial.color.setRGB (1.0, 1.0, 1.0);
      //     }
      //     threeMaterial.map = threeTexture;
      // });
      if (!multiplyDiffuseMap) {
        // Set color to white when not multiplying diffuse map
        targetMaterial.color.setRGB(1.0, 1.0, 1.0);
        console.log(
          'Set color to white due to !multiplyDiffuseMap logic (OBJ/FBX behavior)'
        );
      } else {
        console.log(
          'Keeping color for diffuse map multiplication (GLTF behavior)'
        );
      }
    }

    // Copy other texture maps
    if ((sourceMaterial as any).normalMap) {
      targetMaterial.normalMap = (sourceMaterial as any).normalMap;
    }
    if ((sourceMaterial as any).roughnessMap) {
      targetMaterial.roughnessMap = (sourceMaterial as any).roughnessMap;
    }
    if ((sourceMaterial as any).metalnessMap) {
      targetMaterial.metalnessMap = (sourceMaterial as any).metalnessMap;
    }
    if ((sourceMaterial as any).emissiveMap) {
      targetMaterial.emissiveMap = (sourceMaterial as any).emissiveMap;
    }
    if ((sourceMaterial as any).aoMap) {
      targetMaterial.aoMap = (sourceMaterial as any).aoMap;
    }
    if ((sourceMaterial as any).bumpMap) {
      targetMaterial.bumpMap = (sourceMaterial as any).bumpMap;
    }
    if ((sourceMaterial as any).displacementMap) {
      targetMaterial.displacementMap = (sourceMaterial as any).displacementMap;
    }
    if ((sourceMaterial as any).alphaMap) {
      targetMaterial.alphaMap = (sourceMaterial as any).alphaMap;
    }
  }

  // Copy additional material properties
  private copyMaterialProperties(
    targetMaterial: THREE.MeshStandardMaterial,
    sourceMaterial: THREE.Material
  ): void {
    // Additional properties
    if ((sourceMaterial as any).emissive) {
      targetMaterial.emissive = (sourceMaterial as any).emissive.clone();
    }
    if ((sourceMaterial as any).emissiveIntensity !== undefined) {
      targetMaterial.emissiveIntensity = (
        sourceMaterial as any
      ).emissiveIntensity;
    }
    if ((sourceMaterial as any).roughness !== undefined) {
      targetMaterial.roughness = (sourceMaterial as any).roughness;
    } else {
      targetMaterial.roughness = 0.8; // Default
    }
    if ((sourceMaterial as any).metalness !== undefined) {
      targetMaterial.metalness = (sourceMaterial as any).metalness;
    } else {
      targetMaterial.metalness = 0.0; // Default
    }
  }

  private applyExternalTextures(
    material: THREE.MeshStandardMaterial,
    hasVertexColors: boolean,
    fileType: string
  ): void {
    // Don't override existing good textures for vertex-colored models
    if (hasVertexColors && Object.keys(this.textures).length === 0) {
      console.log(
        'Preserving vertex colors, skipping external texture application'
      );
      return;
    }

    // Determine multiplyDiffuseMap based on file type
    const multiplyDiffuseMap =
      fileType.toLowerCase() === 'gltf' || fileType.toLowerCase() === 'glb';

    // Apply diffuse/albedo texture
    if (
      (this.textures.diffuse || this.textures.albedo) &&
      (!material.map || this.isLowQualityTexture(material.map))
    ) {
      const diffuseUrl = this.textures.diffuse || this.textures.albedo;
      const diffuseTexture = this.textureLoader.load(diffuseUrl);
      this.configureTexture(diffuseTexture, THREE.SRGBColorSpace);

      // if (!material.multiplyDiffuseMap) { threeMaterial.color.setRGB (1.0, 1.0, 1.0); }
      if (!multiplyDiffuseMap) {
        // For OBJ/FBX: set base color to white when applying texture
        material.color.setRGB(1.0, 1.0, 1.0);
        console.log(
          'Set base color to white for external texture (OBJ/FBX logic)'
        );
      } else {
        console.log(
          'Keeping base color for texture multiplication (GLTF logic)'
        );
      }

      material.map = diffuseTexture;
      console.log('Applied external diffuse texture:', diffuseUrl);
    }

    // Apply normal map
    if (this.textures.normal && !material.normalMap) {
      const normalTexture = this.textureLoader.load(this.textures.normal);
      this.configureTexture(normalTexture, THREE.NoColorSpace);
      material.normalMap = normalTexture;
      material.normalScale = new THREE.Vector2(1.0, 1.0);
      console.log('Applied external normal texture:', this.textures.normal);
    }

    // Apply roughness map
    if (this.textures.roughness && !material.roughnessMap) {
      const roughnessTexture = this.textureLoader.load(this.textures.roughness);
      this.configureTexture(roughnessTexture, THREE.NoColorSpace);
      material.roughnessMap = roughnessTexture;
      material.roughness = 1.0; // Let map control
      console.log(
        'Applied external roughness texture:',
        this.textures.roughness
      );
    }

    // Apply metallic map
    if (this.textures.metallic && !material.metalnessMap) {
      const metallicTexture = this.textureLoader.load(this.textures.metallic);
      this.configureTexture(metallicTexture, THREE.NoColorSpace);
      material.metalnessMap = metallicTexture;
      material.metalness = 1.0; // Let map control
      console.log('Applied external metallic texture:', this.textures.metallic);
    }

    // Apply ambient occlusion
    if (this.textures.ao && !material.aoMap) {
      const aoTexture = this.textureLoader.load(this.textures.ao);
      this.configureTexture(aoTexture, THREE.NoColorSpace);
      material.aoMap = aoTexture;
      material.aoMapIntensity = 1.0;
      console.log('Applied external AO texture:', this.textures.ao);
    }

    // Apply emission map
    if (this.textures.emission && !material.emissiveMap) {
      const emissionTexture = this.textureLoader.load(this.textures.emission);
      this.configureTexture(emissionTexture, THREE.SRGBColorSpace);
      material.emissiveMap = emissionTexture;
      material.emissiveIntensity = 1.0;
      console.log('Applied external emission texture:', this.textures.emission);
    }

    // Apply lightmap (critical for baked lighting)
    if ((this.textures.lightmap || this.textures.light) && !material.lightMap) {
      const lightmapUrl = this.textures.lightmap || this.textures.light;
      const lightmapTexture = this.textureLoader.load(lightmapUrl);
      this.configureTexture(lightmapTexture, THREE.SRGBColorSpace);
      material.lightMap = lightmapTexture;
      material.lightMapIntensity = 1.0;

      // Reduce AO when lightmaps are present to avoid double-darkening
      if (material.aoMap) {
        material.aoMapIntensity = 0.3;
      }
      console.log('Applied external lightmap texture:', lightmapUrl);
    }

    material.needsUpdate = true;
  }

  private isLowQualityTexture(texture: THREE.Texture): boolean {
    if (!texture.image) return true;

    if (texture.image.width && texture.image.height) {
      // Replace very small textures (likely placeholders)
      const isTiny = texture.image.width <= 16 || texture.image.height <= 16;
      const isSquareSmall =
        texture.image.width <= 64 &&
        texture.image.height <= 64 &&
        texture.image.width === texture.image.height;
      return isTiny || isSquareSmall;
    }

    return false;
  }

  public finalizeModel(
    model: THREE.Object3D,
    hasEmbeddedMaterials: boolean,
    fileType: string = 'obj'
  ): void {
    console.log('ModelFinalizer: Starting comprehensive model finalization', {
      hasEmbeddedMaterials,
      externalTextureCount: Object.keys(this.textures).length,
      fileType,
    });

    // First pass: collect all materials and analyze them
    const allMaterials = new Set<THREE.Material>();
    const meshes: Array<{
      mesh: THREE.Mesh;
      hasVertexColors: boolean;
      materialCount: number;
    }> = [];

    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const hasVertexColors = this.hasVertexColors(child.geometry);
        const materialCount = Array.isArray(child.material)
          ? child.material.length
          : 1;

        meshes.push({ mesh: child, hasVertexColors, materialCount });

        // Collect all materials
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => allMaterials.add(mat));
        } else {
          allMaterials.add(child.material);
        }

        console.log(`Found mesh: ${child.name || 'unnamed'}`, {
          hasVertexColors,
          materialCount,
          geometryType: child.geometry.type,
          vertexCount: child.geometry.attributes.position?.count || 0,
          hasNormals: !!child.geometry.attributes.normal,
          hasUVs: !!child.geometry.attributes.uv,
          materialTypes: Array.isArray(child.material)
            ? child.material.map((m) => m.type).join(', ')
            : child.material?.type || 'none',
        });
      }
    });

    // This is critical for OBJ files that often have default white materials
    this.replaceDefaultMaterials(
      Array.from(allMaterials),
      hasEmbeddedMaterials
    );

    // From modelfinalization.js: sets material.vertexColors based on triangle analysis
    this.finalizeMaterialVertexColors(Array.from(allMaterials), meshes);

    console.log(`Processing ${meshes.length} meshes...`);

    meshes.forEach(({ mesh, hasVertexColors, materialCount }) => {
      this.processMesh(mesh, hasVertexColors, hasEmbeddedMaterials, fileType);
    });

    console.log('ModelFinalizer: Model finalization complete');
  }

  // From modelfinalization.js lines 29-54: analyzes triangles to set material.vertexColors
  private finalizeMaterialVertexColors(
    allMaterials: THREE.Material[],
    meshes: Array<{
      mesh: THREE.Mesh;
      hasVertexColors: boolean;
      materialCount: number;
    }>
  ): void {
    console.log('Finalizing material vertex colors (pattern)...');

    // Create a map to track which materials have vertex colors
    const materialHasVertexColors = new Map<THREE.Material, boolean>();

    // Analyze each mesh to determine vertex color usage per material
    meshes.forEach(({ mesh, hasVertexColors }) => {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => {
          if (!materialHasVertexColors.has(material)) {
            materialHasVertexColors.set(material, hasVertexColors);
          } else if (!hasVertexColors) {
            // If any mesh using this material doesn't have vertex colors, set to false
            materialHasVertexColors.set(material, false);
          }
        });
      } else {
        const material = mesh.material;
        if (!materialHasVertexColors.has(material)) {
          materialHasVertexColors.set(material, hasVertexColors);
        } else if (!hasVertexColors) {
          materialHasVertexColors.set(material, false);
        }
      }
    });

    // Apply the vertex color settings to materials
    materialHasVertexColors.forEach((hasVertexColors, material) => {
      (material as any).vertexColors = hasVertexColors;
      console.log(`Set material vertex colors:`, {
        materialName: material.name || 'unnamed',
        vertexColors: hasVertexColors,
      });
    });
  }

  private replaceDefaultMaterials(
    materials: THREE.Material[],
    hasEmbeddedMaterials: boolean
  ): void {
    if (hasEmbeddedMaterials) {
      console.log(
        'Model has embedded materials, skipping default material replacement'
      );
      return;
    }

    console.log(
      `Replacing default materials (pattern) for ${materials.length} materials`
    );

    materials.forEach((material, index) => {
      const originalColor = (material as any).color
        ? (material as any).color.clone()
        : null;

      // if (material.source === MaterialSource.DefaultFace) { material.color = color; }
      if (this.isDefaultMaterial(material)) {
        (material as any).color = this.convertColorToThreeColor(200, 200, 200);

        (material as any).userData = {
          ...((material as any).userData || {}),
          source: 'DefaultFace',
          isReplacedDefault: true,
        };

        console.log(`Replaced default material ${index} (logic):`, {
          name: material.name || 'unnamed',
          originalColor: originalColor ? originalColor.getHexString() : 'none',
          newColor: (material as any).color.getHexString(),
          materialType: material.type,
          source: 'DefaultFace',
        });
      }
    });
  }

  // Process individual mesh and its materials
  private processMesh(
    mesh: THREE.Mesh,
    hasVertexColors: boolean,
    hasEmbeddedMaterials: boolean,
    fileType: string
  ): void {
    if (Array.isArray(mesh.material)) {
      // Handle multi-material mesh
      const materialArray = mesh.material;
      mesh.material = materialArray.map((mat, index) => {
        console.log(
          `Processing material ${index + 1}/${materialArray.length} for mesh ${
            mesh.name || 'unnamed'
          }`
        );
        return this.processMaterial(
          mat,
          hasVertexColors,
          hasEmbeddedMaterials,
          fileType
        );
      });
    } else {
      // Handle single material mesh
      mesh.material = this.processMaterial(
        mesh.material,
        hasVertexColors,
        hasEmbeddedMaterials,
        fileType
      );
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;

    // Ensure geometry is properly configured
    if (mesh.geometry.attributes.normal === undefined) {
      mesh.geometry.computeVertexNormals();
      console.log(
        `Computed vertex normals for mesh: ${mesh.name || 'unnamed'}`
      );
    }
  }

  private processMaterial(
    material: THREE.Material,
    hasVertexColors: boolean,
    hasEmbeddedMaterials: boolean,
    fileType: string
  ): THREE.MeshStandardMaterial {
    // Convert to MeshStandardMaterial with ALL properties preserved
    const standardMaterial = this.convertToStandardMaterial(
      material,
      hasVertexColors,
      fileType
    );

    // For models without embedded materials (like OBJ), if there's no texture,
    // preserve the original material color. Only set to white when a texture is applied.
    const hasTexture = standardMaterial.map !== null;
    const multiplyDiffuseMap = hasEmbeddedMaterials || hasTexture;

    // Apply external textures only when appropriate:
    // 1. Model doesn't have embedded materials (like OBJ files), OR
    // 2. We have high-quality external textures to improve the model
    const shouldApplyExternalTextures =
      !hasEmbeddedMaterials && Object.keys(this.textures).length > 0;

    if (shouldApplyExternalTextures) {
      this.applyExternalTextures(standardMaterial, hasVertexColors, fileType);
    }

    // set base color to white. This is crucial for proper texture display.
    if (standardMaterial.map && !multiplyDiffuseMap) {
      if (!hasVertexColors) {
        standardMaterial.color.setRGB(1.0, 1.0, 1.0);
        console.log(
          'Applied texture with white base color (non-multiplied diffuse)'
        );
      }
    }

    // For embedded materials with vertex colors, ensure proper setup
    if (hasEmbeddedMaterials && hasVertexColors) {
      standardMaterial.vertexColors = true;
      standardMaterial.color.setRGB(1.0, 1.0, 1.0);
      console.log('Ensured vertex color setup for embedded material');
    }

    return standardMaterial;
  }
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
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      if (isRecording) {
        // During recording, rotate based on recording progress for smooth full circle
        const normalizedProgress = recordingProgress / 100;
        const targetRotation = normalizedProgress * Math.PI * 2;
        groupRef.current.rotation.y = targetRotation;
      } else if (autoRotate) {
        // Normal auto-rotation when not recording
        groupRef.current.rotation.y += delta * rotationSpeed;
      }
    }
  });

  useEffect(() => {
    const loadModel = async () => {
      if (!modelData) return;

      console.log('LoadedModel: Starting enhanced model load', {
        name: modelData.name,
        type: modelData.type,
        hasEmbeddedMaterials: modelData.hasEmbeddedMaterials,
        externalTextureCount: modelData.textures
          ? Object.keys(modelData.textures).length
          : 0,
        internalPath: modelData.internalPath,
      });

      const { url, type, fileLoader } = modelData;
      const manager = new THREE.LoadingManager();

      if (fileLoader) {
        manager.setURLModifier((requestedUrl) => {
          console.log(`LoadingManager: Resolving "${requestedUrl}"`);

          // Main model file - return as-is
          if (requestedUrl === url) {
            console.log(`LoadingManager: Main model file, returning as-is`);
            return requestedUrl;
          }

          const resolvedUrl = fileLoader.getFileBuffer(requestedUrl);
          if (resolvedUrl) {
            console.log(
              `LoadingManager: Resolved via getFileBuffer -> ${resolvedUrl}`
            );
            return resolvedUrl;
          }

          // Special handling for binary files (.bin for GLTF)
          if (requestedUrl.endsWith('.bin')) {
            const filename = requestedUrl.split('/').pop() || requestedUrl;
            const binUrl = fileLoader.getFileBuffer(filename);
            if (binUrl) {
              console.log(`LoadingManager: Found .bin file -> ${binUrl}`);
              return binUrl;
            }
          }

          // Try relative path resolution from model's internal path
          if (modelData.internalPath) {
            const fallbackUrl = fileLoader.resolveUrl(
              modelData.internalPath,
              requestedUrl
            );
            if (fallbackUrl) {
              console.log(
                `LoadingManager: Resolved via fallback -> ${fallbackUrl}`
              );
              return fallbackUrl;
            }
          }

          // Try additional patterns for GLTF/GLB assets
          if (
            requestedUrl.includes('texture') ||
            requestedUrl.includes('image') ||
            requestedUrl.includes('asset')
          ) {
            const patterns = [
              requestedUrl.split('/').pop(),
              requestedUrl.replace(/^.*\//, ''),
              requestedUrl.toLowerCase(),
            ].filter(Boolean);

            for (const pattern of patterns) {
              const patternUrl = fileLoader.getFileBuffer(pattern!);
              if (patternUrl) {
                console.log(
                  `LoadingManager: Found via pattern "${pattern}" -> ${patternUrl}`
                );
                return patternUrl;
              }
            }
          }

          console.log(
            `LoadingManager: No resolution found, returning original: ${requestedUrl}`
          );
          return requestedUrl;
        });
      }

      // Create appropriate loader
      let loader: OBJLoader | FBXLoader | GLTFLoader;

      switch (type) {
        case 'obj': {
          const objLoader = new OBJLoader(manager);

          // Enhanced MTL loading with better error handling
          if (modelData.fileLoader && modelData.mtlPath) {
            try {
              const mtlUrl = modelData.fileLoader.getFileUrl(modelData.mtlPath);
              if (mtlUrl) {
                console.log('Loading MTL file:', mtlUrl);
                const materials = await new MTLLoader(manager).loadAsync(
                  mtlUrl
                );
                materials.preload();
                objLoader.setMaterials(materials);
                console.log('MTL materials loaded and applied successfully');
              } else {
                console.warn(
                  'MTL path found but URL could not be resolved:',
                  modelData.mtlPath
                );
              }
            } catch (error) {
              console.warn('Failed to load MTL file:', error);
              // Continue without MTL - OBJ can still load
            }
          }

          loader = objLoader;
          break;
        }
        case 'fbx':
          loader = new FBXLoader(manager);
          break;
        case 'gltf':
        case 'glb':
          loader = new GLTFLoader(manager);
          break;
        default:
          console.error('Unsupported model type:', type);
          return;
      }

      try {
        console.log('Loading model from URL:', url);
        const startTime = performance.now();

        const loadedData = await loader.loadAsync(url);

        const loadTime = performance.now() - startTime;
        console.log(`Model loaded in ${loadTime.toFixed(2)}ms`);

        // Extract the scene/model object
        const loadedModel = (loadedData as any).scene
          ? (loadedData as any).scene
          : loadedData;

        console.log('Model loaded successfully', {
          type: loadedModel.type,
          children: loadedModel.children.length,
          hasAnimation: (loadedData as any).animations?.length > 0,
          boundingBox: new THREE.Box3().setFromObject(loadedModel),
        });

        // Center the model (preserve scale)
        const boundingBox = new THREE.Box3().setFromObject(loadedModel);
        const center = boundingBox.getCenter(new THREE.Vector3());
        loadedModel.position.sub(center);

        console.log('Model centered, starting finalization...');

        const finalizer = new ModelFinalizer(modelData.textures || {});
        finalizer.finalizeModel(
          loadedModel,
          modelData.hasEmbeddedMaterials || false,
          modelData.type || 'obj'
        );

        console.log('Model finalization complete, setting model state');
        setModel(loadedModel);
      } catch (error) {
        console.error('Error loading model:', error);
        // You could set an error state here for user feedback
      }
    };

    loadModel();
  }, [modelData]);

  if (!model) {
    return null;
  }

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
}
