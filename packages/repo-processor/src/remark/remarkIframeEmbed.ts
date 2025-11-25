// remarkIframeEmbed.ts
import { Plugin } from 'unified';
import { Root, Code, HTML, Link, Text } from 'mdast';
import { visit } from 'unist-util-visit';

// Content type features that can be toggled
export interface IframeEmbedFeatures {
  mermaid?: boolean;
  html?: boolean;
  markdown?: boolean;
  code?: boolean;
  video?: boolean;
  midi?: boolean;
  model3d?: boolean;
}

// URL pattern detection configuration
export interface UrlPatternConfig {
  pattern: RegExp;
  contentType: string;
  extractUrl?: (match: RegExpMatchArray) => string;
  extractFormat?: (match: RegExpMatchArray) => string;
}

// Plugin options interface
export interface RemarkIframeEmbedOptions {
  /**
   * Base URL for the iframe service
   * @default 'https://iframe.repo.md'
   */
  baseUrl?: string;

  /**
   * Feature toggles for different content types
   */
  features?: IframeEmbedFeatures;

  /**
   * Custom iframe attributes
   */
  iframeAttributes?: Record<string, string>;

  /**
   * Content encoding options
   */
  encoding?: {
    method?: 'base64' | 'url';
    urlEncode?: boolean;
  };

  /**
   * URL pattern configurations for detecting naked URLs
   */
  urlPatterns?: UrlPatternConfig[];

  /**
   * Whether to process naked URLs (not in links)
   */
  processNakedUrls?: boolean;

  /**
   * Whether to process URLs in links
   */
  processLinks?: boolean;

  /**
   * Custom transformers for additional content types
   */
  customTransformers?: Record<string, (content: string, baseUrl: string, encoding: any, options?: any) => string>;

  /**
   * Advanced feature configuration
   */
  advancedFeatures?: {
    [key: string]: boolean | {
      enabled: boolean;
      condition?: (content: string) => boolean;
      attributes?: Record<string, string>;
      languages?: string[];
      minLines?: number;
      maxLines?: number;
      processUrls?: boolean;
    };
  };

  /**
   * Height configuration for different content types
   */
  heights?: {
    default?: string;
    mermaid?: string;
    html?: string;
    markdown?: string;
    code?: string;
    video?: string;
    midi?: string;
    model3d?: string;
    [key: string]: string | undefined;
  };

  /**
   * Security settings
   */
  security?: {
    sandbox?: string;
    allowedDomains?: string[];
    blockDomains?: string[];
  };
}

// Default URL patterns for naked URL detection
const defaultUrlPatterns: UrlPatternConfig[] = [
  // MIDI files
  {
    pattern: /https?:\/\/[^\s]+\.(mid|midi)(\?[^\s]*)?/i,
    contentType: 'midi',
    extractUrl: (match) => match[0]
  },
  
  // 3D model files
  {
    pattern: /https?:\/\/[^\s]+\.(gltf|glb|obj|stl|fbx|dae|3ds|ply)(\?[^\s]*)?/i,
    contentType: 'model3d',
    extractUrl: (match) => match[0],
    extractFormat: (match) => {
      const url = match[0];
      const extension = url.match(/\.(gltf|glb|obj|stl|fbx|dae|3ds|ply)/i)?.[1];
      return extension?.toLowerCase() || 'gltf';
    }
  },
  
  // Video files
  {
    pattern: /https?:\/\/[^\s]+\.(mp4|webm|ogv|mov)(\?[^\s]*)?/i,
    contentType: 'video',
    extractUrl: (match) => match[0]
  },
  
  // GitHub gists (as code)
  {
    pattern: /https?:\/\/gist\.github\.com\/[^\s]+/i,
    contentType: 'code',
    extractUrl: (match) => match[0]
  },
  
  // CodePen URLs
  {
    pattern: /https?:\/\/codepen\.io\/[^\s]+\/pen\/[^\s]+/i,
    contentType: 'html',
    extractUrl: (match) => match[0]
  },
  
  // JSFiddle URLs
  {
    pattern: /https?:\/\/jsfiddle\.net\/[^\s]+/i,
    contentType: 'html',
    extractUrl: (match) => match[0]
  }
];

// Language mappings for better detection
const languageMappings: Record<string, string> = {
  'mermaid': 'mermaid',
  'mmd': 'mermaid',
  'diagram': 'mermaid',
  'flowchart': 'mermaid',
  'sequencediagram': 'mermaid',
  'gantt': 'mermaid',
  'classDiagram': 'mermaid',
  'stateDiagram': 'mermaid',
  'erDiagram': 'mermaid',
  'journey': 'mermaid',
  'gitGraph': 'mermaid',
  'pie': 'mermaid',
  
  'html': 'html',
  'htm': 'html',
  'xhtml': 'html',
  
  'md': 'markdown',
  'markdown': 'markdown',
  'mkd': 'markdown',
  'mdwn': 'markdown',
  'mdtxt': 'markdown',
  'mdtext': 'markdown',
  'text': 'markdown',
  
  'js': 'code',
  'javascript': 'code',
  'ts': 'code',
  'typescript': 'code',
  'jsx': 'code',
  'tsx': 'code',
  'python': 'code',
  'py': 'code',
  'java': 'code',
  'cpp': 'code',
  'c++': 'code',
  'c': 'code',
  'cs': 'code',
  'csharp': 'code',
  'c#': 'code',
  'go': 'code',
  'golang': 'code',
  'rust': 'code',
  'rs': 'code',
  'ruby': 'code',
  'rb': 'code',
  'php': 'code',
  'swift': 'code',
  'kotlin': 'code',
  'kt': 'code',
  'scala': 'code',
  'r': 'code',
  'matlab': 'code',
  'perl': 'code',
  'pl': 'code',
  'bash': 'code',
  'sh': 'code',
  'shell': 'code',
  'powershell': 'code',
  'ps1': 'code',
  'sql': 'code',
  'css': 'code',
  'scss': 'code',
  'sass': 'code',
  'less': 'code',
  'json': 'code',
  'xml': 'code',
  'yaml': 'code',
  'yml': 'code',
  'toml': 'code',
  'ini': 'code',
  'dockerfile': 'code',
  'makefile': 'code',
  'cmake': 'code',
  'gradle': 'code',
  
  'mp4': 'video',
  'webm': 'video',
  'ogv': 'video',
  'mov': 'video',
  'avi': 'video',
  'video': 'video',
  
  'mid': 'midi',
  'midi': 'midi',
  
  'gltf': 'model3d',
  'glb': 'model3d',
  'obj': 'model3d',
  'stl': 'model3d',
  'fbx': 'model3d',
  'dae': 'model3d',
  '3ds': 'model3d',
  'ply': 'model3d',
  'model': 'model3d',
  '3d': 'model3d'
};

/**
 * Encode content for URL usage
 */
function encodeContent(content: string, method: 'base64' | 'url' = 'base64', urlEncode: boolean = true): string {
  let encoded: string;
  
  switch (method) {
    case 'base64':
      // Use browser-compatible base64 encoding
      if (typeof btoa !== 'undefined') {
        encoded = btoa(unescape(encodeURIComponent(content)));
      } else {
        // Node.js environment
        encoded = Buffer.from(content, 'utf-8').toString('base64');
      }
      break;
    case 'url':
      encoded = encodeURIComponent(content);
      break;
    default:
      throw new Error(`Unsupported encoding method: ${method}`);
  }
  
  return urlEncode ? encodeURIComponent(encoded) : encoded;
}

// URL builders for different content types
const urlBuilders: Record<string, (content: string, baseUrl: string, encoding: any, options?: any) => string> = {
  mermaid: (content, baseUrl, encoding) => 
    `${baseUrl}/mermaid/${encodeContent(content, encoding.method, encoding.urlEncode)}`,
  
  html: (content, baseUrl, encoding) => 
    `${baseUrl}/html/${encodeContent(content, encoding.method, encoding.urlEncode)}`,
  
  markdown: (content, baseUrl, encoding) => 
    `${baseUrl}/markdown/${encodeContent(content, encoding.method, encoding.urlEncode)}`,
  
  code: (content, baseUrl, encoding, options) => {
    const language = options?.language || 'javascript';
    return `${baseUrl}/code/${language}/${encodeContent(content, encoding.method, encoding.urlEncode)}`;
  },
  
  video: (content, baseUrl, encoding, options) => {
    if (options?.isUrl) {
      return `${baseUrl}/video/url/${encodeContent(content, encoding.method, encoding.urlEncode)}`;
    }
    return `${baseUrl}/video/data/${encodeContent(content, encoding.method, encoding.urlEncode)}`;
  },
  
  midi: (content, baseUrl, encoding, options) => {
    if (options?.isUrl) {
      return `${baseUrl}/midi/url/${encodeContent(content, encoding.method, encoding.urlEncode)}`;
    }
    return `${baseUrl}/midi/data/${encodeContent(content, encoding.method, encoding.urlEncode)}`;
  },
  
  model3d: (content, baseUrl, encoding, options) => {
    const format = options?.format || 'gltf';
    if (options?.isUrl) {
      return `${baseUrl}/model3d/url/${format}/${encodeContent(content, encoding.method, encoding.urlEncode)}`;
    }
    return `${baseUrl}/model3d/data/${format}/${encodeContent(content, encoding.method, encoding.urlEncode)}`;
  }
};

/**
 * Check if a URL should be blocked based on security settings
 */
function isUrlAllowed(url: string, security?: RemarkIframeEmbedOptions['security']): boolean {
  if (!security) return true;
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // Check blocked domains
    if (security.blockDomains?.some(blocked => domain.includes(blocked))) {
      return false;
    }
    
    // If allowedDomains is specified, check if domain is in the list
    if (security.allowedDomains && security.allowedDomains.length > 0) {
      return security.allowedDomains.some(allowed => domain.includes(allowed));
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a feature should be transformed
 */
function shouldTransform(
  contentType: string, 
  content: string, 
  lang: string | null | undefined,
  features: IframeEmbedFeatures,
  advancedFeatures?: RemarkIframeEmbedOptions['advancedFeatures'],
  hasUrlBuilder?: boolean
): boolean {
  // Check basic features first
  const basicFeature = features[contentType as keyof IframeEmbedFeatures];
  
  // If basic feature is explicitly false, don't transform
  if (basicFeature === false) return false;
  
  // Check advanced features
  if (advancedFeatures && advancedFeatures[contentType]) {
    const feature = advancedFeatures[contentType];
    
    // Simple boolean check
    if (typeof feature === 'boolean') return feature;
    
    // Complex object configuration
    if (!feature.enabled) return false;
    
    // Check conditions
    if (feature.condition && !feature.condition(content)) return false;
    
    // Check language restrictions for code
    if (feature.languages && lang && !feature.languages.includes(lang)) return false;
    
    // Check minimum lines
    if (feature.minLines && content.split('\n').length < feature.minLines) return false;
    
    // Check maximum lines
    if (feature.maxLines && content.split('\n').length > feature.maxLines) return false;
    
    // If we get here, advanced feature is enabled
    return true;
  }
  
  // If basic feature is true, transform it
  if (basicFeature === true) return true;
  
  // For custom content types (not in basic features), check if there's a URL builder
  // and if advanced features enable it
  if (basicFeature === undefined && hasUrlBuilder && advancedFeatures && advancedFeatures[contentType]) {
    return true;
  }
  
  // Default to false
  return false;
}

/**
 * Get iframe attributes for a content type
 */
function getIframeAttributes(
  contentType: string,
  config: RemarkIframeEmbedOptions
): Record<string, string> {
  const baseAttrs = { ...config.iframeAttributes };
  
  // Apply content-type specific height
  if (config.heights && config.heights[contentType]) {
    baseAttrs.height = config.heights[contentType]!;
  } else if (config.heights?.default) {
    baseAttrs.height = config.heights.default;
  }
  
  // Apply advanced feature attributes
  if (config.advancedFeatures && config.advancedFeatures[contentType]) {
    const feature = config.advancedFeatures[contentType];
    if (typeof feature === 'object' && feature.attributes) {
      Object.assign(baseAttrs, feature.attributes);
    }
  }
  
  // Apply security settings
  if (config.security?.sandbox) {
    baseAttrs.sandbox = config.security.sandbox;
  }
  
  return baseAttrs;
}

/**
 * Create an iframe HTML node with optional wrapper for aspect ratio
 */
function createIframeNode(url: string, attributes: Record<string, string>, contentType?: string): HTML {
  const attrs = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  
  // Add content type class if provided
  const className = contentType ? `repo-iframe repo-iframe-${contentType}` : 'repo-iframe';
  
  // For video content, use responsive wrapper
  if (contentType === 'video') {
    return {
      type: 'html',
      value: `<div class="${className}-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
      <iframe src="${url}" ${attrs} style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>`
    };
  }
  
  // For other content, add class to iframe directly
  const classAttr = attributes.class ? `${attributes.class} ${className}` : className;
  const finalAttrs = attrs.replace(/class="[^"]*"/, `class="${classAttr}"`);
  
  return {
    type: 'html',
    value: `<iframe src="${url}" ${finalAttrs.includes('class=') ? finalAttrs : `${attrs} class="${className}"`}></iframe>`
  };
}

/**
 * Remark plugin to transform code blocks and URLs into iframe embeds
 * 
 * This plugin finds code blocks with specific languages and naked URLs,
 * then transforms them into iframe embeds using the repo.md iframe service.
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
 * <iframe src="https://iframe.repo.md/mermaid/..." width="100%" height="400px"></iframe>
 * ```
 * 
 * Also transforms naked URLs:
 * https://example.com/song.midi
 * https://example.com/model.glb
 */
export const remarkIframeEmbed: Plugin<[RemarkIframeEmbedOptions?], Root> = (options = {}) => {
  // Merge default config with user options
  const config: RemarkIframeEmbedOptions = {
    baseUrl: 'https://iframe.repo.md',
    features: {
      mermaid: false, // Default to false - use rehype-mermaid instead of iframe embedding
      html: false,
      markdown: false,
      code: false,
      video: true,
      midi: true,
      model3d: true,
      ...options.features
    },
    iframeAttributes: {
      width: '100%',
      height: '400px',
      frameborder: '0',
      sandbox: 'allow-scripts allow-same-origin',
      allow: 'fullscreen',
      allowfullscreen: 'true',
      ...options.iframeAttributes
    },
    encoding: {
      method: 'base64',
      urlEncode: true,
      ...options.encoding
    },
    urlPatterns: options.urlPatterns || defaultUrlPatterns,
    processNakedUrls: options.processNakedUrls ?? true,
    processLinks: options.processLinks ?? true,
    customTransformers: options.customTransformers || {},
    advancedFeatures: options.advancedFeatures,
    heights: {
      default: '400px',
      mermaid: '600px',    // Diagrams often need more height
      html: '400px',
      markdown: '300px',
      code: '400px',       // Code blocks benefit from more height
      video: '480px',      // 16:9 aspect ratio for 854px width
      midi: '120px',       // Minimal player height
      model3d: '600px',    // 3D viewers need space
      ...options.heights
    },
    security: options.security,
    ...options
  };

  // Combine built-in and custom URL builders
  const allUrlBuilders = { ...urlBuilders, ...config.customTransformers };

  return (tree: Root) => {
    // Process code blocks
    visit(tree, 'code', (node: Code, index, parent) => {
      // Check if this is a valid code block
      if (!parent || typeof index !== 'number') return;
      if (!node.lang) return;
      
      // Map language to content type
      const contentType = languageMappings[node.lang.toLowerCase()] || node.lang;
      
      // Check if URL builder exists for this type
      const hasUrlBuilder = contentType in allUrlBuilders;
      
      // Check if this content type should be transformed
      if (!shouldTransform(contentType, node.value, node.lang, config.features!, config.advancedFeatures, hasUrlBuilder)) {
        return;
      }
      
      // Skip if no URL builder for this type
      if (!allUrlBuilders[contentType]) return;
      
      // Generate iframe URL
      const iframeUrl = allUrlBuilders[contentType](
        node.value, 
        config.baseUrl!, 
        config.encoding!, 
        contentType === 'code' ? { language: node.lang } : undefined
      );
      
      // Get iframe attributes
      const iframeAttrs = getIframeAttributes(contentType, config);
      
      // Create and replace with iframe node
      parent.children[index] = createIframeNode(iframeUrl, iframeAttrs, contentType);
    });
    
    // Process naked URLs if enabled
    if (config.processNakedUrls) {
      visit(tree, 'text', (node: Text, index, parent) => {
        if (!parent || typeof index !== 'number') return;
        
        const text = node.value;
        const newNodes: Array<Text | HTML> = [];
        let lastIndex = 0;
        
        // Try each URL pattern
        for (const patternConfig of config.urlPatterns!) {
          const regex = new RegExp(patternConfig.pattern.source, patternConfig.pattern.flags + 'g');
          let match;
          
          while ((match = regex.exec(text)) !== null) {
            const url = patternConfig.extractUrl ? patternConfig.extractUrl(match) : match[0];
            
            // Check if URL is allowed
            if (!isUrlAllowed(url, config.security)) continue;
            
            // Check if this content type is enabled
            if (!shouldTransform(patternConfig.contentType, url, null, config.features!, config.advancedFeatures, true)) {
              continue;
            }
            
            // Add text before the URL
            if (match.index > lastIndex) {
              newNodes.push({
                type: 'text',
                value: text.slice(lastIndex, match.index)
              });
            }
            
            // Build iframe URL
            const urlBuilderOptions: any = { isUrl: true };
            if (patternConfig.extractFormat) {
              urlBuilderOptions.format = patternConfig.extractFormat(match);
            }
            
            const iframeUrl = allUrlBuilders[patternConfig.contentType](
              url,
              config.baseUrl!,
              config.encoding!,
              urlBuilderOptions
            );
            
            // Get iframe attributes
            const iframeAttrs = getIframeAttributes(patternConfig.contentType, config);
            
            // Add iframe node
            newNodes.push(createIframeNode(iframeUrl, iframeAttrs, patternConfig.contentType));
            
            lastIndex = match.index + match[0].length;
          }
        }
        
        // If we found URLs, replace the text node
        if (newNodes.length > 0) {
          // Add remaining text
          if (lastIndex < text.length) {
            newNodes.push({
              type: 'text',
              value: text.slice(lastIndex)
            });
          }
          
          // Replace the single text node with our new nodes
          parent.children.splice(index, 1, ...newNodes);
        }
      });
    }
    
    // Process links if enabled
    if (config.processLinks) {
      visit(tree, 'link', (node: Link, index, parent) => {
        if (!parent || typeof index !== 'number') return;
        
        const url = node.url;
        
        // Check each URL pattern
        for (const patternConfig of config.urlPatterns!) {
          if (patternConfig.pattern.test(url)) {
            // Check if URL is allowed
            if (!isUrlAllowed(url, config.security)) continue;
            
            // Check if this content type is enabled
            if (!shouldTransform(patternConfig.contentType, url, null, config.features!, config.advancedFeatures, true)) {
              continue;
            }
            
            // Build iframe URL
            const urlBuilderOptions: any = { isUrl: true };
            if (patternConfig.extractFormat) {
              const match = url.match(patternConfig.pattern);
              if (match) {
                urlBuilderOptions.format = patternConfig.extractFormat(match);
              }
            }
            
            const iframeUrl = allUrlBuilders[patternConfig.contentType](
              url,
              config.baseUrl!,
              config.encoding!,
              urlBuilderOptions
            );
            
            // Get iframe attributes
            const iframeAttrs = getIframeAttributes(patternConfig.contentType, config);
            
            // Replace link with iframe
            parent.children[index] = createIframeNode(iframeUrl, iframeAttrs, patternConfig.contentType);
            break;
          }
        }
      });
    }
  };
};

// Export types and defaults for convenience
export { defaultUrlPatterns, languageMappings };
export default remarkIframeEmbed;