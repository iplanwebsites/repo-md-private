/**
 * Issue Collector Service
 *
 * Functional service for collecting and managing processing issues.
 * Uses immutable patterns - returns new state rather than mutating.
 */

import type {
  ProcessingIssue,
  IssueSeverity,
  IssueCategory,
  IssueModule,
  IssueSummary,
  IssueReport,
  IssueFilterOptions,
} from '../types/issues.js';

// ============================================================================
// Issue Collector State
// ============================================================================

export interface IssueCollectorState {
  readonly issues: readonly ProcessingIssue[];
  readonly startTime: string;
}

// ============================================================================
// Issue Collector Class
// ============================================================================

/**
 * Service for collecting and managing processing issues.
 * Provides both mutable (class-based) and functional interfaces.
 */
export class IssueCollector {
  private issues: ProcessingIssue[] = [];
  private readonly startTime: string;

  constructor() {
    this.startTime = new Date().toISOString();
  }

  // --------------------------------------------------------------------------
  // Core Methods
  // --------------------------------------------------------------------------

  /**
   * Add a generic issue
   */
  addIssue(issue: Omit<ProcessingIssue, 'timestamp'>): void {
    this.issues.push({
      ...issue,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add a broken link issue
   */
  addBrokenLink(params: {
    filePath: string;
    lineNumber?: number;
    linkText: string;
    linkTarget: string;
    linkType: 'wiki' | 'markdown' | 'frontmatter';
    suggestions?: readonly string[];
  }): void {
    this.addIssue({
      severity: 'warning',
      category: 'broken-link',
      module: 'link-resolver',
      message: `Broken ${params.linkType} link: [[${params.linkTarget}]] - target not found`,
      filePath: params.filePath,
      lineNumber: params.lineNumber,
      context: {
        linkText: params.linkText,
        linkTarget: params.linkTarget,
        linkType: params.linkType,
        suggestions: params.suggestions,
      },
    });
  }

  /**
   * Add a missing media issue
   */
  addMissingMedia(params: {
    filePath: string;
    lineNumber?: number;
    mediaPath: string;
    referencedFrom: 'content' | 'frontmatter' | 'embed';
    originalReference?: string;
    module?: 'embed-media' | 'image-processor';
  }): void {
    this.addIssue({
      severity: 'warning',
      category: 'missing-media',
      module: params.module ?? 'embed-media',
      message: `Missing media file: ${params.mediaPath}`,
      filePath: params.filePath,
      lineNumber: params.lineNumber,
      context: {
        mediaPath: params.mediaPath,
        referencedFrom: params.referencedFrom,
        originalReference: params.originalReference,
      },
    });
  }

  /**
   * Add a media processing error
   */
  addMediaProcessingError(params: {
    filePath: string;
    mediaPath: string;
    operation: 'read' | 'optimize' | 'resize' | 'hash' | 'copy';
    errorMessage: string;
    errorCode?: string;
  }): void {
    this.addIssue({
      severity: 'error',
      category: 'media-processing',
      module: 'image-processor',
      message: `Failed to ${params.operation} media: ${params.mediaPath} - ${params.errorMessage}`,
      filePath: params.filePath,
      context: {
        mediaPath: params.mediaPath,
        operation: params.operation,
        errorMessage: params.errorMessage,
        errorCode: params.errorCode,
      },
    });
  }

  /**
   * Add a slug conflict warning
   */
  addSlugConflict(params: {
    filePath: string;
    originalSlug: string;
    finalSlug: string;
    conflictingFiles: readonly string[];
  }): void {
    this.addIssue({
      severity: 'info',
      category: 'slug-conflict',
      module: 'slug-generator',
      message: `Slug conflict resolved: "${params.originalSlug}" → "${params.finalSlug}"`,
      filePath: params.filePath,
      context: {
        originalSlug: params.originalSlug,
        finalSlug: params.finalSlug,
        conflictingFiles: params.conflictingFiles,
      },
    });
  }

  /**
   * Add a mermaid error
   */
  addMermaidError(params: {
    filePath: string;
    lineNumber?: number;
    errorType: 'plugin-load' | 'render-fail' | 'missing-deps';
    message: string;
    diagramContent?: string;
    fallback: string;
  }): void {
    this.addIssue({
      severity: params.errorType === 'missing-deps' ? 'info' : 'warning',
      category: 'mermaid-error',
      module: 'embed-mermaid',
      message: params.message,
      filePath: params.filePath,
      lineNumber: params.lineNumber,
      context: {
        errorType: params.errorType,
        diagramContent: params.diagramContent,
        fallback: params.fallback,
      },
    });
  }

  /**
   * Add an embedding error
   */
  addEmbeddingError(params: {
    filePath?: string;
    embeddingType: 'text' | 'image';
    operation: 'initialize' | 'embed' | 'batch';
    errorMessage: string;
  }): void {
    this.addIssue({
      severity: 'error',
      category: 'embedding-error',
      module: params.embeddingType === 'text' ? 'text-embeddings' : 'image-embeddings',
      message: `${params.embeddingType} embedding ${params.operation} failed: ${params.errorMessage}`,
      filePath: params.filePath,
      context: {
        embeddingType: params.embeddingType,
        operation: params.operation,
        errorMessage: params.errorMessage,
      },
    });
  }

  /**
   * Add a plugin error
   */
  addPluginError(params: {
    pluginName: string;
    operation: 'initialize' | 'process' | 'dispose';
    errorMessage: string;
  }): void {
    this.addIssue({
      severity: 'error',
      category: 'plugin-error',
      module: 'plugin-manager',
      message: `Plugin "${params.pluginName}" ${params.operation} failed: ${params.errorMessage}`,
      context: {
        pluginName: params.pluginName,
        operation: params.operation,
        errorMessage: params.errorMessage,
      },
    });
  }

  // --------------------------------------------------------------------------
  // Query Methods
  // --------------------------------------------------------------------------

  /**
   * Get all issues
   */
  getIssues(): readonly ProcessingIssue[] {
    return [...this.issues];
  }

  /**
   * Filter issues
   */
  filterIssues(options: IssueFilterOptions): readonly ProcessingIssue[] {
    return filterIssues(this.issues, options);
  }

  /**
   * Get issue count by severity
   */
  getCountBySeverity(severity: IssueSeverity): number {
    return this.issues.filter((i) => i.severity === severity).length;
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.getCountBySeverity('error') > 0;
  }

  /**
   * Get summary string for console output
   */
  getSummaryString(): string {
    const errors = this.getCountBySeverity('error');
    const warnings = this.getCountBySeverity('warning');
    const info = this.getCountBySeverity('info');

    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
    if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
    if (info > 0) parts.push(`${info} info`);

    return parts.length > 0
      ? `Processing completed with ${parts.join(', ')}`
      : 'Processing completed successfully';
  }

  // --------------------------------------------------------------------------
  // Report Generation
  // --------------------------------------------------------------------------

  /**
   * Generate the final report
   */
  generateReport(): IssueReport {
    const endTime = new Date().toISOString();
    return generateIssueReport(this.issues, this.startTime, endTime);
  }

  /**
   * Clear all issues (for testing)
   */
  clear(): void {
    this.issues = [];
  }
}

// ============================================================================
// Functional Helpers
// ============================================================================

/**
 * Filter issues based on criteria
 */
export const filterIssues = (
  issues: readonly ProcessingIssue[],
  options: IssueFilterOptions
): readonly ProcessingIssue[] => {
  let filtered = [...issues];

  if (options.severity) {
    const severities = Array.isArray(options.severity) ? options.severity : [options.severity];
    filtered = filtered.filter((i) => severities.includes(i.severity));
  }

  if (options.category) {
    const categories = Array.isArray(options.category) ? options.category : [options.category];
    filtered = filtered.filter((i) => categories.includes(i.category));
  }

  if (options.module) {
    const modules = Array.isArray(options.module) ? options.module : [options.module];
    filtered = filtered.filter((i) => modules.includes(i.module));
  }

  if (options.filePath) {
    const paths = Array.isArray(options.filePath) ? options.filePath : [options.filePath];
    filtered = filtered.filter((i) => i.filePath && paths.includes(i.filePath));
  }

  return filtered;
};

/**
 * Calculate issue summary
 */
export const calculateSummary = (issues: readonly ProcessingIssue[]): IssueSummary => {
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  const uniqueFiles = new Set(issues.map((i) => i.filePath).filter(Boolean));

  const categoryCounts = {} as Record<IssueCategory, number>;
  const moduleCounts = {} as Record<IssueModule, number>;

  for (const issue of issues) {
    categoryCounts[issue.category] = (categoryCounts[issue.category] ?? 0) + 1;
    moduleCounts[issue.module] = (moduleCounts[issue.module] ?? 0) + 1;
  }

  return {
    totalIssues: issues.length,
    errorCount,
    warningCount,
    infoCount,
    filesAffected: uniqueFiles.size,
    categoryCounts,
    moduleCounts,
  };
};

/**
 * Generate issue report
 */
export const generateIssueReport = (
  issues: readonly ProcessingIssue[],
  startTime: string,
  endTime: string
): IssueReport => ({
  issues,
  summary: calculateSummary(issues),
  metadata: {
    processStartTime: startTime,
    processEndTime: endTime,
  },
});
