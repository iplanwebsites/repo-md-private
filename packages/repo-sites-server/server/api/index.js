const logger = require('../../packages/utils/logger');
const { getTenantConfig, listTenants } = require('../tenant-manager');

/**
 * Sets up API routes for the application
 * @param {Express} app - Express application instance
 */
function setupApiRoutes(app) {
  // API route prefix
  const apiRouter = app.use('/api');
  
  // Get tenant configuration
  app.get('/api/tenant/:subdomain', async (req, res) => {
    try {
      const { subdomain } = req.params;
      const config = await getTenantConfig(subdomain);
      
      if (!config) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      
      res.json(config);
    } catch (error) {
      logger.error(`API error: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // List all tenants
  app.get('/api/tenants', async (req, res) => {
    try {
      const tenants = await listTenants();
      res.json(tenants);
    } catch (error) {
      logger.error(`API error: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });
}

module.exports = { setupApiRoutes };
