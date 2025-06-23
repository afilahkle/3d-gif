export class FileLoader {
  private fileMap: Map<string, string>;
  private filenameMap: Map<string, string>;
  private rootPath: string;

  constructor(files: { path: string; url: string }[]) {
    this.fileMap = new Map();
    this.filenameMap = new Map();
    this.rootPath = '';

    console.log(
      'FileLoader: Registering files:',
      files.map((f) => f.path)
    );

    if (files.length > 0) {
      this.rootPath = this.findRootPath(files.map((f) => f.path));
      console.log('FileLoader: Root path determined as:', this.rootPath);

      for (const file of files) {
        const relativePath = this.getRelativePath(file.path);

        // Store multiple variations of the path for better matching
        const pathVariations = [
          relativePath,
          relativePath.toLowerCase(),
          file.path,
          file.path.toLowerCase(),
          file.path.replace(/\\/g, '/'),
          file.path.replace(/\\/g, '/').toLowerCase(),
        ];

        // Remove duplicates
        const uniquePathsSet = new Set(pathVariations);
        const uniquePaths = Array.from(uniquePathsSet);

        for (const pathVar of uniquePaths) {
          this.fileMap.set(pathVar, file.url);
        }

        const filename = relativePath
          .split('/')
          .pop()
          ?.split('\\')
          .pop()
          ?.toLowerCase();
        if (filename) {
          this.filenameMap.set(filename, file.url);
          console.log(
            `FileLoader: Mapped "${relativePath}" -> filename "${filename}"`
          );
        }
      }

      console.log(
        'FileLoader: Full file map keys:',
        Array.from(this.fileMap.keys())
      );
      console.log(
        'FileLoader: Filename map:',
        Array.from(this.filenameMap.entries())
      );
    }
  }

  private findRootPath(paths: string[]): string {
    if (paths.length === 0) return '';
    let root = paths[0].split('/');
    for (let i = 1; i < paths.length; i++) {
      const parts = paths[i].split('/');
      for (let j = 0; j < root.length && j < parts.length; j++) {
        if (root[j] !== parts[j]) {
          root = root.slice(0, j);
          break;
        }
      }
    }
    return root.length > 0 ? root.join('/') + '/' : '';
  }

  private getRelativePath(fullPath: string): string {
    if (fullPath.startsWith(this.rootPath)) {
      return fullPath.substring(this.rootPath.length);
    }
    return fullPath;
  }

  public getFileUrl(filePath: string): string | null {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

    // Try exact path match first
    if (this.fileMap.has(normalizedPath)) {
      return this.fileMap.get(normalizedPath) || null;
    }

    const filename = normalizedPath.split('/').pop();
    if (filename && this.filenameMap.has(filename)) {
      return this.filenameMap.get(filename) || null;
    }

    return null;
  }

  // Enhanced file resolution with comprehensive fallback patterns
  public getFileBuffer(filePath: string): string | null {
    console.log(`FileLoader.getFileBuffer("${filePath}")`);
    console.log(
      `Available filename keys:`,
      Array.from(this.filenameMap.keys())
    );

    // Try multiple variations of the requested path
    const variations = [
      filePath,
      filePath.toLowerCase(),
      filePath.replace(/\\/g, '/'),
      filePath.replace(/\\/g, '/').toLowerCase(),
      // Remove leading paths
      filePath.split('/').pop() || filePath,
      filePath.split('\\').pop() || filePath,
    ];

    // Remove duplicates
    const uniqueVariations = Array.from(new Set(variations));

    for (const variation of uniqueVariations) {
      // Try exact path match first
      if (this.fileMap.has(variation)) {
        const result = this.fileMap.get(variation);
        console.log(
          `FileLoader.getFileBuffer("${filePath}") -> FOUND exact match: ${variation}`
        );
        return result || null;
      }
    }

    // Enhanced filename-only lookup with multiple patterns
    const filename = filePath
      .split('/')
      .pop()
      ?.split('\\')
      .pop()
      ?.toLowerCase();
    if (filename) {
      // Try direct filename lookup
      if (this.filenameMap.has(filename)) {
        const result = this.filenameMap.get(filename);
        console.log(
          `FileLoader.getFileBuffer("${filePath}") -> FOUND by filename: ${filename}`
        );
        return result || null;
      }

      // Try filename variations (common in GLTF/GLB files)
      const filenameVariations = [
        filename,
        filename.replace(/[-_]/g, ''), // Remove separators
        filename.replace(/\d+/g, ''), // Remove numbers
        filename.split('.')[0], // Remove extension
      ];

      for (const variation of filenameVariations) {
        if (this.filenameMap.has(variation)) {
          const result = this.filenameMap.get(variation);
          console.log(
            `FileLoader.getFileBuffer("${filePath}") -> FOUND by filename variation: ${variation}`
          );
          return result || null;
        }
      }

      // Enhanced path pattern matching for complex directory structures
      console.log(`Searching for filename "${filename}" in all paths...`);
      for (const [path, url] of Array.from(this.fileMap.entries())) {
        const pathLower = path.toLowerCase();
        const filenameLower = filename.toLowerCase();

        // Check comprehensive patterns
        const patterns = [
          pathLower === filenameLower,
          pathLower.endsWith('/' + filenameLower),
          pathLower.endsWith('\\' + filenameLower),
          pathLower.includes('texture') && pathLower.endsWith(filenameLower),
          pathLower.includes('textures') && pathLower.endsWith(filenameLower),
          pathLower.includes('images') && pathLower.endsWith(filenameLower),
          pathLower.includes('image') && pathLower.endsWith(filenameLower),
          pathLower.includes('assets') && pathLower.endsWith(filenameLower),
          pathLower.includes('asset') && pathLower.endsWith(filenameLower),
          pathLower.includes('materials') && pathLower.endsWith(filenameLower),
          pathLower.includes('material') && pathLower.endsWith(filenameLower),
          pathLower.includes('maps') && pathLower.endsWith(filenameLower),
          pathLower.includes('map') && pathLower.endsWith(filenameLower),
          // Partial filename matches (for versioned files)
          pathLower.includes(filenameLower.split('.')[0]),
        ];

        if (patterns.some(Boolean)) {
          console.log(
            `FileLoader.getFileBuffer: Found "${filePath}" in path: ${path}`
          );
          return url;
        }
      }
    }

    console.log(`FileLoader.getFileBuffer("${filePath}") -> NOT FOUND`);
    return null;
  }

  public resolveUrl(basePath: string, relativePath: string): string | null {
    // If it's already an absolute URL or blob URL, return as-is
    if (
      relativePath.startsWith('http') ||
      relativePath.startsWith('blob:') ||
      relativePath.startsWith('data:')
    ) {
      return relativePath;
    }

    const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1);
    const combinedPath = baseDir + relativePath;

    const parts = combinedPath.split('/');
    const stack: string[] = [];
    for (const part of parts) {
      if (part === '..') {
        stack.pop();
      } else if (part !== '.' && part !== '') {
        stack.push(part);
      }
    }
    const normalizedPath = stack.join('/').toLowerCase();

    // Primary lookup - try exact path
    const url = this.fileMap.get(normalizedPath);
    if (url) {
      console.log(
        `FileLoader.resolveUrl("${basePath}", "${relativePath}") -> FOUND via exact path: ${normalizedPath}`
      );
      return url;
    }

    // Fallback 1: try filename only (critical for cross-folder texture resolution)
    const filename = stack[stack.length - 1];
    if (this.filenameMap.has(filename)) {
      const result = this.filenameMap.get(filename) || null;
      console.log(
        `FileLoader.resolveUrl("${basePath}", "${relativePath}") -> FOUND via filename: ${filename}`
      );
      return result;
    }

    // Fallback 2: match by filename or ending (for legacy compatibility)
    for (const [key, mapUrl] of Array.from(this.fileMap.entries())) {
      if (key === filename || key.endsWith('/' + filename)) {
        console.log(
          `FileLoader.resolveUrl("${basePath}", "${relativePath}") -> FOUND via pattern match: ${key}`
        );
        return mapUrl;
      }
    }

    console.log(
      `FileLoader.resolveUrl("${basePath}", "${relativePath}") -> NOT FOUND`
    );
    return null;
  }
}
