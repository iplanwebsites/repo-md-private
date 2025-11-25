/**
 * Base Tool Class and Utilities
 * Provides common functionality for all tools
 * @module baseTool
 */

/**
 * Base class for tool implementations
 * @class
 */
class BaseTool {
  constructor(definition, category, options = {}) {
    this.definition = definition;
    this.category = category;
    this.requiredPermissions = options.requiredPermissions || [];
    this.requiredContext = options.requiredContext || [];
    this.rateLimit = options.rateLimit || null;
    this.costEstimate = options.costEstimate || 'low';
    this.asyncExecution = options.asyncExecution || false;
  }

  /**
   * Validate tool execution context
   * @param {Object} args - Tool arguments
   * @param {Object} context - Execution context
   * @returns {Object} Validation result
   */
  validate(args, context) {
    // Check required permissions
    if (this.requiredPermissions.length > 0) {
      const userPermissions = context.user?.permissions || [];
      const missingPermissions = this.requiredPermissions.filter(
        perm => !userPermissions.includes(perm)
      );
      
      if (missingPermissions.length > 0) {
        return {
          valid: false,
          error: `Missing required permissions: ${missingPermissions.join(', ')}`
        };
      }
    }
    
    // Check required context
    const missingContext = this.requiredContext.filter(key => !context[key]);
    if (missingContext.length > 0) {
      return {
        valid: false,
        error: `Missing required context: ${missingContext.join(', ')}`
      };
    }
    
    // Validate required arguments
    const required = this.definition.parameters?.required || [];
    const missingArgs = required.filter(arg => !(arg in args));
    if (missingArgs.length > 0) {
      return {
        valid: false,
        error: `Missing required arguments: ${missingArgs.join(', ')}`
      };
    }
    
    return { valid: true };
  }

  /**
   * Execute the tool (to be implemented by subclasses)
   * @param {Object} args - Tool arguments
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async execute(args, context) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Safe execution wrapper with validation and error handling
   * @param {Object} args - Tool arguments
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async safeExecute(args, context) {
    try {
      // Validate before execution
      const validation = this.validate(args, context);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }
      
      // Execute the tool
      const result = await this.execute(args, context);
      
      // Ensure result has success flag
      if (!('success' in result)) {
        result.success = true;
      }
      
      return result;
    } catch (error) {
      console.error(`Error executing tool ${this.definition.name}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Get enriched tool definition
   * @returns {Object} Enriched tool definition
   */
  toJSON() {
    return {
      definition: this.definition,
      category: this.category,
      requiredPermissions: this.requiredPermissions,
      requiredContext: this.requiredContext,
      rateLimit: this.rateLimit,
      costEstimate: this.costEstimate,
      asyncExecution: this.asyncExecution,
      implementation: this.safeExecute.bind(this)
    };
  }
}

/**
 * Factory function to create a tool from a simple definition
 * @param {Object} config - Tool configuration
 * @returns {BaseTool} Tool instance
 */
const createTool = (config) => {
  const {
    definition,
    implementation,
    category,
    ...options
  } = config;
  
  class Tool extends BaseTool {
    async execute(args, context) {
      return implementation(args, context);
    }
  }
  
  return new Tool(definition, category, options);
};

/**
 * Create a batch of tools with shared configuration
 * @param {Array} toolConfigs - Array of tool configurations
 * @param {Object} sharedOptions - Options to apply to all tools
 * @returns {Array} Array of tool instances
 */
const createToolBatch = (toolConfigs, sharedOptions = {}) => {
  return toolConfigs.map(config => createTool({
    ...config,
    ...sharedOptions,
    // Tool-specific options take precedence
    requiredPermissions: config.requiredPermissions || sharedOptions.requiredPermissions,
    requiredContext: config.requiredContext || sharedOptions.requiredContext
  }));
};

/**
 * Common validation functions
 */
const validators = {
  /**
   * Validate project access
   * @param {Object} project - Project object
   * @param {Object} user - User object
   * @param {Array} requiredRoles - Required roles
   * @returns {boolean} Has access
   */
  hasProjectAccess: (project, user, requiredRoles = []) => {
    if (!project || !user) return false;
    
    // Check if user owns the project
    if (project.userId?.toString() === user._id?.toString()) {
      return true;
    }
    
    // Check member access
    const member = project.members?.find(
      m => m.userId?.toString() === user._id?.toString()
    );
    
    if (!member) return false;
    
    // If no specific roles required, any member has access
    if (requiredRoles.length === 0) return true;
    
    // Check if member has required role
    return requiredRoles.includes(member.role);
  },

  /**
   * Validate string parameter
   * @param {*} value - Value to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateString: (value, options = {}) => {
    const { minLength, maxLength, pattern, enum: enumValues } = options;
    
    if (typeof value !== 'string') {
      return { valid: false, error: 'Value must be a string' };
    }
    
    if (minLength && value.length < minLength) {
      return { valid: false, error: `Minimum length is ${minLength}` };
    }
    
    if (maxLength && value.length > maxLength) {
      return { valid: false, error: `Maximum length is ${maxLength}` };
    }
    
    if (pattern && !new RegExp(pattern).test(value)) {
      return { valid: false, error: 'Value does not match required pattern' };
    }
    
    if (enumValues && !enumValues.includes(value)) {
      return { valid: false, error: `Value must be one of: ${enumValues.join(', ')}` };
    }
    
    return { valid: true };
  }
};

/**
 * Common response builders
 */
const responses = {
  /**
   * Build success response
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @returns {Object} Success response
   */
  success: (data, message) => ({
    success: true,
    ...(message && { message }),
    ...(data !== undefined && { data })
  }),

  /**
   * Build error response
   * @param {string} error - Error message
   * @param {string} code - Error code
   * @returns {Object} Error response
   */
  error: (error, code) => ({
    success: false,
    error,
    ...(code && { code })
  }),

  /**
   * Build paginated response
   * @param {Array} items - Items array
   * @param {Object} pagination - Pagination info
   * @returns {Object} Paginated response
   */
  paginated: (items, pagination) => ({
    success: true,
    items,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || items.length,
      hasMore: pagination.hasMore || false
    }
  })
};

/**
 * Database helper functions
 */
const dbHelpers = {
  /**
   * Find project with access check
   * @param {Object} db - Database instance
   * @param {string} projectId - Project ID
   * @param {Object} user - User object
   * @returns {Promise<Object>} Project or null
   */
  findProjectWithAccess: async (db, projectId, user) => {
    const project = await db.collection('projects').findOne({
      _id: projectId,
      $or: [
        { userId: user._id },
        { 'members.userId': user._id }
      ]
    });
    
    return project;
  },

  /**
   * Create audit log entry
   * @param {Object} db - Database instance
   * @param {Object} entry - Audit log entry
   * @returns {Promise<Object>} Insert result
   */
  createAuditLog: async (db, entry) => {
    return db.collection('auditLogs').insertOne({
      ...entry,
      timestamp: new Date(),
      ...(entry.metadata && { metadata: entry.metadata })
    });
  }
};

export {
  BaseTool,
  createTool,
  createToolBatch,
  validators,
  responses,
  dbHelpers
};