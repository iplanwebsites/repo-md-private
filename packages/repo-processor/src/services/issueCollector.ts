import type {
  ProcessingIssue,
  ProcessingIssues,
  IssueSeverity,
  IssueCategory,
  IssueModule,
  BrokenLinkIssue,
  MissingMediaIssue,
  MediaProcessingIssue,
  SlugConflictIssue,
  MermaidErrorIssue,
  IssueFilterOptions,
  IssueReportOptions
} from '../types/issues';

/**
 * Service for collecting and managing processing issues
 */
export class IssueCollector {
  private issues: ProcessingIssue[] = [];
  private startTime: string;

  constructor() {
    this.startTime = new Date().toISOString();
  }

  /**
   * Add a generic issue
   */
  addIssue(issue: Omit<ProcessingIssue, 'timestamp'>): void {
    this.issues.push({
      ...issue,
      timestamp: new Date().toISOString()
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
    suggestions?: string[];
  }): void {
    const issue: BrokenLinkIssue = {
      severity: 'warning',
      category: 'broken-link',
      module: 'link-resolver',
      message: `Broken ${params.linkType} link: [[${params.linkTarget}]] - target file not found`,
      filePath: params.filePath,
      lineNumber: params.lineNumber,
      context: {
        linkText: params.linkText,
        linkTarget: params.linkTarget,
        linkType: params.linkType,
        suggestions: params.suggestions
      },
      timestamp: new Date().toISOString()
    };
    this.issues.push(issue);
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
    const issue: MissingMediaIssue = {
      severity: 'warning',
      category: 'missing-media',
      module: params.module || 'embed-media',
      message: `Missing media file: ${params.mediaPath}`,
      filePath: params.filePath,
      lineNumber: params.lineNumber,
      context: {
        mediaPath: params.mediaPath,
        referencedFrom: params.referencedFrom,
        originalReference: params.originalReference
      },
      timestamp: new Date().toISOString()
    };
    this.issues.push(issue);
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
    const issue: MediaProcessingIssue = {
      severity: 'error',
      category: 'media-processing',
      module: 'image-processor',
      message: `Failed to ${params.operation} media file: ${params.mediaPath} - ${params.errorMessage}`,
      filePath: params.filePath,
      context: {
        mediaPath: params.mediaPath,
        operation: params.operation,
        errorMessage: params.errorMessage,
        errorCode: params.errorCode
      },
      timestamp: new Date().toISOString()
    };
    this.issues.push(issue);
  }

  /**
   * Add a slug conflict warning
   */
  addSlugConflict(params: {
    filePath: string;
    originalSlug: string;
    finalSlug: string;
    conflictingFiles: string[];
  }): void {
    const issue: SlugConflictIssue = {
      severity: 'info',
      category: 'slug-conflict',
      module: 'slug-generator',
      message: `Slug conflict resolved: "${params.originalSlug}" → "${params.finalSlug}"`,
      filePath: params.filePath,
      context: {
        originalSlug: params.originalSlug,
        finalSlug: params.finalSlug,
        conflictingFiles: params.conflictingFiles
      },
      timestamp: new Date().toISOString()
    };
    this.issues.push(issue);
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
    const issue: MermaidErrorIssue = {
      severity: params.errorType === 'missing-deps' ? 'info' : 'warning',
      category: 'mermaid-error',
      module: 'embed-mermaid',
      message: params.message,
      filePath: params.filePath,
      lineNumber: params.lineNumber,
      context: {
        errorType: params.errorType,
        diagramContent: params.diagramContent,
        fallback: params.fallback
      },
      timestamp: new Date().toISOString()
    };
    this.issues.push(issue);
  }

  /**
   * Get all issues
   */
  getIssues(): ProcessingIssue[] {
    return [...this.issues];
  }

  /**
   * Filter issues based on criteria
   */
  filterIssues(options: IssueFilterOptions): ProcessingIssue[] {
    let filtered = [...this.issues];

    if (options.severity) {
      const severities = Array.isArray(options.severity) ? options.severity : [options.severity];
      filtered = filtered.filter(issue => severities.includes(issue.severity));
    }

    if (options.category) {
      const categories = Array.isArray(options.category) ? options.category : [options.category];
      filtered = filtered.filter(issue => categories.includes(issue.category));
    }

    if (options.filePath) {
      const paths = Array.isArray(options.filePath) ? options.filePath : [options.filePath];
      filtered = filtered.filter(issue => issue.filePath && paths.includes(issue.filePath));
    }

    if (!options.includeContext) {
      filtered = filtered.map(issue => {
        const { context, ...rest } = issue;
        return rest;
      });
    }

    return filtered;
  }

  /**
   * Generate the final report
   */
  generateReport(options: IssueReportOptions = {}): ProcessingIssues {
    const endTime = new Date().toISOString();
    const includeAggregates = options.includeAggregates ?? false;
    
    // Always calculate counts for summary
    const errorCount = this.issues.filter(i => i.severity === 'error').length;
    const warningCount = this.issues.filter(i => i.severity === 'warning').length;
    const infoCount = this.issues.filter(i => i.severity === 'info').length;
    
    // Calculate files affected
    const uniqueFiles = new Set(this.issues.map(i => i.filePath).filter(Boolean));
    const filesAffected = uniqueFiles.size;
    
    // Calculate category counts
    const categoryCounts: Record<IssueCategory, number> = {} as any;
    const allCategories: IssueCategory[] = [
      'broken-link', 'missing-media', 'media-processing', 'slug-conflict',
      'mermaid-error', 'frontmatter-error', 'parse-error', 'file-access',
      'configuration', 'other'
    ];
    for (const category of allCategories) {
      categoryCounts[category] = this.issues.filter(i => i.category === category).length;
    }
    
    // Calculate module counts
    const moduleCounts: Record<IssueModule, number> = {} as any;
    const allModules: IssueModule[] = [
      'markdown-parser', 'image-processor', 'embed-mermaid', 'embed-media',
      'link-resolver', 'slug-generator', 'frontmatter-parser', 'file-system',
      'config-validator', 'post-processor', 'other'
    ];
    for (const module of allModules) {
      moduleCounts[module] = this.issues.filter(i => i.module === module).length;
    }
    
    // Base report structure
    const report: ProcessingIssues = {
      issues: this.issues,
      summary: {
        totalIssues: this.issues.length,
        errorCount,
        warningCount,
        infoCount,
        filesAffected,
        categoryCounts,
        moduleCounts
      },
      metadata: {
        processStartTime: this.startTime,
        processEndTime: endTime
      }
    };
    
    // Only populate aggregates if requested
    if (includeAggregates) {
      // Group by file
      for (const issue of this.issues) {
        if (issue.filePath) {
          if (!report.byFile[issue.filePath]) {
            report.byFile[issue.filePath] = [];
          }
          report.byFile[issue.filePath].push(issue);
        }
      }

      // Group by severity
      report.bySeverity = {
        error: this.issues.filter(i => i.severity === 'error'),
        warning: this.issues.filter(i => i.severity === 'warning'),
        info: this.issues.filter(i => i.severity === 'info')
      };

      // Group by category
      for (const category of allCategories) {
        report.byCategory[category] = this.issues.filter(i => i.category === category);
      }

      // Group by module
      for (const module of allModules) {
        report.byModule[module] = this.issues.filter(i => i.module === module);
      }
    }

    return report;
  }

  /**
   * Clear all issues (useful for testing or resetting)
   */
  clear(): void {
    this.issues = [];
    this.startTime = new Date().toISOString();
  }

  /**
   * Get issue count by severity
   */
  getCountBySeverity(severity: IssueSeverity): number {
    return this.issues.filter(i => i.severity === severity).length;
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.getCountBySeverity('error') > 0;
  }

  /**
   * Get a summary string for console output
   */
  getSummaryString(): string {
    const errors = this.getCountBySeverity('error');
    const warnings = this.getCountBySeverity('warning');
    const info = this.getCountBySeverity('info');

    const parts = [];
    if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
    if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
    if (info > 0) parts.push(`${info} info`);

    return parts.length > 0 ? `Processing completed with ${parts.join(', ')}` : 'Processing completed successfully';
  }
}