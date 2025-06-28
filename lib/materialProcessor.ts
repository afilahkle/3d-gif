import * as THREE from 'three';

export interface TextureMap {
  [key: string]: string;
}

export class MaterialProcessor {
  private textureLoader: THREE.TextureLoader;
  private textures: TextureMap;

  constructor(textures: TextureMap = {}) {
    this.textureLoader = new THREE.TextureLoader();
    this.textures = textures;
  }

  /**
   * Configure texture with proper settings for PBR workflow
   */
  private configureTexture(
    texture: THREE.Texture,
    colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace
  ): void {
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.flipY = false;
  }

  /**
   * Check if geometry has vertex colors
   */
  private hasVertexColors(geometry: THREE.BufferGeometry): boolean {
    return geometry?.attributes?.color !== undefined;
  }

  /**
   * Check if material is a default/placeholder material
   */
  private isDefaultMaterial(material: THREE.Material): boolean {
    const isThreeDefault =
      !material.name ||
      material.name === '' ||
      material.name === 'default' ||
      material.name === 'Material' ||
      material.name === THREE.Loader.DEFAULT_MATERIAL_NAME ||
      !!(material as any).isDefaultMaterial;

    const hasDefaultWhiteColor =
      (material as any).color &&
      (material as any).color.r === 1 &&
      (material as any).color.g === 1 &&
      (material as any).color.b === 1;

    const hasDefaultBlackColor =
      (material as any).color &&
      (material as any).color.r === 0 &&
      (material as any).color.g === 0 &&
      (material as any).color.b === 0;

    return isThreeDefault || hasDefaultWhiteColor || hasDefaultBlackColor;
  }

  /**
   * Convert any material to MeshStandardMaterial with proper PBR setup
   */
  private convertToStandardMaterial(
    originalMaterial: THREE.Material,
    hasVertexColors: boolean,
    fileType: string
  ): THREE.MeshStandardMaterial {
    console.log(`Converting material: ${originalMaterial.name || 'unnamed'} (${originalMaterial.type})`);

    // If it's already a standard or physical material, just ensure proper setup
    if (originalMaterial instanceof THREE.MeshStandardMaterial || 
        originalMaterial instanceof THREE.MeshPhysicalMaterial) {
      const material = originalMaterial as THREE.MeshStandardMaterial;
      
      // Ensure vertex colors are properly configured
      if (hasVertexColors && !material.vertexColors) {
        material.vertexColors = true;
        material.color.setRGB(1.0, 1.0, 1.0);
        console.log('Enabled vertex colors on existing standard material');
      }
      
      return material;
    }

    let baseColor = new THREE.Color(0.8, 0.8, 0.8); // Default gray

    // Extract color from original material
    if ((originalMaterial as any).color && !this.isDefaultMaterial(originalMaterial)) {
      baseColor = (originalMaterial as any).color.clone();
      console.log(`Using original color: #${baseColor.getHexString()}`);
    }

    // For vertex colors, use white base
    if (hasVertexColors) {
      baseColor.setRGB(1.0, 1.0, 1.0);
      console.log('Set base color to white for vertex colors');
    }

    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      vertexColors: hasVertexColors,
      opacity: (originalMaterial as any).opacity || 1.0,
      transparent: (originalMaterial as any).transparent || false,
      alphaTest: (originalMaterial as any).alphaTest || 0.0,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.0,
    });

    // Copy textures and properties
    this.copyMaterialProperties(material, originalMaterial);

    // Handle diffuse map multiplication logic
    const isGLTF = fileType.toLowerCase() === 'gltf' || fileType.toLowerCase() === 'glb';
    if (material.map && !isGLTF) {
      material.color.setRGB(1.0, 1.0, 1.0);
      console.log('Set white base color for texture (non-GLTF)');
    }

    console.log('Material conversion complete:', {
      hasTextures: !!material.map,
      roughness: material.roughness,
      metalness: material.metalness,
      vertexColors: material.vertexColors
    });

    return material;
  }

  /**
   * Copy properties from source material to target
   */
  private copyMaterialProperties(
    target: THREE.MeshStandardMaterial,
    source: THREE.Material
  ): void {
    const props = [
      'map', 'normalMap', 'roughnessMap', 'metalnessMap', 
      'emissiveMap', 'aoMap', 'bumpMap', 'displacementMap', 'alphaMap'
    ];

    props.forEach(prop => {
      if ((source as any)[prop]) {
        (target as any)[prop] = (source as any)[prop];
      }
    });

    // Copy scalar values
    if ((source as any).emissive) {
      target.emissive = (source as any).emissive.clone();
    }
    if ((source as any).emissiveIntensity !== undefined) {
      target.emissiveIntensity = (source as any).emissiveIntensity;
    }
    if ((source as any).roughness !== undefined) {
      target.roughness = (source as any).roughness;
    }
    if ((source as any).metalness !== undefined) {
      target.metalness = (source as any).metalness;
    }
  }

  /**
   * Apply external textures when needed
   */
  private applyExternalTextures(material: THREE.MeshStandardMaterial): void {
    if (Object.keys(this.textures).length === 0) return;

    // Apply diffuse/albedo
    if ((this.textures.diffuse || this.textures.albedo) && !material.map) {
      const diffuseUrl = this.textures.diffuse || this.textures.albedo;
      const texture = this.textureLoader.load(diffuseUrl);
      this.configureTexture(texture, THREE.SRGBColorSpace);
      material.map = texture;
      material.color.setRGB(1.0, 1.0, 1.0);
    }

    // Apply normal map
    if (this.textures.normal && !material.normalMap) {
      const texture = this.textureLoader.load(this.textures.normal);
      this.configureTexture(texture, THREE.NoColorSpace);
      material.normalMap = texture;
    }

    // Apply roughness
    if (this.textures.roughness && !material.roughnessMap) {
      const texture = this.textureLoader.load(this.textures.roughness);
      this.configureTexture(texture, THREE.NoColorSpace);
      material.roughnessMap = texture;
      material.roughness = 1.0;
    }

    // Apply metallic
    if (this.textures.metallic && !material.metalnessMap) {
      const texture = this.textureLoader.load(this.textures.metallic);
      this.configureTexture(texture, THREE.NoColorSpace);
      material.metalnessMap = texture;
      material.metalness = 1.0;
    }

    // Apply AO
    if (this.textures.ao && !material.aoMap) {
      const texture = this.textureLoader.load(this.textures.ao);
      this.configureTexture(texture, THREE.NoColorSpace);
      material.aoMap = texture;
      material.aoMapIntensity = 1.0;
    }

    material.needsUpdate = true;
  }

  /**
   * Process a single material
   */
  public processMaterial(
    material: THREE.Material,
    hasVertexColors: boolean,
    hasEmbeddedMaterials: boolean,
    fileType: string
  ): THREE.MeshStandardMaterial {
    const standardMaterial = this.convertToStandardMaterial(
      material,
      hasVertexColors,
      fileType
    );

    // Apply external textures for models without embedded materials
    if (!hasEmbeddedMaterials) {
      this.applyExternalTextures(standardMaterial);
    }

    return standardMaterial;
  }

  /**
   * Process all materials in a model
   */
  public processModel(
    model: THREE.Object3D,
    hasEmbeddedMaterials: boolean,
    fileType: string
  ): void {
    console.log('Processing model materials...', {
      hasEmbeddedMaterials,
      fileType,
      externalTextures: Object.keys(this.textures).length
    });

    let processedMeshes = 0;
    let processedMaterials = 0;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        processedMeshes++;
        const hasVertexColors = this.hasVertexColors(child.geometry);

        console.log(`Processing mesh ${processedMeshes}: ${child.name || 'unnamed'}`, {
          hasVertexColors,
          materialType: Array.isArray(child.material) 
            ? `Array[${child.material.length}]` 
            : child.material?.type || 'none',
          hasNormals: !!child.geometry.attributes.normal,
          hasUVs: !!child.geometry.attributes.uv,
          vertices: child.geometry.attributes.position?.count || 0
        });

        // Configure geometry
        if (!child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
          console.log('Computed missing normals');
        }

        // Configure shadows
        child.castShadow = true;
        child.receiveShadow = true;

        // Process materials
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat, idx) => {
            processedMaterials++;
            console.log(`Processing material ${idx + 1}/${child.material.length} for mesh`);
            return this.processMaterial(mat, hasVertexColors, hasEmbeddedMaterials, fileType);
          });
        } else {
          processedMaterials++;
          child.material = this.processMaterial(
            child.material,
            hasVertexColors,
            hasEmbeddedMaterials,
            fileType
          );
        }
      }
    });

    console.log(`Material processing complete: ${processedMeshes} meshes, ${processedMaterials} materials`);
  }
}
