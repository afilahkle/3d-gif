declare module 'three/examples/jsm/loaders/MTLLoader' {
  import { LoadingManager } from 'three';
  export class MTLLoader {
    constructor(manager?: LoadingManager);
    setPath(path: string): void;
    setResourcePath(path: string): void;
    loadAsync(url: string): Promise<any>;
  }
}

declare module 'three/examples/jsm/loaders/OBJLoader' {
  import { LoadingManager } from 'three';
  export class OBJLoader {
    constructor(manager?: LoadingManager);
    setMaterials(materials: any): void;
    loadAsync(url: string): Promise<any>;
  }
}

declare module 'three/examples/jsm/loaders/FBXLoader' {
  import { LoadingManager } from 'three';
  export class FBXLoader {
    constructor(manager?: LoadingManager);
    loadAsync(url: string): Promise<any>;
  }
}

declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import { LoadingManager } from 'three';
  export class GLTFLoader {
    constructor(manager?: LoadingManager);
    loadAsync(url: string): Promise<any>;
  }
}
