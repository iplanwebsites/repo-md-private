#!/usr/bin/env node
// scripts/copy-repo-processor.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory where the script is running
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define source and destination paths
const projectRoot = path.resolve(__dirname, '..');
let repoProcessorSourcePath;

// Check if custom path provided via environment variable
if (process.env.REPO_PROCESSOR_PATH) {
  repoProcessorSourcePath = process.env.REPO_PROCESSOR_PATH;
  console.log(`Using custom repo-processor path from environment variable: ${repoProcessorSourcePath}`);
} else {
  // Default: assume repo-processor is in the parent directory
  repoProcessorSourcePath = path.join(path.dirname(projectRoot), 'repo-processor');
  console.log(`Using default repo-processor path: ${repoProcessorSourcePath}`);
}

const targetModulesDir = path.join(projectRoot, 'src', 'modules');
const repoProcessorTargetPath = path.join(targetModulesDir, 'repo-processor');

console.log(`Source path: ${repoProcessorSourcePath}`);
console.log(`Target path: ${repoProcessorTargetPath}`);

async function copyRepoProcessor() {
  try {
    console.log('📦 Copying repo-processor files for dockerization...');
    
    // Check if source directory exists
    try {
      await fs.access(repoProcessorSourcePath);
      console.log(`✅ Source directory exists: ${repoProcessorSourcePath}`);
    } catch (error) {
      console.error(`❌ Source directory not found: ${repoProcessorSourcePath}`);
      console.error('Make sure that repo-processor exists in the parent directory of repo-build-worker');
      throw new Error(`Source directory not found: ${repoProcessorSourcePath}`);
    }
    
    // Create the modules directory if it doesn't exist
    await fs.mkdir(targetModulesDir, { recursive: true });
    
    // Create the repo-processor directory in modules if it doesn't exist
    await fs.mkdir(repoProcessorTargetPath, { recursive: true });
    
    // For Docker, we only need the dist folder, not package.json
    
    // Create dist directory if it doesn't exist
    const distTargetPath = path.join(repoProcessorTargetPath, 'dist');
    await fs.mkdir(distTargetPath, { recursive: true });
    
    // Copy dist folder content
    const distSourcePath = path.join(repoProcessorSourcePath, 'dist');
    
    // Check if dist source path exists
    try {
      await fs.access(distSourcePath);
      console.log(`✅ Found dist directory: ${distSourcePath}`);
    } catch (error) {
      console.error(`❌ Dist directory not found: ${distSourcePath}`);
      console.error('Make sure that repo-processor is built (npm run build in repo-processor)');
      throw new Error(`Dist directory not found: ${distSourcePath}`);
    }
    
    // Get all files in the dist folder
    const distFiles = await fs.readdir(distSourcePath);
    
    for (const file of distFiles) {
      const sourceFilePath = path.join(distSourcePath, file);
      const targetFilePath = path.join(distTargetPath, file);
      
      // Check if file is directory or file
      const stats = await fs.stat(sourceFilePath);
      
      if (stats.isDirectory()) {
        // Recursively copy subdirectory
        await copyDirectory(sourceFilePath, targetFilePath);
      } else {
        // Copy file
        await fs.copyFile(sourceFilePath, targetFilePath);
      }
    }
    
    console.log(`✅ Copied dist folder with ${distFiles.length} files/folders`);
    console.log('🚀 repo-processor copy completed successfully!');
    console.log(`📁 Files copied to: ${distTargetPath}`);
    
    return { success: true, targetPath: distTargetPath };
  } catch (error) {
    console.error('❌ Error copying repo-processor files:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to recursively copy a directory
async function copyDirectory(source, target) {
  // Create target directory
  await fs.mkdir(target, { recursive: true });
  
  // Get all items in source directory
  const items = await fs.readdir(source);
  
  for (const item of items) {
    const sourceItemPath = path.join(source, item);
    const targetItemPath = path.join(target, item);
    
    const stats = await fs.stat(sourceItemPath);
    
    if (stats.isDirectory()) {
      // Recursively copy subdirectory
      await copyDirectory(sourceItemPath, targetItemPath);
    } else {
      // Copy file
      await fs.copyFile(sourceItemPath, targetItemPath);
    }
  }
}

// Execute the function if this script is called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  copyRepoProcessor().then(result => {
    if (!result.success) {
      process.exit(1);
    }
  });
}

export default copyRepoProcessor;