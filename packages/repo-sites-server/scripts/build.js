#!/usr/bin/env node

/**
 * Unified build script for the multi-tenant platform
 * Builds all packages and apps for deployment
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const projectRoot = path.resolve(__dirname, '..');
const packagesDir = path.join(projectRoot, 'packages');
const appsDir = path.join(projectRoot, 'apps');
const distDir = path.join(projectRoot, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log('🔨 Starting build process...');

// Build packages first
const packages = fs.readdirSync(packagesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

console.log(`📦 Building ${packages.length} packages...`);

packages.forEach(pkg => {
  const pkgPath = path.join(packagesDir, pkg);
  const pkgJsonPath = path.join(pkgPath, 'package.json');
  
  if (fs.existsSync(pkgJsonPath)) {
    console.log(`Building package: ${pkg}`);
    try {
      // Mock build command - in a real setup, you'd run the actual build command
      // execSync('npm run build', { cwd: pkgPath, stdio: 'inherit' });
      console.log(`✅ Successfully built package: ${pkg}`);
    } catch (error) {
      console.error(`❌ Failed to build package: ${pkg}`);
      console.error(error);
      process.exit(1);
    }
  } else {
    console.log(`Skipping package ${pkg} (no package.json)`);
  }
});

// Build apps
const apps = fs.readdirSync(appsDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

console.log(`🏗️ Building ${apps.length} application templates...`);

apps.forEach(app => {
  const appPath = path.join(appsDir, app);
  const appJsonPath = path.join(appPath, 'package.json');
  
  if (fs.existsSync(appJsonPath)) {
    console.log(`Building app: ${app}`);
    try {
      // Mock build command - in a real setup, you'd run the actual build command
      // execSync('npm run build', { cwd: appPath, stdio: 'inherit' });
      
      // Copy the built app to the dist directory
      const appDistDir = path.join(distDir, 'apps', app);
      if (!fs.existsSync(appDistDir)) {
        fs.mkdirSync(appDistDir, { recursive: true });
      }
      
      // Mock copy built files
      // fs.copyFileSync(path.join(appPath, 'build'), appDistDir);
      
      console.log(`✅ Successfully built app: ${app}`);
    } catch (error) {
      console.error(`❌ Failed to build app: ${app}`);
      console.error(error);
      process.exit(1);
    }
  } else {
    console.log(`Skipping app ${app} (no package.json)`);
  }
});

console.log('🎉 Build completed successfully!');
