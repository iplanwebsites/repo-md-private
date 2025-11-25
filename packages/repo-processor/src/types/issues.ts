/**
 * Issue tracking types for repo-processor
 * Provides structured logging of warnings and errors during processing
 */

/**
 * Severity levels for processing issues
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * Categories of issues that can occur during processing
 */
export type IssueCategory = 
  | 'broken-link'
  | 'missing-media'
  | 'media-processing'
  | 'slug-conflict'
  | 'mermaid-error'
  | 'frontmatter-error'
  | 'parse-error'
  | 'file-access'
  | 'configuration'
  | 'other';

/**
 * Processing modules where issues can originate
 */
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
  | 'other';

/**
 * Base interface for all processing issues
 */
export interface ProcessingIssue {
  /** Severity level of the issue */
  severity: IssueSeverity;
  
  /** Category of the issue for filtering */
  category: IssueCategory;
  
  /** Module that generated the issue */
  module: IssueModule;
  
  /** Human-readable message describing the issue */
  message: string;
  
  /** File path where the issue occurred */
  filePath?: string;
  
  /** Line number in the file (1-based) */
  lineNumber?: number;
  
  /** Column number in the file (1-based) */
  columnNumber?: number;
  
  /** Additional context data */
  context?: Record<string, any>;
  
  /** Timestamp when issue was recorded */
  timestamp: string;
}

/**
 * Broken link issue - when a link target cannot be resolved
 */
export interface BrokenLinkIssue extends ProcessingIssue {
  category: 'broken-link';
  module: 'link-resolver';
  context: {
    /** The text displayed for the link */
    linkText: string;
    /** The target that couldn't be resolved */
    linkTarget: string;
    /** Type of link */
    linkType: 'wiki' | 'markdown' | 'frontmatter';
    /** Suggested alternatives if available */
    suggestions?: string[];
  };
}

/**
 * Missing media issue - when referenced media file doesn't exist
 */
export interface MissingMediaIssue extends ProcessingIssue {
  category: 'missing-media';
  module: 'embed-media' | 'image-processor';
  context: {
    /** Path to the missing media file */
    mediaPath: string;
    /** Where the media was referenced from */
    referencedFrom: 'content' | 'frontmatter' | 'embed';
    /** Original reference syntax */
    originalReference?: string;
  };
}

/**
 * Media processing issue - when media file fails to process
 */
export interface MediaProcessingIssue extends ProcessingIssue {
  category: 'media-processing';
  module: 'image-processor';
  context: {
    /** Path to the media file */
    mediaPath: string;
    /** Type of processing that failed */
    operation: 'read' | 'optimize' | 'resize' | 'hash' | 'copy';
    /** Original error message */
    errorMessage: string;
    /** Error code if available */
    errorCode?: string;
  };
}

/**
 * Slug conflict issue - when multiple files would have the same slug
 */
export interface SlugConflictIssue extends ProcessingIssue {
  category: 'slug-conflict';
  module: 'slug-generator';
  context: {
    /** The original slug before disambiguation */
    originalSlug: string;
    /** The final slug after adding numeric suffix */
    finalSlug: string;
    /** Other files with the same base slug */
    conflictingFiles: string[];
  };
}

/**
 * Mermaid rendering issue
 */
export interface MermaidErrorIssue extends ProcessingIssue {
  category: 'mermaid-error';
  module: 'embed-mermaid';
  context: {
    /** Type of mermaid failure */
    errorType: 'plugin-load' | 'render-fail' | 'missing-deps';
    /** The mermaid diagram content if available */
    diagramContent?: string;
    /** Fallback behavior applied */
    fallback: string;
  };
}

/**
 * Type guards for specific issue types
 */
export function isBrokenLinkIssue(issue: ProcessingIssue): issue is BrokenLinkIssue {
  return issue.category === 'broken-link';
}

export function isMissingMediaIssue(issue: ProcessingIssue): issue is MissingMediaIssue {
  return issue.category === 'missing-media';
}

export function isMediaProcessingIssue(issue: ProcessingIssue): issue is MediaProcessingIssue {
  return issue.category === 'media-processing';
}

export function isSlugConflictIssue(issue: ProcessingIssue): issue is SlugConflictIssue {
  return issue.category === 'slug-conflict';
}

export function isMermaidErrorIssue(issue: ProcessingIssue): issue is MermaidErrorIssue {
  return issue.category === 'mermaid-error';
}

/**
 * Collection of issues with various groupings for easy access
 */
export interface ProcessingIssues {
  /** All issues in order they were recorded */
  issues: ProcessingIssue[];
  
  /** Issues grouped by file path (only included if includeAggregates is true) */
  byFile?: Record<string, ProcessingIssue[]>;
  
  /** Issues grouped by severity (only included if includeAggregates is true) */
  bySeverity?: {
    error: ProcessingIssue[];
    warning: ProcessingIssue[];
    info: ProcessingIssue[];
  };
  
  /** Issues grouped by category (only included if includeAggregates is true) */
  byCategory?: Record<IssueCategory, ProcessingIssue[]>;
  
  /** Issues grouped by module (only included if includeAggregates is true) */
  byModule?: Record<IssueModule, ProcessingIssue[]>;
  
  /** Summary statistics */
  summary: {
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    filesAffected: number;
    categoryCounts: Record<IssueCategory, number>;
    moduleCounts: Record<IssueModule, number>;
  };
  
  /** Metadata about the processing run */
  metadata: {
    processStartTime: string;
    processEndTime: string;
    processorVersion?: string;
    configHash?: string;
  };
}

/**
 * Options for filtering issues
 */
export interface IssueFilterOptions {
  severity?: IssueSeverity | IssueSeverity[];
  category?: IssueCategory | IssueCategory[];
  filePath?: string | string[];
  includeContext?: boolean;
}

/**
 * Options for generating the issue report
 */
export interface IssueReportOptions {
  includeAggregates?: boolean; // Whether to include byFile, bySeverity, byCategory, byModule groupings (default: false)
}