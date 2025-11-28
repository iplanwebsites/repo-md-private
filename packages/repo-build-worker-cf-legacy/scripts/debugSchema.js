import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import scanFrontmatterSchema from '../src/process/scanFrontmatterSchema.js';
import buildSqliteDatabase from '../src/process/buildSqliteDatabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugSchema() {
  const tempDir = path.join(__dirname, '..', 'temp-debug-' + Date.now());
  const distDir = path.join(tempDir, 'dist');
  
  await fs.mkdir(distDir, { recursive: true });
  
  // Create test posts.json
  const testPosts = [
    {
      id: '1',
      slug: 'post-1',
      title: 'Test Post',
      frontmatter: {
        draft: false,
        tags: ['test'],
        date: '2024-01-15',
        customField: 'value'
      }
    }
  ];
  
  await fs.writeFile(
    path.join(distDir, 'posts.json'),
    JSON.stringify(testPosts, null, 2)
  );
  
  // Step 1: Run schema scanner
  console.log('📊 Step 1: Running schema scanner...\n');
  const dataWithAssets = {
    tempDir: tempDir,
    assets: {
      distFolder: distDir
    }
  };
  
  const schemaResult = await scanFrontmatterSchema(dataWithAssets);
  console.log('Schema result:', JSON.stringify(schemaResult.schema, null, 2));
  
  // Check schema file
  const schemaPath = path.join(distDir, 'posts-schema.json');
  const schemaExists = await fs.access(schemaPath).then(() => true).catch(() => false);
  console.log(`\nSchema file exists: ${schemaExists}`);
  
  if (schemaExists) {
    const schemaContent = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
    console.log('Schema file content:', JSON.stringify(schemaContent, null, 2).substring(0, 500));
  }
  
  // Step 2: Run SQLite builder
  console.log('\n\n🗃️ Step 2: Running SQLite builder...\n');
  const sqliteResult = await buildSqliteDatabase(schemaResult);
  
  console.log('\nSQLite result keys:', Object.keys(sqliteResult));
  
  // Cleanup
  await fs.rm(tempDir, { recursive: true, force: true });
}

debugSchema().catch(console.error);