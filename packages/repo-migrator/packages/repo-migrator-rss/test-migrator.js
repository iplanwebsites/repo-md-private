#!/usr/bin/env node

import { migrate, migrateRss, migrateWordPress } from './index.js';
import { readdir } from 'fs/promises';

async function testMigrator() {
  const migrationType = process.argv[2];
  const source = process.argv[3];
  const outputDir = process.argv[4] || './downloads';
  const limit = process.argv[5] ? parseInt(process.argv[5]) : undefined;

  if (!migrationType || !source) {
    console.log('Usage: node test-migrator.js <type> <source> [output_dir] [limit]');
    console.log('');
    console.log('Migration types:');
    console.log('  rss        - RSS/Atom feed URL or file');
    console.log('  wordpress  - WordPress XML export file');
    console.log('');
    console.log('Examples:');
    console.log('  node test-migrator.js rss https://example.com/rss.xml');
    console.log('  node test-migrator.js wordpress ./export.xml ./my-posts');
    console.log('  node test-migrator.js rss https://example.com/feed ./posts 10');
    process.exit(1);
  }

  try {
    console.log(`Testing ${migrationType.toUpperCase()} migration`);
    console.log(`Source: ${source}`);
    console.log(`Output directory: ${outputDir}`);
    if (limit && migrationType === 'rss') console.log(`Limit: ${limit} posts`);
    console.log('---');

    let result;
    const options = limit ? { limit } : {};

    // Use the unified migrate function
    result = await migrate(migrationType, source, outputDir, options);

    console.log('---');
    console.log(`✅ Migration completed successfully!`);
    
    if (result.totalPosts !== undefined) {
      console.log(`📊 Results: ${result.successCount || result.totalPosts}/${result.totalPosts} posts migrated`);
    } else {
      console.log(`📊 Migration completed`);
    }

    // List created files
    try {
      const files = await readdir(outputDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      if (mdFiles.length > 0) {
        console.log('📄 Created files:');
        mdFiles.slice(0, 10).forEach(file => console.log(`  - ${file}`));
        if (mdFiles.length > 10) {
          console.log(`  ... and ${mdFiles.length - 10} more files`);
        }
      }
    } catch (err) {
      console.log('Could not list created files:', err.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testMigrator();