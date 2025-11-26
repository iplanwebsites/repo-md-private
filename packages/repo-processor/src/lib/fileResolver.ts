import path from "node:path";

/**
 * Common file resolution utilities for both articles and media
 */

export interface FileItem {
  originalPath: string;
  fileName: string;
}

export interface ResolverOptions {
  currentFilePath?: string;
  caseSensitive?: boolean;
}

/**
 * Find files by filename with case-insensitive matching
 */
export function findByFileNameCaseInsensitive<T extends FileItem>(
  fileName: string,
  fileMap: Map<string, T[]>
): T[] {
  // First try exact match
  const exact = fileMap.get(fileName);
  if (exact) return exact;
  
  // Try case-insensitive match
  const lowerFileName = fileName.toLowerCase();
  for (const [key, value] of fileMap.entries()) {
    if (key.toLowerCase() === lowerFileName) {
      return value;
    }
  }
  
  return [];
}

/**
 * Resolve from multiple candidates with context awareness
 */
export function resolveFromCandidates<T extends FileItem>(
  candidates: T[],
  currentFilePath?: string
): T | null {
  // If only one candidate, return it
  if (candidates.length === 1) {
    return candidates[0];
  }
  
  if (!candidates.length) {
    return null;
  }
  
  // Multiple candidates - try to find the best match
  if (currentFilePath) {
    // Prefer files in the same directory
    const currentDir = path.dirname(currentFilePath);
    const sameDir = candidates.find(f => 
      path.dirname(f.originalPath) === currentDir
    );
    if (sameDir) return sameDir;
    
    // Try parent directories (for relative resolution)
    let parentDir = currentDir;
    while (parentDir && parentDir !== '.' && parentDir !== '/') {
      parentDir = path.dirname(parentDir);
      const parentMatch = candidates.find(f => 
        path.dirname(f.originalPath) === parentDir
      );
      if (parentMatch) return parentMatch;
    }
  }
  
  // Otherwise return the first one
  return candidates[0];
}

/**
 * Create path variations for flexible matching
 */
export function createPathVariations(
  targetPath: string,
  currentFilePath?: string
): string[] {
  // Normalize the path with consistent handling
  const normalizedPath = targetPath.replace(/\\/g, '/');
  
  // Create normalized variations for better matching
  const withLeadingSlash = normalizedPath.startsWith('/') 
    ? normalizedPath 
    : `/${normalizedPath}`;

  const withoutLeadingSlash = normalizedPath.startsWith('/') 
    ? normalizedPath.substring(1) 
    : normalizedPath;
  
  // Base variations
  const variations: string[] = [
    normalizedPath,
    normalizedPath.toLowerCase(),
    withLeadingSlash,
    withLeadingSlash.toLowerCase(),
    withoutLeadingSlash,
    withoutLeadingSlash.toLowerCase(),
  ];
  
  // If we have a current file path and the target is a relative path (doesn't start with /),
  // resolve it relative to the current file's directory
  if (currentFilePath && !normalizedPath.startsWith('/')) {
    const currentDir = path.dirname(currentFilePath);
    if (currentDir && currentDir !== '.') {
      const resolvedPath = path.join(currentDir, normalizedPath).replace(/\\/g, '/');
      const normalizedResolved = path.normalize(resolvedPath).replace(/\\/g, '/');

      // Add resolved path variations at the beginning (highest priority)
      variations.unshift(
        normalizedResolved,
        normalizedResolved.toLowerCase()
      );
    }
  }
  
  // Add filename-only variations at the end (lowest priority)
  const baseName = path.basename(normalizedPath);
  if (baseName !== normalizedPath) {
    variations.push(
      baseName,
      baseName.toLowerCase()
    );
  }
  
  // Remove duplicates while preserving order
  return [...new Set(variations)];
}

/**
 * Universal file resolver that handles both exact paths and fuzzy matching
 */
export function resolveFile<T extends FileItem>(
  targetPath: string,
  options: {
    byPath: Map<string, T>;
    byName?: Map<string, T[]>;
    currentFilePath?: string;
    extensions?: string[];
  }
): T | null {
  const { byPath, byName, currentFilePath, extensions = [] } = options;
  
  // Create all path variations
  const baseVariations = createPathVariations(targetPath, currentFilePath);
  
  // Add variations with extensions
  const allVariations: string[] = [];
  for (const variation of baseVariations) {
    allVariations.push(variation);
    
    // Add extension variations if the path doesn't already have one
    const hasExtension = extensions.some(ext => variation.endsWith(ext));
    if (!hasExtension) {
      for (const ext of extensions) {
        allVariations.push(variation + ext);
      }
    }
  }
  
  // Try exact path matches first
  for (const variation of allVariations) {
    const exactMatch = byPath.get(variation);
    if (exactMatch) return exactMatch;
  }
  
  // If we have a name map, try filename matching
  if (byName) {
    const fileName = path.basename(targetPath);
    const candidates = findByFileNameCaseInsensitive(fileName, byName);
    
    if (candidates.length > 0) {
      return resolveFromCandidates(candidates, currentFilePath);
    }
    
    // Try without extension
    for (const ext of extensions) {
      if (fileName.endsWith(ext)) {
        const nameWithoutExt = fileName.slice(0, -ext.length);
        const candidatesNoExt = findByFileNameCaseInsensitive(nameWithoutExt, byName);
        if (candidatesNoExt.length > 0) {
          return resolveFromCandidates(candidatesNoExt, currentFilePath);
        }
      }
    }
  }
  
  return null;
}