import path from "node:path";
import { FileData } from "../types/core";
import { toSlug } from "./utility";
import { resolveFromCandidates as resolveFromCandidatesBase, findByFileNameCaseInsensitive as findByNameBase } from "./fileResolver";

export interface LinkResolverOptions {
  urlPrefix: string;
}

export interface FileMap {
  byPath: Map<string, FileData>;
  bySlug: Map<string, FileData>;
  byFileName: Map<string, FileData[]>;
  byAlias: Map<string, FileData[]>;
}

/**
 * Build maps for efficient file lookups
 */
export function buildFileMaps(files: FileData[]): FileMap {
  const byPath = new Map<string, FileData>();
  const bySlug = new Map<string, FileData>();
  const byFileName = new Map<string, FileData[]>();
  const byAlias = new Map<string, FileData[]>();

  
  for (const file of files) {
    // Map by original file path
    byPath.set(file.originalFilePath, file);
    
    // Map by slug
    bySlug.set(file.slug, file);
    
    // Map by filename (can have multiple files with same name in different folders)
    const fileName = path.basename(file.originalFilePath, '.md');
    if (!byFileName.has(fileName)) {
      byFileName.set(fileName, []);
    }
    byFileName.get(fileName)!.push(file);
    
    // Map by aliases (from frontmatter) - case-insensitive
    const aliases = file.frontmatter?.aliases;
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        if (typeof alias === 'string' && alias.trim()) {
          const normalizedAlias = alias.trim().toLowerCase();
          if (!byAlias.has(normalizedAlias)) {
            byAlias.set(normalizedAlias, []);
          }
          byAlias.get(normalizedAlias)!.push(file);
        }
      }
    }
  }

  return { byPath, bySlug, byFileName, byAlias };
}

/**
 * Find a file by slug with case-insensitive matching and slugification
 */
function findBySlugCaseInsensitive(slug: string, bySlug: Map<string, FileData>): FileData | null {
  // First try exact match
  const exact = bySlug.get(slug);
  if (exact) return exact;
  
  // Try case-insensitive match
  const lowerSlug = slug.toLowerCase();
  for (const [key, value] of bySlug.entries()) {
    if (key.toLowerCase() === lowerSlug) {
      return value;
    }
  }
  
  // Try slugified version (handles spaces -> dashes, etc.)
  const slugifiedSearch = toSlug(slug);
  const exactSlugified = bySlug.get(slugifiedSearch);
  if (exactSlugified) return exactSlugified;
  
  // Try case-insensitive match on slugified version
  const lowerSlugified = slugifiedSearch.toLowerCase();
  for (const [key, value] of bySlug.entries()) {
    if (key.toLowerCase() === lowerSlugified) {
      return value;
    }
  }
  
  return null;
}

/**
 * Find files by filename with case-insensitive matching and slugification
 */
function findByFileNameCaseInsensitive(fileName: string, byFileName: Map<string, FileData[]>): FileData[] | null {
  // Use the unified case-insensitive finder
  const results = findByNameBase(fileName, byFileName);
  if (results.length > 0) return results;
  
  // Additionally try slugified version (handles spaces -> dashes, etc.) then remove dashes
  const slugifiedSearch = toSlug(fileName).replace(/-/g, ' ');
  const slugResults = findByNameBase(slugifiedSearch, byFileName);
  if (slugResults.length > 0) return slugResults;
  
  return null;
}

/**
 * Resolve a wikilink to a specific file
 * Wikilinks can be just a filename, or include a path for disambiguation
 */
export function resolveWikilink(
  wikilink: string,
  fileMap: FileMap,
  currentFilePath: string
): FileData | null {
  // Remove any anchors or block references
  const cleanLink = wikilink.split('#')[0].split('#^')[0];
  
  // First, try to find by slug (case-insensitive match)
  const bySlug = findBySlugCaseInsensitive(cleanLink, fileMap.bySlug);
  if (bySlug) return bySlug;
  
  // Try to find by alias (case-insensitive)
  const byAlias = fileMap.byAlias.get(cleanLink.toLowerCase());
  if (byAlias && byAlias.length > 0) {
    return resolveFromCandidates(byAlias, currentFilePath);
  }
  
  // Check if it includes a path
  if (cleanLink.includes('/')) {
    // Try to resolve as a path-based link
    const possiblePaths = [
      cleanLink + '.md',
      cleanLink,
      path.join(path.dirname(currentFilePath), cleanLink + '.md'),
      path.join(path.dirname(currentFilePath), cleanLink)
    ];
    
    for (const possiblePath of possiblePaths) {
      const normalized = path.normalize(possiblePath);
      const file = fileMap.byPath.get(normalized);
      if (file) return file;
    }
  }
  
  // Try to resolve by filename (without extension) - case-insensitive
  const candidates = findByFileNameCaseInsensitive(cleanLink, fileMap.byFileName);
  
  if (!candidates || candidates.length === 0) {
    // Also try with .md extension removed if it was included - case-insensitive
    const withoutExt = cleanLink.replace(/\.md$/, '');
    const candidatesWithoutExt = findByFileNameCaseInsensitive(withoutExt, fileMap.byFileName);
    if (!candidatesWithoutExt || candidatesWithoutExt.length === 0) {
      return null;
    }
    return resolveFromCandidates(candidatesWithoutExt, currentFilePath);
  }
  
  return resolveFromCandidates(candidates, currentFilePath);
}

function resolveFromCandidates(candidates: FileData[], currentFilePath: string): FileData | null {
  // Use the unified resolver
  return resolveFromCandidatesBase(candidates, currentFilePath);
}

/**
 * Convert a wikilink to a markdown link format
 */
export function wikilinkToMarkdownLink(
  wikilink: string,
  alias: string | undefined,
  targetFile: FileData,
  options: LinkResolverOptions
): { url: string; text: string } {
  // Extract any anchor or block reference
  let anchor = '';
  if (wikilink.includes('#^')) {
    // Block reference - we'll just link to the page for now
    const parts = wikilink.split('#^');
    anchor = '';
  } else if (wikilink.includes('#')) {
    const parts = wikilink.split('#');
    anchor = '#' + slugifyAnchor(parts[1]);
  }
  
  const url = `${options.urlPrefix}/${targetFile.slug}${anchor}`;
  const text = alias || targetFile.title || targetFile.fileName;
  
  return { url, text };
}

/**
 * Simple anchor slugification (can be improved to match your heading slug logic)
 */
function slugifyAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Resolve markdown links to final URLs
 * This handles relative links and transforms them based on the target file
 */
export function resolveMarkdownLink(
  href: string,
  fileMap: FileMap,
  currentFilePath: string,
  options: LinkResolverOptions
): string {
  // Skip external links, anchors, and already processed links
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#') ||
    href.startsWith(options.urlPrefix)
  ) {
    return href;
  }
  
  // Remove any existing prefix if present
  let cleanHref = href;
  if (cleanHref.startsWith('/content/')) {
    cleanHref = cleanHref.substring('/content/'.length);
  }
  
  // Extract anchor if present
  let anchor = '';
  const anchorIndex = cleanHref.indexOf('#');
  if (anchorIndex !== -1) {
    anchor = cleanHref.substring(anchorIndex);
    cleanHref = cleanHref.substring(0, anchorIndex);
  }
  
  // Try to find by slug first (case-insensitive)
  const bySlug = findBySlugCaseInsensitive(cleanHref, fileMap.bySlug);
  if (bySlug) {
    return `${options.urlPrefix}/${bySlug.slug}${anchor}`;
  }
  
  // Try to resolve as a relative path
  const possiblePaths = [
    cleanHref + '.md',
    cleanHref,
    path.join(path.dirname(currentFilePath), cleanHref + '.md'),
    path.join(path.dirname(currentFilePath), cleanHref)
  ];
  
  for (const possiblePath of possiblePaths) {
    const normalized = path.normalize(possiblePath);
    const file = fileMap.byPath.get(normalized);
    if (file) {
      return `${options.urlPrefix}/${file.slug}${anchor}`;
    }
  }
  
  // Fallback - return the original href with prefix
  return `${options.urlPrefix}/${cleanHref}${anchor}`;
}