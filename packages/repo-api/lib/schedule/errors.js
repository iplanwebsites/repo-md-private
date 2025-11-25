import * as Sentry from "@sentry/node";

/**
 * Custom error classes for the scheduling system
 */

export class SchedulerError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = "SchedulerError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends SchedulerError {
  constructor(message, details = null) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class TaskNotFoundError extends SchedulerError {
  constructor(taskId) {
    super(`Task not found: ${taskId}`, "TASK_NOT_FOUND", 404);
    this.name = "TaskNotFoundError";
    this.taskId = taskId;
  }
}

export class InvalidDateError extends SchedulerError {
  constructor(dateString) {
    super(`Invalid date: ${dateString}`, "INVALID_DATE", 400);
    this.name = "InvalidDateError";
    this.dateString = dateString;
  }
}

export class ExecutorNotFoundError extends SchedulerError {
  constructor(agentId) {
    super(`No executor registered for agent: ${agentId}`, "EXECUTOR_NOT_FOUND", 404);
    this.name = "ExecutorNotFoundError";
    this.agentId = agentId;
  }
}

export class TaskExecutionError extends SchedulerError {
  constructor(taskId, originalError) {
    super(`Task execution failed: ${originalError.message}`, "TASK_EXECUTION_FAILED", 500);
    this.name = "TaskExecutionError";
    this.taskId = taskId;
    this.originalError = originalError;
  }
}

export class NaturalLanguageError extends SchedulerError {
  constructor(command, reason) {
    super(`Failed to parse command "${command}": ${reason}`, "NLP_PARSE_ERROR", 400);
    this.name = "NaturalLanguageError";
    this.command = command;
    this.reason = reason;
  }
}

export class RecurrenceError extends SchedulerError {
  constructor(message) {
    super(message, "RECURRENCE_ERROR", 400);
    this.name = "RecurrenceError";
  }
}

export class QueueError extends SchedulerError {
  constructor(message) {
    super(message, "QUEUE_ERROR", 500);
    this.name = "QueueError";
  }
}

export class CalendarFeedError extends SchedulerError {
  constructor(message, feedType) {
    super(message, "CALENDAR_FEED_ERROR", 500);
    this.name = "CalendarFeedError";
    this.feedType = feedType;
  }
}

/**
 * Error handler middleware for Express
 */
export function schedulerErrorHandler(err, req, res, next) {
  // Log to Sentry
  if (err instanceof SchedulerError) {
    Sentry.captureException(err, {
      tags: {
        errorType: err.name,
        errorCode: err.code
      },
      extra: {
        ...err,
        url: req.url,
        method: req.method,
        body: req.body
      }
    });
  }

  // Handle Zod validation errors
  if (err.name === "ZodError") {
    const validationError = new ValidationError(
      "Validation failed",
      err.errors
    );
    
    return res.status(400).json({
      error: validationError.message,
      code: validationError.code,
      details: validationError.details
    });
  }

  // Handle our custom errors
  if (err instanceof SchedulerError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details })
    });
  }

  // Handle MongoDB errors
  if (err.name === "MongoError" || err.name === "MongoServerError") {
    Sentry.captureException(err);
    
    return res.status(500).json({
      error: "Database error occurred",
      code: "DATABASE_ERROR"
    });
  }

  // Default error handler
  next(err);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Error logging with context
 */
export function logError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
    timestamp: new Date().toISOString()
  };

  // Log to console in development
  if (process.env.NODE_ENV !== "production") {
    console.error("Scheduler Error:", errorInfo);
  }

  // Send to Sentry
  Sentry.captureException(error, {
    extra: context
  });

  return errorInfo;
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff(
  fn,
  maxRetries = 3,
  initialDelay = 1000,
  maxDelay = 30000,
  onRetry = null
) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt),
        maxDelay
      );
      
      if (onRetry) {
        onRetry(attempt + 1, delay, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Safe task execution wrapper
 */
export async function safeExecute(taskId, fn, context = {}) {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    
    return {
      success: true,
      result,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    logError(error, {
      taskId,
      ...context
    });
    
    return {
      success: false,
      error: error.message,
      errorType: error.name,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Validate and sanitize user input
 */
export function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== "string") {
    return input;
  }
  
  // Remove control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, "");
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Create error response for API
 */
export function createErrorResponse(error) {
  if (error instanceof SchedulerError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      ...(error.details && { details: error.details })
    };
  }
  
  // Generic error response
  return {
    success: false,
    error: "An unexpected error occurred",
    code: "INTERNAL_ERROR"
  };
}