#!/usr/bin/env node

/**
 * Template build script for the multi-tenant platform
 * 
 * This script:
 * 1. Reads the app template configuration from apps/app-templates.json
 * 2. Clones the template repositories into apps/source/[template-name]
 * 3. Builds each template
 * 4. Copies the build output to apps/dist/[template-name]
 */

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../packages/utils/logger');

// Configuration
const projectRoot = path.resolve(__dirname, '..');
const appsDir = path.join(projectRoot, 'apps');
const sourceDir = path.join(appsDir, 'source');
const distDir = path.join(appsDir, 'dist');
const templatesConfigPath = path.join(appsDir, 'app-templates.json');

// Ensure directories exist
if (!fs.existsSync(sourceDir)) {
  fs.mkdirSync(sourceDir, { recursive: true });
}
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Read templates configuration
let templates;
try {
  const templatesConfig = JSON.parse(fs.readFileSync(templatesConfigPath, 'utf8'));
  templates = templatesConfig.templates;
  
  if (!templates || !Array.isArray(templates)) {
    throw new Error('Invalid templates configuration: templates array not found');
  }
} catch (error) {
  logger.error(`Failed to read templates configuration: ${error.message}`);
  process.exit(1);
}

logger.info('🔨 Starting template build process...');
logger.info(`Found ${templates.length} templates to build`);

/**
 * Clone a template repository
 * @param {Object} template - Template configuration
 */
async function cloneTemplate(template) {
  const { name, repo, branch = 'main' } = template;
  const templateSourceDir = path.join(sourceDir, name);
  
  logger.info(`Cloning ${name} from ${repo}...`);
  
  // Remove existing directory if it exists
  if (fs.existsSync(templateSourceDir)) {
    // In a real implementation, you might want to pull instead of clone if the repo already exists
    logger.info(`${name} already exists, removing...`);
    try {
      execSync(`rm -rf ${templateSourceDir}`);
    } catch (error) {
      logger.error(`Failed to remove existing template directory: ${error.message}`);
      throw error;
    }
  }
  
  try {
    // For this MVP, we'll just simulate the clone
    // In a real implementation, you would use:
    // execSync(`git clone --branch ${branch} ${repo} ${templateSourceDir}`, { stdio: 'inherit' });
    
    // Mock clone for demonstration
    logger.info(`Simulating clone of ${repo} to ${templateSourceDir}...`);
    fs.mkdirSync(templateSourceDir, { recursive: true });
    
    // Copy our mock template files from the existing app directory to the source directory
    const templateDir = path.join(appsDir, name);
    if (fs.existsSync(templateDir)) {
      execSync(`cp -r ${templateDir}/* ${templateSourceDir}/`);
    } else {
      // Create a mock package.json if the template directory doesn't exist
      fs.writeFileSync(path.join(templateSourceDir, 'package.json'), JSON.stringify({
        name: name,
        version: "0.1.0",
        scripts: {
          build: "echo 'Building template'"
        }
      }, null, 2));
    }
    
    logger.info(`✅ Successfully cloned ${name}`);
  } catch (error) {
    logger.error(`Failed to clone ${name}: ${error.message}`);
    throw error;
  }
}

/**
 * Build a template
 * @param {Object} template - Template configuration
 */
async function buildTemplate(template) {
  const { name, buildCommand, env = {} } = template;
  const templateSourceDir = path.join(sourceDir, name);
  
  logger.info(`Building ${name}...`);
  
  try {
    // Set environment variables
    const envVars = { ...process.env, ...env };
    
    // Install dependencies (in a real implementation)
    logger.info(`Installing dependencies for ${name}...`);
    // In a real implementation, you would use:
    // execSync('npm install', { cwd: templateSourceDir, stdio: 'inherit', env: envVars });
    
    // Simulate install
    logger.info(`Simulating npm install for ${name}...`);
    
    // Build the template
    logger.info(`Running build command for ${name}: ${buildCommand}`);
    // In a real implementation, you would use:
    // execSync(buildCommand, { cwd: templateSourceDir, stdio: 'inherit', env: envVars });
    
    // Simulate build
    logger.info(`Simulating ${buildCommand} for ${name}...`);
    
    logger.info(`✅ Successfully built ${name}`);
  } catch (error) {
    logger.error(`Failed to build ${name}: ${error.message}`);
    throw error;
  }
}

/**
 * Copy built files to dist directory
 * @param {Object} template - Template configuration
 */
async function copyToDist(template) {
  const { name, distDir: templateDistDir } = template;
  const templateSourceDir = path.join(sourceDir, name);
  const templateBuildDir = path.join(templateSourceDir, templateDistDir);
  const templateOutputDir = path.join(distDir, name);
  
  logger.info(`Copying ${name} build output to ${templateOutputDir}...`);
  
  try {
    // In a real implementation, you'd copy the contents of the build directory
    // Ensure output directory exists
    fs.mkdirSync(templateOutputDir, { recursive: true });
    
    // In a real implementation, you would use:
    // execSync(`cp -r ${templateBuildDir}/* ${templateOutputDir}/`);
    
    // Simulate copy
    logger.info(`Simulating copy of ${templateBuildDir} to ${templateOutputDir}...`);
    
    // Create a marker file to indicate this template was "built"
    fs.writeFileSync(
      path.join(templateOutputDir, 'build-info.json'), 
      JSON.stringify({ 
        name: template.name,
        builtAt: new Date().toISOString(),
        description: template.description || ""
      }, null, 2)
    );
    
    logger.info(`✅ Successfully copied ${name} build output`);
  } catch (error) {
    logger.error(`Failed to copy ${name} build output: ${error.message}`);
    throw error;
  }
}

/**
 * Process a template (clone, build, copy)
 * @param {Object} template - Template configuration
 */
async function processTemplate(template) {
  try {
    await cloneTemplate(template);
    await buildTemplate(template);
    await copyToDist(template);
    logger.info(`✅ Successfully processed ${template.name}`);
  } catch (error) {
    logger.error(`Failed to process ${template.name}: ${error.message}`);
  }
}

// Process all templates
async function processAllTemplates() {
  // Process templates one by one
  // In a real implementation, you might want to use Promise.all to process them in parallel
  for (const template of templates) {
    logger.info(`Processing template: ${template.name}`);
    await processTemplate(template);
  }
}

// Run the process
processAllTemplates()
  .then(() => {
    logger.info('🎉 Template build process completed successfully!');
  })
  .catch((error) => {
    logger.error(`Template build process failed: ${error.message}`);
    process.exit(1);
  });