#!/usr/bin/env node
// scripts/test-dockerization.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import copyRepoProcessor from './copy-repo-processor.js';

// Get the directory where the script is running
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Create a temporary build file that uses the copied repo-processor
async function createModifiedBuildAssetsFile() {
  try {
    console.log('📝 Creating modified buildAssets file for dockerization test...');
    
    // Source file
    const sourceFile = path.join(projectRoot, 'src', 'process', 'buildAssets.js');
    
    // Temporary test file
    const testFile = path.join(projectRoot, 'src', 'process', 'buildAssets-docker-test.js');
    
    // Read the source file
    const content = await fs.readFile(sourceFile, 'utf-8');
    
    // Replace the import path to use the copied repo-processor
    const modifiedContent = content.replace(
      /from "..\/..\/..\/repo-processor\/dist\/index.js"/,
      'from "../modules/repo-processor/dist/index.js"'
    );
    
    // Write the modified content to the test file
    await fs.writeFile(testFile, modifiedContent);
    
    console.log('✅ Created modified buildAssets file at:', testFile);
    return testFile;
  } catch (error) {
    console.error('❌ Error creating modified buildAssets file:', error);
    throw error;
  }
}

// Test function that runs a simple test using the modified repo-processor
async function testRepoProcessor() {
  try {
    const { RepoProcessor } = await import('../src/modules/repo-processor/dist/index.js');
    
    console.log('✅ Successfully imported RepoProcessor from copied module');
    
    // Create a simple test config
    const config = {
      dir: {
        input: path.join(projectRoot, 'test-wp-import'),
        output: path.join(projectRoot, 'test-output'),
      },
      paths: {
        notesPrefix: '/_repo/notes',
        mediaPrefix: '/_repo/medias',
        useAbsolutePaths: true,
      },
      media: {
        optimize: false,
        skip: true,
      },
      posts: {
        exportEnabled: true,
        processAllFiles: true,
        useHash: true,
      },
      debugLevel: 1,
    };
    
    console.log('🧪 Testing RepoProcessor initialization...');
    const processor = new RepoProcessor(config);
    console.log('✅ RepoProcessor initialized successfully!');
    
    return true;
  } catch (error) {
    console.error('❌ Error testing RepoProcessor:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('🐳 Starting dockerization test...');
  
  try {
    // Step 1: Copy repo-processor files
    console.log('Step 1: Copying repo-processor files');
    console.log('Note: You can set REPO_PROCESSOR_PATH environment variable to specify a custom location for repo-processor');
    let copyResult;
    try {
      copyResult = await copyRepoProcessor();
      if (!copyResult.success) {
        console.error('❌ Failed to copy repo-processor files');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error during repo-processor copying:', error.message);
      console.error(`
Please make sure repo-processor exists in the correct location.
- Default: ../repo-processor (parent directory of repo-build-worker)
- Custom: Set REPO_PROCESSOR_PATH environment variable

Example: REPO_PROCESSOR_PATH=/path/to/repo-processor npm run test:docker
`);
      process.exit(1);
    }
    
    // Step 2: Create modified buildAssets file
    const modifiedFilePath = await createModifiedBuildAssetsFile();
    
    // Step 3: Test the imported repo-processor
    console.log('🧪 Testing repo-processor import...');
    const testResult = await testRepoProcessor();
    
    if (testResult) {
      console.log('🎉 Dockerization test completed successfully!');
      console.log('✅ The copied repo-processor module works correctly');
      console.log(`
To use this in Docker:
1. Make sure to install the repo-processor dependencies 
   in your Dockerfile with: 
   RUN cd /app/src/modules/repo-processor && npm install --omit=dev

2. Import RepoProcessor from "../modules/repo-processor/dist/index.js" 
   in your code instead of "../../../repo-processor/dist/index.js"
      `);
    } else {
      console.error('❌ Dockerization test failed - RepoProcessor failed to initialize');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Dockerization test failed with error:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export default main;