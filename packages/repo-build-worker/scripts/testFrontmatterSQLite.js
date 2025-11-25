import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import scanFrontmatterSchema from '../src/process/scanFrontmatterSchema.js';
import buildSqliteDatabase from '../src/process/buildSqliteDatabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createTestData() {
  const tempDir = path.join(__dirname, '..', 'temp-test-sqlite-' + Date.now());
  const distDir = path.join(tempDir, 'dist');
  
  await fs.mkdir(distDir, { recursive: true });
  
  // Create test content.json with frontmatter
  const testContent = {
    posts: [
      {
        id: '1',
        slug: 'post-1',
        title: 'Test Post 1',
        type: 'post',
        created: '2024-01-15',
        modified: '2024-01-16',
        path: 'posts/post-1.md',
        frontmatter: {
          draft: false,
          tags: ['javascript', 'testing'],
          date: '2024-01-15',
          author: 'John Doe',
          category: 'tech'
        }
      },
      {
        id: '2',
        slug: 'post-2',
        title: 'Test Post 2',
        type: 'post',
        created: '2024-01-16',
        modified: '2024-01-17',
        path: 'posts/post-2.md',
        frontmatter: {
          draft: true,
          tags: ['react'],
          published: false,
          order: 2,
          update: '2024-01-17' // Reserved property
        }
      }
    ]
  };
  
  // Write both content.json and posts.json for compatibility
  await fs.writeFile(
    path.join(distDir, 'content.json'),
    JSON.stringify(testContent, null, 2)
  );
  
  await fs.writeFile(
    path.join(distDir, 'posts.json'),
    JSON.stringify(testContent.posts, null, 2)
  );
  
  return { tempDir, distDir };
}

async function runTest() {
  console.log('🧪 Testing Frontmatter SQLite Integration\n');
  
  const { tempDir, distDir } = await createTestData();
  
  try {
    // Test data
    const testData = {
      jobId: 'test-sqlite-' + Date.now(),
      tempDir: tempDir,
      assets: {
        distFolder: distDir,
        contentPath: path.join(distDir, 'content.json')
      }
    };
    
    // Step 1: Run schema scanner
    console.log('📊 Step 1: Scanning frontmatter schema...\n');
    const schemaResult = await scanFrontmatterSchema(testData);
    
    // Step 2: Build SQLite database with dynamic columns
    console.log('\n🗃️  Step 2: Building SQLite database with dynamic columns...\n');
    const dbResult = await buildSqliteDatabase(schemaResult);
    
    // Step 3: Examine the created database
    console.log('\n🔍 Step 3: Examining database structure...\n');
    const dbPath = path.join(distDir, 'content.sqlite');
    const db = new Database(dbPath, { readonly: true });
    
    // Get table schema
    const tableInfo = db.prepare("PRAGMA table_info('posts')").all();
    console.log('Posts Table Columns:');
    console.log('===================');
    for (const col of tableInfo) {
      console.log(`  ${col.name} (${col.type})`);
    }
    
    // Query posts with dynamic columns
    console.log('\n\n📖 Querying Posts:');
    console.log('=================');
    
    // Build dynamic SELECT to include all columns - quote reserved words
    const reservedWords = new Set(['order', 'update', 'group', 'index', 'table', 'column']);
    const columnNames = tableInfo.map(col => 
      reservedWords.has(col.name.toLowerCase()) ? `"${col.name}"` : col.name
    ).join(', ');
    const posts = db.prepare(`SELECT ${columnNames} FROM posts`).all();
    
    for (const post of posts) {
      console.log(`\nPost: ${post._title}`);
      console.log(`  ID: ${post._id}`);
      console.log(`  Slug: ${post._slug}`);
      
      // Show dynamic frontmatter columns (exclude internal columns starting with _)
      console.log('  Frontmatter columns:');
      for (const col of tableInfo) {
        if (!col.name.startsWith('_')) {
          const value = post[col.name];
          if (value !== null && value !== undefined) {
            console.log(`    ${col.name}: ${value}`);
          }
        }
      }
    }
    
    // Test querying by frontmatter properties
    console.log('\n\n🔎 Testing Frontmatter Queries:');
    console.log('==============================');
    
    // Query draft posts
    console.log('\nDraft posts:');
    const draftPosts = db.prepare('SELECT _title, draft FROM posts WHERE draft = 1').all();
    for (const post of draftPosts) {
      console.log(`  - ${post._title} (draft: ${post.draft})`);
    }
    
    // Query by category
    console.log('\nPosts in "tech" category:');
    const techPosts = db.prepare('SELECT _title, category FROM posts WHERE category = ?').all('tech');
    for (const post of techPosts) {
      console.log(`  - ${post._title} (category: ${post.category})`);
    }
    
    // Query by order (reserved SQL keyword - needs quoting)
    console.log('\nPosts with order property:');
    const orderedPosts = db.prepare('SELECT _title, "order" FROM posts WHERE "order" IS NOT NULL ORDER BY "order"').all();
    for (const post of orderedPosts) {
      console.log(`  - ${post._title} (order: ${post.order})`);
    }
    
    db.close();
    
    console.log('\n✅ SQLite integration test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test directory...');
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

// Run the test
runTest().catch(console.error);