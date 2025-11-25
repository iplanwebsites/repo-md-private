/**
 * Centralized Error Handling for AI/LLM System
 * @module errorHandler
 */

/**
 * Custom error classes for different error types
 */
class AIError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
  }
}

class ValidationError extends AIError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AIError {
  constructor(message = 'Authentication required', details = {}) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AIError {
  constructor(message = 'Insufficient permissions', details = {}) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AIError {
  constructor(resource, details = {}) {
    super(`${resource} not found`, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

class RateLimitError extends AIError {
  constructor(retryAfter, details = {}) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429, { retryAfter, ...details });
    this.name = 'RateLimitError';
  }
}

class ToolExecutionError extends AIError {
  constructor(toolName, originalError, details = {}) {
    super(`Tool execution failed: ${toolName}`, 'TOOL_EXECUTION_ERROR', 500, {
      tool: toolName,
      originalError: originalError.message,
      ...details
    });
    this.name = 'ToolExecutionError';
  }
}

class OpenAIError extends AIError {
  constructor(message, originalError, details = {}) {
    super(message, 'OPENAI_ERROR', 502, {
      service: 'openai',
      originalError: originalError.message,
      ...details
    });
    this.name = 'OpenAIError';
  }
}

/**
 * Error handler middleware for Express
 */
const errorMiddleware = (err, req, res, next) => {
  // Log error for monitoring
  console.error(`[${new Date().toISOString()}] Error:`, {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?._id
  });

  // Handle AI errors
  if (err instanceof AIError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
      timestamp: err.timestamp
    });
  }

  // Handle MongoDB errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    if (err.code === 11000) {
      return res.status(409).json({
        error: 'Resource already exists',
        code: 'DUPLICATE_RESOURCE',
        details: { field: Object.keys(err.keyPattern || {})[0] }
      });
    }
    
    return res.status(500).json({
      error: 'Database operation failed',
      code: 'DATABASE_ERROR'
    });
  }

  // Handle validation errors from middleware
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors
    });
  }

  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Error wrapper for tool implementations
 */
const toolErrorWrapper = (toolName, implementation) => {
  return async (args, context) => {
    try {
      return await implementation(args, context);
    } catch (error) {
      // Check if it's already a formatted error response
      if (error.success === false) {
        return error;
      }
      
      // Log tool execution error
      console.error(`Tool execution error in ${toolName}:`, error);
      
      // Return formatted error response
      return {
        success: false,
        error: error.message || 'Tool execution failed',
        code: error.code || 'TOOL_ERROR',
        tool: toolName
      };
    }
  };
};

/**
 * Stream error handler for SSE responses
 */
const handleStreamError = (error, res) => {
  const errorData = {
    type: 'error',
    error: error.message || 'Stream processing error',
    code: error.code || 'STREAM_ERROR'
  };
  
  if (!res.headersSent) {
    res.writeHead(500, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
  }
  
  res.write(`data: ${JSON.stringify(errorData)}\n\n`);
  res.end();
};

/**
 * OpenAI API error handler
 */
const handleOpenAIError = (error) => {
  // Rate limit error
  if (error.status === 429) {
    const retryAfter = error.headers?.['retry-after'] || 60;
    throw new RateLimitError(retryAfter, { service: 'openai' });
  }
  
  // Quota exceeded
  if (error.code === 'insufficient_quota') {
    throw new OpenAIError('OpenAI API quota exceeded', error, { 
      code: 'QUOTA_EXCEEDED' 
    });
  }
  
  // Model overloaded
  if (error.code === 'model_overloaded') {
    throw new OpenAIError('Model is currently overloaded', error, {
      code: 'MODEL_OVERLOADED',
      retryable: true
    });
  }
  
  // Generic OpenAI error
  throw new OpenAIError('OpenAI API error', error);
};

/**
 * Validation helper functions
 */
const validate = {
  /**
   * Validate required fields
   * @param {Object} data - Data to validate
   * @param {Array} required - Required field names
   * @throws {ValidationError}
   */
  required: (data, required) => {
    const missing = required.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new ValidationError('Missing required fields', { 
        missing,
        required 
      });
    }
  },

  /**
   * Validate field types
   * @param {Object} data - Data to validate
   * @param {Object} schema - Field type schema
   * @throws {ValidationError}
   */
  types: (data, schema) => {
    const errors = {};
    
    for (const [field, expectedType] of Object.entries(schema)) {
      if (data[field] !== undefined) {
        const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
        
        if (actualType !== expectedType) {
          errors[field] = `Expected ${expectedType}, got ${actualType}`;
        }
      }
    }
    
    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Type validation failed', { errors });
    }
  },

  /**
   * Validate enum values
   * @param {*} value - Value to validate
   * @param {Array} allowedValues - Allowed values
   * @param {string} fieldName - Field name for error message
   * @throws {ValidationError}
   */
  enum: (value, allowedValues, fieldName) => {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(`Invalid ${fieldName}`, {
        field: fieldName,
        value,
        allowed: allowedValues
      });
    }
  },

  /**
   * Validate string constraints
   * @param {string} value - String to validate
   * @param {Object} constraints - Constraints object
   * @param {string} fieldName - Field name for error message
   * @throws {ValidationError}
   */
  string: (value, constraints, fieldName) => {
    const { minLength, maxLength, pattern } = constraints;
    
    if (minLength && value.length < minLength) {
      throw new ValidationError(`${fieldName} too short`, {
        field: fieldName,
        minLength,
        actualLength: value.length
      });
    }
    
    if (maxLength && value.length > maxLength) {
      throw new ValidationError(`${fieldName} too long`, {
        field: fieldName,
        maxLength,
        actualLength: value.length
      });
    }
    
    if (pattern && !new RegExp(pattern).test(value)) {
      throw new ValidationError(`${fieldName} format invalid`, {
        field: fieldName,
        pattern
      });
    }
  }
};

/**
 * Error recovery strategies
 */
const recovery = {
  /**
   * Retry with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {Object} options - Retry options
   * @returns {Promise} Result of successful execution
   */
  retry: async (fn, options = {}) => {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      factor = 2,
      onRetry
    } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(factor, attempt - 1),
          maxDelay
        );
        
        if (onRetry) {
          onRetry(error, attempt, delay);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  },

  /**
   * Circuit breaker pattern
   * @param {string} key - Circuit breaker key
   * @param {Function} fn - Function to protect
   * @param {Object} options - Circuit breaker options
   * @returns {Promise} Result or circuit breaker error
   */
  circuitBreaker: (() => {
    const circuits = new Map();
    
    return async (key, fn, options = {}) => {
      const {
        threshold = 5,
        timeout = 60000,
        resetTimeout = 30000
      } = options;
      
      let circuit = circuits.get(key);
      
      if (!circuit) {
        circuit = {
          failures: 0,
          lastFailure: null,
          state: 'closed' // closed, open, half-open
        };
        circuits.set(key, circuit);
      }
      
      // Check if circuit is open
      if (circuit.state === 'open') {
        const elapsed = Date.now() - circuit.lastFailure;
        
        if (elapsed < resetTimeout) {
          throw new AIError('Circuit breaker is open', 'CIRCUIT_OPEN', 503, {
            key,
            resetIn: Math.ceil((resetTimeout - elapsed) / 1000)
          });
        }
        
        // Try half-open
        circuit.state = 'half-open';
      }
      
      try {
        const result = await Promise.race([
          fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Circuit breaker timeout')), timeout)
          )
        ]);
        
        // Success - reset circuit
        circuit.failures = 0;
        circuit.state = 'closed';
        
        return result;
      } catch (error) {
        circuit.failures++;
        circuit.lastFailure = Date.now();
        
        if (circuit.failures >= threshold) {
          circuit.state = 'open';
        }
        
        throw error;
      }
    };
  })()
};

module.exports = {
  // Error classes
  AIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ToolExecutionError,
  OpenAIError,
  
  // Middleware and handlers
  errorMiddleware,
  asyncHandler,
  toolErrorWrapper,
  handleStreamError,
  handleOpenAIError,
  
  // Validation utilities
  validate,
  
  // Recovery strategies
  recovery
};