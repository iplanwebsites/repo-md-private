import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import buildAssets from '../src/process/buildAssets.js';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifySchemaExport() {
  console.log('🔍 Verifying Schema Export in Full Pipeline\n');
  
  const tempDir = path.join(__dirname, '..', 'temp-verify-' + Date.now());
  const sourceDir = path.join(tempDir, 'source');
  const distDir = path.join(tempDir, 'dist');
  
  try {
    // Create test repository
    await fs.mkdir(path.join(sourceDir, 'posts'), { recursive: true });
    await fs.mkdir(distDir, { recursive: true });
    
    // Create a post with various frontmatter
    await fs.writeFile(path.join(sourceDir, 'posts', 'test.md'), `---
title: Test Post
draft: false
tags: ['test', 'schema']
date: 2024-01-15
customProp: value
---

# Test Post

This is a test.`);

    // Run build pipeline
    const result = await buildAssets({
      jobId: 'verify-schema-' + Date.now(),
      tempDir: tempDir,
      repoInfo: {
        path: sourceDir,
        distPath: distDir
      },
      assets: {
        distFolder: distDir
      },
      config: {
        embeddings: false,
        mediaOptimization: false
      }
    });
    
    console.log('✅ Build completed\n');
    
    // Check schema in result
    console.log('📊 Schema in result object:');
    console.log('  Has schema:', !!result.schema);
    if (result.schema) {
      console.log('  Schema path:', result.schema.schemaPath);
      console.log('  Properties:', result.schema.statistics?.uniqueProperties);
    }
    
    // Check schema file
    console.log('\n📄 Schema file on disk:');
    const schemaPath = path.join(distDir, 'posts-schema.json');
    const schemaExists = await fs.access(schemaPath).then(() => true).catch(() => false);
    console.log('  Exists:', schemaExists);
    
    if (schemaExists) {
      const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
      console.log('  Properties:', Object.keys(schema.schema).join(', '));
    }
    
    // Check SQLite columns
    console.log('\n🗃️  SQLite columns:');
    const dbPath = path.join(distDir, 'content.sqlite');
    const db = new Database(dbPath, { readonly: true });
    const columns = db.prepare("PRAGMA table_info('posts')").all();
    const frontmatterCols = columns
      .filter(col => !col.name.startsWith('_'))
      .map(col => col.name);
    console.log('  Frontmatter columns:', frontmatterCols.join(', '));
    
    // Check file list
    console.log('\n📁 Files in dist (from files-dist.json):');
    const fileListPath = path.join(distDir, 'files-dist.json');
    if (await fs.access(fileListPath).then(() => true).catch(() => false)) {
      const fileList = JSON.parse(await fs.readFile(fileListPath, 'utf8'));
      const schemaInList = fileList.some(f => f.filename === 'posts-schema.json');
      console.log('  Total files:', fileList.length);
      console.log('  posts-schema.json in list:', schemaInList);
      
      // Show all JSON files
      const jsonFiles = fileList
        .filter(f => f.extension === 'json')
        .map(f => f.filename);
      console.log('  JSON files:', jsonFiles.join(', '));
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

verifySchemaExport().catch(console.error);