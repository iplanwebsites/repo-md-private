// src/process/computePostEmbeddings.js
import fs from "fs/promises";
import path from "path";
import instructorEmbedder from "../lib/instructor-embedder.js";

// Enable debug mode
const DEBUG_MODE = true;
instructorEmbedder.setDebug(DEBUG_MODE);

/**
 * Normalize an embedding vector to unit length
 * @param {Array<number>} embedding - The embedding to normalize
 * @returns {Array<number>} Normalized embedding
 */
function normalizeEmbedding(embedding) {
  let magnitude = 0;
  for (let i = 0; i < embedding.length; i++) {
    magnitude += embedding[i] * embedding[i];
  }
  magnitude = Math.sqrt(magnitude);
  return magnitude > 0 ? embedding.map((e) => e / magnitude) : embedding;
}

/**
 * Generate embedding for a single post
 * @param {Object} post - Post object
 * @returns {Promise<Array<number> | null>} Normalized embedding
 */
async function generatePostEmbedding(post) {
  const postId = post.id || post.slug || "unknown";
  console.log(`🔄 Processing post: ${postId}`);

  const title = post.title || "";
  const plain = post.plain || "";
  const frontmatterStr = post.frontmatter
    ? JSON.stringify(post.frontmatter)
    : "";

  const textToEmbed = `${title}. ${plain} ${frontmatterStr}`.trim();

  if (!textToEmbed) {
    console.warn(`⚠️ No content to embed for post: ${postId}`);
    return null;
  }

  try {
    const instruction = "Represent the document for semantic search:";
    const embedding = await instructorEmbedder.getEmbedding(
      instruction,
      textToEmbed
    );
    //  const normalized = normalizeEmbedding(embedding);
    //console.log(`✅ Embedding generated for post: ${postId}`);
    return embedding;
  } catch (error) {
    console.error(`❌ Error embedding post ${postId}:`, error.message);
    return null;
  }
}

/**
 * Compute embeddings for an array of posts and return augmented data
 * @param {Array} postsArray - Array of posts to embed
 * @param {Object} existingEmbeddings - Optional existing embeddings to reuse (hash -> embedding map)
 * @returns {Promise<Object>} Object with posts array and embedding maps
 */
async function computePostEmbeddings(postsArray, existingEmbeddings = null) {
  console.log("🧠 Computing post embeddings...");
  
  if (existingEmbeddings && Object.keys(existingEmbeddings).length > 0) {
    console.log(`♻️ Found ${Object.keys(existingEmbeddings).length} existing embeddings to potentially reuse`);
  }

  // First, test if the embedding model can be initialized before processing any posts
  try {
    console.log(`🔄 Testing post embedding model initialization...`);
    
    // Check if getEmbedding function exists
    if (typeof instructorEmbedder.getEmbedding !== 'function') {
      throw new Error("getEmbedding is not a function - check the instructorEmbedder implementation");
    }
    
    // Try a simple embedding to validate the model works
    try {
      const testEmbedding = await instructorEmbedder.getEmbedding(
        "Test initialization",
        "This is a test sentence to verify the model works correctly."
      );
      
      if (!testEmbedding || !Array.isArray(testEmbedding) || testEmbedding.length === 0) {
        throw new Error("Test embedding generation failed - invalid result");
      }
      
      console.log(`✅ Post embedding model successfully initialized`);
    } catch (testError) {
      throw new Error(`Failed to generate test embedding: ${testError.message}`);
    }
  } catch (modelInitError) {
    // If model initialization fails, log a warning and return empty results
    console.warn(`⚠️ AI model for post embedding not initialized: ${modelInitError.message}`);
    console.error(`❌ Model initialization failed: ${modelInitError.message}`);
    console.log(`🚫 Skipping post embedding generation due to model initialization failure`);
    
    // Return empty results with error information
    return {
      augmentedPosts: postsArray, // Return original posts without embeddings
      slugMap: {},
      hashMap: {},
      metadata: {
        computed: false,
        count: 0,
        skipped: postsArray ? postsArray.length : 0,
        dimension: 0,
        timestamp: new Date().toISOString(),
        error: `Model initialization failed: ${modelInitError.message}`
      }
    };
  }

  try {
    if (!Array.isArray(postsArray)) {
      throw new Error("❌ Posts data is not an array");
    }

    console.log(`🔢 Found ${postsArray.length} posts to process`);

    const embeddingsBySlug = {};
    const embeddingsByHash = {};
    let dimension = 0;
    const augmentedPosts = [];
    let reusedCount = 0;
    let computedCount = 0;

    for (let i = 0; i < postsArray.length; i++) {
      const post = postsArray[i];
      const slug = post.slug || post.name;
      const hash = post.hash;

      if (!slug || !hash) {
        console.warn(`⚠️ Skipping post without slug/hash at index ${i}`, post);
        augmentedPosts.push(post); // Keep original post even without embedding
        continue;
      }

      let embedding = null;
      
      // Check if we can reuse an existing embedding
      if (existingEmbeddings && existingEmbeddings[hash]) {
        embedding = existingEmbeddings[hash];
        reusedCount++;
        console.log(`♻️ Reusing existing embedding for post: ${slug}`);
      } else {
        // Generate new embedding
        embedding = await generatePostEmbedding(post);
        computedCount++;
      }
      // console.log("created embedding for post", post.slug, embedding);

      // Create augmented post with embedding
      const augmentedPost = { ...post };

      if (embedding) {
        embeddingsBySlug[slug] = embedding;
        embeddingsByHash[hash] = embedding;
        augmentedPost.embedding = embedding;
        if (dimension === 0) dimension = embedding.length;
      }

      augmentedPosts.push(augmentedPost);
    }

    const count = Object.keys(embeddingsBySlug).length;
    console.log(`📊 Generated ${count} embeddings (dimension: ${dimension})`);
    
    if (reusedCount > 0 || computedCount > 0) {
      console.log(`✅ Embeddings summary: ${reusedCount} reused, ${computedCount} computed`);
    }

    const metadata = {
      model: "Xenova/all-MiniLM-L6-v2",
      dimension,
      count,
      reusedCount,
      computedCount,
      timestamp: new Date().toISOString(),
    };

    // Create maps but don't save them to files
    const slugMap = embeddingsBySlug; //{ ...metadata, embeddings: embeddingsBySlug };
    const hashMap = embeddingsByHash; //{ ...metadata, embeddings: embeddingsByHash };

    console.log(`🎉 Finished processing ${count} embeddings`);

    return {
      augmentedPosts,
      slugMap,
      hashMap,
      metadata: {
        computed: true,
        count,
        reusedCount,
        computedCount,
        dimension,
        timestamp: metadata.timestamp,
      },
    };
  } catch (error) {
    console.error("❌ Error computing post embeddings:", error.message);
    
    // Return empty results with error information but don't throw
    return {
      augmentedPosts: postsArray, // Return original posts without embeddings
      slugMap: {},
      hashMap: {},
      metadata: {
        computed: false,
        count: 0,
        skipped: postsArray ? postsArray.length : 0,
        dimension: 0,
        timestamp: new Date().toISOString(),
        error: error.message
      }
    };
  }
}

export default computePostEmbeddings;
