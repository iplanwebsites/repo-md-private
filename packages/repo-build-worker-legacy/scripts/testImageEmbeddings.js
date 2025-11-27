// src/scripts/testImageEmbeddings.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import clipEmbedder, { 
  imageEmbeddingByUrl, 
  textEmbedding, 
  cosineSimilarity, 
  processImage 
} from "../src/lib/clip-embedder.js";
import crypto from "crypto";

// Enable debug mode for detailed logging
clipEmbedder.setDebug(true);

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test CLIP embeddings generation with sample images and text
 */
async function testEmbeddings() {
  try {
    console.log("🧪 Testing CLIP embeddings generation...");

    // Path to test images directory (create this directory and add sample images)
    const testImagesDir = path.join(__dirname, "test-images");

    // Create test images directory if it doesn't exist
    try {
      await fs.mkdir(testImagesDir, { recursive: true });
      console.log(`📁 Created test images directory at ${testImagesDir}`);
    } catch (error) {
      // Directory may already exist
      console.log(
        `📁 Using existing test images directory at ${testImagesDir}`
      );
    }

    // Initialize models
    console.log("🔄 Initializing CLIP models...");
    await clipEmbedder.initialize();
    console.log("✅ Models initialized successfully");

    // Read images from the test directory
    const files = await fs.readdir(testImagesDir);
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);
    });

    if (imageFiles.length === 0) {
      console.log(
        "⚠️ No test images found. Please add some images to the test-images directory."
      );
      console.log(`Directory path: ${testImagesDir}`);
      return;
    }

    console.log(`🖼️ Found ${imageFiles.length} test images`);

    // First test text embeddings
    console.log("\n🔤 Testing text embeddings...");
    const testTexts = ["a cat", "a dog", "a landscape", "a portrait of a person"];
    const textResults = [];

    for (const text of testTexts) {
      console.log(`\n📝 Processing text: "${text}"`);
      
      // Measure time taken
      const startTime = Date.now();
      
      // Generate embedding
      const embedding = await textEmbedding(text);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (!embedding) {
        console.log(`❌ Failed to generate embedding for "${text}"`);
        textResults.push({
          text,
          success: false,
          error: "No embedding returned",
        });
        continue;
      }
      
      console.log(`✅ Generated embedding for "${text}" in ${duration}s`);
      console.log(`📏 Embedding dimensions: ${embedding.length}`);
      console.log(
        `🔍 First 5 values: ${embedding
          .slice(0, 5)
          .map((v) => v.toFixed(4))
          .join(", ")}...`
      );
      
      textResults.push({
        text,
        success: true,
        dimensions: embedding.length,
        duration: `${duration}s`,
      });
    }

    // Process each image
    console.log("\n🖼️ Testing image embeddings...");
    const imageResults = [];

    // Import RawImage from transformers.js for direct file loading
    const { RawImage } = await import('@huggingface/transformers');

    for (const imageFile of imageFiles) {
      const imagePath = path.join(testImagesDir, imageFile);
      console.log(`\n📷 Processing image: ${imageFile}`);

      // Read the image file
      const imageBuffer = await fs.readFile(imagePath);

      // Calculate image hash
      const hash = crypto
        .createHash("sha256")
        .update(imageBuffer)
        .digest("hex");
      console.log(`🔑 Image hash: ${hash}`);

      // Measure time taken
      const startTime = Date.now();

      // Generate embedding using direct file path method
      try {
        console.log(`🔄 Loading image from path: ${imagePath}`);
        
        // First try with direct file loading with RawImage
        const image = await RawImage.read(imagePath);
        
        // Use processImage which works directly with RawImage objects
        const embedding = await processImage(image);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (!embedding) {
          console.log(`❌ Failed to generate embedding for ${imageFile}`);
          imageResults.push({
            file: imageFile,
            success: false,
            hash,
            error: "No embedding returned",
          });
          continue;
        }

        console.log(`✅ Generated embedding for ${imageFile} in ${duration}s`);
        console.log(`📏 Embedding dimensions: ${embedding.length}`);
        console.log(
          `🔍 First 5 values: ${embedding
            .slice(0, 5)
            .map((v) => v.toFixed(4))
            .join(", ")}...`
        );

        imageResults.push({
          file: imageFile,
          success: true,
          hash,
          dimensions: embedding.length,
          duration: `${duration}s`,
          embedding: embedding // Store for later comparison
        });
      } catch (error) {
        console.error(`❌ Error generating embedding for ${imageFile}:`, error.message);
        imageResults.push({
          file: imageFile,
          success: false,
          hash,
          error: error.message,
        });
      }
    }

    // Compare image embeddings if we have more than one successful embedding
    const successfulImageResults = imageResults.filter((r) => r.success);
    if (successfulImageResults.length >= 2) {
      console.log("\n🔄 Testing embedding similarity between images...");

      // Use the stored embeddings from the previous step
      const image1 = successfulImageResults[0];
      const image2 = successfulImageResults[1];

      // Calculate similarity using the cosineSimilarity function
      const similarity = cosineSimilarity(image1.embedding, image2.embedding);

      console.log(
        `🔍 Similarity between ${image1.file} and ${image2.file}: ${similarity.toFixed(4)}`
      );
      console.log(
        `   - Higher value (closer to 1.0) means more similar images`
      );
      console.log(`   - Lower value (closer to 0.0) means less similar images`);
    }

    // Compare images to text if both have successful embeddings
    const successfulTextResults = textResults.filter((r) => r.success);
    if (successfulImageResults.length > 0 && successfulTextResults.length > 0) {
      console.log("\n🔄 Testing image-text similarity...");

      // Get first successful image embedding (already computed)
      const imageResult = successfulImageResults[0];
      const imageEmbedding = imageResult.embedding;
      
      // Generate text embeddings for comparison
      const textEmbeddings = [];
      for (const textResult of successfulTextResults) {
        const text = textResult.text;
        const embedding = await textEmbedding(text);
        textEmbeddings.push({ text, embedding });
      }
      
      console.log(`\n📊 Image-text similarity scores for ${imageResult.file}:`);
      
      // Calculate similarities
      for (const { text, embedding } of textEmbeddings) {
        const similarity = cosineSimilarity(imageEmbedding, embedding);
        console.log(`  "${text}": ${similarity.toFixed(4)}`);
      }
      
      // Calculate probabilities
      const allTextEmbeddings = textEmbeddings.map(t => t.embedding);
      const probabilities = clipEmbedder.calculateProbabilities(imageEmbedding, allTextEmbeddings);
      
      console.log(`\n📊 Classification probabilities for ${imageResult.file}:`);
      for (let i = 0; i < textEmbeddings.length; i++) {
        console.log(`  "${textEmbeddings[i].text}": ${(probabilities[i] * 100).toFixed(2)}%`);
      }
    }

    // Summary
    console.log("\n📊 Test Summary:");
    console.log(`Text embeddings processed: ${textResults.length}`);
    console.log(`Successful text embeddings: ${successfulTextResults.length}`);
    console.log(`Failed text embeddings: ${textResults.length - successfulTextResults.length}`);
    console.log(`Image embeddings processed: ${imageResults.length}`);
    console.log(`Successful image embeddings: ${successfulImageResults.length}`);
    console.log(`Failed image embeddings: ${imageResults.length - successfulImageResults.length}`);

    if (successfulTextResults.length > 0 && successfulImageResults.length > 0) {
      console.log("\n✅ CLIP embedding generation is working correctly!");
    } else {
      console.log(
        "\n❌ Some embeddings failed to generate. Check the error logs above."
      );
    }
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    console.error(error.stack);
  }
}

// Run the test
testEmbeddings();