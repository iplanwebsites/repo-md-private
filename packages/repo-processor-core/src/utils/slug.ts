/**
 * Slug Utilities
 *
 * Functions for generating and managing URL-friendly slugs.
 */

import slugify from '@sindresorhus/slugify';

/**
 * Convert a string to a URL-friendly slug
 */
export const toSlug = (s: string): string =>
  slugify(s, { decamelize: false });

/**
 * Information about a generated slug
 */
export interface SlugInfo {
  readonly slug: string;
  readonly originalSlug: string;
  readonly source: 'frontmatter' | 'filename' | 'folder';
  readonly wasModified: boolean;
}

/**
 * Configuration for slug generation
 */
export interface SlugConfig {
  readonly conflictStrategy: 'number' | 'hash';
}

/**
 * Result of slug assignment
 */
export interface SlugAssignment {
  readonly filePath: string;
  readonly slug: string;
  readonly info: SlugInfo;
}

/**
 * Options for generating a base slug
 */
export interface BaseSlugOptions {
  readonly fileName: string;
  readonly parentFolder?: string;
  readonly siblingCount?: number;
  readonly frontmatterSlug?: string;
}

/**
 * Generate a base slug from file info
 * Uses file name by default, parent folder for index.md without siblings
 */
export const generateBaseSlug = (options: BaseSlugOptions): { slug: string; source: SlugInfo['source'] } => {
  const { fileName, parentFolder, siblingCount, frontmatterSlug } = options;

  // Frontmatter slug takes priority
  if (frontmatterSlug) {
    return {
      slug: frontmatterSlug,
      source: 'frontmatter',
    };
  }

  // Use parent folder name for index.md without siblings
  if (fileName === 'index' && parentFolder && (siblingCount === undefined || siblingCount === 1)) {
    return {
      slug: toSlug(parentFolder),
      source: 'folder',
    };
  }

  // Default: use file name
  return {
    slug: toSlug(fileName),
    source: 'filename',
  };
};

/**
 * Resolve a slug conflict by adding a numeric suffix
 */
export const resolveSlugConflict = (
  baseSlug: string,
  usedSlugs: ReadonlySet<string>,
  strategy: 'number' | 'hash' = 'number'
): string => {
  if (!usedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  if (strategy === 'number') {
    let counter = 2;
    let newSlug = `${baseSlug}${counter}`;

    while (usedSlugs.has(newSlug)) {
      counter++;
      newSlug = `${baseSlug}${counter}`;
    }

    return newSlug;
  }

  // Hash strategy: append short hash
  const hash = require('crypto')
    .createHash('sha256')
    .update(baseSlug + Date.now().toString())
    .digest('hex')
    .substring(0, 6);

  return `${baseSlug}-${hash}`;
};

/**
 * Immutable slug manager for tracking used slugs
 */
export class SlugManager {
  private readonly usedSlugs: Map<string, string> = new Map();
  private readonly fileSlugs: Map<string, SlugInfo> = new Map();
  private readonly strategy: 'number' | 'hash';

  constructor(strategy: 'number' | 'hash' = 'number') {
    this.strategy = strategy;
  }

  /**
   * Check if a slug is already used
   */
  isUsed(slug: string): boolean {
    return this.usedSlugs.has(slug);
  }

  /**
   * Get slug info for a file path
   */
  getSlugInfo(filePath: string): SlugInfo | undefined {
    return this.fileSlugs.get(filePath);
  }

  /**
   * Reserve a slug for a file
   */
  reserve(filePath: string, options: BaseSlugOptions): SlugInfo {
    const { slug: baseSlug, source } = generateBaseSlug(options);

    // Check for conflict
    const existingFile = this.usedSlugs.get(baseSlug);
    const wasModified = existingFile !== undefined && existingFile !== filePath;

    const finalSlug = wasModified
      ? resolveSlugConflict(baseSlug, new Set(this.usedSlugs.keys()), this.strategy)
      : baseSlug;

    const info: SlugInfo = {
      slug: finalSlug,
      originalSlug: baseSlug,
      source,
      wasModified,
    };

    this.usedSlugs.set(finalSlug, filePath);
    this.fileSlugs.set(filePath, info);

    return info;
  }

  /**
   * Get all assigned slugs
   */
  getAllSlugs(): ReadonlyMap<string, SlugInfo> {
    return this.fileSlugs;
  }
}
