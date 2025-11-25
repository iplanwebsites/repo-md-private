import express from "express";
import { dalle } from "../../lib/dalle.js";
import { db } from "../../db.js";
import crypto from "crypto";

const router = express.Router();
const CACHE_EXPIRY_DAYS = 60; // Default cache expiry in days
const DEBUG = true; // Enable detailed logging with emojis
const CACHE_VERSION = "20250403d"; // Current date as cache version

// Add JSON body parser middleware specifically for this router
router.use(express.json());

/**
 * Create a cache key from DALL-E parameters
 * @param {Object} params - Parameters to create key from
 * @returns {String} - Hash-based cache key
 */
const createCacheKey = (params) => {
  // Extract the fields we want to use for caching
  const {
    prompt = "",
    model = "dall-e-3",
    size = "1024x1024",
    quality = "standard",
    style = "vivid",
    cacheVersion = CACHE_VERSION,
  } = params;
  const cacheObj = { prompt, model, size, quality, style, cacheVersion };

  // Serialize object and create a hash
  const serialized = JSON.stringify(cacheObj);
  return crypto
    .createHash("md5")
    .update(serialized)
    .digest("hex")
    .substring(0, 64); //minimal collision risks
};

/**
 * Process DALL-E API calls from both GET and POST requests with caching
 * @param {Object} params - Combined parameters from query or body
 * @param {Boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<Object>} - The DALL-E response
 */
const processDalleCall = async (params = {}, useCache = true) => {
  const startTime = Date.now();

  // Ensure params is an object and not null
  if (!params || typeof params !== "object") {
    params = {};
  }

  // Extract with defaults
  const {
    prompt = "",
    model = "dall-e-3",
    size = "1024x1024",
    quality = "standard",
    style = "vivid",
    n = 1,
  } = params;

  if (!prompt) {
    return {
      data: [],
      created: Date.now(),
      metadata: { model },
    };
  }

  if (DEBUG) {
    console.log(
      `🔍 DALL-E Request - Prompt: "${prompt.substring(0, 50)}${
        prompt.length > 50 ? "..." : ""
      }"`
    );
    console.log(
      `🎨 Model: ${model}, Size: ${size}, Quality: ${quality}, Style: ${style}`
    );
    console.log(`💾 Cache ${useCache ? "enabled" : "disabled"}`);
  }

  // Check cache if enabled
  if (useCache && db.dalleApiCache) {
    const cacheKey = createCacheKey(params);
    if (DEBUG) console.log(`🔑 Cache key: ${cacheKey}`);

    const cachedResult = await db.dalleApiCache.findOne({ cacheKey });

    if (cachedResult && cachedResult.response) {
      const age = Math.round(
        (Date.now() - new Date(cachedResult.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (DEBUG) {
        console.log(`✅ CACHE HIT! Found response from ${age} days ago`);
        console.log(`⏱️  Cache lookup took ${Date.now() - startTime}ms`);
      } else {
        console.log("Cache hit for DALL-E request");
      }

      return cachedResult.response;
    } else if (DEBUG) {
      console.log(`❌ CACHE MISS! No cached response found`);
    }
  }

  // Make request to DALL-E
  if (DEBUG) console.log(`🚀 Sending request to DALL-E API...`);
  const apiStartTime = Date.now();

  const response = await dalle({
    prompt,
    model,
    size,
    quality,
    style,
    n,
  });

  const apiDuration = Date.now() - apiStartTime;
  if (DEBUG) console.log(`⚡ API call completed in ${apiDuration}ms`);

  // Save to cache if enabled
  if (useCache && db.dalleApiCache) {
    if (DEBUG) console.log(`💾 Saving response to cache...`);
    const cacheKey = createCacheKey(params);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + CACHE_EXPIRY_DAYS);

    const cacheStartTime = Date.now();
    await db.dalleApiCache.updateOne(
      { cacheKey },
      {
        $set: {
          cacheKey,
          response,
          params,
          createdAt: new Date(),
          expiresAt: expiryDate,
        },
      },
      { upsert: true }
    );

    if (DEBUG) {
      console.log(
        `✅ Cache save completed in ${Date.now() - cacheStartTime}ms`
      );
      console.log(`⏱️  Total processing time: ${Date.now() - startTime}ms`);
    }
  }

  return response;
};

// Handle both GET and POST requests
router.all("/dalle", async (req, res) => {
  try {
    const requestId = Math.random().toString(36).substring(2, 10);
    if (DEBUG)
      console.log(
        `\n🔄 [${requestId}] New DALL-E request (${
          req.method
        }) at ${new Date().toISOString()}`
      );

    // Get parameters from either query (GET) or body (POST) or empty object as fallback
    let params = {};

    if (req.method === "GET" && req.query) {
      params = req.query;
    } else if (req.method === "POST" && req.body) {
      params = req.body;
    }

    // Support custom cache version (for cache busting)
    if (!params.cacheVersion) {
      params.cacheVersion = CACHE_VERSION;
    }

    // Determine if we should skip cache
    const skipCache = params.skipCache === "true" || params.skipCache === true;
    const useCache = !skipCache;

    if (DEBUG) {
      console.log(`📝 [${requestId}] Request details:`);
      console.log(`   - Method: ${req.method}`);
      console.log(
        `   - Cache: ${useCache ? "Enabled" : "Disabled (skipCache=true)"}`
      );
      console.log(`   - Cache Version: ${params.cacheVersion}`);
      console.log(`   - User IP: ${req.ip}`);
      console.log(`   - User Agent: ${req.get("user-agent")}`);
    } else {
      console.log(`DALL-E function called with ${req.method} params:`, params);
    }

    const result = await processDalleCall(params, useCache);

    if (DEBUG)
      console.log(`✅ [${requestId}] Request completed successfully\n`);

    // Ensure the response format exactly matches the expected output
    const formattedResponse = {
      data: result.data ? result.data.map((item) => ({ url: item.url })) : [],
      created: result.created || Date.now(),
      metadata: {
        model: result.metadata?.model || params.model || "dall-e-3",
        prompt: result.metadata?.prompt || params.prompt || "",
      },
    };

    console.log(formattedResponse);
    res.json(formattedResponse);
  } catch (error) {
    if (DEBUG) {
      console.error(`❌ DALL-E request failed with error:`);
      console.error(`   - Name: ${error.name}`);
      console.error(`   - Message: ${error.message}`);
      console.error(`   - Stack: ${error.stack}`);
    } else {
      console.error("Error processing DALL-E request:", error);
    }

    res.status(500).json({
      error: "Failed to process DALL-E request",
      message: error.message,
    });
  }
});

export default router;
export { processDalleCall };

// Usage example:
// import dalleRouter from './dalleApi.js';
// app.use('/api/dalle', dalleRouter);
