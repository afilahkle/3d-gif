import JSZip from 'jszip';
import { ModelData } from '@/app/page';

export async function handleFileUpload(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ModelData> {
  onProgress?.(10);

  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  if (fileExtension === 'zip') {
    return handleZipFile(file, onProgress);
  } else if (['obj', 'fbx', 'gltf', 'glb'].includes(fileExtension || '')) {
    return handleDirectModelFile(file, onProgress);
  } else {
    throw new Error(`Unsupported file format: ${fileExtension}`);
  }
}

async function handleDirectModelFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ModelData> {
  onProgress?.(50);

  const url = URL.createObjectURL(file);
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  onProgress?.(100);

  // Direct model files often have embedded materials, especially FBX, GLB, GLTF
  const hasEmbeddedMaterials = ['fbx', 'glb', 'gltf'].includes(extension);

  return {
    url,
    name: file.name,
    type: extension,
    hasEmbeddedMaterials,
  };
}

async function handleZipFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ModelData> {
  onProgress?.(20);

  const zip = new JSZip();
  const zipContent = await zip.loadAsync(file);

  onProgress?.(40);

  // Look for model files in the ZIP (check root first, then source folder)
  let modelFile: JSZip.JSZipObject | null = null;
  let modelType = '';
  let activeZipForResources = zipContent;

  console.log('ZIP contents:', Object.keys(zipContent.files));

  // First, try to find model files directly in the root of the ZIP
  for (const [path, file] of Object.entries(zipContent.files)) {
    if (!file.dir) {
      const ext = path.split('.').pop()?.toLowerCase();
      if (['obj', 'fbx', 'gltf', 'glb'].includes(ext || '')) {
        modelFile = file;
        modelType = ext || '';
        console.log(`Found model file in root: ${path} (${modelType})`);
        break;
      }
    }
  }

  // If no model found in root, look for source folder
  if (!modelFile) {
    const sourceFolder = zipContent.folder('source');

    if (sourceFolder) {
      console.log('Checking source folder for model files');

      // Check for nested zip in source folder
      const sourceFiles = Object.keys(sourceFolder.files);
      const nestedZip = sourceFiles.find((path) => path.endsWith('.zip'));

      if (nestedZip) {
        // Handle nested zip
        const nestedZipFile = sourceFolder.files[nestedZip];
        const nestedZipContent = await nestedZipFile.async('arraybuffer');
        const nestedZipParsed = await zip.loadAsync(nestedZipContent);
        activeZipForResources = nestedZipParsed; // Resources are in the nested zip

        // Find model in nested zip
        for (const [path, file] of Object.entries(nestedZipParsed.files)) {
          if (!file.dir) {
            const ext = path.split('.').pop()?.toLowerCase();
            if (['obj', 'fbx', 'gltf', 'glb'].includes(ext || '')) {
              modelFile = file;
              modelType = ext || '';
              console.log(
                `Found model file in nested zip: ${path} (${modelType})`
              );
              break;
            }
          }
        }
      } else {
        // Find model directly in source folder
        for (const [path, file] of Object.entries(sourceFolder.files)) {
          if (!file.dir) {
            const ext = path.split('.').pop()?.toLowerCase();
            if (['obj', 'fbx', 'gltf', 'glb'].includes(ext || '')) {
              modelFile = file;
              modelType = ext || '';
              console.log(
                `Found model file in source folder: ${path} (${modelType})`
              );
              break;
            }
          }
        }
      }
    }
  }

  if (!modelFile) {
    console.error('Available files in ZIP:', Object.keys(zipContent.files));
    throw new Error(
      'No supported 3D model found in the ZIP file. Expected: obj, fbx, gltf, or glb files.'
    );
  }

  onProgress?.(60);

  onProgress?.(80);

  // Extract model file
  const modelBlob = new Blob([await modelFile.async('arraybuffer')]);
  const modelUrl = URL.createObjectURL(modelBlob);

  // For GLTF models, we need to extract all auxiliary files (.bin, textures) to support external references
  let auxiliaryFiles: Record<string, string> = {};

  if (modelType === 'gltf') {
    console.log(
      'GLTF model detected - extracting auxiliary files for external references'
    );

    // Extract all files from the active zip that could be referenced by GLTF
    for (const [path, file] of Object.entries(activeZipForResources.files)) {
      if (!file.dir) {
        const fileName = path.split('/').pop()?.toLowerCase() || '';
        const ext = fileName.split('.').pop()?.toLowerCase();

        // Extract .bin files (GLTF binary data)
        if (ext === 'bin') {
          const binBlob = new Blob([await file.async('arraybuffer')]);
          const binUrl = URL.createObjectURL(binBlob);
          auxiliaryFiles[fileName] = binUrl;
          console.log(`Extracted GLTF binary file: ${fileName}`);
        }
        // Extract image files that could be textures
        else if (
          ['jpg', 'jpeg', 'png', 'bmp', 'tga', 'gif'].includes(ext || '')
        ) {
          const imageBlob = new Blob([await file.async('arraybuffer')]);
          const imageUrl = URL.createObjectURL(imageBlob);
          auxiliaryFiles[fileName] = imageUrl;

          // Also store with relative paths that GLTF might reference
          const relativePath = path.toLowerCase();
          if (relativePath.includes('textures/')) {
            auxiliaryFiles[relativePath] = imageUrl;
            auxiliaryFiles[relativePath.replace('textures/', '')] = imageUrl;
          }

          console.log(
            `Extracted GLTF texture file: ${fileName} (also as ${relativePath})`
          );
        }
      }
    }
  }

  // Extract textures if available (check both textures folder and source folder)
  let textures: Record<string, string> = {};

  // Function to process texture files from any folder
  const processTextureFiles = async (
    folder: JSZip | null,
    folderName: string = ''
  ) => {
    if (!folder) return;

    for (const [path, file] of Object.entries(folder.files)) {
      if (!file.dir) {
        const fileName = path.split('/').pop()?.toLowerCase() || '';
        const ext = fileName.split('.').pop();

        if (['jpg', 'jpeg', 'png', 'bmp', 'tga', 'gif'].includes(ext || '')) {
          const textureBlob = new Blob([await file.async('arraybuffer')]);
          const textureUrl = URL.createObjectURL(textureBlob);

          // More comprehensive texture categorization
          const nameWithoutExt = fileName
            .replace(/\.(jpg|jpeg|png|bmp|tga|gif)$/i, '')
            .toLowerCase();

          // Diffuse/Albedo textures
          if (
            nameWithoutExt.includes('diffuse') ||
            nameWithoutExt.includes('albedo') ||
            nameWithoutExt.includes('color') ||
            nameWithoutExt.includes('base') ||
            nameWithoutExt.includes('diff') ||
            nameWithoutExt.includes('col') ||
            nameWithoutExt.includes('basecolor') ||
            nameWithoutExt.includes('tex') ||
            nameWithoutExt.includes('main')
          ) {
            textures.diffuse = textureUrl;
          }
          // Normal maps
          else if (
            nameWithoutExt.includes('normal') ||
            nameWithoutExt.includes('norm') ||
            nameWithoutExt.includes('bump') ||
            nameWithoutExt.includes('nrm') ||
            nameWithoutExt.includes('normalmap') ||
            nameWithoutExt.includes('bmp')
          ) {
            textures.normal = textureUrl;
          }
          // Roughness maps
          else if (
            nameWithoutExt.includes('roughness') ||
            nameWithoutExt.includes('rough') ||
            nameWithoutExt.includes('rgh') ||
            nameWithoutExt.includes('roughnessmap')
          ) {
            textures.roughness = textureUrl;
          }
          // Metallic maps
          else if (
            nameWithoutExt.includes('metallic') ||
            nameWithoutExt.includes('metal') ||
            nameWithoutExt.includes('metalness') ||
            nameWithoutExt.includes('met') ||
            nameWithoutExt.includes('metallicmap')
          ) {
            textures.metallic = textureUrl;
          }
          // Specular maps
          else if (
            nameWithoutExt.includes('specular') ||
            nameWithoutExt.includes('spec') ||
            nameWithoutExt.includes('reflection') ||
            nameWithoutExt.includes('refl') ||
            nameWithoutExt.includes('specularmap')
          ) {
            textures.specular = textureUrl;
          }
          // Ambient Occlusion
          else if (
            nameWithoutExt.includes('ao') ||
            nameWithoutExt.includes('ambient') ||
            nameWithoutExt.includes('occlusion') ||
            nameWithoutExt.includes('ambientocclusion') ||
            nameWithoutExt.includes('aomap')
          ) {
            textures.ao = textureUrl;
          }
          // Opacity/Alpha
          else if (
            nameWithoutExt.includes('opacity') ||
            nameWithoutExt.includes('alpha') ||
            nameWithoutExt.includes('transparent') ||
            nameWithoutExt.includes('mask') ||
            nameWithoutExt.includes('alphamap')
          ) {
            textures.opacity = textureUrl;
          }
          // Height/Displacement
          else if (
            nameWithoutExt.includes('height') ||
            nameWithoutExt.includes('displacement') ||
            nameWithoutExt.includes('disp') ||
            nameWithoutExt.includes('heightmap') ||
            nameWithoutExt.includes('parallax')
          ) {
            textures.height = textureUrl;
          }
          // Emission
          else if (
            nameWithoutExt.includes('emission') ||
            nameWithoutExt.includes('emissive') ||
            nameWithoutExt.includes('glow') ||
            nameWithoutExt.includes('emissivemap')
          ) {
            textures.emission = textureUrl;
          }
          // Lightmap/Baked lighting (IMPORTANT for preserving original lighting)
          else if (
            nameWithoutExt.includes('lightmap') ||
            nameWithoutExt.includes('light') ||
            nameWithoutExt.includes('lighting') ||
            nameWithoutExt.includes('baked') ||
            nameWithoutExt.includes('illumination') ||
            nameWithoutExt.includes('lightingmap')
          ) {
            textures.lightmap = textureUrl;
            console.log(`Found lightmap texture: ${fileName} -> lightmap`);
          }
          // Default fallback - use first texture as diffuse if no diffuse found (especially useful for FBX)
          else if (!textures.diffuse && modelType !== 'gltf') {
            // For non-GLTF models, use fallback logic, but be more aggressive for FBX
            if (
              modelType === 'fbx' ||
              (!nameWithoutExt.includes('normal') &&
                !nameWithoutExt.includes('rough') &&
                !nameWithoutExt.includes('metal'))
            ) {
              console.log(
                `Using texture ${fileName} as diffuse (fallback) from ${folderName}`
              );
              textures.diffuse = textureUrl;
            }
          }
          // For FBX models, be more permissive with texture assignment
          else if (modelType === 'fbx' && Object.keys(textures).length === 0) {
            console.log(
              `FBX fallback: Using texture ${fileName} as diffuse from ${folderName}`
            );
            textures.diffuse = textureUrl;
          }

          console.log(
            `Extracted texture: ${fileName} -> type: ${
              Object.keys(textures).find(
                (key) => textures[key] === textureUrl
              ) || 'unknown'
            } from ${folderName}`
          );
        }
      }
    }
  };

  // Process textures from dedicated textures folder (for non-GLTF models or as fallback)
  const texturesFolder = zipContent.folder('textures');
  if (texturesFolder && modelType !== 'gltf') {
    console.log('Processing textures from dedicated textures folder');
    await processTextureFiles(texturesFolder, 'textures folder');
  }

  // Also check for textures in the source folder (common when models have embedded materials)
  const sourceFolder = zipContent.folder('source');
  if (
    sourceFolder &&
    Object.keys(textures).length === 0 &&
    modelType !== 'gltf'
  ) {
    console.log(
      'No textures found in textures folder, checking source folder for texture files'
    );
    await processTextureFiles(sourceFolder, 'source folder');
  }

  onProgress?.(100);

  // Determine if model likely has embedded materials (common for FBX, GLB, GLTF)
  const hasEmbeddedMaterials =
    ['fbx', 'glb', 'gltf'].includes(modelType) ||
    (Object.keys(textures).length === 0 && modelType === 'obj');

  console.log(
    `ZIP processing complete. Model: ${modelType}, External textures: ${
      Object.keys(textures).length
    }, Auxiliary files: ${
      Object.keys(auxiliaryFiles).length
    }, Likely embedded materials: ${hasEmbeddedMaterials}`
  );

  return {
    url: modelUrl,
    name: file.name,
    type: modelType,
    textures: Object.keys(textures).length > 0 ? textures : undefined,
    auxiliaryFiles:
      Object.keys(auxiliaryFiles).length > 0 ? auxiliaryFiles : undefined, // For GLTF external references
    hasEmbeddedMaterials, // Add this flag to help the loader decide how to handle materials
  };
}
