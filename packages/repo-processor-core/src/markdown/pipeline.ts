/**
 * Markdown Processing Pipeline
 *
 * Core unified pipeline for converting markdown to HTML.
 * Supports Obsidian-style markdown with wiki-links, callouts, and embeds.
 * Extensible through plugins and options.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import matter from 'gray-matter';
import type { Root as MdastRoot } from 'mdast';
import type { Root as HastRoot } from 'hast';

// Obsidian & Content plugins
import remarkCallouts from 'remark-callouts';
import remarkMath from 'remark-math';
import { remarkObsidianLink } from 'remark-obsidian-link';
import remarkYoutube from 'remark-youtube';

// Rehype plugins
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeHighlight from 'rehype-highlight';
import rehypeMathjaxChtml from 'rehype-mathjax/chtml';

// Languages for syntax highlighting
import { all as allLowlightLanguages } from 'lowlight';

// Custom media plugins
import { remarkObsidianMedia } from './remarkObsidianMedia.js';
import { remarkMdImages } from './remarkMdImages.js';
import type { MediaService } from './mediaService.js';

// Re-export media service for convenience
export { MediaService, createMediaService } from './mediaService.js';
export type { MediaServiceOptions, MediaLookupMap, MediaResolveResult } from './mediaService.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Wiki-link object as passed by remark-obsidian-link
 */
export interface WikiLink {
  value: string;
  alias?: string;
}

/**
 * Wiki-link resolver function type
 * Takes a wiki-link object and returns the resolved link info
 */
export type WikiLinkResolver = (wikiLink: WikiLink) => {
  value: string;
  uri: string;
  exists?: boolean;
};

/**
 * Options for the markdown pipeline
 */
export interface PipelineOptions {
  /** Enable GitHub Flavored Markdown (tables, strikethrough, etc.) */
  readonly gfm?: boolean;
  /** Allow raw HTML in markdown */
  readonly allowRawHtml?: boolean;

  // Obsidian features
  /** Enable wiki-link syntax [[page]] */
  readonly wikiLinks?: boolean;
  /** Custom wiki-link resolver function */
  readonly wikiLinkResolver?: WikiLinkResolver;
  /** Enable Obsidian callouts (> [!NOTE]) */
  readonly callouts?: boolean;
  /** Enable Obsidian media embeds ![[image.jpg]] */
  readonly obsidianMedia?: boolean;

  // Code & Math
  /** Enable syntax highlighting for code blocks */
  readonly syntaxHighlighting?: boolean;
  /** Enable LaTeX math expressions ($..$ and $$..$$) */
  readonly parseFormulas?: boolean;

  // Links
  /** Add target="_blank" to external links */
  readonly externalLinks?: boolean;
  /** Wrap headings with anchor links */
  readonly autolinkHeadings?: boolean;

  // Media
  /** Enable markdown image path resolution */
  readonly resolveImagePaths?: boolean;
  /** Media service for path resolution (used by obsidianMedia and resolveImagePaths) */
  readonly mediaService?: MediaService;
  /** Current file path for relative resolution */
  readonly currentFilePath?: string;

  // Embeds
  /** Enable YouTube video embeds */
  readonly youtubeEmbeds?: boolean;

  /** Custom remark plugins to add */
  readonly remarkPlugins?: readonly RemarkPlugin[];
  /** Custom rehype plugins to add */
  readonly rehypePlugins?: readonly RehypePlugin[];
}

/**
 * A remark plugin with optional options
 */
export interface RemarkPlugin {
  readonly plugin: unknown;
  readonly options?: unknown;
}

/**
 * A rehype plugin with optional options
 */
export interface RehypePlugin {
  readonly plugin: unknown;
  readonly options?: unknown;
}

/**
 * Result of parsing frontmatter
 */
export interface FrontmatterResult {
  readonly content: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * Result of processing markdown
 */
export interface MarkdownResult {
  /** Processed HTML content */
  readonly html: string;
  /** Original markdown (without frontmatter) */
  readonly markdown: string;
  /** Parsed frontmatter data */
  readonly frontmatter: Readonly<Record<string, unknown>>;
  /** MDAST root node */
  readonly mdast: MdastRoot;
  /** HAST root node */
  readonly hast: HastRoot;
}

// ============================================================================
// Frontmatter Processing
// ============================================================================

/**
 * Parse frontmatter from markdown content
 */
export const parseFrontmatter = (content: string): FrontmatterResult => {
  const { content: markdown, data } = matter(content);
  return {
    content: markdown,
    data,
  };
};

// ============================================================================
// Default Wiki-Link Resolver
// ============================================================================

/**
 * Default wiki-link resolver that creates simple links
 * In real usage, this should be replaced with a resolver that knows about the vault
 */
const defaultWikiLinkResolver: WikiLinkResolver = (wikiLink: WikiLink) => {
  const { value, alias } = wikiLink;

  // Simple slugification
  const slug = value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');

  return {
    value: alias ?? value,
    uri: `/${slug}`,
    exists: true,
  };
};

// ============================================================================
// Pipeline Creation
// ============================================================================

/**
 * Default pipeline options - all features enabled for full Obsidian compatibility
 */
export const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = {
  gfm: true,
  allowRawHtml: true,
  wikiLinks: true,
  callouts: true,
  obsidianMedia: true, // Enable ![[image.jpg]] syntax
  syntaxHighlighting: true,
  parseFormulas: false, // Disabled by default (requires MathJax CSS)
  externalLinks: true,
  autolinkHeadings: true,
  resolveImagePaths: true, // Enable ![](path) resolution
  youtubeEmbeds: true,
  remarkPlugins: [],
  rehypePlugins: [],
};

/**
 * Create a markdown to HTML processor with full Obsidian support
 * Uses 'any' for processor type to avoid complex unified generic constraints
 */
export const createBasePipeline = (options: PipelineOptions = {}): any => {
  const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };

  let processor: any = unified().use(remarkParse);

  // -------------------------------------------------------------------------
  // Remark plugins (Markdown AST transformations)
  // -------------------------------------------------------------------------

  // Add GFM support (tables, strikethrough, task lists, autolinks)
  if (opts.gfm) {
    processor = processor.use(remarkGfm);
  }

  // Add wiki-link support [[page]] and [[page|alias]]
  if (opts.wikiLinks) {
    const resolver = opts.wikiLinkResolver ?? defaultWikiLinkResolver;
    processor = processor.use(remarkObsidianLink, {
      toLink: (wikiLink: WikiLink) => resolver(wikiLink),
    });
  }

  // Add YouTube video embeds
  if (opts.youtubeEmbeds) {
    processor = processor.use(remarkYoutube, { noHardcodedSize: true });
  }

  // Add Obsidian-style callouts (> [!NOTE], > [!WARNING], etc.)
  if (opts.callouts) {
    processor = processor.use(remarkCallouts);
  }

  // Add Obsidian media embeds ![[image.jpg]]
  if (opts.obsidianMedia) {
    processor = processor.use(remarkObsidianMedia, {
      mediaService: opts.mediaService,
      currentFilePath: opts.currentFilePath,
    });
  }

  // Add markdown image path resolution ![alt](path)
  if (opts.resolveImagePaths) {
    processor = processor.use(remarkMdImages, {
      mediaService: opts.mediaService,
      currentFilePath: opts.currentFilePath,
    });
  }

  // Add LaTeX math support ($..$ and $$..$$ blocks)
  if (opts.parseFormulas) {
    processor = processor.use(remarkMath);
  }

  // Add custom remark plugins
  for (const { plugin, options: pluginOpts } of opts.remarkPlugins ?? []) {
    processor = processor.use(plugin as any, pluginOpts);
  }

  // -------------------------------------------------------------------------
  // Convert MDAST to HAST
  // -------------------------------------------------------------------------

  processor = processor.use(remarkRehype, {
    allowDangerousHtml: opts.allowRawHtml,
  });

  // Allow raw HTML passthrough
  if (opts.allowRawHtml) {
    processor = processor.use(rehypeRaw);
  }

  // -------------------------------------------------------------------------
  // Rehype plugins (HTML AST transformations)
  // -------------------------------------------------------------------------

  // Add external links handling (target="_blank", rel="noopener")
  if (opts.externalLinks) {
    processor = processor.use(rehypeExternalLinks, {
      target: '_blank',
      rel: ['noopener', 'noreferrer'],
    });
  }

  // Add slug IDs to headings (for TOC anchor links)
  processor = processor.use(rehypeSlug);

  // Wrap headings with anchor links
  if (opts.autolinkHeadings) {
    processor = processor.use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
    });
  }

  // Add syntax highlighting for code blocks
  if (opts.syntaxHighlighting) {
    processor = processor.use(rehypeHighlight, {
      languages: allLowlightLanguages,
    });
  }

  // Render LaTeX math to HTML
  if (opts.parseFormulas) {
    processor = processor.use(rehypeMathjaxChtml, {
      chtml: {
        fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2',
      },
    });
  }

  // Add custom rehype plugins
  for (const { plugin, options: pluginOpts } of opts.rehypePlugins ?? []) {
    processor = processor.use(plugin as any, pluginOpts);
  }

  // Convert to string
  processor = processor.use(rehypeStringify, {
    allowDangerousHtml: opts.allowRawHtml,
  });

  return processor;
};

/**
 * Parse markdown to MDAST
 */
export const parseToMdast = (markdown: string, options: PipelineOptions = {}): MdastRoot => {
  let processor: any = unified().use(remarkParse);

  if (options.gfm !== false) {
    processor = processor.use(remarkGfm);
  }

  return processor.parse(markdown) as MdastRoot;
};

/**
 * Convert MDAST to HAST
 */
export const mdastToHast = async (
  mdast: MdastRoot,
  options: { allowDangerousHtml?: boolean } = {}
): Promise<HastRoot> => {
  const processor: any = unified()
    .use(remarkRehype, { allowDangerousHtml: options.allowDangerousHtml ?? true })
    .use(rehypeRaw)
    .use(rehypeSlug); // Add IDs to headings

  const result = await processor.run(mdast);
  return result as HastRoot;
};

/**
 * Convert HAST to HTML string
 */
export const hastToHtml = (hast: HastRoot): string => {
  const processor: any = unified().use(rehypeStringify);
  return processor.stringify(hast);
};

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process markdown content to HTML with full metadata
 */
export const processMarkdown = async (
  content: string,
  options: PipelineOptions = {}
): Promise<MarkdownResult> => {
  // Parse frontmatter first
  const { content: markdown, data: frontmatter } = parseFrontmatter(content);

  // Parse to MDAST
  const mdast = parseToMdast(markdown, options);

  // Create pipeline
  const pipeline = createBasePipeline(options);

  // Process through pipeline
  const file = await pipeline.process(markdown);

  // Get HAST (we need to run partial pipeline for this)
  const hast = await mdastToHast(mdast, {
    allowDangerousHtml: options.allowRawHtml ?? true,
  });

  return {
    html: String(file),
    markdown,
    frontmatter,
    mdast,
    hast,
  };
};

// ============================================================================
// AST Utilities
// ============================================================================

/**
 * Extract text content from MDAST
 */
export const mdastToText = (node: MdastRoot): string => {
  const parts: string[] = [];

  const visit = (n: any) => {
    if (n.type === 'text' || n.type === 'inlineCode') {
      parts.push(n.value);
    }
    if (n.children) {
      for (const child of n.children) {
        visit(child);
      }
    }
  };

  visit(node);
  return parts.join(' ');
};

/**
 * Extract first paragraph text from MDAST
 */
export const extractFirstParagraph = (mdast: MdastRoot): string => {
  for (const node of mdast.children) {
    if (node.type === 'paragraph') {
      return mdastToText({ type: 'root', children: [node] });
    }
  }
  return '';
};

/**
 * Extract headings from MDAST
 */
export const extractHeadings = (
  mdast: MdastRoot
): readonly { depth: number; text: string }[] => {
  const headings: { depth: number; text: string }[] = [];

  const visit = (node: any) => {
    if (node.type === 'heading') {
      headings.push({
        depth: node.depth,
        text: mdastToText({ type: 'root', children: node.children }),
      });
    }
    if (node.children) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  visit(mdast);
  return headings;
};

/**
 * Build table of contents from headings
 */
export const buildToc = (
  headings: readonly { depth: number; text: string }[]
): readonly { depth: number; text: string; slug: string }[] => {
  const slugify = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

  return headings.map((h) => ({
    ...h,
    slug: slugify(h.text),
  }));
};
