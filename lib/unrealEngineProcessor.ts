import * as THREE from 'three';

export class UnrealEngineProcessor {
  /**
   * Process GLTF/GLB models exported from Unreal Engine
   */
  public static processUnrealModel(model: THREE.Object3D): void {
    console.log('Processing Unreal Engine model...');

    // First pass: analyze the model structure
    let meshCount = 0;
    let materialCount = 0;
    const materials = new Set<THREE.Material>();

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshCount++;
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => materials.add(mat));
          materialCount += child.material.length;
        } else {
          materials.add(child.material);
          materialCount++;
        }
      }
    });

    console.log(`Found ${meshCount} meshes with ${materialCount} materials`);

    // Process each mesh
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.processMesh(child);
      }
    });

    console.log('Unreal Engine model processing complete');
  }

  /**
   * Process individual mesh for Unreal Engine compatibility
   */
  private static processMesh(mesh: THREE.Mesh): void {
    // Process materials
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(material => this.processMaterial(material));
    } else {
      this.processMaterial(mesh.material);
    }

    // Ensure proper geometry setup
    this.processGeometry(mesh.geometry);

    // Configure shadows
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }

  /**
   * Process materials for Unreal Engine specific requirements
   */
  private static processMaterial(material: THREE.Material): void {
    console.log(`Processing material: ${material.name || 'unnamed'} (${material.type})`);

    // Convert non-standard materials to MeshStandardMaterial for better compatibility
    if (!(material instanceof THREE.MeshStandardMaterial) && 
        !(material instanceof THREE.MeshPhysicalMaterial)) {
      console.log(`Material ${material.name} is ${material.type}, may need conversion`);
      return; // Let MaterialProcessor handle the conversion
    }

    const stdMaterial = material as THREE.MeshStandardMaterial;

    // Log current material state
    console.log('Material properties:', {
      hasMap: !!stdMaterial.map,
      hasNormalMap: !!stdMaterial.normalMap,
      hasRoughnessMap: !!stdMaterial.roughnessMap,
      hasMetalnessMap: !!stdMaterial.metalnessMap,
      hasEmissiveMap: !!stdMaterial.emissiveMap,
      roughness: stdMaterial.roughness,
      metalness: stdMaterial.metalness,
      color: stdMaterial.color.getHexString(),
    });

    // Unreal Engine specific material adjustments
    
    // Fix metallic workflow
    if (stdMaterial.metalnessMap && !stdMaterial.roughnessMap) {
      // Unreal often packs metallic and roughness in different channels
      stdMaterial.roughness = 0.5; // Default roughness when no map
      console.log('Set default roughness for metallic material');
    }

    // Adjust emission intensity for Unreal Engine exports
    if (stdMaterial.emissiveMap) {
      const originalIntensity = stdMaterial.emissiveIntensity;
      // Unreal often uses higher emission values
      if (stdMaterial.emissiveIntensity < 1.0) {
        stdMaterial.emissiveIntensity = 1.0;
      }
      console.log(`Adjusted emission intensity: ${originalIntensity} -> ${stdMaterial.emissiveIntensity}`);
    }

    // Fix normal map intensity
    if (stdMaterial.normalMap && stdMaterial.normalScale) {
      // Unreal Engine normal maps might need different scaling
      const currentScale = stdMaterial.normalScale.x;
      if (currentScale > 2.0) {
        stdMaterial.normalScale.set(1.0, 1.0);
        console.log(`Adjusted normal scale: ${currentScale} -> 1.0`);
      }
    }

    // Ensure proper alpha handling
    if (stdMaterial.transparent && stdMaterial.opacity < 1.0) {
      stdMaterial.alphaTest = 0.1;
      stdMaterial.side = THREE.DoubleSide;
      console.log('Configured alpha handling for transparent material');
    }

    // Fix texture color spaces for Unreal Engine assets
    this.fixTextureColorSpaces(stdMaterial);

    // Adjust material properties for better PBR rendering
    this.adjustPBRProperties(stdMaterial);

    stdMaterial.needsUpdate = true;
    console.log('Material processing complete');
  }

  /**
   * Fix texture color spaces for Unreal Engine exports
   */
  private static fixTextureColorSpaces(material: THREE.MeshStandardMaterial): void {
    // Diffuse/Base Color should be in sRGB
    if (material.map) {
      material.map.colorSpace = THREE.SRGBColorSpace;
    }

    // Emission maps should be in sRGB
    if (material.emissiveMap) {
      material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    }

    // All other maps should be linear
    const linearMaps = [
      'normalMap', 'roughnessMap', 'metalnessMap', 
      'aoMap', 'bumpMap', 'displacementMap', 'alphaMap'
    ];

    linearMaps.forEach(mapName => {
      const map = (material as any)[mapName];
      if (map) {
        map.colorSpace = THREE.NoColorSpace;
      }
    });
  }

  /**
   * Adjust PBR properties for better rendering
   */
  private static adjustPBRProperties(material: THREE.MeshStandardMaterial): void {
    // Ensure reasonable roughness values
    if (material.roughness === 0) {
      material.roughness = 0.04; // Minimum roughness for realistic materials
    }

    // Clamp metalness values
    material.metalness = Math.max(0, Math.min(1, material.metalness));

    // Adjust IOR for better reflections
    if ('ior' in material) {
      (material as any).ior = 1.5; // Standard IOR for most materials
    }

    // Enable clearcoat for automotive/glossy materials if available
    if ('clearcoat' in material && material.metalnessMap) {
      const avgMetalness = material.metalness;
      if (avgMetalness < 0.1) { // Non-metallic materials
        (material as any).clearcoat = 0.1;
        (material as any).clearcoatRoughness = material.roughness * 0.5;
      }
    }
  }

  /**
   * Process geometry for Unreal Engine compatibility
   */
  private static processGeometry(geometry: THREE.BufferGeometry): void {
    // Compute normals if missing
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }

    // Compute tangents for normal mapping
    if (geometry.attributes.normal && geometry.attributes.uv && !geometry.attributes.tangent) {
      geometry.computeTangents();
    }

    // Ensure proper UV coordinates
    if (geometry.attributes.uv) {
      const uvArray = geometry.attributes.uv.array;
      let needsUpdate = false;

      // Check for flipped V coordinates (common in Unreal Engine exports)
      for (let i = 1; i < uvArray.length; i += 2) {
        if (uvArray[i] > 1.0) {
          uvArray[i] = 1.0 - (uvArray[i] - Math.floor(uvArray[i]));
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        geometry.attributes.uv.needsUpdate = true;
        console.log('Fixed UV coordinates for Unreal Engine compatibility');
      }
    }

    // Optimize geometry
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  /**
   * Apply Unreal Engine specific lighting corrections
   */
  public static applyLightingCorrections(model: THREE.Object3D): void {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach(material => {
          if (material instanceof THREE.MeshStandardMaterial) {
            // Unreal Engine models often need tone mapping adjustment
            if (material.emissiveMap) {
              // Reduce emission intensity to prevent over-bright materials
              material.emissiveIntensity *= 0.5;
            }

            // Adjust base color for better lighting
            if (!material.map) {
              // Non-textured materials might be too bright
              material.color.multiplyScalar(0.8);
            }
          }
        });
      }
    });
  }

  /**
   * Handle special Unreal Engine GLTF extensions and material types
   */
  public static handleUnrealExtensions(model: THREE.Object3D): void {
    console.log('Checking for Unreal Engine specific extensions...');

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach(material => {
          // Handle KHR_materials_unlit (common in Unreal Engine exports)
          if ((material as any).userData?.gltfExtensions?.KHR_materials_unlit) {
            console.log('Found KHR_materials_unlit material, converting to unlit rendering');
            if (material instanceof THREE.MeshStandardMaterial) {
              // Convert to basic material for unlit rendering
              const basicMaterial = new THREE.MeshBasicMaterial({
                map: material.map,
                color: material.color,
                transparent: material.transparent,
                opacity: material.opacity,
                alphaTest: material.alphaTest,
                side: material.side,
              });
              
              if (Array.isArray(child.material)) {
                const index = child.material.indexOf(material);
                child.material[index] = basicMaterial;
              } else {
                child.material = basicMaterial;
              }
            }
          }

          // Handle double-sided materials (common in Unreal)
          if ((material as any).userData?.doubleSided !== undefined) {
            material.side = (material as any).userData.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
            console.log(`Set material side to: ${material.side === THREE.DoubleSide ? 'DoubleSide' : 'FrontSide'}`);
          }
        });
      }
    });
  }
}
