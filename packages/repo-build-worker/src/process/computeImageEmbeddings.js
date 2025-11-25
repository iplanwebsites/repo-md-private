// src/process/computeImageEmbeddings.js
import fs from "fs/promises";
import path from "path";
import { imageEmbeddingByUrl } from "../lib/clip-embedder.js";
import clipEmbedder from "../lib/clip-embedder.js";
import crypto from "crypto";

// Enable debug mode if needed
const DEBUG_MODE = true;
clipEmbedder.setDebug(DEBUG_MODE);

// Use mobileclip_s2 model for better quality/performance balance
const CLIP_MODEL = "Xenova/mobileclip_s2";

/**
 * Check if a file is a supported image format
 * @param {string} filePath - Path to the file
 * @returns {boolean} - True if the file is a supported image
 */
function isSupportedImageFormat(filePath) {
  if (!filePath) return false;

  const ext = path.extname(filePath).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);
}

/**
 * Get the MD size variant of an image path
 * @param {string} filePath - Original file path
 * @returns {string} - Path to the MD size variant
 */
function getMdSizeImagePath(filePath) {
  if (!filePath) return null;
  
  // Parse the path
  const parsedPath = path.parse(filePath);
  
  // Check if this is already an optimized variant
  const suffixMatch = parsedPath.name.match(/-([a-z]{2})\.([a-z]+)$/);
  if (suffixMatch) {
    // Replace the size suffix with 'md'
    return path.join(
      parsedPath.dir, 
      parsedPath.name.replace(/-([a-z]{2})\.([a-z]+)$/, `-md.${suffixMatch[2]}`)
    );
  }
  
  // For original images, add the md suffix
  // Look for hash-based naming pattern (common in the processed images)
  const hashMatch = parsedPath.name.match(/^([a-f0-9]+)$/);
  if (hashMatch) {
    return path.join(
      parsedPath.dir,
      `${parsedPath.name}-md${parsedPath.ext}`
    );
  }
  
  // Default case if we can't determine the pattern
  return filePath;
}

/**
 * Find a valid image file path from different sources in the media object
 * @param {Object} media - Media object with paths and metadata
 * @returns {Promise<string | null>} - The valid file path or null if not found
 */
async function findValidImagePath(media) {
  // Extract identifier for logging
  const mediaId = media.hash || media.metadata?.hash || media.id || "unknown";
  
  // Initialize paths
  let filePath = null;
  
  // Search for paths in sizes object (most reliable source)
  if (media.sizes) {
    console.log(`🔍 Searching for file paths in sizes object...`);
    
    // First try the medium size (optimal for embeddings)
    // Then fall back to other sizes in order of preference
    const sizePriority = ['md', 'lg', 'sm', 'xl', 'xs'];
    
    for (const size of sizePriority) {
      if (Array.isArray(media.sizes[size])) {
        // Try each variant in the size array
        for (const variant of media.sizes[size]) {
          if (variant.outputPath) {
            console.log(`📋 Found potential ${size} file path: ${variant.outputPath} (${variant.format || 'unknown'})`);
            try {
              await fs.access(variant.outputPath);
              console.log(`✅ Verified ${size} file exists: ${variant.outputPath}`);
              return variant.outputPath;
            } catch (e) {
              console.log(`⚠️ ${size} file not found: ${variant.outputPath}`);
            }
          }
        }
      }
    }
    
    // Also check for publicPath as a last resort
    for (const size of Object.keys(media.sizes)) {
      if (Array.isArray(media.sizes[size])) {
        for (const variant of media.sizes[size]) {
          if (variant.publicPath) {
            console.log(`🔍 Found publicPath in sizes.${size}[]: ${variant.publicPath}`);
            // We would need to convert this to a file path, but we don't have enough context
            // Just logging for debugging purposes
          }
        }
      }
    }
  }
  
  // Fall back to other path properties
  const fallbackPathChecks = [
    {
      check: () => {
        if (media.metadata?.hash) {
          const hash = media.metadata.hash;
          const ext = media.fileExt || 'jpg';
          return `dist/_medias/${hash}.${ext}`;
        }
        return null;
      },
      description: "metadata.hash"
    },
    {
      check: () => media.hashPath ? `dist/_medias/${media.hashPath}` : null,
      description: "hashPath"
    },
    {
      check: () => media.effectivePath ? `dist/${media.effectivePath}` : null,
      description: "effectivePath"
    },
    {
      check: () => media.filePath || null,
      description: "filePath"
    },
    {
      check: () => media.path || null,
      description: "path"
    },
    {
      check: () => media.originalPath || null,
      description: "originalPath"
    },
    {
      check: () => media.fileName ? `dist/_medias/${media.fileName}` : null,
      description: "fileName"
    }
  ];

  // Try each fallback path
  for (const { check, description } of fallbackPathChecks) {
    const path = check();
    if (path) {
      console.log(`🔍 Using ${description}: ${path}`);
      try {
        await fs.access(path);
        console.log(`✅ Verified ${description} file exists: ${path}`);
        return path;
      } catch (e) {
        console.log(`⚠️ File not found at ${description}: ${path}`);
      }
    }
  }
  
  // If we get here, we couldn't find any valid path
  console.error(`❌ Could not find any valid file path for media ${mediaId}`);
  return null;
}

/**
 * Generate embedding for a single media file using md size variant
 * @param {Object} media - Media object with path and metadata
 * @returns {Promise<Array<number> | null>} Normalized embedding or null if failed
 */
async function generateMediaEmbedding(media) {
  // Dump entire media object at the beginning to understand its structure
  console.log(`📦 Full media object:`, JSON.stringify(media, null, 2));
  
  // Extract hash using multiple methods
  const mediaId = media.hash || media.metadata?.hash || media.id || "unknown";
  
  // Find a valid file path
  const filePath = await findValidImagePath(media);
  
  // If we couldn't find a valid path, return null
  if (!filePath) {
    console.error(`📦 Complete media object:`, media);
    return null;
  }

  console.log(`🔄 Processing media: ${mediaId} with path: ${filePath}`);

  // Skip non-image files
  if (!isSupportedImageFormat(filePath)) {
    console.log(`⏭️ Skipping non-image media: ${filePath}`);
    return null;
  }

  try {
    // Read the image file
    console.log(`📚 Reading image file: ${filePath}`);
    const imageBuffer = await fs.readFile(filePath);
    console.log(`📊 Image file size: ${imageBuffer.length} bytes`);
    
    if (imageBuffer.length === 0) {
      console.error(`❌ Image file is empty: ${filePath}`);
      return null;
    }

    // Generate embedding from the image
    console.log(`🧠 Generating embedding for: ${mediaId}`);
    const startTime = Date.now();
    
    // Strategy 1: Use RawImage direct approach (proven to work)
    try {
      console.log(`🔄 Using direct file loading approach: ${filePath}`);
      
      // Import RawImage and process directly
      const { RawImage } = await import('@huggingface/transformers');
      const image = await RawImage.read(filePath);
      
      // Process using our custom method
      const embedding = await clipEmbedder.processImage(image);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(3);
      console.log(`✅ Embedding generated using direct file approach in ${duration}s`);
      
      if (embedding && embedding.length > 0) {
        console.log(`📊 Embedding sample: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);
        return embedding;
      }
      
      console.warn(`⚠️ Empty embedding result for ${mediaId} using direct approach`);
      return null;
    } catch (directError) {
      // Strategy 2: Use file:// URL approach as fallback
      console.error(`❌ Error using direct file approach: ${directError.message}`);
      console.log(`🔄 Falling back to file URL approach as last resort...`);
      
      try {
        const fileUrl = `file://${filePath}`;
        console.log(`🔗 Using file URL: ${fileUrl}`);
        
        // Use the imageEmbeddingByUrl function for embedding
        const embedding = await imageEmbeddingByUrl(fileUrl);
        const duration = ((Date.now() - startTime) / 1000).toFixed(3);
        
        // Return with successful result
        if (embedding && embedding.length > 0) {
          console.log(`✅ Embedding generated for media: ${mediaId} (${embedding.length} dimensions) in ${duration}s`);
          console.log(`📊 Embedding sample: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);
          return embedding;
        }
        
        console.warn(`⚠️ Empty embedding result for ${mediaId}`);
        return null;
      } catch (fallbackError) {
        console.error(`❌ All embedding approaches failed: ${fallbackError.message}`);
        throw fallbackError; // Rethrow to be caught by the outer try-catch
      }
    }
  } catch (error) {
    console.error(`❌ Error embedding media ${mediaId}:`, error.message);
    console.error(`Stack trace:`, error.stack);
    return null;
  }
}

/**
 * Compute embeddings for an array of media files
 * @param {Array} mediaArray - Array of media objects to embed
 * @param {Object} existingEmbeddings - Optional existing embeddings to reuse (hash -> embedding map)
 * @returns {Promise<Object>} Object with embeddings maps and metadata
 */
async function computeImageEmbeddings(mediaArray, existingEmbeddings = null) {
  console.log(`🧠 Computing image embeddings using ${CLIP_MODEL}...`);
  
  if (existingEmbeddings && Object.keys(existingEmbeddings).length > 0) {
    console.log(`♻️ Found ${Object.keys(existingEmbeddings).length} existing image embeddings to potentially reuse`);
  }

  // First check if we can initialize the model before processing any images
  try {
    // Check if the embedding method exists
    console.log(`🔄 Testing image embedding model initialization...`);
    
    // Initialize the models
    await clipEmbedder.initialize();
    
    // Try a simple test embedding to verify the model works
    try {
      console.log(`🔄 Testing text embedding with a sample text...`);
      const testText = "test";
      const testResult = await clipEmbedder.textEmbedding(testText);
      
      // Verify we got a valid result
      if (!testResult || !Array.isArray(testResult) || testResult.length === 0) {
        throw new Error("Test embedding generation failed - invalid or empty result");
      }
      
      console.log(`✅ CLIP models successfully initialized with ${CLIP_MODEL}`);
    } catch (testError) {
      throw new Error(`Failed to process test text: ${testError.message}`);
    }
  } catch (modelInitError) {
    // If model initialization fails, log a warning and return empty results
    console.warn(`⚠️ AI model for embedding not initialized: ${modelInitError.message}`);
    console.error(`❌ Model initialization failed: ${modelInitError.message}`);
    console.log(`🚫 Skipping embedding generation due to model initialization failure`);
    
    // Return empty results with error information
    return {
      hashMap: {},
      metadata: {
        computed: false,
        count: 0,
        skipped: mediaArray ? mediaArray.length : 0,
        dimension: 0,
        timestamp: new Date().toISOString(),
        model: CLIP_MODEL,
        error: `Model initialization failed: ${modelInitError.message}`
      },
    };
  }

  try {
    // Validate input
    if (!mediaArray) {
      throw new Error("❌ Media array is null or undefined");
    }
    
    if (!Array.isArray(mediaArray)) {
      console.error("❌ Input is not an array:", typeof mediaArray);
      throw new Error("❌ Media data is not an array");
    }

    console.log(`🔢 Found ${mediaArray.length} media items to process`);
    
    // Check if there are any media items to process
    if (mediaArray.length === 0) {
      console.warn("⚠️ No media items to process");
      return {
        hashMap: {},
        metadata: {
          computed: false,
          count: 0,
          skipped: 0,
          dimension: 0,
          timestamp: new Date().toISOString(),
          model: CLIP_MODEL,
          error: "No media items provided"
        },
      };
    }

    // Log a sample of the first media item to verify structure
    console.log("📦 First media item sample:", {
      hasHash: !!mediaArray[0].hash,
      hasFilePath: !!mediaArray[0].filePath,
      hasPath: !!mediaArray[0].path,
      hasSizes: !!mediaArray[0].sizes,
      keys: Object.keys(mediaArray[0]),
      sizes: mediaArray[0].sizes ? Object.keys(mediaArray[0].sizes) : null,
      usingMd: !!(mediaArray[0].sizes?.md),
      subKeys: mediaArray[0].sizes?.md ? Object.keys(mediaArray[0].sizes.md) : null
    });

    const embeddingsByHash = {};
    let dimension = 0;
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let reusedCount = 0;
    let computedCount = 0;
    const errors = [];

    console.log(`⏳ Starting batch processing of ${mediaArray.length} media items...`);
    
    for (let i = 0; i < mediaArray.length; i++) {
      // Log progress for every 10th item or at beginning/end
      if (i % 10 === 0 || i === mediaArray.length - 1) {
        console.log(`🔄 Progress: processing item ${i+1}/${mediaArray.length} (${Math.round((i+1)/mediaArray.length*100)}%)`);
      }
      
      const media = mediaArray[i];
      
      // Skip invalid media items
      if (!media) {
        console.warn(`⚠️ Skipping null or undefined media at index ${i}`);
        skippedCount++;
        continue;
      }
      
      // Generate or retrieve hash - with extensive fallback mechanisms
      let hash = null;
      
      // First try the direct hash property
      if (media.hash) {
        hash = media.hash;
        console.log(`✅ Using existing hash for media at index ${i}: ${hash.substring(0, 8)}...`);
      } 
      // Try to generate from filePath
      else if (media.filePath) {
        hash = crypto.createHash("sha256").update(media.filePath).digest("hex");
        console.log(`✅ Generated hash from filePath for media at index ${i}: ${hash.substring(0, 8)}...`);
      }
      // Try to generate from path
      else if (media.path) {
        hash = crypto.createHash("sha256").update(media.path).digest("hex");
        console.log(`✅ Generated hash from path for media at index ${i}: ${hash.substring(0, 8)}...`);
      }
      // Try to generate from sizes.md.path if available
      else if (media.sizes?.md?.path) {
        hash = crypto.createHash("sha256").update(media.sizes.md.path).digest("hex");
        console.log(`✅ Generated hash from sizes.md.path for media at index ${i}: ${hash.substring(0, 8)}...`);
      }
      // Try to generate from any path in any size variant
      else if (media.sizes) {
        const sizeKeys = Object.keys(media.sizes);
        for (const size of sizeKeys) {
          if (media.sizes[size]?.path) {
            hash = crypto.createHash("sha256").update(media.sizes[size].path).digest("hex");
            console.log(`✅ Generated hash from sizes.${size}.path for media at index ${i}: ${hash.substring(0, 8)}...`);
            break;
          }
        }
      }
      // As a last resort, create a hash from stringified media object
      if (!hash) {
        try {
          // Generate hash from available metadata or originalPath if available
          if (media.metadata?.hash) {
            hash = media.metadata.hash;
            console.log(`✅ Using hash from metadata for index ${i}: ${hash.substring(0, 8)}...`);
          } else if (media.originalPath) {
            hash = crypto.createHash("sha256").update(media.originalPath).digest("hex");
            console.log(`✅ Generated hash from originalPath for index ${i}: ${hash.substring(0, 8)}...`);
          } else {
            // As a last resort, generate from the stringified object
            const dataToHash = JSON.stringify(media);
            hash = crypto.createHash("sha256").update(dataToHash).digest("hex");
            console.log(`⚠️ Created fallback hash from media object for index ${i}: ${hash.substring(0, 8)}...`);
          }
        } catch (error) {
          console.warn(`❌ Failed to create fallback hash for media at index ${i}: ${error.message}`);
        }
      }

      if (!hash) {
        console.warn(`⚠️ Skipping media without hash at index ${i} - no way to identify this media`);
        skippedCount++;
        continue;
      }

      try {
        let embedding = null;
        
        // Check if we can reuse an existing embedding
        if (existingEmbeddings && existingEmbeddings[hash]) {
          embedding = existingEmbeddings[hash];
          reusedCount++;
          console.log(`♻️ Reusing existing embedding for media: ${hash.substring(0, 8)}...`);
        } else {
          // Generate new embedding for this media item
          embedding = await generateMediaEmbedding(media);
          computedCount++;
        }

        if (embedding && Array.isArray(embedding) && embedding.length > 0) {
          // Store embedding in hash map
          embeddingsByHash[hash] = embedding;
          
          // Set dimension from first successful embedding
          if (dimension === 0) dimension = embedding.length;
          
          // Verify dimensions match expected
          if (embedding.length !== dimension) {
            console.warn(`⚠️ Embedding dimension mismatch for media ${hash}: expected ${dimension}, got ${embedding.length}`);
          }
          
          processedCount++;
          console.log(`✅ Successfully processed media ${hash} (${processedCount} of ${mediaArray.length})`);
        } else {
          console.warn(`⚠️ No valid embedding generated for media hash ${hash}`);
          skippedCount++;
        }
      } catch (mediaError) {
        console.error(`❌ Error processing media ${hash}:`, mediaError.message);
        errorCount++;
        errors.push({ hash, error: mediaError.message });
        skippedCount++;
      }
    }

    // Check processed count
    if (processedCount === 0) {
      console.error("❗ No embeddings were successfully generated");
      throw new Error("Failed to generate any valid embeddings");
    }

    console.log(
      `📊 Generated ${processedCount} image embeddings (${Math.round(processedCount/mediaArray.length*100)}%), ` +
      `skipped ${skippedCount}, errors: ${errorCount}`
    );
    
    if (reusedCount > 0 || computedCount > 0) {
      console.log(`✅ Image embeddings summary: ${reusedCount} reused, ${computedCount} computed`);
    }

    const metadata = {
      model: CLIP_MODEL,
      dimension,
      count: processedCount,
      skipped: skippedCount,
      errors: errorCount,
      reusedCount,
      computedCount,
      timestamp: new Date().toISOString(),
    };

    // Log size of hash map
    console.log(`📊 Embedding hash map contains ${Object.keys(embeddingsByHash).length} entries`);
    
    // Check if hash map is empty
    if (Object.keys(embeddingsByHash).length === 0) {
      console.error("❌ Embedding hash map is empty!");
    } else {
      // Log a sample of embedding values for verification
      const sampleHash = Object.keys(embeddingsByHash)[0];
      const sampleEmbedding = embeddingsByHash[sampleHash];
      console.log(`📊 Sample embedding for hash ${sampleHash}: [${sampleEmbedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);
    }

    console.log(`🎉 Finished generating ${processedCount} image embeddings`);

    return {
      hashMap: embeddingsByHash,
      metadata: {
        computed: processedCount > 0,
        count: processedCount,
        skipped: skippedCount,
        errors: errorCount,
        dimension,
        timestamp: metadata.timestamp,
        model: CLIP_MODEL
      },
    };
  } catch (error) {
    console.error("❌ Error computing image embeddings:", error.message);
    console.error("Stack trace:", error.stack);
    
    // Return empty result with error information
    return {
      hashMap: {},
      metadata: {
        computed: false,
        count: 0,
        skipped: 0,
        dimension: 0,
        timestamp: new Date().toISOString(),
        model: CLIP_MODEL,
        error: error.message
      },
    };
  }
}

export default computeImageEmbeddings;