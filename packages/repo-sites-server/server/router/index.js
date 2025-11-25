const express = require('express');
const fs = require('fs');
const path = require('path');
const { getTenantConfig } = require('../tenant-manager');
const logger = require('../../packages/utils/logger');

const router = express.Router();
const appsDistDir = path.join(__dirname, '../../apps/dist');

// Extract tenant information from Cloudflare headers
const getTenantInfo = (req) => {
  // Mock extracting subdomain from Cloudflare-specific header
  // In production, you'd use the actual header name from Cloudflare (e.g. cf-connecting-ip)
  const cfConnectingDomain = req.headers['cf-connecting-domain'] || '';
  
  if (!cfConnectingDomain) {
    return { subdomain: 'default' };
  }
  
  // Extract subdomain from the domain
  const parts = cfConnectingDomain.split('.');
  if (parts.length >= 3) {
    return { subdomain: parts[0] };
  }
  
  return { subdomain: 'default' };
};

// Serve template static assets
router.use('/assets/:template', express.static(path.join(appsDistDir)));

// Main router that handles tenant-specific routing
router.use(async (req, res, next) => {
  try {
    // Get tenant information from request headers
    const { subdomain } = getTenantInfo(req);
    logger.info(`Request for tenant: ${subdomain}`);
    
    // Get tenant configuration
    const tenantConfig = await getTenantConfig(subdomain);
    
    if (!tenantConfig) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Attach tenant config to request for use in downstream handlers
    req.tenantConfig = tenantConfig;
    
    // Get the template directory
    const templateName = tenantConfig.template || 'next-template-a';
    const templatePath = path.join(appsDistDir, templateName);
    
    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      logger.error(`Template not found: ${templatePath}`);
      
      // Serve the mock page if template doesn't exist yet
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${tenantConfig.name || 'Multi-tenant App'}</title>
          </head>
          <body>
            <h1>Welcome to ${tenantConfig.name || 'Multi-tenant App'}</h1>
            <p>This is a mock page for tenant: ${subdomain}</p>
            <p>Template: ${templateName}</p>
            <pre>${JSON.stringify(tenantConfig, null, 2)}</pre>
          </body>
        </html>
      `);
    }
    
    // Serve the template's index.html with variable replacements
    const indexPath = path.join(templatePath, 'index.html');
    
    if (fs.existsSync(indexPath)) {
      let htmlContent = fs.readFileSync(indexPath, 'utf8');
      
      // Replace placeholders with tenant-specific content
      htmlContent = htmlContent
        .replace(/{{TENANT_NAME}}/g, tenantConfig.name || 'Multi-tenant App')
        
        // Replace features list if it exists
        .replace(/{{FEATURES}}/g, 
          tenantConfig.features 
            ? tenantConfig.features.map(feature => `<li>${feature}</li>`).join('\n') 
            : '<li>No features available</li>'
        )
        
        // Replace feature cards if they exist
        .replace(/{{FEATURE_CARDS}}/g, 
          tenantConfig.features 
            ? tenantConfig.features.map(feature => `
                <div class="feature-card">
                  <h3>${feature}</h3>
                  <p>Description for ${feature}</p>
                </div>
              `).join('\n') 
            : '<div class="feature-card"><h3>No features available</h3></div>'
        )
        
        // Replace documentation sections if they exist
        .replace(/{{DOCUMENTATION_SECTIONS}}/g, 
          tenantConfig.features 
            ? tenantConfig.features.map(feature => `
                <div class="card">
                  <h3>${feature}</h3>
                  <p>Documentation for ${feature}</p>
                </div>
              `).join('\n') 
            : '<div class="card"><h3>No documentation available</h3></div>'
        );
      
      // Apply theme customizations
      if (tenantConfig.theme) {
        const { primaryColor, secondaryColor, fontFamily } = tenantConfig.theme;
        
        // This is a simple replacement, in a real implementation you would use a more sophisticated approach
        if (primaryColor) {
          htmlContent = htmlContent.replace(/background-color: #[0-9A-F]{6};/g, function(match) {
            return match.includes('primary') ? `background-color: ${primaryColor};` : match;
          });
        }
        
        if (secondaryColor) {
          htmlContent = htmlContent.replace(/background-color: #[0-9A-F]{6};/g, function(match) {
            return match.includes('secondary') ? `background-color: ${secondaryColor};` : match;
          });
        }
        
        if (fontFamily) {
          htmlContent = htmlContent.replace(/font-family: [^;]+;/g, function(match) {
            return `font-family: ${fontFamily};`;
          });
        }
      }
      
      return res.send(htmlContent);
    }
    
    // If no index.html exists, serve a simple info page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${tenantConfig.name || 'Multi-tenant App'}</title>
        </head>
        <body>
          <h1>Welcome to ${tenantConfig.name || 'Multi-tenant App'}</h1>
          <p>This is a mock page for tenant: ${subdomain}</p>
          <p>Template: ${templateName}</p>
          <pre>${JSON.stringify(tenantConfig, null, 2)}</pre>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error(`Router error: ${error.message}`);
    next(error);
  }
});

module.exports = { router };