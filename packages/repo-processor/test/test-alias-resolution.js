#!/usr/bin/env node

import { processFolder } from '../dist/process/processFolder.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testAliasResolution() {
  const vaultPath = path.join(__dirname, 'testVault1');
  
  console.log('Testing alias resolution...');
  console.log('Vault path:', vaultPath);
  
  try {
    const result = await processFolder(vaultPath, {
      debug: 2,
      notePathPrefix: '/content',
      processAllFiles: true
    });
    
    // Find the dog page
    const dogPage = result.pages.find(p => p.slug === 'dog222');
    
    if (!dogPage) {
      console.error('❌ Dog page not found!');
      return;
    }
    
    console.log('\n✅ Dog page found:');
    console.log('  - Slug:', dogPage.slug);
    console.log('  - Title:', dogPage.title);
    console.log('  - Aliases:', dogPage.frontmatter?.aliases);
    
    // Check if the links were resolved
    console.log('\n🔍 Checking link resolution in HTML:');
    const html = dogPage.html;
    
    // Extract all links from the HTML
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>([^<]+)<\/a>/g;
    const links = [];
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      links.push({
        href: match[1],
        text: match[2]
      });
    }
    
    console.log('\n📎 Found links:');
    links.forEach(link => {
      console.log(`  - Text: "${link.text}", URL: "${link.href}"`);
    });
    
    // Check if all aliases point to the same page
    const aliasLinks = links.filter(l => 
      ['Doggo', 'Woofer', 'Yapper'].includes(l.text)
    );
    
    if (aliasLinks.length === 3) {
      const allPointToSamePage = aliasLinks.every(l => 
        l.href === '/content/dog222'
      );
      
      if (allPointToSamePage) {
        console.log('\n✅ SUCCESS: All alias links correctly point to /content/dog222');
      } else {
        console.log('\n❌ FAIL: Not all alias links point to the correct page');
        aliasLinks.forEach(l => {
          console.log(`  - ${l.text} -> ${l.href}`);
        });
      }
    } else {
      console.log(`\n❌ FAIL: Expected 3 alias links, found ${aliasLinks.length}`);
    }
    
    // Also check if other pages can link to dog using aliases
    console.log('\n🔍 Testing links from other pages...');
    
    // Create a test page that links to dog using an alias
    const testPagePath = path.join(vaultPath, 'test-alias-links.md');
    const testContent = `---
public: true
---

# Test Alias Links

Linking to dog using aliases:
- [[Doggo]] should link to dog
- [[Woofer]] should also link to dog
- [[Yapper]] is another alias for dog
- [[dog222]] direct slug link
`;
    
    fs.writeFileSync(testPagePath, testContent);
    
    // Process again with the new test page
    const result2 = await processFolder(vaultPath, {
      debug: 1,
      notePathPrefix: '/content',
      processAllFiles: true
    });
    
    const testPage = result2.pages.find(p => p.fileName === 'test-alias-links');
    if (testPage) {
      console.log('\n✅ Test page processed');
      
      // Extract links from test page
      const testLinks = [];
      let testMatch;
      
      while ((testMatch = linkRegex.exec(testPage.html)) !== null) {
        testLinks.push({
          href: testMatch[1],
          text: testMatch[2]
        });
      }
      
      console.log('\n📎 Links in test page:');
      testLinks.forEach(link => {
        console.log(`  - Text: "${link.text}", URL: "${link.href}"`);
      });
      
      // Check if all links point to dog222
      const dogLinks = testLinks.filter(l => 
        ['Doggo', 'Woofer', 'Yapper', 'dog222'].includes(l.text)
      );
      
      if (dogLinks.length === 4 && dogLinks.every(l => l.href === '/content/dog222')) {
        console.log('\n✅ SUCCESS: All alias links from test page correctly resolve to dog222');
      } else {
        console.log('\n❌ FAIL: Alias links from test page do not all resolve correctly');
      }
    }
    
    // Clean up test file
    fs.unlinkSync(testPagePath);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAliasResolution();