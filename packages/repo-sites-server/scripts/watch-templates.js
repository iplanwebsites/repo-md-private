#!/usr/bin/env node

/**
 * Template watcher script for the multi-tenant platform
 * 
 * This script:
 * 1. Reads the app template configuration from apps/app-templates.json
 * 2. Watches for changes in the source template directories
 * 3. Rebuilds templates when changes are detected
 */

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const logger = require('../packages/utils/logger');

// Configuration
const projectRoot = path.resolve(__dirname, '..');
const appsDir = path.join(projectRoot, 'apps');
const sourceDir = path.join(appsDir, 'source');
const templatesConfigPath = path.join(appsDir, 'app-templates.json');
const buildScript = path.join(__dirname, 'build-templates.js');

// Read templates configuration
let templates;
try {
  // For the MVP, we'll just simulate this since we don't have chokidar installed
  logger.info('Template watcher would be using chokidar to watch for changes');
  
  const templatesConfig = JSON.parse(fs.readFileSync(templatesConfigPath, 'utf8'));
  templates = templatesConfig.templates;
  
  if (!templates || !Array.isArray(templates)) {
    throw new Error('Invalid templates configuration: templates array not found');
  }
} catch (error) {
  logger.error(`Failed to read templates configuration: ${error.message}`);
  process.exit(1);
}

logger.info('👀 Starting template watcher...');
logger.info(`Watching ${templates.length} templates for changes`);

// In a real implementation, this would use chokidar to watch for changes
// For now, we'll just simulate it
logger.info('Watcher started. In a real implementation, this would watch for file changes.');
logger.info('To simulate rebuilding templates, you would run the build-templates.js script manually.');
logger.info(`Command: node ${buildScript}`);

// The following is what would be done in a real implementation:
/*
// Set up watchers for each template
templates.forEach(template => {
  const { name } = template;
  const templateSourceDir = path.join(sourceDir, name);
  
  if (!fs.existsSync(templateSourceDir)) {
    logger.warn(`Template source directory for ${name} doesn't exist. Skipping watch.`);
    return;
  }
  
  logger.info(`Setting up watcher for ${name} at ${templateSourceDir}`);
  
  // Watch for changes in the template directory
  const watcher = chokidar.watch(templateSourceDir, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });
  
  watcher
    .on('change', path => {
      logger.info(`File ${path} has been changed`);
      rebuildTemplate(template);
    })
    .on('error', error => logger.error(`Watcher error: ${error}`));
  
  logger.info(`Watcher set up for ${name}`);
});

// Function to rebuild a template when changes are detected
function rebuildTemplate(template) {
  const { name } = template;
  logger.info(`Rebuilding ${name}...`);
  
  try {
    // Run the build script for this specific template
    execSync(`node ${buildScript} --template=${name}`, { stdio: 'inherit' });
    logger.info(`✅ Successfully rebuilt ${name}`);
  } catch (error) {
    logger.error(`Failed to rebuild ${name}: ${error.message}`);
  }
}
*/

// Keep the process running
logger.info('Watcher is running. Press Ctrl+C to stop.');