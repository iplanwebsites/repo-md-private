/**
 * Worker Issue Collector
 * Collects internal processing issues separate from content issues
 */

class WorkerIssueCollector {
  constructor() {
    this.issues = [];
    this.startTime = new Date().toISOString();
  }

  /**
   * Add a generic issue
   */
  addIssue({ severity, category, module, message, filePath, context }) {
    this.issues.push({
      severity,
      category,
      module,
      message,
      filePath,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add an embedding processing error
   */
  addEmbeddingError({ type, filePath, error, operation }) {
    this.addIssue({
      severity: 'error',
      category: 'embedding-error',
      module: type === 'image' ? 'image-embeddings' : 'text-embeddings',
      message: `Failed to ${operation} ${type} embeddings: ${error.message || error}`,
      filePath,
      context: {
        embeddingType: type,
        operation,
        errorMessage: error.message || error,
        errorStack: error.stack
      }
    });
  }

  /**
   * Add a database processing error
   */
  addDatabaseError({ operation, error, tableName }) {
    this.addIssue({
      severity: 'error',
      category: 'database-error',
      module: 'sqlite-builder',
      message: `Database ${operation} failed${tableName ? ` for table ${tableName}` : ''}: ${error.message || error}`,
      context: {
        operation,
        tableName,
        errorMessage: error.message || error,
        errorCode: error.code
      }
    });
  }

  /**
   * Add a deployment error
   */
  addDeploymentError({ service, operation, error, filePath }) {
    this.addIssue({
      severity: 'error',
      category: 'deployment-error',
      module: `deploy-${service}`,
      message: `${service} ${operation} failed: ${error.message || error}`,
      filePath,
      context: {
        service,
        operation,
        errorMessage: error.message || error,
        errorCode: error.code
      }
    });
  }

  /**
   * Add a GitHub API error
   */
  addGitHubError({ operation, error, repo }) {
    this.addIssue({
      severity: 'error',
      category: 'github-error',
      module: 'github-api',
      message: `GitHub ${operation} failed${repo ? ` for ${repo}` : ''}: ${error.message || error}`,
      context: {
        operation,
        repo,
        errorMessage: error.message || error,
        errorStatus: error.status
      }
    });
  }

  /**
   * Add a file system error
   */
  addFileSystemError({ operation, path, error }) {
    this.addIssue({
      severity: 'error',
      category: 'filesystem-error',
      module: 'file-system',
      message: `File system ${operation} failed for ${path}: ${error.message || error}`,
      filePath: path,
      context: {
        operation,
        errorMessage: error.message || error,
        errorCode: error.code
      }
    });
  }

  /**
   * Add a WordPress import error
   */
  addWordPressError({ operation, error, context }) {
    this.addIssue({
      severity: 'error',
      category: 'wordpress-error',
      module: 'wp-importer',
      message: `WordPress ${operation} failed: ${error.message || error}`,
      context: {
        operation,
        ...context,
        errorMessage: error.message || error
      }
    });
  }

  /**
   * Add a configuration warning
   */
  addConfigWarning({ setting, message, suggestion }) {
    this.addIssue({
      severity: 'warning',
      category: 'configuration',
      module: 'config-validator',
      message,
      context: {
        setting,
        suggestion
      }
    });
  }

  /**
   * Add a performance warning
   */
  addPerformanceWarning({ operation, duration, threshold, details }) {
    this.addIssue({
      severity: 'warning',
      category: 'performance',
      module: 'performance-monitor',
      message: `${operation} took ${duration}ms (threshold: ${threshold}ms)`,
      context: {
        operation,
        duration,
        threshold,
        ...details
      }
    });
  }

  /**
   * Generate the final report
   */
  generateReport() {
    const endTime = new Date().toISOString();
    
    const errorCount = this.issues.filter(i => i.severity === 'error').length;
    const warningCount = this.issues.filter(i => i.severity === 'warning').length;
    const infoCount = this.issues.filter(i => i.severity === 'info').length;

    const categoryCounts = {};
    const moduleCounts = {};
    
    this.issues.forEach(issue => {
      categoryCounts[issue.category] = (categoryCounts[issue.category] || 0) + 1;
      moduleCounts[issue.module] = (moduleCounts[issue.module] || 0) + 1;
    });

    return {
      issues: this.issues,
      summary: {
        totalIssues: this.issues.length,
        errorCount,
        warningCount,
        infoCount,
        categoryCounts,
        moduleCounts
      },
      metadata: {
        processStartTime: this.startTime,
        processEndTime: endTime,
        workerVersion: process.env.npm_package_version || 'unknown'
      }
    };
  }

  /**
   * Check if there are any errors
   */
  hasErrors() {
    return this.issues.some(i => i.severity === 'error');
  }

  /**
   * Get a summary string for console output
   */
  getSummaryString() {
    const errors = this.issues.filter(i => i.severity === 'error').length;
    const warnings = this.issues.filter(i => i.severity === 'warning').length;
    const info = this.issues.filter(i => i.severity === 'info').length;

    const parts = [];
    if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
    if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
    if (info > 0) parts.push(`${info} info`);

    return parts.length > 0 
      ? `Worker processing completed with ${parts.join(', ')}`
      : 'Worker processing completed successfully';
  }
}

export default WorkerIssueCollector;