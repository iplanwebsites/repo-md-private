// remarkMermaid.ts
import { Plugin } from 'unified';
import { Root, Code, HTML } from 'mdast';
import { visit } from 'unist-util-visit';

// Plugin options interface
export interface RemarkMermaidOptions {
  /**
   * Whether to wrap mermaid diagrams in a container div
   * @default true
   */
  wrapInContainer?: boolean;
  
  /**
   * CSS class name for the container div
   * @default 'mermaid-container'
   */
  containerClass?: string;
  
  /**
   * CSS class name for the mermaid diagram
   * @default 'mermaid'
   */
  mermaidClass?: string;
  
  /**
   * Whether to add a loading indicator placeholder
   * @default false
   */
  addLoadingIndicator?: boolean;
  
  /**
   * Custom theme for mermaid diagrams
   * @default undefined (uses default theme)
   */
  theme?: string;
}

/**
 * Remark plugin to transform mermaid code blocks into HTML elements suitable for client-side rendering
 * 
 * This plugin finds code blocks with the language set to 'mermaid' and transforms them into
 * HTML elements that can be rendered by mermaid.js on the client side.
 * 
 * @example
 * ```mermaid
 * graph TD
 *   A[Start] --> B[Process]
 *   B --> C[End]
 * ```
 * 
 * Will be transformed to:
 * ```html
 * <div class="mermaid-container">
 *   <pre class="mermaid">graph TD
 *   A[Start] --> B[Process]
 *   B --> C[End]</pre>
 * </div>
 * ```
 */
export const remarkMermaid: Plugin<[RemarkMermaidOptions?], Root> = (options = {}) => {
  // Set default options
  const {
    wrapInContainer = true,
    containerClass = 'mermaid-container',
    mermaidClass = 'mermaid',
    addLoadingIndicator = false,
    theme
  } = options;
  
  return (tree: Root) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      // Check if this is a mermaid code block
      if (!parent || typeof index !== 'number') return;
      if (node.lang !== 'mermaid') return;
      
      // Get the mermaid code content
      const mermaidCode = node.value;
      
      // Build the HTML for the mermaid diagram
      let html = '';
      
      if (wrapInContainer) {
        html += `<div class="${containerClass}">`;
        
        if (addLoadingIndicator) {
          html += '<div class="mermaid-loading">Loading diagram...</div>';
        }
      }
      
      // Create the pre element with mermaid class
      // The mermaid.js library will look for elements with this class
      const dataTheme = theme ? ` data-theme="${theme}"` : '';
      html += `<pre class="${mermaidClass}"${dataTheme}>${escapeHtml(mermaidCode)}</pre>`;
      
      if (wrapInContainer) {
        html += '</div>';
      }
      
      // Create an HTML node to replace the code block
      const htmlNode: HTML = {
        type: 'html',
        value: html
      };
      
      // Replace the code node with the HTML node
      parent.children[index] = htmlNode;
    });
  };
};

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, (char) => map[char]);
}