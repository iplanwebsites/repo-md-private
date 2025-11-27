#!/usr/bin/env node
// scripts/test-deploy-locally.js
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

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
 * Main function to run the Docker build and test deployment
 */
async function main() {
  try {
    console.log('🚀 Starting local Dokku deployment test...');
    
    // Step 1: Build Docker image
    console.log('Step 1: Building Docker image');
    try {
      await runCommand('docker', [
        'build', 
        '-t', 
        'repo-build-worker:dokku-test',
        '.'
      ]);
      console.log('✅ Docker image built successfully');
    } catch (error) {
      console.error('❌ Error building Docker image:', error.message);
      process.exit(1);
    }
    
    // Step 2: Run Docker container with relevant Dokku environment
    console.log('Step 2: Running Docker container with Dokku-like environment');
    
    const containerName = 'repo-build-worker-dokku-test';
    
    // Stop and remove container if it already exists
    try {
      await runCommand('docker', ['stop', containerName]);
      await runCommand('docker', ['rm', containerName]);
      console.log('✅ Cleaned up existing test container');
    } catch (error) {
      // Ignore errors, container might not exist
    }
    
    try {
      // Start the container with Dokku-like environment variables
      await runCommand('docker', [
        'run',
        '-d',
        '--name', containerName,
        '-p', '5522:5522',
        '-e', 'PORT=5522',
        '-e', 'NODE_ENV=production',
        '-e', 'USE_PERSISTENT_MODELS=false',
        'repo-build-worker:dokku-test'
      ]);
      console.log('✅ Docker container started');
      
      // Follow logs
      console.log('📋 Container logs (Ctrl+C to stop following logs):');
      await runCommand('docker', ['logs', '-f', containerName]);
      
    } catch (error) {
      console.error('❌ Error running Docker container:', error.message);
      
      // Show logs even if there was an error
      console.log('📋 Container logs:');
      try {
        await runCommand('docker', ['logs', containerName]);
      } catch (logError) {
        console.error('Failed to retrieve container logs:', logError.message);
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});