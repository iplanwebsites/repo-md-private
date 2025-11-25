#!/usr/bin/env node

import { processFolder } from './dist/index.js';
import path from 'path';

async function testLinkResolution() {
  console.log('🔍 Testing link resolution...');
  
  const testVaultPath = path.join(process.cwd(), 'test/testVault1');
  
  try {
    const results = await processFolder(testVaultPath, {
      debug: 2,
      processAllFiles: false // Only process public files
    });
    
    console.log('\n📊 Results:');
    console.log(`Found ${results.length} files`);
    
    // Check the first file for links
    const testFile = results.find(f => f.fileName === 'Test File');
    if (testFile) {
      console.log('\n🔗 Links in Test File:');
      console.log('HTML content preview:', testFile.html.substring(0, 500) + '...');
      
      // Check for specific link patterns
      const linkMatches = testFile.html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/g);
      if (linkMatches) {
        console.log('\n✅ Found links:');
        linkMatches.forEach(link => console.log('  -', link));
      } else {
        console.log('\n❌ No links found in HTML');
      }
      
      // Check if wikilinks were processed
      const wikilinkMatches = testFile.html.match(/\[\[[^\]]+\]\]/g);
      if (wikilinkMatches) {
        console.log('\n⚠️ Unprocessed wikilinks found:');
        wikilinkMatches.forEach(link => console.log('  -', link));
      } else {
        console.log('\n✅ No unprocessed wikilinks found');
      }
    } else {
      console.log('\n❌ Test File not found in results');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLinkResolution();