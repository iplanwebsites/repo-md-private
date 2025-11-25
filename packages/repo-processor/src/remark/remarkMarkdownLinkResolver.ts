import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import { resolveMarkdownLinkPath } from './customToLink';
import type { FileData } from '../types/core';

interface RemarkMarkdownLinkResolverOptions {
  filesByPath: Map<string, FileData>;
  urlPrefix: string;
  currentFilePath: string;
}

/**
 * Remark plugin to resolve markdown links with relative path resolution
 */
export const remarkMarkdownLinkResolver: Plugin<[RemarkMarkdownLinkResolverOptions], Root> = (options) => {
  const { filesByPath, urlPrefix, currentFilePath } = options;

  return (tree: Root) => {
    // Process regular markdown links
    visit(tree, 'link', (node: any) => {
      if (node.url && !node.url.startsWith(urlPrefix) && !node.url.startsWith('http')) {
        // Try to resolve the link path
        const targetFile = resolveMarkdownLinkPath(node.url, currentFilePath, filesByPath);
        
        if (targetFile) {
          // Extract anchor if present
          const anchorIndex = node.url.indexOf('#');
          const anchor = anchorIndex !== -1 ? node.url.substring(anchorIndex) : '';
          
          // Update the URL to use the target file's slug
          node.url = `${urlPrefix}/${targetFile.slug}${anchor}`;
        } else {
          // If not found by exact path match, try to find by filename
          const filename = node.url.replace(/\.md$/, '');
          
          // Search all files for a matching filename
          for (const [path, file] of filesByPath.entries()) {
            if (file.fileName === filename) {
              // Extract anchor if present
              const anchorIndex = node.url.indexOf('#');
              const anchor = anchorIndex !== -1 ? node.url.substring(anchorIndex) : '';
              
              node.url = `${urlPrefix}/${file.slug}${anchor}`;
              break;
            }
          }
        }
      }
    });
  };
};