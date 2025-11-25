/**
 * API client for interacting with the multi-tenant platform API
 */

class ApiClient {
  /**
   * Create a new API client instance
   * @param {string} baseUrl - The base URL for API requests
   */
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get tenant configuration
   * @param {string} subdomain - The tenant subdomain
   * @returns {Promise<Object>} The tenant configuration
   */
  async getTenantConfig(subdomain) {
    const response = await fetch(`${this.baseUrl}/tenant/${subdomain}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tenant config: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * List all available tenants
   * @returns {Promise<Array>} List of tenant subdomains
   */
  async listTenants() {
    const response = await fetch(`${this.baseUrl}/tenants`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tenants: ${response.statusText}`);
    }
    
    return response.json();
  }
}

module.exports = ApiClient;
