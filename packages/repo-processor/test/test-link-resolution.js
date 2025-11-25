import { processFolder } from '../dist/index.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function testLinkResolution() {
  console.log('🧪 Testing link resolution...\n');
  
  const testVaultPath = resolve(__dirname, 'portfolio');
  
  try {
    const results = await processFolder(testVaultPath, {
      processAllFiles: true,
      notePathPrefix: '/posts',
      debug: 2
    });
    
    // Find our test page
    const testPage = results.find(p => p.slug === 'test-page' || p.fileName === 'link-resolution-test');
    
    if (testPage) {
      console.log('📄 Test page found:', testPage.fileName);
      console.log('🔗 URL:', testPage.url);
      console.log('\n📝 Generated HTML (first 500 chars):');
      console.log(testPage.html.substring(0, 500) + '...\n');
      
      // Check for resolved links
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/g;
      const links = [];
      let match;
      
      while ((match = linkRegex.exec(testPage.html)) !== null) {
        links.push({ href: match[1], text: match[2] });
      }
      
      console.log('🔍 Found links:');
      links.forEach(link => {
        console.log(`  - "${link.text}" -> ${link.href}`);
      });
    } else {
      console.log('❌ Test page not found');
    }
    
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLinkResolution();