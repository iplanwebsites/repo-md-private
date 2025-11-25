const logger = require('../../packages/utils/logger');

// Mock tenant configurations
const tenantConfigs = {
  'default': {
    name: 'Default Site',
    template: 'next-template-a',
    theme: {
      primaryColor: '#4285F4',
      secondaryColor: '#34A853',
      fontFamily: 'Roboto, sans-serif'
    },
    features: ['blog', 'contact']
  },
  'demo': {
    name: 'Demo Site',
    template: 'next-template-b',
    theme: {
      primaryColor: '#DB4437',
      secondaryColor: '#F4B400',
      fontFamily: 'Open Sans, sans-serif'
    },
    features: ['blog', 'shop', 'gallery']
  },
  'test': {
    name: 'Test Site',
    template: 'remix-template',
    theme: {
      primaryColor: '#0F9D58',
      secondaryColor: '#4285F4',
      fontFamily: 'Lato, sans-serif'
    },
    features: ['documentation', 'forum']
  }
};

/**
 * Get tenant configuration by subdomain
 * @param {string} subdomain - The tenant subdomain
 * @returns {Promise<Object>} The tenant configuration
 */
async function getTenantConfig(subdomain) {
  // In a real implementation, this would fetch from a database
  logger.debug(`Fetching configuration for tenant: ${subdomain}`);
  
  // Simulate async database call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(tenantConfigs[subdomain] || tenantConfigs['default']);
    }, 50);
  });
}

/**
 * List all available tenants
 * @returns {Promise<Array>} List of tenant subdomains
 */
async function listTenants() {
  // In a real implementation, this would query the database
  return Object.keys(tenantConfigs);
}

module.exports = {
  getTenantConfig,
  listTenants
};
