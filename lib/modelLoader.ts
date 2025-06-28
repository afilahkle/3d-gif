import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { ModelData } from '@/app/page';

export class ModelLoader {
  private manager: THREE.LoadingManager;

  constructor() {
    this.manager = new THREE.LoadingManager();
  }

  /**
   * Setup loading manager with URL resolution for file loaders
   */
  private setupLoadingManager(modelData: ModelData): void {
    if (!modelData.fileLoader) return;

    this.manager.setURLModifier((requestedUrl) => {
      console.log(`Resolving URL: "${requestedUrl}"`);

      // Main model file
      if (requestedUrl === modelData.url) {
        return requestedUrl;
      }

      // Try direct file buffer lookup
      const resolvedUrl = modelData.fileLoader!.getFileBuffer(requestedUrl);
      if (resolvedUrl) {
        console.log(`Resolved via getFileBuffer: ${resolvedUrl}`);
        return resolvedUrl;
      }

      // Handle binary files for GLTF
      if (requestedUrl.endsWith('.bin')) {
        const filename = requestedUrl.split('/').pop() || requestedUrl;
        const binUrl = modelData.fileLoader!.getFileBuffer(filename);
        if (binUrl) {
          console.log(`Found .bin file: ${binUrl}`);
          return binUrl;
        }
      }

      // Try relative path resolution
      if (modelData.internalPath) {
        const fallbackUrl = modelData.fileLoader!.resolveUrl(
          modelData.internalPath,
          requestedUrl
        );
        if (fallbackUrl) {
          console.log(`Resolved via fallback: ${fallbackUrl}`);
          return fallbackUrl;
        }
      }

      // Try common patterns for assets
      const patterns = [
        requestedUrl.split('/').pop(),
        requestedUrl.replace(/^.*\//, ''),
        requestedUrl.toLowerCase(),
      ].filter(Boolean);

      for (const pattern of patterns) {
        const patternUrl = modelData.fileLoader!.getFileBuffer(pattern!);
        if (patternUrl) {
          console.log(`Found via pattern "${pattern}": ${patternUrl}`);
          return patternUrl;
        }
      }

      console.log(`No resolution found, returning original: ${requestedUrl}`);
      return requestedUrl;
    });
  }

  /**
   * Create and configure GLTF loader with Unreal Engine optimizations
   */
  private createGLTFLoader(): GLTFLoader {
    const loader = new GLTFLoader(this.manager);

    try {
      // Setup DRACO decoder for compressed geometry (optional - many UE exports don't use DRACO)
      const dracoLoader = new DRACOLoader();
      // Use CDN path for DRACO decoder as fallback
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      dracoLoader.preload();
      loader.setDRACOLoader(dracoLoader);
      console.log('DRACO decoder configured');
    } catch (error) {
      console.warn('DRACO decoder setup failed, continuing without compression support:', error);
    }

    try {
      // Setup KTX2 loader for compressed textures (optional)
      const ktx2Loader = new KTX2Loader();
      ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.177.0/examples/jsm/libs/basis/');
      loader.setKTX2Loader(ktx2Loader);
      console.log('KTX2 loader configured');
    } catch (error) {
      console.warn('KTX2 loader setup failed, continuing without KTX2 support:', error);
    }

    try {
      // Setup Meshopt decoder for mesh compression
      loader.setMeshoptDecoder(MeshoptDecoder);
      console.log('Meshopt decoder configured');
    } catch (error) {
      console.warn('Meshopt decoder setup failed, continuing without meshopt support:', error);
    }

    return loader;
  }

  /**
   * Create OBJ loader with MTL support
   */
  private async createOBJLoader(modelData: ModelData): Promise<OBJLoader> {
    const objLoader = new OBJLoader(this.manager);

    // Load MTL file if available
    if (modelData.fileLoader && modelData.mtlPath) {
      try {
        const mtlUrl = modelData.fileLoader.getFileUrl(modelData.mtlPath);
        if (mtlUrl) {
          console.log('Loading MTL file:', mtlUrl);
          const materials = await new MTLLoader(this.manager).loadAsync(mtlUrl);
          materials.preload();
          objLoader.setMaterials(materials);
          console.log('MTL materials loaded successfully');
        }
      } catch (error) {
        console.warn('Failed to load MTL file:', error);
      }
    }

    return objLoader;
  }

  /**
   * Load a 3D model with proper configuration
   */
  public async loadModel(modelData: ModelData): Promise<THREE.Object3D> {
    console.log('Loading model:', {
      name: modelData.name,
      type: modelData.type,
      hasEmbeddedMaterials: modelData.hasEmbeddedMaterials,
      url: modelData.url
    });

    this.setupLoadingManager(modelData);

    const startTime = performance.now();
    let loader: OBJLoader | FBXLoader | GLTFLoader;
    let loadedData: any;

    switch (modelData.type) {
      case 'obj':
        loader = await this.createOBJLoader(modelData);
        break;
      case 'fbx':
        loader = new FBXLoader(this.manager);
        break;
      case 'gltf':
      case 'glb':
        loader = this.createGLTFLoader();
        break;
      default:
        throw new Error(`Unsupported model type: ${modelData.type}`);
    }

    try {
      loadedData = await loader.loadAsync(modelData.url);
      const loadTime = performance.now() - startTime;
      console.log(`Model loaded in ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    }

    // Extract the scene/model object
    const model = loadedData.scene ? loadedData.scene : loadedData;

    // Store animations if available
    if (loadedData.animations?.length > 0) {
      (model as any).animations = loadedData.animations;
      console.log(`Model has ${loadedData.animations.length} animations`);
    }

    // Log detailed model information
    this.analyzeModel(model);

    // Center the model
    this.centerModel(model);

    console.log('Model loaded successfully:', {
      type: model.type,
      children: model.children.length,
      hasAnimations: !!loadedData.animations?.length
    });

    return model;
  }

  /**
   * Center the model in the scene
   */
  private centerModel(model: THREE.Object3D): void {
    const boundingBox = new THREE.Box3().setFromObject(model);
    const center = boundingBox.getCenter(new THREE.Vector3());
    model.position.sub(center);
    
    console.log('Model centered:', {
      originalCenter: center.toArray(),
      boundingBox: {
        min: boundingBox.min.toArray(),
        max: boundingBox.max.toArray()
      }
    });
  }

  /**
   * Analyze model structure for debugging
   */
  private analyzeModel(model: THREE.Object3D): void {
    let meshCount = 0;
    let materialCount = 0;
    let geometryTypes = new Set<string>();
    let materialTypes = new Set<string>();
    
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshCount++;
        geometryTypes.add(child.geometry.type);
        
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materialCount += materials.length;
        materials.forEach(mat => materialTypes.add(mat.type));
      }
    });

    console.log('Model analysis:', {
      meshes: meshCount,
      materials: materialCount,
      geometryTypes: Array.from(geometryTypes),
      materialTypes: Array.from(materialTypes)
    });
  }
}
