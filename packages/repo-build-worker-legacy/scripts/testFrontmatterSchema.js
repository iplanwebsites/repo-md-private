import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import scanFrontmatterSchema from '../src/process/scanFrontmatterSchema.js';
import generateFrontmatterTypes from '../src/process/generateFrontmatterTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple logger for testing
const testLogger = {
  logs: [],
  info: function(...args) { 
    console.log('[INFO]', ...args);
    this.logs.push({ level: 'info', message: args });
  },
  log: function(...args) { 
    console.log('[LOG]', ...args);
    this.logs.push({ level: 'log', message: args });
  },
  warn: function(...args) { 
    console.warn('[WARN]', ...args);
    this.logs.push({ level: 'warn', message: args });
  },
  error: function(...args) { 
    console.error('[ERROR]', ...args);
    this.logs.push({ level: 'error', message: args });
  },
  getLogs: function() { return this.logs; }
};

// Simple issue reporter for testing
const testIssueReporter = {
  issues: [],
  addIssue: function(issue) {
    console.log('[ISSUE]', issue.type.toUpperCase(), ':', issue.message);
    this.issues.push(issue);
  },
  getIssues: function() { return this.issues; }
};

async function createTestData() {
  const tempDir = path.join(__dirname, '..', 'temp-test-' + Date.now());
  const distDir = path.join(tempDir, 'dist');
  
  await fs.mkdir(distDir, { recursive: true });
  
  // Create test content.json with various frontmatter patterns
  const testContent = {
    posts: [
      {
        id: '1',
        slug: 'post-1',
        title: 'Test Post 1',
        frontmatter: {
          draft: true,
          tags: ['javascript', 'testing'],
          date: '2024-01-15',
          author: 'John Doe'
        }
      },
      {
        id: '2',
        slug: 'post-2',
        title: 'Test Post 2',
        frontmatter: {
          draft: 'false', // String instead of boolean
          tags: 'single-tag', // String instead of array
          date: '2024-01-16T10:30:00Z',
          author: {
            name: 'Jane Smith',
            email: 'jane@example.com'
          }
        }
      },
      {
        id: '3',
        slug: 'post-3',
        title: 'Test Post 3',
        frontmatter: {
          draft: false,
          tags: ['react', 'frontend'],
          published: true,
          category: 'tech'
        }
      },
      {
        id: '4',
        slug: 'post-4',
        title: 'Test Post 4',
        frontmatter: {
          tags: [],
          draft: 1, // Number instead of boolean
          metadata: {
            views: 100,
            likes: 25
          }
        }
      },
      {
        id: '5',
        slug: 'post-5',
        title: 'Test Post 5 - Reserved Properties',
        frontmatter: {
          // Test reserved property names
          title: 'Custom Title', // Conflicts with posts table
          date: '2024-01-20', // Reserved SQL keyword
          update: '2024-01-21', // Reserved SQL keyword
          content: 'Some content', // Conflicts with posts table
          order: 5, // Reserved SQL keyword
          customField: 'allowed'
        }
      }
    ]
  };
  
  await fs.writeFile(
    path.join(distDir, 'content.json'),
    JSON.stringify(testContent, null, 2)
  );
  
  return { tempDir, distDir };
}

async function runTest() {
  console.log('🧪 Testing Frontmatter Schema Scanner\n');
  
  const { tempDir, distDir } = await createTestData();
  
  try {
    // Test data
    const testData = {
      jobId: 'test-job-' + Date.now(),
      tempDir: tempDir,
      logger: testLogger,
      issueReporter: testIssueReporter,
      assets: {
        distFolder: distDir,
        contentPath: path.join(distDir, 'content.json')
      }
    };
    
    // Run schema scanner
    console.log('📊 Running schema scanner...\n');
    const schemaResult = await scanFrontmatterSchema(testData);
    
    // Display results
    if (schemaResult.schema && schemaResult.schema.schemaPath) {
      const schemaData = JSON.parse(
        await fs.readFile(schemaResult.schema.schemaPath, 'utf8')
      );
      
      console.log('\n📋 Schema Analysis:');
      console.log('==================');
      console.log(`Total posts: ${schemaData.statistics.totalPosts}`);
      console.log(`Posts with frontmatter: ${schemaData.statistics.postsWithFrontmatter}`);
      console.log(`Unique properties: ${schemaData.statistics.uniqueProperties}`);
      
      console.log('\n🔍 Property Types:');
      console.log('=================');
      for (const [prop, info] of Object.entries(schemaData.schema)) {
        console.log(`\n${prop}:`);
        console.log(`  Types: ${info.types.join(', ')}`);
        console.log(`  Occurrences: ${info.occurrences}`);
        console.log(`  Nullable: ${info.nullable}`);
        console.log(`  Recommended: ${info.recommendedType}`);
        console.log(`  SQL Type: ${info.sqlType}`);
        console.log(`  Column Name: ${info.columnName}`);
        if (info.needsQuoting) {
          console.log(`  ⚠️  SQLite Reserved Word: YES (needs quoting in queries)`);
        }
        if (info.conflicts) {
          console.log(`  Conflicts:`, info.conflicts);
        }
      }
      
      // Read and display report
      if (schemaResult.schema.reportPath) {
        const report = JSON.parse(
          await fs.readFile(schemaResult.schema.reportPath, 'utf8')
        );
        
        console.log('\n⚠️  Warnings:');
        console.log('============');
        if (report.summary.warnings.length > 0) {
          for (const warning of report.summary.warnings) {
            console.log(`- ${warning.message}`);
          }
        } else {
          console.log('No warnings');
        }
        
        console.log('\n🔧 Recommendations:');
        console.log('==================');
        if (report.recommendations.length > 0) {
          for (const rec of report.recommendations) {
            console.log(`- ${rec.message}`);
            if (rec.details) {
              for (const detail of rec.details) {
                console.log(`  • ${detail.property} → ${detail.suggestedType}`);
              }
            }
          }
        } else {
          console.log('No recommendations');
        }
      }
    }
    
    // Test type generation
    console.log('\n\n🏗️  Testing Type Generation...\n');
    const typeResult = await generateFrontmatterTypes(schemaResult);
    
    if (typeResult.types) {
      console.log('\n📝 Generated TypeScript Interface:');
      console.log('==================================');
      const tsContent = await fs.readFile(typeResult.types.typescriptPath, 'utf8');
      console.log(tsContent);
      
      console.log('\n📝 Generated Zod Schema:');
      console.log('=======================');
      const zodContent = await fs.readFile(typeResult.types.zodPath, 'utf8');
      console.log(zodContent);
    }
    
    // Display collected issues
    console.log('\n\n📋 Collected Issues:');
    console.log('===================');
    const issues = testIssueReporter.getIssues();
    if (issues.length > 0) {
      for (const issue of issues) {
        console.log(`[${issue.type.toUpperCase()}] ${issue.message}`);
      }
    } else {
      console.log('No issues collected');
    }
    
    console.log('\n✅ Test completed successfully!');
    
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