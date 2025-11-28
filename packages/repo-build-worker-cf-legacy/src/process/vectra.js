// src/process/vectra.js
import fs from "fs/promises";
import path from "path";
import { LocalIndex } from "vectra";

/**
 * Creates a _vectra folder and populates it with vector data from the build
 * @param {Object} data - The data from previous build steps containing assets and embeddings
 * @returns {Promise<Object>} - Result with vector database information
 */
async function createVectraIndex(data) {
  console.log("🧠 Creating Vectra vector database...", { jobId: data.jobId });

  // Validate required data
  if (!data.assets || !data.assets.distFolder) {
    throw new Error("Assets information is required");
  }

  if (!data.postEmbeddings) {
    throw new Error("Post embeddings information is required");
  }

  try {
    const distFolder = data.assets.distFolder;
    const vectraFolder = path.join(distFolder, "_vectra");

    // Create _vectra folder if it doesn't exist
    await fs.mkdir(vectraFolder, { recursive: true });
    console.log(`📁 Created Vectra folder at ${vectraFolder}`);

    // Create separate indexes for posts and images
    const postsIndex = new LocalIndex(path.join(vectraFolder, "posts"));
    await postsIndex.createIndex();
    console.log("✅ Created posts vector index");

    // Load the post embeddings data
    const postEmbeddingsHashMapPath = data.postEmbeddings.hashMapPath;
    const postEmbeddingsHashMap = JSON.parse(
      await fs.readFile(postEmbeddingsHashMapPath, "utf-8")
    );

    // Insert posts into the vector index
    let postsCount = 0;
    for (const [hash, entry] of Object.entries(postEmbeddingsHashMap)) {
      if (entry.embedding && entry.embedding.length > 0) {
        await postsIndex.insertItem({
          vector: entry.embedding,
          metadata: {
            hash,
            slug: entry.slug,
            title: entry.title,
            path: entry.path,
            type: "post"
          }
        });
        postsCount++;
      }
    }
    console.log(`✅ Inserted ${postsCount} posts into vector index`);

    // If media embeddings exist, create a vector index for them
    let mediaCount = 0;
    if (data.mediaEmbeddings && data.mediaEmbeddings.hashMapPath) {
      const mediaIndex = new LocalIndex(path.join(vectraFolder, "media"));
      await mediaIndex.createIndex();
      console.log("✅ Created media vector index");

      const mediaEmbeddingsHashMapPath = data.mediaEmbeddings.hashMapPath;
      const mediaEmbeddingsHashMap = JSON.parse(
        await fs.readFile(mediaEmbeddingsHashMapPath, "utf-8")
      );

      for (const [hash, entry] of Object.entries(mediaEmbeddingsHashMap)) {
        if (entry.embedding && entry.embedding.length > 0) {
          await mediaIndex.insertItem({
            vector: entry.embedding,
            metadata: {
              hash,
              filename: entry.filename,
              path: entry.path,
              type: "media"
            }
          });
          mediaCount++;
        }
      }
      console.log(`✅ Inserted ${mediaCount} media items into vector index`);
    } else {
      console.log("ℹ️ No media embeddings found, skipping media vector index");
    }

    // Add the Vectra information to the result
    return {
      ...data,
      vectra: {
        processed: true,
        folder: vectraFolder,
        postsCount,
        mediaCount,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error("❌ Failed to create Vectra index", {
      jobId: data.jobId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export default createVectraIndex;