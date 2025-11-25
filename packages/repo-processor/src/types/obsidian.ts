// Obsidian-specific types
import { WikiLink as _WikiLink } from "remark-obsidian-link";
import { MediaFileData, MediaPathMap, ProcessMediaOptions } from './media';

export type WikiLink = _WikiLink;

// Obsidian link types for toLinkBuilder
export type ObsidianLink = PageOnly | PageAndHeader | PageAndBlock | HeaderOnly | BlockOnly;

export interface PageOnly {
  type: "page";
  page: string;
  alias?: string;
}

export interface PageAndHeader {
  type: "page-header";
  page: string;
  header: string;
  alias?: string;
}

export interface PageAndBlock {
  type: "page-block";
  page: string;
  block: string;
  alias?: string;
}

export interface HeaderOnly {
  type: "header";
  header: string;
  alias?: string;
}

export interface BlockOnly {
  type: "block";
  block: string;
  alias?: string;
}

/**
 * @deprecated This interface is deprecated and will be removed in a future version.
 * Use ProcessOptions from core.ts instead.
 */
export interface ObsidianProcessOptions {
  /**
   * Given a dirpath, build a `Set<string>` of filepaths,
   * representing pages that should be turned into html,
   * and linked to from other pages.
   *
   * The default behavior is to check the file's `frontmatter`
   * for `public: true`. Only if `public` exists and is set to
   * `true` is the filePath added to the `FilePathAllowSet`.
   */
  filePathAllowSetBuilder?: FilePathAllowSetBuilder;
  /**
   * This builder function constructs the unified.js processor
   * that is used to both parse markdown into mdast, and transform
   * markdown into html. It takes in a `toLink` function that can
   * be controlled as well via `toLinkBuilderOpts`
   *
   * The default behavior is a collection of common markdown and
   * html plugins.
   */
  unifiedProcessorBuilder?: UnifiedProcessorBuilder;
  /**
   * These options control the `toLinkBuilder` function execution. In short,
   * `remark-obsidian-link` requires a `toLink` function, and this function
   * builds that function. For example,
   *
   * ```ts
   * const toLink = toLinkBuilder(opts);
   * const mdastLink = toLink(wikiLink);
   * ```
   *
   * By default the options are:
   *
   * ```ts
   * {
   *   filePathAllowSet: [override or default],
   *   prefix: '/content',
   *   toSlug: (s: string) => slugify(s, {decamelize: false}),
   * }
   * ```
   *
   * The resulting behavior is approximately as follows:
   *
   * ```ts
   * // original string slice from markdown: "[[Wiki Link]]"
   * const wikiLinkInput = { value: "Wiki Link" };
   * const mdastLinkOutput = { value: "Wiki Link", uri: "content/wiki-link" }
   * ```
   */
  toLinkBuilderOpts?: ToLinkBuilderOpts;
  notePathPrefix?: string;
  assetPathPrefix?: string; // WIP
  // Make sure debug is explicitly declared
  debug?: number;
  // Media-related properties
  mediaOptions?: ProcessMediaOptions;
  mediaData?: MediaFileData[];
  mediaPathMap?: MediaPathMap;
  useAbsolutePaths?: boolean;
  preferredSize?: 'sm' | 'md' | 'lg';
  // Option to determine if media details should be included in output
  includeMediaData?: boolean;
  /**
   * When true, exports individual post JSON files to _posts directory (or postsOutputFolder if specified)
   * and creates an index.json with minimal data
   */
  exportPosts?: boolean;
  
  /**
   * Directory path to export individual post JSON files to
   * If provided, this will be used instead of the default _posts directory
   */
  postsOutputFolder?: string;
}

// Forward references to types from core.ts
import { FilePathAllowSetBuilder, ToLinkBuilderOpts, UnifiedProcessorBuilder } from './core';