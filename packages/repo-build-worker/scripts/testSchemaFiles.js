import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import scanFrontmatterSchema from '../src/process/scanFrontmatterSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSchemaFiles() {
  const tempDir = path.join(__dirname, '..', 'temp-schema-test-' + Date.now());
  const distDir = path.join(tempDir, 'dist');
  
  await fs.mkdir(distDir, { recursive: true });
  
  // Create test content
  const testContent = {
    posts: [
      {
        id: '1',
        slug: 'post-1',
        title: 'Test Post',
        frontmatter: {
          draft: false,
          tags: ['test'],
          date: '2024-01-15'
        }
      }
    ]
  };
  
  await fs.writeFile(
    path.join(distDir, 'content.json'),
    JSON.stringify(testContent, null, 2)
  );
  
  // Run schema scanner
  const result = await scanFrontmatterSchema({
    tempDir: tempDir,
    assets: {
      distFolder: distDir
    }
  });
  
  console.log('Schema result:', result.schema);
  
  // Check if files exist
  const schemaPath = path.join(distDir, 'posts-schema.json');
  const reportPath = path.join(distDir, 'schema-report.json');
  
  try {
    const schemaExists = await fs.access(schemaPath).then(() => true).catch(() => false);
    const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
    
    console.log(`\nSchema file exists at ${schemaPath}: ${schemaExists}`);
    console.log(`Report file exists at ${reportPath}: ${reportExists}`);
    
    if (schemaExists) {
      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      console.log('\nSchema file content preview:');
      console.log(schemaContent.substring(0, 200) + '...');
    }
    
    // List all files in dist
    console.log('\nAll files in dist folder:');
    const files = await fs.readdir(distDir);
    for (const file of files) {
      const stats = await fs.stat(path.join(distDir, file));
      console.log(`  - ${file} (${stats.size} bytes)`);
    }
    
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

testSchemaFiles().catch(console.error);