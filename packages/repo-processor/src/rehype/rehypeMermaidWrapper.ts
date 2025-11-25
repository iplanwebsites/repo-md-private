import type { Plugin } from 'unified'
import type { Root } from 'hast'
import type { VFile } from 'vfile'

export interface RehypeMermaidOptions {
  strategy?: 'img-png' | 'img-svg' | 'inline-svg' | 'pre-mermaid'
  dark?: boolean
  prefix?: string
  mermaidConfig?: Record<string, any>
  errorFallback?: (element: any, diagram: string, error: Error, file: VFile) => any
}

let rehypeMermaidPlugin: Plugin<[RehypeMermaidOptions?], Root> | null = null
let importError: Error | null = null

// Try to dynamically import rehype-mermaid
async function loadRehypeMermaid() {
  if (rehypeMermaidPlugin !== null || importError !== null) {
    return
  }
  
  try {
    const { default: rehypeMermaid } = await import('rehype-mermaid')
    rehypeMermaidPlugin = rehypeMermaid as Plugin<[RehypeMermaidOptions?], Root>
  } catch (error) {
    importError = error as Error
    console.warn('Failed to load rehype-mermaid:', error)
    console.warn('Mermaid diagrams will be rendered as code blocks.')
    console.warn('To enable Mermaid rendering, install required dependencies:')
    console.warn('  npm install rehype-mermaid playwright')
    console.warn('  npx playwright install --with-deps chromium')
  }
}

/**
 * Wrapper for rehype-mermaid that gracefully handles missing dependencies
 * 
 * This plugin attempts to use rehype-mermaid to render Mermaid diagrams.
 * If the dependencies are not available (e.g., Playwright not installed),
 * it will fallback to leaving the diagrams as code blocks.
 */
export const rehypeMermaidWrapper: Plugin<[RehypeMermaidOptions?], Root> = function(options = {}) {
  return async (tree, file) => {
    // Try to use the real rehype-mermaid plugin with dynamic import
    try {
      const { default: rehypeMermaid } = await import('rehype-mermaid')
      
      // Create a new processor just for this tree
      const { unified } = await import('unified')
      const tempProcessor = unified()
        .use(rehypeMermaid as Plugin<[RehypeMermaidOptions?], Root>, options)
      
      const result = await tempProcessor.run(tree, file)
      return result as Root
      
    } catch (error) {
      console.warn('Failed to load or run rehype-mermaid:', error)
      console.warn('Mermaid diagrams will be rendered as code blocks.')
      console.warn('To enable Mermaid rendering, install required dependencies:')
      console.warn('  npm install rehype-mermaid playwright')
      console.warn('  npx playwright install --with-deps chromium')
    }
    
    // Return tree unchanged if plugin not available or failed
    return tree
  }
}

/**
 * Synchronous version that always returns the tree unchanged if async loading fails
 * Use this if you need a fully synchronous pipeline
 */
export const rehypeMermaidWrapperSync: Plugin<[RehypeMermaidOptions?], Root> = function(options = {}) {
  return (tree, file) => {
    // If plugin is already loaded, try to use it
    if (rehypeMermaidPlugin) {
      try {
        const processor = rehypeMermaidPlugin.call(this, options)
        // Note: This assumes the plugin can work synchronously
        return processor(tree, file) as Root
      } catch (error) {
        console.warn(`Failed to render Mermaid diagram in ${file.path}:`, error)
      }
    } else if (importError === null) {
      // Plugin hasn't been loaded yet
      console.warn('rehype-mermaid has not been loaded. Use async version or pre-load the plugin.')
    }
    
    // Return tree unchanged
    return tree
  }
}

// Pre-load the plugin on module initialization
loadRehypeMermaid().catch(() => {
  // Error already handled in loadRehypeMermaid
})