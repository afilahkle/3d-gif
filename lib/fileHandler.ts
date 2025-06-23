import JSZip from 'jszip';
import { ModelData } from '@/app/page';
import { FileLoader } from './fileLoader';

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

  const hasEmbeddedMaterials = ['fbx', 'glb', 'gltf'].includes(extension);

  return {
    url,
    name: file.name,
    type: extension,
    hasEmbeddedMaterials,
    fileLoader: null,
    internalPath: file.name.toLowerCase(),
  };
}

function findFile(
  filePath: string,
  availablePaths: string[]
): string | undefined {
  const normalizedFilePath = filePath.replace(/\\/g, '/');
  const fileName = normalizedFilePath.split('/').pop()?.toLowerCase();
  if (!fileName) return undefined;

  // Try to find by full path first
  const fullPathMatch = availablePaths.find((p) =>
    p.toLowerCase().endsWith(normalizedFilePath.toLowerCase())
  );
  if (fullPathMatch) return fullPathMatch;

  // Fallback to just filename
  return (
    availablePaths.find((p) => p.toLowerCase().endsWith('/' + fileName)) ||
    availablePaths.find((p) => p.toLowerCase() === fileName)
  );
}

async function handleZipFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ModelData> {
  onProgress?.(20);

  const zip = new JSZip();
  const zipContent = await zip.loadAsync(file);
  onProgress?.(30);

  const files: { path: string; blob: Blob; url: string; text?: string }[] = [];
  const filePromises: Promise<void>[] = [];

  for (const [path, zipObject] of Object.entries(zipContent.files)) {
    if (!zipObject.dir) {
      const lowerPath = path.toLowerCase();
      const promise = zipObject.async('blob').then(async (blob) => {
        const url = URL.createObjectURL(blob);
        const ext = path.split('.').pop()?.toLowerCase();
        let text: string | undefined;
        if (['mtl', 'obj'].includes(ext || '')) {
          try {
            text = await blob.text();
          } catch (e) {
            console.warn(`Could not read file as text: ${path}`, e);
          }
        }
        files.push({ path: lowerPath, blob, url, text });
      });
      filePromises.push(promise);
    }
  }
  await Promise.all(filePromises);
  onProgress?.(50);

  const fileLoader = new FileLoader(
    files.map((f) => ({ path: f.path, url: f.url }))
  );

  // Enhanced texture classification with more patterns
  const textureMap: Record<string, string> = {};
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
      'diffusemap',
      'colormap',
      'basemap',
      'material',
      'surface',
    ],
    normal: [
      'normal',
      'norm',
      'bump',
      'nrm',
      'normalmap',
      'bumpmap',
      'height',
      'relief',
    ],
    roughness: [
      'roughness',
      'rough',
      'rgh',
      'roughnessmap',
      'gloss',
      'glossiness',
      'smoothness',
    ],
    metallic: [
      'metallic',
      'metal',
      'metalness',
      'met',
      'metallicmap',
      'spec',
      'specular',
      'reflection',
    ],
    ao: ['ao', 'ambientocclusion', 'occlusion', 'ambient', 'shadow', 'cavity'],
    height: [
      'height',
      'displacement',
      'disp',
      'heightmap',
      'parallax',
      'depth',
    ],
    emission: [
      'emissive',
      'emission',
      'glow',
      'emit',
      'emissivemap',
      'light',
      'luminance',
    ],
    lightmap: [
      'lightmap',
      'lighting',
      'baked',
      'illumination',
      'lightingmap',
      'gi',
      'indirect',
    ],
    opacity: [
      'opacity',
      'alpha',
      'transparent',
      'mask',
      'alphamap',
      'transparency',
    ],
  };

  const extensions = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'bmp',
    'tga',
    'tiff',
    'webp',
    'hdr',
    'exr',
  ];

  // Enhanced texture detection with priority ordering
  for (const f of files) {
    const fileName = f.path.split('/').pop() || '';
    const lowerName = fileName.toLowerCase();
    const ext = lowerName.split('.').pop() || '';

    if (!extensions.includes(ext)) continue;

    // Remove extension for pattern matching
    const nameWithoutExt = lowerName.replace(`.${ext}`, '');

    // Check each texture type with priority (more specific patterns first)
    Object.entries(basePatterns).forEach(([type, patterns]) => {
      if (textureMap[type]) return; // Already found this type

      for (const pattern of patterns) {
        // Exact match
        if (nameWithoutExt === pattern) {
          textureMap[type] = f.url;
          console.log(`Found ${type} texture (exact): ${fileName}`);
          return;
        }

        // Contains pattern
        if (nameWithoutExt.includes(pattern)) {
          textureMap[type] = f.url;
          console.log(`Found ${type} texture (contains): ${fileName}`);
          return;
        }

        // Pattern at end (common naming convention)
        if (
          nameWithoutExt.endsWith(`_${pattern}`) ||
          nameWithoutExt.endsWith(`-${pattern}`)
        ) {
          textureMap[type] = f.url;
          console.log(`Found ${type} texture (suffix): ${fileName}`);
          return;
        }
      }
    });
  }

  // Find model file
  let modelFileEntry = files.find(
    (f) =>
      f.path.toLowerCase().endsWith('.obj') ||
      f.path.toLowerCase().endsWith('.fbx') ||
      f.path.toLowerCase().endsWith('.gltf') ||
      f.path.toLowerCase().endsWith('.glb')
  );

  if (!modelFileEntry) {
    throw new Error('No supported 3D model found in the ZIP file.');
  }

  const modelPath = modelFileEntry.path;
  const modelType = modelPath.split('.').pop()?.toLowerCase() || '';
  const hasEmbeddedMaterials = ['fbx', 'glb', 'gltf'].includes(modelType);
  let mtlPath: string | undefined;
  if (modelType === 'obj' && modelFileEntry.text) {
    const match = modelFileEntry.text.match(/^mtllib\s+(.+)/m);
    if (match) {
      const mtlFileName = match[1].trim();
      const found = findFile(
        mtlFileName,
        files.map((f) => f.path)
      );
      if (found) mtlPath = found;
    }
  }

  onProgress?.(100);

  return {
    url: modelFileEntry.url,
    name: file.name,
    type: modelType,
    hasEmbeddedMaterials,
    fileLoader,
    internalPath: modelPath.toLowerCase(),
    mtlPath,
    textures: textureMap,
  };
}
