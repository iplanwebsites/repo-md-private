import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import buildAssets from '../src/process/buildAssets.js';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testBuildPipeline() {
  console.log('🧪 Testing Full Build Pipeline with Schema\n');
  
  const tempDir = path.join(__dirname, '..', 'temp-pipeline-test-' + Date.now());
  const sourceDir = path.join(tempDir, 'source');
  const distDir = path.join(tempDir, 'dist');
  
  try {
    // Create test repository structure
    await fs.mkdir(path.join(sourceDir, 'posts'), { recursive: true });
    await fs.mkdir(distDir, { recursive: true });
    
    // Create test markdown files with frontmatter
    await fs.writeFile(path.join(sourceDir, 'posts', 'post1.md'), `---
title: First Post
draft: false
tags: ['javascript', 'testing']
date: 2024-01-15
author: John Doe
category: tech
---

# First Post

This is the first test post.`);

    await fs.writeFile(path.join(sourceDir, 'posts', 'post2.md'), `---
title: Second Post
draft: true
tags: ['react', 'frontend']
published: false
order: 2
update: 2024-01-17
---

# Second Post

This is the second test post.`);

    // Create test data object
    const testData = {
      jobId: 'test-pipeline-' + Date.now(),
      tempDir: tempDir,
      repoInfo: {
        path: sourceDir,
        distPath: distDir
      },
      assets: {
        distFolder: distDir
      },
      config: {
        embeddings: false, // Disable embeddings for faster test
        mediaOptimization: false
      }
    };
    
    // Run the build pipeline
    console.log('📦 Running buildAssets pipeline...\n');
    const result = await buildAssets(testData);
    
    // Check results
    console.log('\n✅ Build completed successfully!\n');
    console.log('📊 Results:');
    console.log(`  - Job ID: ${result.jobId}`);
    console.log(`  - Dist folder: ${result.assets.distFolder}`);
    console.log(`  - Content path: ${result.assets.contentPath}`);
    if (result.schema) {
      console.log(`  - Schema path: ${result.schema.schemaPath}`);
      console.log(`  - Schema properties: ${result.schema.statistics.uniqueProperties}`);
      console.log(`  - Has conflicts: ${result.schema.hasConflicts}`);
    }
    
    // Check schema files
    console.log('\n📋 Checking schema files:');
    const schemaPath = path.join(distDir, 'posts-schema.json');
    const schemaExists = await fs.access(schemaPath).then(() => true).catch(() => false);
    console.log(`  - posts-schema.json exists: ${schemaExists}`);
    
    if (schemaExists) {
      const schemaContent = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
      console.log(`  - Schema properties: ${Object.keys(schemaContent.schema).join(', ')}`);
    }
    
    // Check SQLite database
    console.log('\n🗃️  Checking SQLite database:');
    const dbPath = path.join(distDir, 'content.sqlite');
    const dbExists = await fs.access(dbPath).then(() => true).catch(() => false);
    console.log(`  - content.sqlite exists: ${dbExists}`);
    
    if (dbExists) {
      const db = new Database(dbPath, { readonly: true });
      const tableInfo = db.prepare("PRAGMA table_info('posts')").all();
      console.log(`  - Posts table columns: ${tableInfo.length}`);
      
      // Show frontmatter columns
      const frontmatterColumns = tableInfo
        .filter(col => !col.name.startsWith('_'))
        .map(col => `${col.name} (${col.type})`);
      console.log(`  - Frontmatter columns: ${frontmatterColumns.join(', ')}`);
      
      db.close();
    }
    
    // List all files in dist
    console.log('\n📁 Files in dist folder:');
    const files = await fs.readdir(distDir);
    for (const file of files) {
      const stats = await fs.stat(path.join(distDir, file));
      console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    }
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test directory...');
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

testBuildPipeline().catch(console.error);