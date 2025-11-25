import { ToLink } from "remark-obsidian-link";
import { wikiToObsidian } from "./toLinkBuilder";
import { FileData } from "../types/core";
import { IssueCollector } from "../services/issueCollector";
import path from "node:path";

interface CustomToLinkOptions {
  filesBySlug: Map<string, FileData>;
  filesByName: Map<string, FileData>;
  filesByPath: Map<string, FileData>;
  filesByAlias: Map<string, FileData[]>;
  urlPrefix: string;
  currentFile?: FileData;
  issueCollector?: IssueCollector;
}

/**
 * Creates a custom toLink function that resolves links using our file map
 */
export function createCustomToLink(options: CustomToLinkOptions): ToLink {
  const { filesBySlug, filesByName, filesByAlias, urlPrefix, currentFile, issueCollector } = options;
  
  return (wikiLink) => {
    const obsidianLink = wikiToObsidian(wikiLink);
    
    // Debug logging
    if (wikiLink.value.toLowerCase() === 'doggo' || 
        wikiLink.value.toLowerCase() === 'woofer' || 
        wikiLink.value.toLowerCase() === 'yapper') {
      console.log('🔍 Debug wikilink:', { 
        wikiLink, 
        obsidianLink,
        alias: obsidianLink.alias,
        page: obsidianLink.page
      });
    }
    
    switch (obsidianLink.type) {
      case "page":
      case "page-header":
      case "page-block": {
        // First try to find by slug (in case someone uses the slug directly)
        let targetFile = filesBySlug.get(obsidianLink.page);
        
        // If not found by slug, try by alias (case-insensitive)
        if (!targetFile) {
          const aliasCandidates = filesByAlias.get(obsidianLink.page.toLowerCase());
          if (aliasCandidates && aliasCandidates.length > 0) {
            // If multiple files have the same alias, prefer files in same directory
            if (aliasCandidates.length === 1) {
              targetFile = aliasCandidates[0];
            } else if (currentFile) {
              const currentDir = path.dirname(currentFile.originalFilePath);
              const sameDir = aliasCandidates.find(f => 
                path.dirname(f.originalFilePath) === currentDir
              );
              targetFile = sameDir || aliasCandidates[0];
            } else {
              targetFile = aliasCandidates[0];
            }
          }
        }
        
        // If not found by alias, try by filename
        if (!targetFile) {
          targetFile = filesByName.get(obsidianLink.page);
        }
        
        if (!targetFile) {
          // If still not found, create a broken link indicator
          // Use a special URI scheme to indicate this is a broken link
          console.warn(`⚠️ Broken wikilink: [[${obsidianLink.page}]] - target file not found or not public`);
          
          // Add to issue collector if available
          if (issueCollector && currentFile) {
            issueCollector.addBrokenLink({
              filePath: currentFile.originalFilePath,
              linkText: obsidianLink.alias || obsidianLink.page,
              linkTarget: obsidianLink.page,
              linkType: 'wiki'
            });
          }
          
          return { 
            value: obsidianLink.alias || obsidianLink.page,
            uri: `#broken-link:${obsidianLink.page}`
          };
        }
        
        // Build the URL using the target file's slug
        let uri = `${urlPrefix}/${targetFile.slug}`;
        
        // Add anchor if present
        if (obsidianLink.type === "page-header") {
          uri += `#${slugifyAnchor(obsidianLink.header)}`;
        }
        
        const result = {
          value: obsidianLink.alias || obsidianLink.page,
          uri
        };
        
        // Debug logging
        if (obsidianLink.page.toLowerCase() === 'doggo' || 
            obsidianLink.page.toLowerCase() === 'woofer' || 
            obsidianLink.page.toLowerCase() === 'yapper') {
          console.log('🔍 Debug result:', result);
        }
        
        return result;
      }
      
      case "header":
        // Internal header link
        return {
          value: obsidianLink.alias || `#${obsidianLink.header}`,
          uri: `#${slugifyAnchor(obsidianLink.header)}`
        };
        
      case "block":
        // Block references - just return as text for now
        return {
          value: obsidianLink.alias || `#^${obsidianLink.block}`,
          uri: ''
        };
        
      default:
        const _exhaustiveCheck: never = obsidianLink;
        return { value: String(obsidianLink), uri: '' };
    }
  };
}

function slugifyAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Resolve a markdown link path relative to the current file
 */
export function resolveMarkdownLinkPath(
  linkPath: string,
  currentFilePath: string,
  filesByPath: Map<string, FileData>
): FileData | null {
  // Skip external links and anchors
  if (linkPath.startsWith('http://') || 
      linkPath.startsWith('https://') ||
      linkPath.startsWith('mailto:') ||
      linkPath.startsWith('#')) {
    return null;
  }
  
  // Remove anchor if present
  const cleanPath = linkPath.split('#')[0];
  
  // Calculate the absolute path relative to current file
  const currentDir = path.dirname(currentFilePath);
  const resolvedPath = path.normalize(path.join(currentDir, cleanPath));
  
  // Try with and without .md extension
  const candidates = [
    resolvedPath,
    resolvedPath.replace(/\.md$/, '') + '.md'
  ];
  
  for (const candidate of candidates) {
    const file = filesByPath.get(candidate);
    if (file) return file;
  }
  
  return null;
}