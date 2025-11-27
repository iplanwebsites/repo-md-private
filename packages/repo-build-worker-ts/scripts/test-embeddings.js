// scripts/test-embeddings.js
import path from 'path';
import fs from 'fs/promises';
import clipEmbedder from '../src/lib/clip-embedder.js';

// Enable debug mode
clipEmbedder.setDebug(true);

/**
 * Test a simple embedding generation on a test image
 */
async function testEmbeddings() {
  console.log('🧪 Testing image embeddings...');
  
  try {
    // First initialize the models
    console.log('⚙️ Initializing models...');
    await clipEmbedder.initialize();
    console.log('✅ Models initialized successfully');
    
    // Test image path
    const testImagePath = path.resolve('./scripts/test-images/test1.jpeg');
    console.log(`📷 Using test image: ${testImagePath}`);
    
    // Verify the file exists
    try {
      await fs.access(testImagePath);
      console.log('✅ Test image exists');
    } catch (error) {
      console.error(`❌ Test image not found: ${error.message}`);
      return;
    }
    
    // Test using URL approach
    console.log('🔄 Testing URL approach...');
    try {
      const fileUrl = `file://${testImagePath}`;
      console.log(`🔗 Using file URL: ${fileUrl}`);
      
      const embedding = await clipEmbedder.imageEmbeddingByUrl(fileUrl);
      console.log(`✅ URL approach successful, embedding length: ${embedding.length}`);
      console.log(`📊 Sample: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);
    } catch (error) {
      console.error(`❌ URL approach failed: ${error.message}`);
    }
    
    // Test using direct image approach
    console.log('🔄 Testing direct image approach...');
    try {
      const { RawImage } = await import('@huggingface/transformers');
      const image = await RawImage.read(testImagePath);
      
      const embedding = await clipEmbedder.processImage(image);
      console.log(`✅ Direct approach successful, embedding length: ${embedding.length}`);
      console.log(`📊 Sample: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);
    } catch (error) {
      console.error(`❌ Direct approach failed: ${error.message}`);
    }
    
    console.log('🎉 Testing completed');
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the test
testEmbeddings();