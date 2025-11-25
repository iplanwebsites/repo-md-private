/**
 * Configuration management utilities
 */

/**
 * Merges the base configuration with tenant-specific overrides
 * @param {Object} baseConfig - The base configuration
 * @param {Object} tenantConfig - Tenant-specific configuration
 * @returns {Object} The merged configuration
 */
function mergeConfig(baseConfig, tenantConfig) {
  return {
    ...baseConfig,
    ...tenantConfig,
    theme: {
      ...baseConfig.theme,
      ...tenantConfig.theme
    },
    features: [...new Set([...baseConfig.features, ...(tenantConfig.features || [])])]
  };
}

/**
 * Validates a tenant configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
function validateConfig(config) {
  const errors = [];
  
  if (!config.name) {
    errors.push('Missing tenant name');
  }
  
  if (!config.template) {
    errors.push('Missing template specification');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  mergeConfig,
  validateConfig
};
