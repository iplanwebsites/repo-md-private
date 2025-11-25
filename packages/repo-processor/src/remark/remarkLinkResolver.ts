import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import { buildFileMaps, resolveWikilink, wikilinkToMarkdownLink, resolveMarkdownLink, LinkResolverOptions } from '../lib/linkResolver';
import type { FileData } from '../types/core';

interface RemarkLinkResolverOptions {
  fileMap: ReturnType<typeof buildFileMaps>;
  linkResolverOptions: LinkResolverOptions;
  currentFilePath: string;
}

/**
 * Remark plugin to resolve wikilinks and markdown links with full file knowledge
 */
export const remarkLinkResolver: Plugin<[RemarkLinkResolverOptions], Root> = (options) => {
  const { fileMap, linkResolverOptions, currentFilePath } = options;

  return (tree: Root) => {
    // Process wikilinks first
    visit(tree, 'wikiLink', (node: any, index: number | null, parent: any) => {
      const { value, data } = node;
      const alias = data?.alias;
      
      // Resolve the wikilink to a file
      const targetFile = resolveWikilink(value, fileMap, currentFilePath);
      
      if (!targetFile) {
        // Convert to text node wrapped in brackets if we can't resolve it
        const textNode = {
          type: 'text',
          value: `[[${value}]]`
        };
        
        if (parent && index !== null) {
          parent.children[index] = textNode;
        }
        return;
      }
      
      // Convert to link node
      const { url, text } = wikilinkToMarkdownLink(value, alias, targetFile, linkResolverOptions);
      const linkNode = {
        type: 'link',
        url: url,
        children: [{ type: 'text', value: text }]
      };
      
      if (parent && index !== null) {
        parent.children[index] = linkNode;
      }
    });

    // Process regular markdown links
    visit(tree, 'link', (node: any) => {
      if (node.url) {
        node.url = resolveMarkdownLink(node.url, fileMap, currentFilePath, linkResolverOptions);
      }
    });
  };
};