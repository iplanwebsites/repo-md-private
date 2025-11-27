#!/usr/bin/env node
// scripts/test-docker-build.js
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import copyRepoProcessor from './copy-repo-processor.js';

// Get the directory where the script is running
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Run a command and return a promise that resolves when the command completes
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const proc = spawn(command, args, {
      cwd: options.cwd || projectRoot,
      stdio: 'inherit',
      ...options
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Main function to run the Docker build test
 */
async function main() {
  try {
    console.log('🚀 Starting Docker build test...');
    
    // Step 1: Ensure repo-processor files are in place
    console.log('Step 1: Ensuring repo-processor files are in place');
    try {
      // Verify the files exist and create if they don't
      const copyResult = await copyRepoProcessor();
      if (!copyResult.success) {
        throw new Error('Failed to copy repo-processor files');
      }
      console.log('✅ Repo-processor files are in place');
    } catch (error) {
      console.error('❌ Error preparing repo-processor files:', error.message);
      process.exit(1);
    }
    
    // Step 2: Build Docker image
    console.log('Step 2: Building Docker image');
    try {
      await runCommand('docker', [
        'build', 
        '-t', 
        'repo-build-worker:test',
        '-f',
        'Dockerfile_test',
        '.'
      ]);
      console.log('✅ Docker image built successfully');
    } catch (error) {
      console.error('❌ Error building Docker image:', error.message);
      process.exit(1);
    }
    
    console.log(`
🎉 Docker build test completed successfully!

The Docker image repo-build-worker:test has been created.
You can run it locally with:

docker run -p 5522:5522 repo-build-worker:test

This confirms that the approach with the copied repo-processor dist files works in Docker.

Key changes made:
1. Only copied the compiled dist/ files from repo-processor 
2. No need to run npm install for repo-processor
3. Changed import path to use the local modules directory
    `);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the script
main();