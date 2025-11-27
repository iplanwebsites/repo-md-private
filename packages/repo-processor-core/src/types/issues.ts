/**
 * Issue tracking types for @repo-md/processor-core
 */

// ============================================================================
// Enums and Literal Types
// ============================================================================

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCategory =
  | 'broken-link'
  | 'missing-media'
  | 'media-processing'
  | 'slug-conflict'
  | 'mermaid-error'
  | 'frontmatter-error'
  | 'parse-error'
  | 'file-access'
  | 'embedding-error'
  | 'database-error'
  | 'plugin-error'
  | 'configuration'
  | 'other';

export type IssueModule =
  | 'markdown-parser'
  | 'image-processor'
  | 'embed-mermaid'
  | 'embed-media'
  | 'link-resolver'
  | 'slug-generator'
  | 'frontmatter-parser'
  | 'file-system'
  | 'config-validator'
  | 'post-processor'
  | 'text-embeddings'
  | 'image-embeddings'
  | 'similarity'
  | 'database'
  | 'plugin-manager'
  | 'other';

// ============================================================================
// Issue Types
// ============================================================================

/**
 * Base interface for all processing issues
 */
export interface ProcessingIssue {
  readonly severity: IssueSeverity;
  readonly category: IssueCategory;
  readonly module: IssueModule;
  readonly message: string;
  readonly filePath?: string;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly timestamp: string;
}

/**
 * Broken link issue
 */
export interface BrokenLinkIssue extends ProcessingIssue {
  readonly category: 'broken-link';
  readonly module: 'link-resolver';
  readonly context: {
    readonly linkText: string;
    readonly linkTarget: string;
    readonly linkType: 'wiki' | 'markdown' | 'frontmatter';
    readonly suggestions?: readonly string[];
  };
}

/**
 * Missing media issue
 */
export interface MissingMediaIssue extends ProcessingIssue {
  readonly category: 'missing-media';
  readonly module: 'embed-media' | 'image-processor';
  readonly context: {
    readonly mediaPath: string;
    readonly referencedFrom: 'content' | 'frontmatter' | 'embed';
    readonly originalReference?: string;
  };
}

/**
 * Media processing issue
 */
export interface MediaProcessingIssue extends ProcessingIssue {
  readonly category: 'media-processing';
  readonly module: 'image-processor';
  readonly context: {
    readonly mediaPath: string;
    readonly operation: 'read' | 'optimize' | 'resize' | 'hash' | 'copy';
    readonly errorMessage: string;
    readonly errorCode?: string;
  };
}

/**
 * Slug conflict issue
 */
export interface SlugConflictIssue extends ProcessingIssue {
  readonly category: 'slug-conflict';
  readonly module: 'slug-generator';
  readonly context: {
    readonly originalSlug: string;
    readonly finalSlug: string;
    readonly conflictingFiles: readonly string[];
  };
}

/**
 * Mermaid error issue
 */
export interface MermaidErrorIssue extends ProcessingIssue {
  readonly category: 'mermaid-error';
  readonly module: 'embed-mermaid';
  readonly context: {
    readonly errorType: 'plugin-load' | 'render-fail' | 'missing-deps';
    readonly diagramContent?: string;
    readonly fallback: string;
  };
}

/**
 * Embedding error issue
 */
export interface EmbeddingErrorIssue extends ProcessingIssue {
  readonly category: 'embedding-error';
  readonly module: 'text-embeddings' | 'image-embeddings';
  readonly context: {
    readonly embeddingType: 'text' | 'image';
    readonly operation: 'initialize' | 'embed' | 'batch';
    readonly errorMessage: string;
  };
}

/**
 * Plugin error issue
 */
export interface PluginErrorIssue extends ProcessingIssue {
  readonly category: 'plugin-error';
  readonly module: 'plugin-manager';
  readonly context: {
    readonly pluginName: string;
    readonly operation: 'initialize' | 'process' | 'dispose';
    readonly errorMessage: string;
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export const isBrokenLinkIssue = (issue: ProcessingIssue): issue is BrokenLinkIssue =>
  issue.category === 'broken-link';

export const isMissingMediaIssue = (issue: ProcessingIssue): issue is MissingMediaIssue =>
  issue.category === 'missing-media';

export const isMediaProcessingIssue = (issue: ProcessingIssue): issue is MediaProcessingIssue =>
  issue.category === 'media-processing';

export const isSlugConflictIssue = (issue: ProcessingIssue): issue is SlugConflictIssue =>
  issue.category === 'slug-conflict';

export const isMermaidErrorIssue = (issue: ProcessingIssue): issue is MermaidErrorIssue =>
  issue.category === 'mermaid-error';

export const isEmbeddingErrorIssue = (issue: ProcessingIssue): issue is EmbeddingErrorIssue =>
  issue.category === 'embedding-error';

export const isPluginErrorIssue = (issue: ProcessingIssue): issue is PluginErrorIssue =>
  issue.category === 'plugin-error';

// ============================================================================
// Issue Collection
// ============================================================================

export interface IssueSummary {
  readonly totalIssues: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly filesAffected: number;
  readonly categoryCounts: Readonly<Record<IssueCategory, number>>;
  readonly moduleCounts: Readonly<Record<IssueModule, number>>;
}

export interface IssueReport {
  readonly issues: readonly ProcessingIssue[];
  readonly summary: IssueSummary;
  readonly metadata: {
    readonly processStartTime: string;
    readonly processEndTime: string;
    readonly processorVersion?: string;
  };
}

export interface IssueFilterOptions {
  readonly severity?: IssueSeverity | readonly IssueSeverity[];
  readonly category?: IssueCategory | readonly IssueCategory[];
  readonly module?: IssueModule | readonly IssueModule[];
  readonly filePath?: string | readonly string[];
}
