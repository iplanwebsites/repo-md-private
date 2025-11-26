// src/services/loggerService.js
import util from "util";

/**
 * Job-specific logger that maintains isolated logs per job
 * This approach ensures logs from all child processes are captured
 */
class JobLogger {
  constructor(jobId) {
    this.jobId = jobId;
    this.logs = [];
  }

  /**
   * Log an informational message
   */
  log(...args) {
    const logMessage = util.format(...args);
    this.logs.push({
      type: "info",
      jobId: this.jobId,
      timestamp: new Date().toISOString(),
      message: logMessage,
    });
    console.log(`[${this.jobId}]`, ...args);
  }

  /**
   * Log an error message
   */
  error(...args) {
    const logMessage = util.format(...args);
    this.logs.push({
      type: "error",
      jobId: this.jobId,
      timestamp: new Date().toISOString(),
      message: logMessage,
    });
    console.error(`[${this.jobId}]`, ...args);
  }

  /**
   * Get all logs for this job
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Clear all logs for this job
   */
  clear() {
    this.logs.length = 0;
  }

  /**
   * Creates a proxy to redirect console.log and console.error to this logger
   * This is used inside child processes to ensure their logs are captured
   */
  createConsoleProxy() {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const logger = this;

    // Create proxy object that mimics console but redirects to job logger
    const consoleProxy = {
      log: function(...args) {
        logger.log(...args);
        originalConsoleLog.apply(console, args);
      },
      error: function(...args) {
        logger.error(...args);
        originalConsoleError.apply(console, args);
      }
    };

    return consoleProxy;
  }

  /**
   * Install global console overrides for this specific job
   * NOTE: This should be used with extreme caution and only within job-specific
   * contexts where we're certain no other jobs are running concurrently
   */
  installGlobalProxy() {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const logger = this;

    console.log = function(...args) {
      logger.log(...args);
    };

    console.error = function(...args) {
      logger.error(...args);
    };

    // Return function to restore original console methods
    return function restoreConsole() {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    };
  }
}

/**
 * Logger service that creates and manages job-specific loggers
 */
class LoggerService {
  constructor() {
    this.jobLoggers = new Map();
  }

  /**
   * Get or create a logger for a specific job
   * @param {string} jobId - The unique job identifier
   * @returns {JobLogger} - The job-specific logger
   */
  getLogger(jobId) {
    if (!this.jobLoggers.has(jobId)) {
      this.jobLoggers.set(jobId, new JobLogger(jobId));
    }
    return this.jobLoggers.get(jobId);
  }

  /**
   * Remove a logger when job is complete
   * @param {string} jobId - The unique job identifier
   */
  removeLogger(jobId) {
    this.jobLoggers.delete(jobId);
  }
}

// Create singleton instance
const loggerService = new LoggerService();

export default loggerService;