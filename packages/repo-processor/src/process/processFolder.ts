// processFolder.ts

import slugify from "@sindresorhus/slugify";
import matter from "gray-matter";
import elixir from "highlight.js/lib/languages/elixir";
import { common as commonLanguagesRecord } from "lowlight";
import { all as allLowlightLanguages } from "lowlight";
import { Root as MdastRoot } from "mdast";
import fs from "node:fs";
import path from "node:path";
import crypto from "crypto"; // Import for file hashing
import { execSync } from "child_process";
import { IssueCollector } from "../services/issueCollector";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import rehypeHighlight from "rehype-highlight";
import rehypeMathjaxChtml from "rehype-mathjax/chtml";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkCallouts from "remark-callouts";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { remarkObsidianLink } from "remark-obsidian-link";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkImages from 'remark-images'
import remarkYoutube from 'remark-youtube';
import { unified } from "unified";
import ignore from "ignore";

import { remarkMdImages } from "../remark/remarkmdimages";
import { remarkObsidianMedia } from "../remark/remarkObsidianMedia";
import { remarkIframeEmbed } from "../remark/remarkIframeEmbed";
import { rehypeMermaidWrapper } from "../rehype/rehypeMermaidWrapper";

import { hast, mdast } from "../lib";
import { calculateFileHash } from "../lib/utility";
import { countWords } from "../lib/wordCount";
import { MediaService } from "../lib/mediaService";
import { toLinkBuilder } from "../remark/toLinkBuilder";
import { createCustomToLink } from "../remark/customToLink";
import { remarkMarkdownLinkResolver } from "../remark/remarkMarkdownLinkResolver";

// Import types from the unified type system
import type {
  FileData,
  ProcessOptions,
  MediaFileData,
  MediaPathMap,
  SlugInfo
} from "../types";

/**
 * Represents a parsed file before slug assignment
 */
interface ParsedFile {
  fileName: string;
  title: string;
  frontmatter: Record<string, any>;
  firstParagraphText: string;
  plain: string;
  wordCount: number;
  markdown: string; // Store original markdown for reprocessing
  mdastRoot: MdastRoot; // Store AST for reprocessing
  toc: any[];
  originalFilePath: string;
  parentFolder?: string;
  fsCreated: Date;
  fsModified: Date;
  gitCreated?: Date;
  gitModified?: Date;
  firstImage?: string | null;
}

/**
 * Manages slug generation and tracking to ensure uniqueness with frontmatter priority
 */
class SlugManager {
  private usedSlugs: Map<string, string> = new Map(); // slug -> filePath mapping
  private fileSlugs: Map<string, SlugInfo> = new Map(); // filePath -> SlugInfo mapping
  private slugConflictResolutionStrategy: 'number' | 'hash' = 'number';
  private issueCollector?: IssueCollector;

  constructor(strategy: 'number' | 'hash' = 'number', issueCollector?: IssueCollector) {
    this.slugConflictResolutionStrategy = strategy;
    this.issueCollector = issueCollector;
  }

  /**
   * Generate a base slug from a filename or parent folder
   * Uses file name by default, only uses parent folder for index.md with no siblings
   */
  public generateBaseSlug(fileName: string, parentFolder?: string, siblingCount?: number): string {
    console.log(`DEBUG: generateBaseSlug called with fileName="${fileName}", parentFolder="${parentFolder}", siblingCount=${siblingCount}`);
    
    // Only use parent folder name if file is index.md and has no siblings
    if (fileName === 'index' && parentFolder && (siblingCount === undefined || siblingCount === 1)) {
      const result = slugify(path.basename(parentFolder), { decamelize: false });
      console.log(`DEBUG: Using parent folder name: "${result}"`);
      return result;
    }
    
    const result = slugify(fileName, { decamelize: false });
    console.log(`DEBUG: Using file name: "${result}"`);
    return result;
  }

  /**
   * Resolve slug conflicts by adding a number suffix
   */
  private resolveConflictWithNumber(baseSlug: string): string {
    let counter = 2;
    let newSlug = `${baseSlug}${counter}`;

    while (this.usedSlugs.has(newSlug)) {
      counter++;
      newSlug = `${baseSlug}${counter}`;
    }

    return newSlug;
  }

  /**
   * Two-phase slug assignment: first prioritize frontmatter slugs, then assign remaining
   */
  assignSlugs(parsedFiles: ParsedFile[]): Map<string, SlugInfo> {
    // Phase 1: Reserve frontmatter slugs (these get priority)
    const frontmatterFiles: ParsedFile[] = [];
    const nonFrontmatterFiles: ParsedFile[] = [];

    for (const file of parsedFiles) {
      if (file.frontmatter?.slug) {
        frontmatterFiles.push(file);
      } else {
        nonFrontmatterFiles.push(file);
      }
    }

    // Process frontmatter slugs first
    for (const file of frontmatterFiles) {
      this.assignSlugToFile(file, file.frontmatter.slug);
    }

    // Phase 2: Calculate sibling counts for files in same directories
    const directoryFileCount = new Map<string, number>();
    for (const file of nonFrontmatterFiles) {
      const dir = file.parentFolder || '.';
      directoryFileCount.set(dir, (directoryFileCount.get(dir) || 0) + 1);
    }

    // Phase 3: Assign slugs to remaining files
    for (const file of nonFrontmatterFiles) {
      const siblingCount = directoryFileCount.get(file.parentFolder || '.');
      const baseSlug = this.generateBaseSlug(file.fileName, file.parentFolder, siblingCount);
      this.assignSlugToFile(file, baseSlug);
    }

    return this.fileSlugs;
  }

  /**
   * Assign a slug to a specific file
   */
  private assignSlugToFile(file: ParsedFile, desiredSlug: string): SlugInfo {
    const existingPath = this.usedSlugs.get(desiredSlug);
    let disambiguatedSlug = desiredSlug;
    let finalSlug = desiredSlug;

    if (existingPath && existingPath !== file.originalFilePath) {
      // If the slug is taken by a different file, disambiguate it
      if (this.slugConflictResolutionStrategy === 'number') {
        disambiguatedSlug = this.resolveConflictWithNumber(desiredSlug);
      } else {
        // Generate a short hash for disambiguation
        const hash = calculateFileHash(file.originalFilePath).slice(0, 8);
        disambiguatedSlug = `${desiredSlug}-${hash}`;
      }
      finalSlug = disambiguatedSlug;
      
      // Track slug conflict in issue collector
      if (this.issueCollector) {
        // Find all files with the same desired slug
        const conflictingFiles: string[] = [];
        for (const [slug, filePath] of this.usedSlugs.entries()) {
          if (slug === desiredSlug || slug.startsWith(`${desiredSlug}-`)) {
            conflictingFiles.push(filePath);
          }
        }
        
        this.issueCollector.addSlugConflict({
          filePath: file.originalFilePath,
          originalSlug: desiredSlug,
          finalSlug: disambiguatedSlug,
          conflictingFiles
        });
      }
    }

    // Store the slug information
    const slugInfo: SlugInfo = {
      desiredSlug,
      disambiguatedSlug,
      finalSlug,
      isDisambiguated: disambiguatedSlug !== desiredSlug
    };

    this.fileSlugs.set(file.originalFilePath, slugInfo);
    this.usedSlugs.set(finalSlug, file.originalFilePath);

    return slugInfo;
  }

  /**
   * Get all tracked slugs
   */
  getAllSlugs(): Map<string, SlugInfo> {
    return this.fileSlugs;
  }

  /**
   * Get all used slugs
   */
  getUsedSlugs(): Map<string, string> {
    return this.usedSlugs;
  }
}

/**
 * Extract and resolve wiki-style links from ANY frontmatter field
 * @param frontmatter The frontmatter object to process
 * @param mediaService MediaService instance for resolving image paths
 * @param mediaData Array of media data for strict path matching
 * @param currentFilePath The path of the current file being processed
 * @param issueCollector Optional issue collector for tracking broken links
 * @returns The resolved frontmatter with resolved URLs
 */
function resolveFrontmatterWikiLinks(
  frontmatter: Record<string, any>, 
  mediaService: MediaService,
  mediaData: MediaFileData[],
  currentFilePath: string,
  issueCollector?: IssueCollector
): Record<string, any> {
  const resolvedFrontmatter = { ...frontmatter };
  const defaultImageSize = 'lg';
  const allSizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
  
  // Helper function to check if value contains wiki-style link
  const isWikiLink = (value: string): boolean => {
    return /^!\[\[([^\]]+)\]\]$/.test(value);
  };
  
  // Helper function to extract link from wiki-style format
  const extractWikiLink = (fieldValue: string): string | null => {
    const match = fieldValue.match(/^!\[\[([^\]]+)\]\]$/);
    return match ? match[1] : null;
  };
  
  // Recursive function to process all fields
  const processField = (obj: any, fieldPath: string[] = []): any => {
    if (typeof obj === 'string' && isWikiLink(obj)) {
      // This is a wiki-style link, resolve it
      const link = extractWikiLink(obj);
      if (link) {
        // For frontmatter, we want STRICT path matching to avoid wrong image resolution
        // We'll create path variations and check them directly against media data
        const pathVariations = mediaService.createPathVariations(link, currentFilePath);
        
        // Try to find exact path match in media data
        let mediaItem: MediaFileData | undefined = undefined;
        for (const variation of pathVariations) {
          // Check all media items for exact path match
          for (const media of mediaData) {
            if (media.originalPath?.toLowerCase() === variation || 
                media.effectivePath?.toLowerCase() === variation ||
                media.hashPath?.toLowerCase() === variation) {
              mediaItem = media;
              break;
            }
          }
          if (mediaItem) break;
        }
        
        if (mediaItem && mediaItem.sizes) {
          // For top-level fields, we'll add size variants
          const isTopLevel = fieldPath.length === 1;
          let defaultImagePath: string | null = null;
          
          // Generate URLs for all available sizes
          for (const size of allSizes) {
            const sizeData = mediaItem.sizes[size];
            if (sizeData && sizeData.length > 0) {
              // Find the best format (prefer webp)
              const webpFormat = sizeData.find((s: { format: string }) => s.format === 'webp');
              const avifFormat = sizeData.find((s: { format: string }) => s.format === 'avif');
              const jpegFormat = sizeData.find((s: { format: string }) => s.format === 'jpeg' || s.format === 'jpg');
              const bestFormat = webpFormat || avifFormat || jpegFormat || sizeData[0];
              
              // Use absolute path if requested and available
              const imagePath = bestFormat.absolutePublicPath || bestFormat.publicPath;
              
              if (size === defaultImageSize) {
                defaultImagePath = imagePath;
              }
              
              // Add size variants for top-level fields
              if (isTopLevel) {
                const fieldName = fieldPath[0];
                resolvedFrontmatter[`${fieldName}-${size}`] = imagePath;
              }
            }
          }
          
          // Return the default size path
          if (!defaultImagePath) {
            // Track broken link
            if (issueCollector) {
              issueCollector.addMissingMedia({
                filePath: currentFilePath,
                mediaPath: link,
                referencedFrom: 'frontmatter',
                originalReference: obj,
                module: 'embed-media'
              });
            }
            return `#broken-link-${link}`;
          }
          return defaultImagePath;
        }
        
        // No media found - return broken link indicator
        if (issueCollector) {
          issueCollector.addMissingMedia({
            filePath: currentFilePath,
            mediaPath: link,
            referencedFrom: 'frontmatter',
            originalReference: obj,
            module: 'embed-media'
          });
        }
        return `#broken-link-${link}`;
      }
    } else if (Array.isArray(obj)) {
      // Process arrays recursively
      return obj.map((item, index) => processField(item, [...fieldPath, String(index)]));
    } else if (obj instanceof Date) {
      // Preserve Date objects as-is (they'll serialize to ISO strings)
      return obj;
    } else if (obj !== null && typeof obj === 'object') {
      // Process objects recursively
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = processField(value, [...fieldPath, key]);
      }
      return result;
    }

    // Return unchanged for other types
    return obj;
  };
  
  // Process the entire frontmatter object
  for (const [key, value] of Object.entries(resolvedFrontmatter)) {
    resolvedFrontmatter[key] = processField(value, [key]);
  }
  
  return resolvedFrontmatter;
}

/**
 * Extract the first image URL from markdown content
 * @param markdown The markdown content to scan
 * @param mediaService MediaService instance for resolving image paths
 * @returns The first image URL or null if no images found
 */
function extractFirstImageFromMarkdown(markdown: string, mediaService: MediaService, currentFilePath: string): string | null {
  // Regular expressions for different image formats
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/;
  const obsidianImageRegex = /!\[\[([^\]]+)\]\]/;
  
  // Find first markdown-style image
  const markdownMatch = markdown.match(markdownImageRegex);
  if (markdownMatch) {
    const imageUrl = markdownMatch[2];
    // Try to resolve through media service
    const resolvedUrl = mediaService.getFirstImageUrl(imageUrl, currentFilePath);
    return resolvedUrl || imageUrl;
  }
  
  // Find first Obsidian-style image
  const obsidianMatch = markdown.match(obsidianImageRegex);
  if (obsidianMatch) {
    const imageUrl = obsidianMatch[1];
    // Try to resolve through media service
    const resolvedUrl = mediaService.getFirstImageUrl(imageUrl, currentFilePath);
    return resolvedUrl || imageUrl;
  }
  
  return null;
}

/**
 * Get git metadata for a file
 * @param filePath Path to the file
 * @returns Object with git creation and modification dates, or undefined if not in git repo
 */
function getGitInfo(filePath: string): { gitCreated?: Date; gitModified?: Date } {
  try {
    // Check if we're in a git repository
    execSync('git rev-parse --git-dir', { cwd: path.dirname(filePath), stdio: 'ignore' });
    
    // Get the first commit date for this file (creation)
    const firstCommitCmd = `git log --reverse --format="%ai" --follow -- "${filePath}" | head -1`;
    const firstCommitDate = execSync(firstCommitCmd, { 
      cwd: path.dirname(filePath), 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    // Get the last commit date for this file (modification)
    const lastCommitCmd = `git log -1 --format="%ai" --follow -- "${filePath}"`;
    const lastCommitDate = execSync(lastCommitCmd, { 
      cwd: path.dirname(filePath), 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    return {
      gitCreated: firstCommitDate ? new Date(firstCommitDate) : undefined,
      gitModified: lastCommitDate ? new Date(lastCommitDate) : undefined
    };
  } catch (error) {
    // Not in a git repository or git command failed
    return {};
  }
}

/**
 * Process an Obsidian vault directory and return file data for public files
 * @param dirPath Path to the Obsidian vault directory
 * @param opts Processing options including media handling
 * @returns Array of processed file data objects
 */
export async function processFolder(
  dirPath: string,
  opts?: ProcessOptions,
): Promise<FileData[]> {
  // Normalize the input path
  dirPath = path.normalize(dirPath);

  // Create logging function based on debug level
  const debugLevel = opts?.debug || 0;
  const log = createLogger(debugLevel);

  log(1, "🔍 Processing Obsidian vault: " + dirPath);

  // Initialize slug manager
  const slugManager = new SlugManager('number', opts?.issueCollector);

  // Get the allowed file paths (public files or all files based on options)
  const allowedFiles: Set<string> =
    opts?.filePathAllowSetBuilder?.(dirPath) ??
    buildDefaultAllowedFileSet(dirPath, log, opts);

  log(1, `📄 Found ${allowedFiles.size} allowed files to process`);

  // Build initial link transformer for media (posts will be resolved in phase 2)
  const toLinkOptions: any = {
    filePathAllowSet: allowedFiles,
    toSlug: (s: string) => s, // Temporary - will be replaced in phase 2
    prefix: opts?.notePathPrefix ?? "/content"
  };

  const toLink = toLinkBuilder(toLinkOptions);

  // Media data and path map (can be passed in or will be empty if not available)
  const mediaData = opts?.mediaData || [];
  const mediaPathMap: MediaPathMap = opts?.mediaPathMap || {};

  // Create a media service for first image extraction
  const mediaService = new MediaService({
    mediaData,
    mediaPathMap,
    useAbsolutePaths: opts?.useAbsolutePaths || false,
    preferredSize: opts?.preferredSize || 'lg',
    enableCssRatio: true
  });

  // Log media info if available
  if (mediaData.length > 0) {
    log(1, `🖼️ Found ${mediaData.length} media items to process`);
  }
  if (Object.keys(mediaPathMap).length > 0) {
    log(1, `🔗 Found ${Object.keys(mediaPathMap).length} media path mappings`);
  }

  // Track relationships by default
  const trackRelationships = opts?.trackRelationships !== false; // Enabled by default unless explicitly disabled
  if (trackRelationships) {
    log(1, `🔄 Relationship tracking is enabled`);
  }

  // Create a map for path to hash lookups if relationship tracking is enabled
  const pathHashMap: Record<string, string> = opts?.pathHashMap || {};

  // Create unified processor with media support
  const processor = buildMarkdownProcessor({
    toLink,
    mediaData,
    mediaPathMap,
    useAbsolutePaths: opts?.useAbsolutePaths || false,
    preferredSize: opts?.preferredSize || 'lg',
    iframeEmbedOptions: opts?.iframeEmbedOptions,
    rehypeMermaidOptions: opts?.rehypeMermaidOptions
  });

  // Phase 1: Parse all files without slug assignment
  const parsedFiles: ParsedFile[] = [];

  for (const filePath of allowedFiles) {
    // Skip non-markdown files
    if (typeof filePath !== 'string' || !filePath.endsWith('.md')) continue;

    try {
      log(2, `⚙️ Parsing file: ${filePath}`);

      // Parse file
      const { name: fileName } = path.parse(filePath);
      const raw = fs.readFileSync(filePath, "utf8");
      const { content: markdown, data: frontmatter } = matter(raw);

      // Parse non-zero-padded dates in frontmatter
      const frontmatterWithDates = parseFrontmatterDates(frontmatter);

      // Calculate relative path from vault root first (needed for context)
      const relativePath = path.relative(dirPath, filePath);

      // Resolve wiki-style links in ANY frontmatter field
      const resolvedFrontmatter = resolveFrontmatterWikiLinks(
        frontmatterWithDates, 
        mediaService,
        mediaData,
        relativePath,
        opts?.issueCollector
      );
      
      // Get filesystem metadata
      const fileStats = fs.statSync(filePath);
      
      // Get git metadata
      const gitInfo = getGitInfo(filePath);

      // Parse markdown to AST but don't process to HTML yet
      const mdastRoot = processor.parse(markdown) as MdastRoot;

      // Get plain text for word counting from AST
      const { toString: mdastToString } = await import('mdast-util-to-string');
      const plainText = mdastToString(mdastRoot);

      // Create a temporary object for hash calculation
      const title = resolvedFrontmatter?.title || String(fileName).replace(/_/g, ' ').replace('  ', ' ')

      // Extract first image from markdown content
      const firstImage = extractFirstImageFromMarkdown(markdown, mediaService, relativePath);

      // Create parsed file object
      const parsedFile: ParsedFile = {
        fileName,
        title: title.trim(),
        frontmatter: resolvedFrontmatter,
        firstParagraphText: mdast.getFirstParagraphText(mdastRoot) ?? "",
        plain: plainText,
        wordCount: countWords(plainText),
        markdown,
        mdastRoot,
        toc: [], // Will be populated after HTML generation
        originalFilePath: relativePath,
        parentFolder: path.dirname(relativePath) !== '.' ? path.dirname(relativePath) : undefined,
        fsCreated: fileStats.birthtime,
        fsModified: fileStats.mtime,
        gitCreated: gitInfo.gitCreated,
        gitModified: gitInfo.gitModified,
        firstImage
      };

      parsedFiles.push(parsedFile);
      log(2, `✅ Parsed: ${fileName}`);
    } catch (error) {
      log(0, `❌ Error parsing ${filePath}: ${error}`);
    }
  }

  // Phase 2: Assign slugs with frontmatter priority
  log(1, `🏷️ Assigning slugs to ${parsedFiles.length} files with frontmatter priority`);
  const slugAssignments = slugManager.assignSlugs(parsedFiles);

  // Phase 3: Create initial FileData objects with assigned slugs (without HTML yet)
  const pages: FileData[] = [];
  const urlPrefix = opts?.notePathPrefix ?? "/content";
  const parsedFileMap = new Map<string, ParsedFile>(); // Store parsed data for phase 4

  for (const parsedFile of parsedFiles) {
    const slugInfo = slugAssignments.get(parsedFile.originalFilePath);
    if (!slugInfo) {
      log(0, `❌ Error: No slug assignment found for ${parsedFile.fileName}`);
      continue;
    }

    // Create initial file object without HTML (we'll process it after all slugs are known)
    const file: FileData = {
      fileName: parsedFile.fileName,
      slug: slugInfo.finalSlug,
      title: parsedFile.title,
      frontmatter: parsedFile.frontmatter,
      firstParagraphText: parsedFile.firstParagraphText,
      plain: parsedFile.plain,
      wordCount: parsedFile.wordCount,
      html: '', // Will be populated in phase 4
      toc: parsedFile.toc,
      originalFilePath: parsedFile.originalFilePath,
      folder: parsedFile.parentFolder || '', // Folder path relative to vault root
      url: `${urlPrefix}/${slugInfo.finalSlug}`, // Generate URL
      hash: '', // Will be calculated after HTML is generated
      links: [], // Initialize empty links array
      firstImage: parsedFile.firstImage || undefined,
      fsCreated: parsedFile.fsCreated,
      fsModified: parsedFile.fsModified,
      gitCreated: parsedFile.gitCreated,
      gitModified: parsedFile.gitModified,
      _slugInfo: slugInfo
    };

    pages.push(file);
    parsedFileMap.set(parsedFile.originalFilePath, parsedFile);
    log(2, `✅ Assigned slug: ${parsedFile.fileName} -> ${slugInfo.finalSlug}`);
  }

  // Phase 4: Now that all slugs are known, reprocess with proper link resolution
  log(1, `🔗 Processing links now that all slugs are known`);
  
  // Build maps for link resolution
  const filesBySlug = new Map<string, FileData>();
  const filesByName = new Map<string, FileData>();
  const filesByPath = new Map<string, FileData>();
  const filesByAlias = new Map<string, FileData[]>();
  
  for (const file of pages) {
    filesBySlug.set(file.slug, file);
    filesByName.set(file.fileName, file);
    filesByPath.set(file.originalFilePath, file);
    
    // Build alias map (case-insensitive)
    const aliases = file.frontmatter?.aliases;
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        if (typeof alias === 'string' && alias.trim()) {
          const normalizedAlias = alias.trim().toLowerCase();
          if (!filesByAlias.has(normalizedAlias)) {
            filesByAlias.set(normalizedAlias, []);
          }
          filesByAlias.get(normalizedAlias)!.push(file);
        }
      }
    }
  }

  // Process each file's markdown again with proper link resolution
  for (const file of pages) {
    const parsedData = parsedFileMap.get(file.originalFilePath);
    if (!parsedData) continue;
    
    log(2, `⚙️ Processing HTML with resolved links for: ${file.fileName}`);
    
    try {
      // Create a processor for this specific file
      const linkProcessor = unified()
        .use(remarkParse)
        .use(remarkImages, { link: false })
                // Process iframe embeds AFTER remarkGfm (so we can handle both naked URLs and links)
        .use(remarkIframeEmbed, {
          ...opts?.iframeEmbedOptions,
          features: {
            ...opts?.iframeEmbedOptions?.features,
            mermaid: opts?.iframeEmbedOptions?.features?.mermaid ?? false // Default to false (use rehype-mermaid instead)
          }
        })
        .use(remarkGfm)

        .use(remarkObsidianLink, { 
          toLink: createCustomToLink({
            filesBySlug,
            filesByName,
            filesByPath,
            filesByAlias,
            urlPrefix,
            currentFile: file,
            issueCollector: opts?.issueCollector
          })
        })
        // Process markdown links after wikilinks
        .use(remarkMarkdownLinkResolver, {
          filesByPath,
          urlPrefix,
          currentFilePath: file.originalFilePath
        })
        .use(remarkMdImages, {
          mediaData,
          mediaPathMap,
          useAbsolutePaths: opts?.useAbsolutePaths || false,
          preferredSize: opts?.preferredSize || 'lg',
          enableCssRatio: true,
          currentFilePath: file.originalFilePath,
        })
        .use(remarkObsidianMedia, {
          mediaData,
          mediaPathMap,
          useAbsolutePaths: opts?.useAbsolutePaths || false,
          preferredSize: opts?.preferredSize || 'lg',
          enableCssRatio: true,
          currentFilePath: file.originalFilePath,
        })
        .use(remarkYoutube, { noHardcodedSize: true })
        .use(remarkCallouts)
        .use(remarkMath)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeExternalLinks)
        .use(rehypeSlug)
        .use(rehypeAutolinkHeadings, { behavior: "wrap" });

      // Add rehype-mermaid BEFORE rehype-highlight so it can process mermaid code blocks first
      if (opts?.rehypeMermaidOptions?.enabled !== false) {
        linkProcessor.use(rehypeMermaidWrapper, {
          strategy: opts?.rehypeMermaidOptions?.strategy || 'inline-svg',
          dark: opts?.rehypeMermaidOptions?.dark,
          prefix: opts?.rehypeMermaidOptions?.prefix,
          mermaidConfig: opts?.rehypeMermaidOptions?.mermaidConfig
        });
      }

      linkProcessor
        .use(rehypeHighlight, {
          languages: { ...allLowlightLanguages, elixir },
        })
        .use(rehypeMathjaxChtml, {
          chtml: {
            fontURL: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2",
          },
        })
        .use(rehypeStringify, { allowDangerousHtml: true });

      // Reset the first image flag for this file
      mediaService.resetFirstImageFlag();
      
      // Process markdown with link resolution
      const htmlString = (await linkProcessor.process(parsedData.markdown)).toString();
      file.html = htmlString;
      file.toc = hast.getToc(htmlString);
      
      // Calculate final hash including the HTML
      const fileHash = calculateFileHash(JSON.stringify({
        fileName: file.fileName,
        slug: file.slug,
        title: file.title,
        frontmatter: file.frontmatter,
        originalFilePath: file.originalFilePath,
        html: file.html,
        url: file.url
      }));
      file.hash = fileHash;
      
      // Store the file's hash in the pathHashMap for relationship tracking
      if (trackRelationships) {
        pathHashMap[file.originalFilePath] = fileHash;
      }
      
      log(2, `✅ Processed: ${file.fileName}`);
    } catch (error) {
      log(0, `❌ Error processing ${file.fileName}: ${error}`);
    }
  }

  // Add slug tracking information to the first page if needed
  if (opts?.includeSlugTracking && pages.length > 0) {
    // @ts-ignore - Adding custom property
    pages[0]._slugTracking = {
      allSlugs: Object.fromEntries(slugManager.getAllSlugs()),
      usedSlugs: Object.fromEntries(slugManager.getUsedSlugs())
    };
    log(1, `📊 Added slug tracking information to first page object`);
  }

  // Second pass: track relationships between files if enabled
  if (trackRelationships) {
    log(1, `🔄 Starting second pass to track relationships between files`);
    log(2, `🔍 Will collect POST_LINKS_TO_POST and POST_USE_IMAGE relationships`);

    // Create maps for relationship tracking
    const postToPostLinks = new Map<string, Set<string>>(); // Source post hash -> Set of target post hashes
    const postToImageLinks = new Map<string, Set<string>>(); // Post hash -> Set of image hashes

    for (const file of pages) {
      log(2, `🔄 Tracking relationships for file: ${file.fileName}`);

      // Create sets to ensure uniqueness of links
      const linkedPostHashes = new Set<string>();
      const linkedImageHashes = new Set<string>();

      // Extract links from HTML
      const htmlLinks = extractLinksFromHtml(file.html);

      // Process each link and try to map it to a file hash
      for (const link of htmlLinks) {
        if (link.startsWith('#')) {
          // Skip fragment/anchor links
          continue;
        }

        // Try to find a corresponding file path
        // First, strip the prefix and any fragments
        let cleanLink = link;
        const prefixToStrip = opts?.notePathPrefix || '/content';
        if (cleanLink.startsWith(prefixToStrip)) {
          cleanLink = cleanLink.substring(prefixToStrip.length);
        }

        // Remove any fragment part
        cleanLink = cleanLink.split('#')[0];

        // Remove leading slash if present
        if (cleanLink.startsWith('/')) {
          cleanLink = cleanLink.substring(1);
        }

        // Try to find the corresponding page
        const matchingPage = pages.find(p => p.slug === cleanLink);
        if (matchingPage) {
          linkedPostHashes.add(matchingPage.hash);
          log(3, `  🔗 Found link from ${file.fileName} to ${matchingPage.fileName}`);
        }
      }

      // Extract images from HTML for tracking POST_USE_IMAGE relationships
      const imageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
      let match;

      // Use a new regex to avoid modifying the global regex lastIndex
      const content = file.html;
      while ((match = imageRegex.exec(content)) !== null) {
        const src = match[1].trim();

        // Skip external images, data URLs, and placeholder images
        if (src.startsWith('http://') ||
          src.startsWith('https://') ||
          src.startsWith('data:') ||
          src.includes('placeholder')) {
          log(3, `  ⏭️ Skipping external or placeholder image: ${src}`);
          continue;
        }

        log(3, `  🔍 Checking image source: ${src}`);

        // Find the image in mediaData
        let foundMatch = false;
        for (const media of mediaData) {
          // Check if this media file is used in this image
          // We need to check multiple possible paths:
          // 1. The original source might be used directly
          // 2. The media path map might map to a different path
          // 3. The sizes paths might be used

          // Get the filename for simple comparison
          const srcFileName = path.basename(src).toLowerCase();
          const mediaFileName = media.fileName.toLowerCase();

          const sourceMatches = srcFileName.includes(mediaFileName);
          const pathMatches = Object.values(media.sizes || {}).some((sizeArr: any) =>
            Array.isArray(sizeArr) && sizeArr.some((size: any) =>
              size.publicPath?.toLowerCase() === src.toLowerCase() ||
              (size.absolutePublicPath && size.absolutePublicPath.toLowerCase() === src.toLowerCase())
            )
          );

          if (sourceMatches || pathMatches) {
            // We found a match - add the media hash to the set
            const mediaHash = media.metadata?.hash || calculateFileHash(media.originalPath);
            linkedImageHashes.add(mediaHash);
            log(3, `  🖼️ Found image usage in ${file.fileName}: ${media.fileName} (hash: ${mediaHash})`);
            foundMatch = true;
            break;
          }
        }

        if (!foundMatch) {
          log(3, `  ⚠️ Could not find media match for image source: ${src}`);
        }
      }

      // Update the file's links array with the unique post hash IDs
      file.links = Array.from(linkedPostHashes);
      log(2, `  ✅ Found ${file.links.length} unique post links and ${linkedImageHashes.size} image usages in ${file.fileName}`);

      // Store relationships for later graph generation
      if (linkedPostHashes.size > 0) {
        postToPostLinks.set(file.hash, linkedPostHashes);
      }

      if (linkedImageHashes.size > 0) {
        postToImageLinks.set(file.hash, linkedImageHashes);
      }
    }

    // Store the relationships in opts for later use by the caller
    if (opts) {
      opts.postToPostLinks = postToPostLinks;
      opts.postToImageLinks = postToImageLinks;
    }

    // Log summary of relationships found
    const totalPostLinks = Array.from(postToPostLinks.values()).reduce((sum, links) => sum + links.size, 0);
    const totalImageLinks = Array.from(postToImageLinks.values()).reduce((sum, links) => sum + links.size, 0);
    log(1, `📊 Relationship tracking complete: found ${totalPostLinks} post-to-post links and ${totalImageLinks} post-to-image links`);
  }

  log(1, `🎉 Successfully processed ${pages.length} files`);

  // If includeMediaData is true, add the media data to the first page object only
  // This is useful if you need the media data elsewhere but don't want to duplicate it
  if (opts?.includeMediaData && pages.length > 0 && mediaData.length > 0) {
    // Create a special property on the first page to hold the media catalog
    // @ts-ignore - Adding custom property
    pages[0]._mediaData = mediaData;
    log(1, `📊 Added media catalog to first page object`);

    // Also add the path map if available
    if (Object.keys(mediaPathMap).length > 0) {
      // @ts-ignore - Adding custom property
      pages[0]._mediaPathMap = mediaPathMap;
      log(1, `🗺️ Added media path map to first page object`);
    }
  }

  // Export posts if enabled
  if (opts?.exportPosts) {
    exportPosts(pages, opts, dirPath, log);
  }

  return pages;
}

/**
 * Build the unified processor with wiki link and media support (for initial parsing)
 */
function buildMarkdownProcessor({
  toLink,
  mediaData = [],
  mediaPathMap = {},
  useAbsolutePaths = false,
  preferredSize = 'lg',
  iframeEmbedOptions,
  rehypeMermaidOptions
}: {
  toLink: ReturnType<typeof toLinkBuilder>;
  mediaData?: MediaFileData[];
  mediaPathMap?: MediaPathMap;
  useAbsolutePaths?: boolean;
  preferredSize?: 'sm' | 'md' | 'lg';
  iframeEmbedOptions?: ProcessOptions['iframeEmbedOptions'];
  rehypeMermaidOptions?: ProcessOptions['rehypeMermaidOptions'];
}) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkImages, { link: false })
    .use(remarkGfm)
    // Process iframe embeds AFTER remarkGfm (so we can handle both naked URLs and links)
    .use(remarkIframeEmbed, {
      ...iframeEmbedOptions,
      features: {
        ...iframeEmbedOptions?.features,
        mermaid: iframeEmbedOptions?.features?.mermaid ?? false // Default to false (use rehype-mermaid instead)
      }
    })
    .use(remarkObsidianLink, { toLink })
    .use(remarkMdImages, {
      mediaData,
      mediaPathMap,
      useAbsolutePaths,
      preferredSize, enableCssRatio: true,
    })
    .use(remarkObsidianMedia, {
      mediaData,
      mediaPathMap,
      useAbsolutePaths,
      preferredSize,
      enableCssRatio: true,
    })
    .use(remarkYoutube, { noHardcodedSize: true })
    .use(remarkCallouts);
  
  processor
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeExternalLinks)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" });
    
  // Add rehype-mermaid BEFORE rehype-highlight so it can process mermaid code blocks first
  if (rehypeMermaidOptions?.enabled !== false) {
    processor.use(rehypeMermaidWrapper, {
      strategy: rehypeMermaidOptions?.strategy || 'inline-svg',
      dark: rehypeMermaidOptions?.dark,
      prefix: rehypeMermaidOptions?.prefix,
      mermaidConfig: rehypeMermaidOptions?.mermaidConfig
    });
  }
  
  processor
    .use(rehypeHighlight, {
      languages: { ...allLowlightLanguages, elixir },
    })
    .use(rehypeMathjaxChtml, {
      chtml: {
        fontURL: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2",
      },
    });
  
  return processor.use(rehypeStringify, { allowDangerousHtml: true });
}

/*
 * Removed - using inline processor creation instead
 */
/*function buildLinkAwareProcessorFactory({
  fileMap,
  linkResolverOptions,
  mediaData = [],
  mediaPathMap = {},
  useAbsolutePaths = false,
  preferredSize = 'lg'
}: {
  fileMap: ReturnType<typeof buildFileMaps>;
  linkResolverOptions: LinkResolverOptions;
  mediaData?: MediaFileData[];
  mediaPathMap?: MediaPathMap;
  useAbsolutePaths?: boolean;
  preferredSize?: 'sm' | 'md' | 'lg';
}) {
  // Return a function that creates a processor for a specific file
  return (currentFilePath: string) => {
    return unified()
      .use(remarkParse)
      .use(remarkImages, { link: false })
      .use(remarkGfm)
      // Parse wikilinks but keep them as-is for our resolver
      .use(remarkObsidianLink)
      // Then resolve all links with our custom resolver
      .use(remarkLinkResolver, {
        fileMap,
        linkResolverOptions,
        currentFilePath
      })
      .use(remarkMdImages, {
        mediaData,
        mediaPathMap,
        useAbsolutePaths,
        preferredSize,
        enableCssRatio: true,
      })
      .use(remarkObsidianMedia, {
        mediaData,
        mediaPathMap,
        useAbsolutePaths,
        preferredSize,
        enableCssRatio: true,
      })
      .use(remarkYoutube, { noHardcodedSize: true })
      .use(remarkCallouts)
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeExternalLinks)
      .use(rehypeSlug)
      .use(rehypeAutolinkHeadings, { behavior: "wrap" })
      .use(rehypeHighlight, {
        languages: { ...allLowlightLanguages, elixir },
      })
      .use(rehypeMathjaxChtml, {
        chtml: {
          fontURL: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2",
        },
      })
      .use(rehypeStringify);
  };
}*/

/**
 * Extract links from HTML content
 * @param htmlContent HTML content to scan for links
 * @returns Array of href values
 */
function extractLinksFromHtml(htmlContent: string): string[] {
  const links: string[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/g;
  let match;

  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const href = match[1].trim();
    // Skip external links and email links
    if (!href.startsWith('http://') &&
      !href.startsWith('https://') &&
      !href.startsWith('mailto:') &&
      !href.startsWith('tel:')) {
      links.push(href);
    }
  }

  return links;
}


/**
 * Parse non-zero-padded dates in frontmatter
 * Converts strings like "2025-10-7" or "2025-1-1" to Date objects
 * @param value The value to check and potentially convert
 * @returns The value as a Date if it matches the pattern, otherwise unchanged
 */
function parseDateString(value: any): any {
  if (typeof value === 'string') {
    // Match date patterns like YYYY-M-D, YYYY-MM-D, or YYYY-M-DD
    // This regex matches dates with or without zero padding
    const dateRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
    const match = value.match(dateRegex);

    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);

      // Validate date ranges more strictly
      if (month >= 1 && month <= 12) {
        // Check days per month (accounting for leap years)
        const daysInMonth = new Date(year, month, 0).getDate(); // Month is 1-indexed here for getting last day

        if (day >= 1 && day <= daysInMonth) {
          // Create a date in UTC to match gray-matter's behavior
          // Note: JavaScript months are 0-indexed
          const date = new Date(Date.UTC(year, month - 1, day));

          // Double-check the date is valid and didn't roll over
          if (date.getUTCFullYear() === year &&
              date.getUTCMonth() === month - 1 &&
              date.getUTCDate() === day) {
            return date;
          }
        }
      }
    }
  }
  return value;
}

/**
 * Recursively parse date strings in frontmatter
 * @param obj The frontmatter object to process
 * @returns The frontmatter with parsed dates
 */
function parseFrontmatterDates(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // If it's already a Date object, leave it alone
  if (obj instanceof Date) {
    return obj;
  }

  // Try to parse as date string
  const parsed = parseDateString(obj);
  if (parsed !== obj) {
    return parsed;
  }

  // Recursively process arrays
  if (Array.isArray(obj)) {
    return obj.map(item => parseFrontmatterDates(item));
  }

  // Recursively process objects
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = parseFrontmatterDates(value);
    }
    return result;
  }

  return obj;
}

// Default ignore patterns
const DEFAULT_IGNORE_PATTERNS = [
  // Documentation files
  'CONTRIBUTING.md',
  'README.md',
  'readme.md',
  'LICENSE.md',
  'CLAUDE.md',
  
  // Repository metadata
  'repo.md',
  'REPO.md',
  'Repo.md',
  
  // System folders and files
  '.obsidian',
  '.git',
  '.github',
  '.vscode',
  '.idea',
  'node_modules',
  '.DS_Store',
  'Thumbs.db',
  
  // Build outputs
  'dist',
  'build',
  '_build',
  'out',
  
  // Temporary files
  '*.tmp',
  '*.temp',
  '*.cache',
  '*.log',
  
  // Test directories
  '__tests__',
  '__mocks__',
  'coverage',
  '.nyc_output'
];

/**
 * Create ignore matcher with default patterns as base,
 * optionally loading additional patterns from a file
 */
function createIgnoreMatcher(filePath?: string, log?: (level: number, message: string) => void) {
  // Start with default patterns as base
  const ig = ignore().add(DEFAULT_IGNORE_PATTERNS);
  
  // If a file path is provided, add those patterns on top
  if (filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      ig.add(content);
    } catch (error) {
      // If file can't be read, just use defaults
      if (log) {
        log(2, `⚠️ Could not read ignore file ${filePath}, using defaults only`);
      }
    }
  }
  
  return ig;
}

/**
 * Build a set of allowed file paths (both public and all files options)
 */
function buildDefaultAllowedFileSet(
  dirPath: string,
  log: (level: number, message: string) => void,
  opts?: ProcessOptions
): Set<string> {
  const allowedFiles = new Set<string>();

  // Check if we should process all files or just public ones
  const processAllFiles = opts?.processAllFiles || false;
  
  // Check for .repoignore file first
  const repoIgnorePath = path.join(dirPath, '.repoignore');
  let ignoreMatcher: ReturnType<typeof ignore> | null = null;
  let usingRepoIgnore = false;
  
  if (fs.existsSync(repoIgnorePath)) {
    // Use .repoignore file patterns on top of defaults
    ignoreMatcher = createIgnoreMatcher(repoIgnorePath, log);
    log(1, '📄 Found .repoignore file, using default patterns + file patterns');
  } else if (opts?.ignoreFiles !== undefined) {
    // User provided explicit ignore list - combine with defaults
    ignoreMatcher = ignore().add(DEFAULT_IGNORE_PATTERNS);
    if (opts.ignoreFiles.length > 0) {
      ignoreMatcher.add(opts.ignoreFiles);
    }
    log(1, `📄 No .repoignore found, using default patterns + ${opts.ignoreFiles.length} provided patterns`);
  } else {
    // Use only default patterns
    ignoreMatcher = createIgnoreMatcher(undefined, log);
    log(1, `📄 No .repoignore found, using default ignore patterns (${DEFAULT_IGNORE_PATTERNS.length} entries)`);
  }

  function scanDirectory(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    log(3, `📂 Scanning directory: ${currentPath}`);

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(dirPath, entryPath);

      if (entry.isDirectory()) { 
        // Skip hidden directories
        if (entry.name.startsWith(".")) {
          log(3, `⏭️ Skipping hidden directory: ${entry.name}`);
          continue;
        }
        
        // Check if this directory should be ignored
        if (ignoreMatcher && ignoreMatcher.ignores(relativePath)) {
          log(3, `⏭️ Skipping ignored directory: ${relativePath}`);
          continue;
        }
        
        // Recursively scan subdirectories
        scanDirectory(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Check if file should be ignored
        if (ignoreMatcher && ignoreMatcher.ignores(relativePath)) {
          log(3, `⏭️ Skipping ignored file: ${relativePath}`);
          continue;
        }

        try {
          const raw = fs.readFileSync(entryPath, "utf8");
          const { data: frontmatter } = matter(raw);

          // Include all files if processAllFiles is true, or just public files otherwise
          if (processAllFiles || frontmatter?.public) {
            allowedFiles.add(entryPath);
            log(3, `✅ Found file to process: ${entry.name}`);
          } else {
            log(3, `⏭️ Skipping non-public file: ${entry.name}`);
          }
        } catch (error) {
          log(0, `❌ Error reading ${entryPath}: ${error}`);
        }
      }
    }
  }

  scanDirectory(dirPath);
  return allowedFiles;
}

/**
 * Create a logger function based on debug level
 * @param level Debug level (0-3)
 * @returns Logging function
 */
function createLogger(level: number) {
  return function log(messageLevel: number, message: string) {
    if (messageLevel <= level) {
      console.log(message);
    }
  };
}

/**
 * Export posts to JSON files
 */
function exportPosts(
  pages: FileData[],
  opts: ProcessOptions,
  dirPath: string,
  log: (level: number, message: string) => void
): void {
  // We MUST have a postsOutputFolder at this point
  if (!opts?.postsOutputFolder) {
    log(0, '⚠️ Posts export enabled but no output folder was provided. This should never happen.');
    return;
  }

  const basePostsDir = opts.postsOutputFolder;

  // Safety check - make sure we're not writing to the input directory
  // We need to compare normalized paths to avoid false positives with similar path prefixes
  const normalizedBasePostsDir = path.normalize(basePostsDir);
  const normalizedDirPath = path.normalize(dirPath);

  if (normalizedBasePostsDir === normalizedDirPath ||
    (normalizedBasePostsDir.startsWith(normalizedDirPath) &&
      normalizedBasePostsDir.substring(normalizedDirPath.length, normalizedDirPath.length + 1) === path.sep)) {
    log(0, `⚠️ ERROR: Posts output folder (${basePostsDir}) appears to be inside the input directory (${dirPath}). This would pollute the source directory. Skipping export.`);
    return;
  }

  // Construct hash and slug directory paths
  const hashPostsDir = path.join(basePostsDir, "hash");
  const slugPostsDir = path.join(basePostsDir, "slug");

  // Make sure the directory exists
  if (!fs.existsSync(basePostsDir)) {
    fs.mkdirSync(basePostsDir, { recursive: true });
    log(1, `📁 Created posts directory at ${basePostsDir}`);
  }

  // Export to both directories
  exportPostsToJsonFiles(hashPostsDir, pages, log, slugPostsDir);

  log(1, `📝 Exported post JSON files to ${basePostsDir}`);
}

/**
 * Export individual post JSON files and create an index file
 * @param hashDir Directory to export hash-named files
 * @param pages Array of processed file data objects
 * @param log Logging function
 * @param slugDir Directory to export slug-named files
 */
function exportPostsToJsonFiles(
  hashDir: string,
  pages: FileData[],
  log: (level: number, message: string) => void,
  slugDir: string
): void {
  // Create output directories
  const directories = [hashDir, slugDir];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(1, `📁 Created directory at ${dir}`);
    }
  }

  // Create index data with minimal information
  const indexData = pages.map(page => ({
    slug: page.slug, // Use the processed slug directly
    hash: page.hash,
    title: page.title,
    colophon: page.frontmatter?.colophon || null
  }));

  // Write index.json to both directories
  const indexJson = JSON.stringify(indexData, null, 2);
  fs.writeFileSync(path.join(hashDir, "index.json"), indexJson);
  fs.writeFileSync(path.join(slugDir, "index.json"), indexJson);
  log(1, `📝 Created index.json files with ${pages.length} entries`);

  // Export individual JSON files for each post
  const postJson = pages.map(page => ({
    page,
    json: JSON.stringify(page, null, 2)
  }));

  for (const { page, json } of postJson) {
    // Save hash-named file using the pre-calculated hash property
    fs.writeFileSync(path.join(hashDir, `${page.hash}.json`), json);
    log(2, `📝 Exported post to hash/${page.hash}.json`);

    // Save slug-named file
    fs.writeFileSync(path.join(slugDir, `${page.slug}.json`), json);
    log(2, `📝 Exported post to slug/${page.slug}.json`);
  }

  log(1, `✅ Successfully exported ${pages.length} posts to hash and slug directories`);
}

// Using the calculateFileHash utility function imported from "../lib/utility"