'use client';

import { useEffect, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as THREE from 'three';
import { ModelData } from '@/app/page';

interface LoadedModelProps {
  modelData: ModelData;
  autoRotate: boolean;
  rotationSpeed: number;
  isRecording?: boolean;
  recordingProgress?: number;
}

// Helper function to configure texture properties for better quality
function configureTexture(
  texture: THREE.Texture,
  colorSpace: THREE.ColorSpace
) {
  texture.colorSpace = colorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.flipY = false;
}

// Helper function to check if a texture should be replaced (low quality indicators)
function shouldReplaceTexture(texture: THREE.Texture): boolean {
  if (!texture.image) return true;

  // Check if texture is very small (likely placeholder)
  if (texture.image.width && texture.image.height) {
    return texture.image.width < 64 || texture.image.height < 64;
  }

  return false;
}
function getTexturePatterns(type: string): string[] {
  const basePatterns: Record<string, string[]> = {
    diffuse: [
      'diffuse',
      'albedo',
      'color',
      'base',
      'diff',
      'col',
      'basecolor',
      'tex',
      'main',
    ],
    albedo: [
      'diffuse',
      'albedo',
      'color',
      'base',
      'diff',
      'col',
      'basecolor',
      'tex',
      'main',
    ],
    normal: ['normal', 'norm', 'bump', 'nrm', 'normalmap', 'bmp'],
    roughness: ['roughness', 'rough', 'rgh', 'roughnessmap'],
    metallic: ['metallic', 'metal', 'metalness', 'met', 'metallicmap'],
    specular: ['specular', 'spec', 'reflection', 'refl', 'specularmap'],
    ao: ['ao', 'ambient', 'occlusion', 'ambientocclusion', 'aomap'],
    opacity: ['opacity', 'alpha', 'transparent', 'mask', 'alphamap'],
    height: ['height', 'displacement', 'disp', 'heightmap', 'parallax'],
    emission: ['emission', 'emissive', 'glow', 'emissivemap'],
    lightmap: [
      'lightmap',
      'light',
      'lighting',
      'baked',
      'illumination',
      'lightingmap',
    ],
    light: [
      'lightmap',
      'light',
      'lighting',
      'baked',
      'illumination',
      'lightingmap',
    ],
  };

  const patterns = basePatterns[type.toLowerCase()] || [type.toLowerCase()];
  const extensions = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'bmp',
    'tga',
    'tiff',
    'webp',
  ];

  const result: string[] = [];
  patterns.forEach((pattern) => {
    extensions.forEach((ext) => {
      result.push(`${pattern}.${ext}`);
      // Also add without extension for partial matching
      result.push(pattern);
    });
  });

  return result;
}

// Helper function to manually apply textures (fallback method)
function applyTexturesManually(
  model: THREE.Object3D,
  textures: Record<string, string>
) {
  const textureLoader = new THREE.TextureLoader();

  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Create a material that preserves original lighting information
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.0,
        transparent: false,
        side: THREE.FrontSide,
        // Reduce emissive when lightmaps are present to avoid over-brightening
        emissive: textures.lightmap || textures.light ? 0x000000 : 0x0a0a0a,
        emissiveIntensity: textures.lightmap || textures.light ? 0.0 : 0.05,
      });

      // Apply textures with proper encoding and settings
      if (textures.diffuse || textures.albedo) {
        const diffuseUrl = textures.diffuse || textures.albedo;
        const diffuseTexture = textureLoader.load(diffuseUrl);
        configureTexture(diffuseTexture, THREE.SRGBColorSpace);
        material.map = diffuseTexture;
        console.log('Applied diffuse texture:', diffuseUrl);
      }

      // Apply lightmap for baked lighting (CRUCIAL for preserving original lighting)
      if (textures.lightmap || textures.light) {
        const lightmapUrl = textures.lightmap || textures.light;
        const lightmapTexture = textureLoader.load(lightmapUrl);
        configureTexture(lightmapTexture, THREE.SRGBColorSpace);
        material.lightMap = lightmapTexture;
        material.lightMapIntensity = 1.0; // Full intensity for lightmaps
        console.log('Applied lightmap texture:', lightmapUrl);

        // When lightmaps are present, reduce ambient lighting contribution
        // to avoid washing out the baked lighting
        material.aoMapIntensity = 0.5; // Reduce AO when lightmaps are present
      }

      if (textures.normal) {
        const normalTexture = textureLoader.load(textures.normal);
        configureTexture(normalTexture, THREE.NoColorSpace);
        material.normalMap = normalTexture;
        material.normalScale.set(0.8, 0.8);
        console.log('Applied normal texture:', textures.normal);
      }

      if (textures.roughness) {
        const roughnessTexture = textureLoader.load(textures.roughness);
        configureTexture(roughnessTexture, THREE.NoColorSpace);
        material.roughnessMap = roughnessTexture;
        material.roughness = 0.8;
        console.log('Applied roughness texture:', textures.roughness);
      }

      if (textures.metallic) {
        const metallicTexture = textureLoader.load(textures.metallic);
        configureTexture(metallicTexture, THREE.NoColorSpace);
        material.metalnessMap = metallicTexture;
        material.metalness = 0.5;
        console.log('Applied metallic texture:', textures.metallic);
      }

      if (textures.ao) {
        const aoTexture = textureLoader.load(textures.ao);
        configureTexture(aoTexture, THREE.NoColorSpace);
        material.aoMap = aoTexture;
        // Reduce AO intensity when lightmaps are present to avoid double-darkening
        material.aoMapIntensity =
          textures.lightmap || textures.light ? 0.3 : 0.8;
        console.log('Applied AO texture:', textures.ao);
      }

      // Ensure material is properly lit
      material.needsUpdate = true;
      child.material = material;
      child.castShadow = !material.lightMap; // Don't cast shadows if using lightmaps
      child.receiveShadow = !material.lightMap; // Don't receive shadows if using lightmaps

      console.log(
        'Applied material with lightmap support to mesh:',
        child.name || 'unnamed',
        {
          hasLightmap: !!material.lightMap,
          lightMapIntensity: material.lightMapIntensity,
        }
      );
    }
  });
}

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
        // recordingProgress goes from 0 to 100 during the entire recording process
        // We want exactly one full rotation that loops perfectly
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
      try {
        let loadedModel: THREE.Object3D;

        switch (modelData.type) {
          case 'gltf':
          case 'glb':
            console.log('Loading GLTF/GLB file:', modelData.url);

            // Create a custom loading manager for GLTF external resources
            const gltfLoadingManager = new THREE.LoadingManager();

            // If we have auxiliary files (for GLTF with external references), set up URL resolver
            if (
              modelData.auxiliaryFiles &&
              Object.keys(modelData.auxiliaryFiles).length > 0
            ) {
              console.log(
                'Setting up GLTF external resource resolver for auxiliary files:',
                Object.keys(modelData.auxiliaryFiles)
              );

              gltfLoadingManager.setURLModifier((url: string) => {
                console.log('GLTF LoadingManager intercepting URL:', url);

                // Extract filename from URL (handle both absolute and relative paths)
                const filename = url.split('/').pop()?.toLowerCase() || '';
                const urlLower = url.toLowerCase();

                // Direct filename match
                if (modelData.auxiliaryFiles![filename]) {
                  console.log(
                    `GLTF: Resolved ${url} -> ${filename} (direct match)`
                  );
                  return modelData.auxiliaryFiles![filename];
                }

                // Check for relative path matches (e.g., "textures/diffuse.jpg")
                for (const [auxPath, blobUrl] of Object.entries(
                  modelData.auxiliaryFiles!
                )) {
                  const auxPathLower = auxPath.toLowerCase();

                  // Exact path match
                  if (urlLower === auxPathLower) {
                    console.log(
                      `GLTF: Resolved ${url} -> ${auxPath} (exact path match)`
                    );
                    return blobUrl;
                  }

                  // URL ends with the auxiliary path
                  if (urlLower.endsWith(auxPathLower)) {
                    console.log(
                      `GLTF: Resolved ${url} -> ${auxPath} (path suffix match)`
                    );
                    return blobUrl;
                  }

                  // Auxiliary path ends with the URL filename
                  if (auxPathLower.endsWith(filename)) {
                    console.log(
                      `GLTF: Resolved ${url} -> ${auxPath} (filename suffix match)`
                    );
                    return blobUrl;
                  }

                  // Check if URL is requesting a texture from textures/ folder
                  if (
                    url.includes('/') &&
                    auxPathLower.includes('textures/') &&
                    auxPathLower.endsWith(filename)
                  ) {
                    console.log(
                      `GLTF: Resolved ${url} -> ${auxPath} (texture folder match)`
                    );
                    return blobUrl;
                  }
                }

                // Try fuzzy matching for common GLTF patterns
                if (filename.endsWith('.bin') || filename === 'scene.bin') {
                  // Find any .bin file
                  for (const [auxPath, blobUrl] of Object.entries(
                    modelData.auxiliaryFiles!
                  )) {
                    if (auxPath.toLowerCase().endsWith('.bin')) {
                      console.log(
                        `GLTF: Resolved ${url} -> ${auxPath} (bin fallback)`
                      );
                      return blobUrl;
                    }
                  }
                }

                // Try matching by just the base filename without extension
                const baseFilename = filename.replace(/\.[^.]+$/, '');
                if (baseFilename) {
                  for (const [auxPath, blobUrl] of Object.entries(
                    modelData.auxiliaryFiles!
                  )) {
                    const auxBasename =
                      auxPath
                        .toLowerCase()
                        .split('/')
                        .pop()
                        ?.replace(/\.[^.]+$/, '') || '';
                    if (auxBasename === baseFilename) {
                      console.log(
                        `GLTF: Resolved ${url} -> ${auxPath} (base filename match)`
                      );
                      return blobUrl;
                    }
                  }
                }

                console.log(
                  `GLTF: Could not resolve external reference: ${url}`
                );
                console.log(
                  'Available auxiliary files:',
                  Object.keys(modelData.auxiliaryFiles!)
                );
                return url; // Return original URL as fallback
              });
            } else {
              console.log(
                'No auxiliary files detected for GLTF - loading as standalone file'
              );
            }

            const gltfLoader = new GLTFLoader(gltfLoadingManager);
            const gltf = await new Promise<any>((resolve, reject) => {
              gltfLoader.load(
                modelData.url,
                (gltf) => {
                  console.log('GLTF loaded successfully:', gltf);
                  resolve(gltf);
                },
                (progress) => {
                  console.log('GLTF loading progress:', progress);
                },
                (error) => {
                  console.error('GLTF loading error:', error);
                  reject(error);
                }
              );
            });
            loadedModel = gltf.scene;

            // Verify the loaded model has content
            console.log('GLTF scene loaded:', {
              children: loadedModel.children.length,
              hasGeometry: loadedModel.children.some(
                (child) => child instanceof THREE.Mesh
              ),
              boundingBox: new THREE.Box3().setFromObject(loadedModel),
              totalMeshes: loadedModel.children.filter(
                (child) => child instanceof THREE.Mesh
              ).length,
            });

            // Log detailed information about the scene structure
            console.log('GLTF scene structure:');
            let childIndex = 0;
            loadedModel.traverse((child) => {
              console.log(
                `  Child ${childIndex++}: ${child.constructor.name} - name: ${
                  child.name || 'unnamed'
                }`
              );
              if (child instanceof THREE.Mesh) {
                console.log(
                  `    Mesh geometry: ${child.geometry ? 'present' : 'missing'}`
                );
                console.log(
                  `    Mesh material: ${
                    child.material ? child.material.constructor.name : 'missing'
                  }`
                );
                if (child.geometry) {
                  console.log(
                    `    Vertices: ${
                      child.geometry.attributes.position?.count || 0
                    }`
                  );
                  console.log(
                    `    Faces: ${
                      child.geometry.index
                        ? child.geometry.index.count / 3
                        : 'no index'
                    }`
                  );
                }
              }
            });

            // GLTF/GLB files often have proper materials already, but they might be too dark
            // Enhance materials for better visibility while preserving embedded lighting
            loadedModel.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material) {
                console.log(`Found GLTF mesh: ${child.name || 'unnamed'}`, {
                  geometry: !!child.geometry,
                  material: child.material.constructor.name,
                  hasTexture: Array.isArray(child.material)
                    ? child.material.some((mat) => mat.map)
                    : !!(child.material as any).map,
                });

                if (Array.isArray(child.material)) {
                  // Handle multiple materials
                  child.material.forEach((mat, index) => {
                    if (mat instanceof THREE.MeshStandardMaterial) {
                      // Check if material has lightmap
                      const hasLightmap = !!mat.lightMap;

                      if (!hasLightmap) {
                        // Only enhance materials without lightmaps
                        const brightness =
                          (mat.color.r + mat.color.g + mat.color.b) / 3;
                        if (brightness < 0.5) {
                          mat.color.multiplyScalar(1.3); // Brighten dark materials
                          console.log(
                            `Brightened GLTF material ${index} on ${
                              child.name || 'unnamed'
                            }`
                          );
                        }

                        // Ensure reasonable material properties
                        if (mat.roughness > 0.9) mat.roughness = 0.7;
                        if (mat.metalness > 0.9) mat.metalness = 0.5;
                      }

                      // Ensure proper color space for textures
                      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;

                      mat.needsUpdate = true;
                    }
                  });
                } else if (
                  child.material instanceof THREE.MeshStandardMaterial
                ) {
                  // Handle single material
                  const mat = child.material;
                  const hasLightmap = !!mat.lightMap;

                  if (!hasLightmap) {
                    // Only enhance materials without lightmaps
                    const brightness =
                      (mat.color.r + mat.color.g + mat.color.b) / 3;
                    if (brightness < 0.5) {
                      mat.color.multiplyScalar(1.3); // Brighten dark materials
                      console.log(
                        `Brightened GLTF material on ${child.name || 'unnamed'}`
                      );
                    }

                    // Ensure reasonable material properties
                    if (mat.roughness > 0.9) mat.roughness = 0.7;
                    if (mat.metalness > 0.9) mat.metalness = 0.5;
                  }

                  // Ensure proper color space for textures
                  if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;

                  mat.needsUpdate = true;
                } else if (child.material instanceof THREE.MeshBasicMaterial) {
                  // Convert basic materials to standard for better lighting
                  const basicMat = child.material;
                  const newMaterial = new THREE.MeshStandardMaterial({
                    color: basicMat.color,
                    map: basicMat.map,
                    transparent: basicMat.transparent,
                    opacity: basicMat.opacity,
                    alphaMap: basicMat.alphaMap,
                    roughness: 0.5,
                    metalness: 0.1,
                  });

                  if (newMaterial.map) {
                    newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                  }

                  child.material = newMaterial;
                  console.log(
                    `Converted GLTF basic material to standard for ${
                      child.name || 'unnamed'
                    }`
                  );
                }

                // Set appropriate shadow behavior
                if (
                  child.material instanceof THREE.MeshStandardMaterial ||
                  (Array.isArray(child.material) &&
                    child.material[0] instanceof THREE.MeshStandardMaterial)
                ) {
                  const hasLightmap = Array.isArray(child.material)
                    ? child.material.some((mat) => mat.lightMap)
                    : !!(child.material as THREE.MeshStandardMaterial).lightMap;

                  child.castShadow = !hasLightmap;
                  child.receiveShadow = !hasLightmap;
                } else {
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              }
            });

            console.log('GLTF material processing complete');
            break;

          case 'obj':
            // Create loading manager for OBJ with texture support
            const objLoadingManager = new THREE.LoadingManager();

            // Set up URL modifier for textures if we have them
            if (
              modelData.textures &&
              Object.keys(modelData.textures).length > 0
            ) {
              objLoadingManager.setURLModifier((url: string) => {
                console.log('OBJ LoadingManager intercepting:', url);

                const filename = url.split('/').pop()?.toLowerCase() || '';
                const nameWithoutExt = filename
                  .replace(/\.(jpg|jpeg|png|gif|bmp|tga)$/i, '')
                  .toLowerCase();

                // Try to match texture by filename patterns
                for (const [type, blobUrl] of Object.entries(
                  modelData.textures!
                )) {
                  const typePatterns = getTexturePatterns(type);

                  for (const pattern of typePatterns) {
                    const patternName = pattern
                      .replace(/\.(jpg|png|gif|jpeg|bmp|tga)$/i, '')
                      .toLowerCase();

                    if (
                      filename.includes(patternName) ||
                      patternName.includes(nameWithoutExt)
                    ) {
                      console.log(
                        `OBJ: Matched ${filename} to ${type} texture`
                      );
                      return blobUrl;
                    }
                  }
                }

                return url;
              });
            }

            const objLoader = new OBJLoader(objLoadingManager);
            loadedModel = await new Promise<THREE.Object3D>(
              (resolve, reject) => {
                objLoader.load(modelData.url, resolve, undefined, reject);
              }
            );

            // Force bright materials for OBJ models (they often come without proper materials)
            loadedModel.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                // Create a Sketchfab-style bright material
                const brightMaterial = new THREE.MeshStandardMaterial({
                  color: 0xffffff,
                  roughness: 0.2, // Lower roughness for more reflectivity
                  metalness: 0.0, // Non-metallic for brighter appearance
                  transparent: false,
                  side: THREE.FrontSide,
                  emissive: 0x101010, // Slight emission for extra brightness
                  emissiveIntensity: 0.1,
                });

                // Apply textures if available
                if (modelData.textures) {
                  const textureLoader = new THREE.TextureLoader();

                  // Check if lightmap is available to adjust lighting strategy
                  const hasLightmap = !!(
                    modelData.textures.lightmap || modelData.textures.light
                  );

                  // Adjust material properties based on lightmap presence
                  if (hasLightmap) {
                    brightMaterial.emissive.setHex(0x000000); // No emission when lightmaps present
                    brightMaterial.emissiveIntensity = 0.0;
                  }

                  if (modelData.textures.diffuse) {
                    const diffuseTexture = textureLoader.load(
                      modelData.textures.diffuse
                    );
                    diffuseTexture.colorSpace = THREE.SRGBColorSpace;
                    diffuseTexture.wrapS = THREE.RepeatWrapping;
                    diffuseTexture.wrapT = THREE.RepeatWrapping;
                    diffuseTexture.flipY = false;
                    brightMaterial.map = diffuseTexture;
                    console.log('Applied diffuse to OBJ mesh:', child.name);
                  }

                  // Apply lightmap for baked lighting (highest priority)
                  if (modelData.textures.lightmap || modelData.textures.light) {
                    const lightmapUrl =
                      modelData.textures.lightmap || modelData.textures.light;
                    const lightmapTexture = textureLoader.load(lightmapUrl);
                    lightmapTexture.colorSpace = THREE.SRGBColorSpace;
                    lightmapTexture.wrapS = THREE.RepeatWrapping;
                    lightmapTexture.wrapT = THREE.RepeatWrapping;
                    lightmapTexture.flipY = false;
                    brightMaterial.lightMap = lightmapTexture;
                    brightMaterial.lightMapIntensity = 1.0;
                    console.log(
                      'Applied lightmap to OBJ mesh:',
                      child.name,
                      lightmapUrl
                    );
                  }

                  if (modelData.textures.normal) {
                    const normalTexture = textureLoader.load(
                      modelData.textures.normal
                    );
                    normalTexture.colorSpace = THREE.NoColorSpace;
                    normalTexture.wrapS = THREE.RepeatWrapping;
                    normalTexture.wrapT = THREE.RepeatWrapping;
                    brightMaterial.normalMap = normalTexture;
                    brightMaterial.normalScale.set(0.8, 0.8);
                  }

                  if (modelData.textures.roughness) {
                    const roughnessTexture = textureLoader.load(
                      modelData.textures.roughness
                    );
                    roughnessTexture.colorSpace = THREE.NoColorSpace;
                    brightMaterial.roughnessMap = roughnessTexture;
                    brightMaterial.roughness = 0.8;
                  }

                  if (modelData.textures.metallic) {
                    const metallicTexture = textureLoader.load(
                      modelData.textures.metallic
                    );
                    metallicTexture.colorSpace = THREE.NoColorSpace;
                    brightMaterial.metalnessMap = metallicTexture;
                    brightMaterial.metalness = 0.5;
                  }

                  // Adjust shadow behavior based on lightmap presence
                  child.castShadow = !hasLightmap;
                  child.receiveShadow = !hasLightmap;
                } else {
                  // For OBJ without textures, use an even brighter base color
                  brightMaterial.color.setHex(0xeeeeee);
                  brightMaterial.emissive.setHex(0x202020);
                  brightMaterial.emissiveIntensity = 0.15;
                }

                child.material = brightMaterial;
                child.castShadow = true;
                child.receiveShadow = true;

                console.log(
                  'Applied Sketchfab-style bright material to OBJ mesh:',
                  child.name || 'unnamed'
                );
              }
            });
            break;

          case 'fbx':
            console.log('Loading FBX file:', modelData.url);

            // Create a custom loading manager for FBX texture support
            const fbxLoadingManager = new THREE.LoadingManager();

            // Set up URL modifier for textures if we have them
            if (
              modelData.textures &&
              Object.keys(modelData.textures).length > 0
            ) {
              console.log(
                'Setting up FBX texture resolver for:',
                Object.keys(modelData.textures)
              );

              fbxLoadingManager.setURLModifier((url: string) => {
                console.log('FBX LoadingManager intercepting:', url);

                const filename = url.split('/').pop()?.toLowerCase() || '';
                const nameWithoutExt = filename
                  .replace(/\.(jpg|jpeg|png|gif|bmp|tga|tiff|webp)$/i, '')
                  .toLowerCase();

                console.log(
                  `Searching for FBX texture: ${filename} (base: ${nameWithoutExt})`
                );

                // 1. Exact filename match
                for (const [type, blobUrl] of Object.entries(
                  modelData.textures!
                )) {
                  if (
                    filename === type.toLowerCase() + '.jpg' ||
                    filename === type.toLowerCase() + '.png' ||
                    filename === type.toLowerCase() + '.jpeg'
                  ) {
                    console.log(
                      `FBX: Exact filename match ${filename} to ${type} texture`
                    );
                    return blobUrl;
                  }
                }

                // 2. Pattern-based matching
                for (const [type, blobUrl] of Object.entries(
                  modelData.textures!
                )) {
                  const typePatterns = getTexturePatterns(type);

                  for (const pattern of typePatterns) {
                    const patternName = pattern
                      .replace(/\.(jpg|png|gif|jpeg|bmp|tga|tiff|webp)$/i, '')
                      .toLowerCase();

                    // Check multiple variations
                    if (
                      filename.includes(patternName) ||
                      patternName.includes(nameWithoutExt) ||
                      nameWithoutExt.includes(patternName) ||
                      // Check for common variations
                      (patternName === 'diffuse' &&
                        (nameWithoutExt.includes('color') ||
                          nameWithoutExt.includes('albedo'))) ||
                      (patternName === 'normal' &&
                        nameWithoutExt.includes('norm')) ||
                      (patternName === 'roughness' &&
                        nameWithoutExt.includes('rough'))
                    ) {
                      console.log(
                        `FBX: Pattern match ${filename} to ${type} texture via pattern ${patternName}`
                      );
                      return blobUrl;
                    }
                  }
                }

                // 3. Fuzzy matching with texture type names
                for (const [type, blobUrl] of Object.entries(
                  modelData.textures!
                )) {
                  if (
                    filename.includes(type.toLowerCase()) ||
                    nameWithoutExt.includes(type.toLowerCase()) ||
                    type.toLowerCase().includes(nameWithoutExt)
                  ) {
                    console.log(
                      `FBX: Fuzzy match ${filename} to ${type} texture`
                    );
                    return blobUrl;
                  }
                }

                // 4. Last resort: if it's the only texture of a reasonable size, use it as diffuse
                const textureKeys = Object.keys(modelData.textures!);
                if (
                  textureKeys.length === 1 &&
                  !nameWithoutExt.includes('normal') &&
                  !nameWithoutExt.includes('bump')
                ) {
                  console.log(
                    `FBX: Last resort - using ${filename} as single available texture`
                  );
                  return modelData.textures![textureKeys[0]];
                }

                console.log(
                  `FBX: No match found for ${url}, available textures:`,
                  textureKeys
                );
                return url;
              });
            } else {
              console.log('No external textures available for FBX');
            }

            const fbxLoader = new FBXLoader(fbxLoadingManager);
            loadedModel = await new Promise<THREE.Object3D>(
              (resolve, reject) => {
                fbxLoader.load(
                  modelData.url,
                  (fbx) => {
                    console.log('FBX loaded successfully:', fbx);
                    resolve(fbx);
                  },
                  (progress) => {
                    console.log('FBX loading progress:', progress);
                  },
                  (error) => {
                    console.error('FBX loading error:', error);
                    reject(error);
                  }
                );
              }
            );

            // Log FBX structure and materials
            console.log('FBX model structure:');
            let fbxMeshCount = 0;
            loadedModel.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                fbxMeshCount++;
                console.log(
                  `FBX Mesh ${fbxMeshCount}: ${child.name || 'unnamed'}`,
                  {
                    material: child.material
                      ? child.material.constructor.name
                      : 'no material',
                    hasTexture:
                      child.material &&
                      (Array.isArray(child.material)
                        ? child.material.some((mat) => mat.map)
                        : !!(child.material as any).map),
                    geometry: !!child.geometry,
                  }
                );
              }
            });

            // Post-process FBX materials for better lighting support
            loadedModel.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                // Check UV coordinates first - essential for texture mapping
                if (child.geometry && !child.geometry.attributes.uv) {
                  console.warn(
                    `FBX mesh ${
                      child.name || 'unnamed'
                    } has no UV coordinates - generating basic UVs`
                  );
                  // Generate basic UV coordinates for models without them
                  const geometry = child.geometry;
                  const positions = geometry.attributes.position;
                  const uvs = new Float32Array(positions.count * 2);

                  for (let i = 0; i < positions.count; i++) {
                    // Simple planar projection - better than no UVs
                    uvs[i * 2] = (positions.getX(i) + 1) / 2;
                    uvs[i * 2 + 1] = (positions.getY(i) + 1) / 2;
                  }

                  geometry.setAttribute(
                    'uv',
                    new THREE.BufferAttribute(uvs, 2)
                  );
                  console.log(
                    `Generated UV coordinates for ${child.name || 'unnamed'}`
                  );
                }

                // Convert material types for better lighting, but preserve existing properties
                if (Array.isArray(child.material)) {
                  // Handle multiple materials
                  child.material.forEach((mat, index) => {
                    if (
                      mat instanceof THREE.MeshLambertMaterial ||
                      mat instanceof THREE.MeshPhongMaterial
                    ) {
                      // Convert Lambert/Phong to Standard for better lighting
                      const newMaterial = new THREE.MeshStandardMaterial({
                        color: mat.color,
                        map: mat.map,
                        normalMap: (mat as any).normalMap,
                        transparent: mat.transparent,
                        opacity: mat.opacity,
                        roughness: 0.5,
                        metalness: 0.1,
                      });

                      if (newMaterial.map) {
                        newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                      }

                      child.material[index] = newMaterial;
                      console.log(
                        `Converted FBX ${
                          mat.constructor.name
                        } to MeshStandardMaterial for ${
                          child.name || 'unnamed'
                        }[${index}]`
                      );
                    } else if (mat instanceof THREE.MeshBasicMaterial) {
                      // Convert basic materials to standard
                      const newMaterial = new THREE.MeshStandardMaterial({
                        color: mat.color,
                        map: mat.map,
                        transparent: mat.transparent,
                        opacity: mat.opacity,
                        roughness: 0.4,
                        metalness: 0.1,
                      });

                      if (newMaterial.map) {
                        newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                      }

                      child.material[index] = newMaterial;
                      console.log(
                        `Converted FBX MeshBasicMaterial to MeshStandardMaterial for ${
                          child.name || 'unnamed'
                        }[${index}]`
                      );
                    }
                  });
                } else if (child.material) {
                  // Handle single material
                  if (
                    child.material instanceof THREE.MeshLambertMaterial ||
                    child.material instanceof THREE.MeshPhongMaterial
                  ) {
                    // Convert Lambert/Phong to Standard for better lighting
                    const oldMaterial = child.material;
                    const newMaterial = new THREE.MeshStandardMaterial({
                      color: oldMaterial.color,
                      map: oldMaterial.map,
                      normalMap: (oldMaterial as any).normalMap,
                      transparent: oldMaterial.transparent,
                      opacity: oldMaterial.opacity,
                      roughness: 0.5,
                      metalness: 0.1,
                    });

                    if (newMaterial.map) {
                      newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                    }

                    child.material = newMaterial;
                    console.log(
                      `Converted FBX ${
                        oldMaterial.constructor.name
                      } to MeshStandardMaterial for ${child.name || 'unnamed'}`
                    );
                  } else if (
                    child.material instanceof THREE.MeshBasicMaterial
                  ) {
                    // Convert basic materials to standard
                    const basicMat = child.material;
                    const newMaterial = new THREE.MeshStandardMaterial({
                      color: basicMat.color,
                      map: basicMat.map,
                      transparent: basicMat.transparent,
                      opacity: basicMat.opacity,
                      roughness: 0.4,
                      metalness: 0.1,
                    });

                    if (newMaterial.map) {
                      newMaterial.map.colorSpace = THREE.SRGBColorSpace;
                    }

                    child.material = newMaterial;
                    console.log(
                      `Converted FBX MeshBasicMaterial to MeshStandardMaterial for ${
                        child.name || 'unnamed'
                      }`
                    );
                  }
                }

                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            break;

          default:
            throw new Error(`Unsupported model type: ${modelData.type}`);
        }

        // Handle texture application based on whether model has embedded materials
        if (
          modelData.textures &&
          Object.keys(modelData.textures).length > 0 &&
          !['obj'].includes(modelData.type)
        ) {
          console.log('Available textures:', Object.keys(modelData.textures));
          console.log('Texture URLs:', modelData.textures);

          if (modelData.type === 'gltf' || modelData.type === 'glb') {
            // For GLTF/GLB, only apply textures manually if the model doesn't have good embedded materials
            // Check if model has any materials with textures
            let hasEmbeddedTextures = false;
            loadedModel.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material) {
                if (Array.isArray(child.material)) {
                  hasEmbeddedTextures = child.material.some((mat) => mat.map);
                } else {
                  hasEmbeddedTextures = !!(child.material as any).map;
                }
              }
            });

            if (!hasEmbeddedTextures) {
              console.log(
                'GLTF/GLB has no embedded textures, applying external textures manually'
              );
              applyTexturesManually(loadedModel, modelData.textures);
            } else {
              console.log('GLTF/GLB has embedded textures, preserving them');
            }
          } else if (modelData.type === 'fbx') {
            // For FBX, check if textures were successfully applied by LoadingManager
            let hasAnyTextures = false;
            loadedModel.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material) {
                if (Array.isArray(child.material)) {
                  hasAnyTextures = child.material.some((mat) => mat.map);
                } else {
                  hasAnyTextures = !!(child.material as any).map;
                }
              }
            });

            if (!hasAnyTextures) {
              console.log(
                'FBX LoadingManager failed to apply textures, applying manually'
              );
              applyTexturesManually(loadedModel, modelData.textures);
            } else {
              console.log('FBX LoadingManager successfully applied textures');
            }
          }
        } else if (modelData.hasEmbeddedMaterials) {
          // Model has embedded materials - preserve them but enhance for better lighting
          console.log(
            'Model has embedded materials, preserving and enhancing existing materials'
          );
          loadedModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              // Preserve existing materials but ensure they're bright enough
              if (child.material instanceof THREE.MeshStandardMaterial) {
                // Check if material already has a lightmap
                const hasEmbeddedLightmap = !!child.material.lightMap;

                // Only adjust if material seems too dark or has poor lighting properties
                const currentColor = child.material.color.getHex();
                const brightness =
                  (child.material.color.r +
                    child.material.color.g +
                    child.material.color.b) /
                  3;

                if (brightness < 0.3 && !hasEmbeddedLightmap) {
                  // Material is too dark and has no lightmap, brighten it
                  child.material.color.multiplyScalar(1.5);
                  console.log(
                    `Brightened dark embedded material on ${
                      child.name || 'unnamed'
                    }`
                  );
                }

                // Ensure reasonable lighting properties only if no lightmap
                if (!hasEmbeddedLightmap) {
                  if (child.material.roughness > 0.8) {
                    child.material.roughness = 0.7; // Not too rough
                  }
                  if (child.material.metalness > 0.8) {
                    child.material.metalness = 0.3; // Reduce excessive metalness
                  }
                }

                // Ensure proper texture color space if textures exist
                if (child.material.map) {
                  child.material.map.colorSpace = THREE.SRGBColorSpace;
                }

                // Preserve lightmap settings if they exist
                if (hasEmbeddedLightmap) {
                  console.log(
                    `Preserving embedded lightmap on ${child.name || 'unnamed'}`
                  );
                  // Don't add emission or change shadow settings for lightmapped objects
                  child.castShadow = false;
                  child.receiveShadow = false;
                } else {
                  // Only adjust shadows for non-lightmapped objects
                  child.castShadow = true;
                  child.receiveShadow = true;
                }

                child.material.needsUpdate = true;
              } else if (child.material instanceof THREE.MeshBasicMaterial) {
                // Convert basic materials to standard for better lighting
                const newMaterial = new THREE.MeshStandardMaterial({
                  color: child.material.color,
                  map: child.material.map,
                  transparent: child.material.transparent,
                  opacity: child.material.opacity,
                  roughness: 0.4,
                  metalness: 0.1,
                });
                child.material = newMaterial;
                child.castShadow = true;
                child.receiveShadow = true;
                console.log(
                  `Converted basic material to standard for ${
                    child.name || 'unnamed'
                  }`
                );
              } else {
                // For other material types, ensure shadows are appropriate
                child.castShadow = true;
                child.receiveShadow = true;
              }
            }
          });
        } else {
          // Apply extremely bright default materials for models without textures (Sketchfab style)
          console.log(
            'Applying Sketchfab-style bright default materials for model without textures'
          );
          loadedModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (child.material) {
                // Improve existing materials and make them extremely bright
                if (child.material instanceof THREE.MeshStandardMaterial) {
                  // Make materials extremely bright and reflective
                  child.material.roughness = 0.1; // Very low roughness for shininess
                  child.material.metalness = 0.0; // Non-metallic for brightness
                  child.material.color.set(0xffffff); // Pure white
                  child.material.emissive.set(0x404040); // Strong emission for brightness
                  child.material.emissiveIntensity = 0.2;
                } else if (child.material instanceof THREE.MeshBasicMaterial) {
                  // Convert basic materials to extremely bright standard materials
                  const newMaterial = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    map: child.material.map,
                    transparent: child.material.transparent,
                    opacity: child.material.opacity,
                    roughness: 0.1,
                    metalness: 0.0,
                    emissive: 0x404040,
                    emissiveIntensity: 0.2,
                  });
                  child.material = newMaterial;
                } else {
                  // For other material types, create an extremely bright standard material
                  child.material = new THREE.MeshStandardMaterial({
                    color: 0xffffff, // Pure white
                    roughness: 0.1, // Very reflective
                    metalness: 0.0, // Non-metallic
                    emissive: 0x404040, // Strong emission
                    emissiveIntensity: 0.2,
                  });
                }
                child.material.needsUpdate = true;
                child.castShadow = true;
                child.receiveShadow = true;
              } else {
                // Create an extremely bright material if none exists
                child.material = new THREE.MeshStandardMaterial({
                  color: 0xffffff,
                  roughness: 0.1,
                  metalness: 0.0,
                  emissive: 0x404040,
                  emissiveIntensity: 0.2,
                });
                child.castShadow = true;
                child.receiveShadow = true;
              }

              console.log(
                'Applied extremely bright Sketchfab-style material to mesh:',
                child.name || 'unnamed',
                {
                  color: child.material.color?.getHex(),
                  roughness: child.material.roughness,
                  metalness: child.material.metalness,
                  emissive: child.material.emissive?.getHex(),
                  emissiveIntensity: child.material.emissiveIntensity,
                }
              );
            }
          });
        }

        // Debug: Log the final model structure and materials
        console.log('Final loaded model:', loadedModel);
        loadedModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            console.log('Mesh found:', {
              name: child.name || 'unnamed',
              material: child.material,
              materialType: child.material?.constructor.name,
              color: child.material?.color?.getHex(),
              roughness: child.material?.roughness,
              metalness: child.material?.metalness,
              map: child.material?.map ? 'has texture' : 'no texture',
            });
          }
        });

        // Scale model to fit in scene (made even larger)
        const box = new THREE.Box3().setFromObject(loadedModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 5 / maxDim;
        loadedModel.scale.setScalar(scale);

        // Recalculate bounding box after scaling
        loadedModel.updateMatrixWorld(true);
        const scaledBox = new THREE.Box3().setFromObject(loadedModel);
        const scaledSize = scaledBox.getSize(new THREE.Vector3());
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        // Center the model at origin (0,0,0) for proper rotation
        loadedModel.position.set(
          -scaledCenter.x,
          -scaledCenter.y,
          -scaledCenter.z
        );

        // Position the model so its bottom sits on the ground plane (y=0)
        loadedModel.position.y += scaledSize.y / 2;

        setModel(loadedModel);
      } catch (error) {
        console.error('Error loading model:', error);
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
