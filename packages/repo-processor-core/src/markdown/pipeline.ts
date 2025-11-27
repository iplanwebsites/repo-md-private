/**
 * Markdown Processing Pipeline
 *
 * Core unified pipeline for converting markdown to HTML.
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
import type { VFile } from 'vfile';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the markdown pipeline
 */
export interface PipelineOptions {
  /** Enable GitHub Flavored Markdown */
  readonly gfm?: boolean;
  /** Allow raw HTML in markdown */
  readonly allowRawHtml?: boolean;
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
// Pipeline Creation
// ============================================================================

/**
 * Default pipeline options
 */
export const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = {
  gfm: true,
  allowRawHtml: true,
  remarkPlugins: [],
  rehypePlugins: [],
};

/**
 * Create a basic markdown to HTML processor
 * Uses 'any' for processor type to avoid complex unified generic constraints
 */
export const createBasePipeline = (options: PipelineOptions = {}): any => {
  const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };

  let processor: any = unified().use(remarkParse);

  // Add GFM support
  if (opts.gfm) {
    processor = processor.use(remarkGfm);
  }

  // Add custom remark plugins
  for (const { plugin, options: pluginOpts } of opts.remarkPlugins ?? []) {
    processor = processor.use(plugin as any, pluginOpts);
  }

  // Convert to HAST
  processor = processor.use(remarkRehype, {
    allowDangerousHtml: opts.allowRawHtml,
  });

  // Allow raw HTML
  if (opts.allowRawHtml) {
    processor = processor.use(rehypeRaw);
  }

  // Add slug IDs to headings (for TOC anchor links)
  processor = processor.use(rehypeSlug);

  // Add custom rehype plugins
  for (const { plugin, options: pluginOpts } of opts.rehypePlugins ?? []) {
    processor = processor.use(plugin as any, pluginOpts);
  }

  // Convert to string
  processor = processor.use(rehypeStringify);

  return processor;
};

/**
 * Parse markdown to MDAST
 */
export const parseToMdast = (markdown: string): MdastRoot => {
  const processor = unified().use(remarkParse).use(remarkGfm);
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
  const mdast = parseToMdast(markdown);

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
