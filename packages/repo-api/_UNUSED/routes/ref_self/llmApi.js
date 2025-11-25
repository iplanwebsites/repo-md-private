import express from "express";
import { llm, getAiModelConfig } from "../../lib/chat/openaiClient.js";
import { db } from "../../db.js";
import crypto from "crypto";

const router = express.Router();
const CACHE_EXPIRY_DAYS = 60; // Default cache expiry in days
const DEBUG = true; // Enable detailed logging with emojis
const CACHE_VERSION = "20250403b"; // Current date as cache version

// Add JSON body parser middleware specifically for this router
router.use(express.json());

/**
 * Create a cache key from LLM parameters
 * @param {Object} params - Parameters to create key from
 * @returns {String} - Hash-based cache key
 */
const createCacheKey = (params) => {
  // Extract the fields we want to use for caching
  const {
    prompt = "",
    msg = "",
    options = {},
    cacheVersion = CACHE_VERSION,
  } = params;
  const cacheObj = { prompt, msg, options, cacheVersion };

  // Serialize object and create a hash
  const serialized = JSON.stringify(cacheObj);
  return crypto
    .createHash("md5")
    .update(serialized)
    .digest("hex")
    .substring(0, 64); //minimal collision risks
};

/**
 * Process LLM API calls from both GET and POST requests with caching
 * @param {Object} params - Combined parameters from query or body
 * @param {Boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<Object>} - The LLM response
 */
const processLlmCall = async (params = {}, useCache = true) => {
  const startTime = Date.now();

  // Ensure params is an object and not null
  if (!params || typeof params !== "object") {
    params = {};
  }

  // Extract with defaults
  const {
    prompt = "",
    msg = "Hello, how can I help you?",
    options = {},
  } = params;

  if (DEBUG) {
    console.log(
      `🔍 LLM Request - Message: "${msg.substring(0, 50)}${
        msg.length > 50 ? "..." : ""
      }"`
    );
    console.log(
      `🧠 System Prompt: "${prompt.substring(0, 50)}${
        prompt.length > 50 ? "..." : ""
      }"`
    );
    console.log(`🛠️  Options: ${JSON.stringify(options)}`);
    console.log(`💾 Cache ${useCache ? "enabled" : "disabled"}`);
  }

  // Check cache if enabled
  if (useCache && db.llmApiCache) {
    const cacheKey = createCacheKey(params);
    if (DEBUG) console.log(`🔑 Cache key: ${cacheKey}`);

    const cachedResult = await db.llmApiCache.findOne({ cacheKey });

    if (cachedResult && cachedResult.response) {
      const age = Math.round(
        (Date.now() - new Date(cachedResult.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (DEBUG) {
        console.log(`✅ CACHE HIT! Found response from ${age} days ago`);
        console.log(`⏱️  Cache lookup took ${Date.now() - startTime}ms`);
      } else {
        console.log("Cache hit for LLM request");
      }

      return cachedResult.response;
    } else if (DEBUG) {
      console.log(`❌ CACHE MISS! No cached response found`);
    }
  }

  // Safely parse options if it's a string
  let parsedOptions = {};
  try {
    parsedOptions = typeof options === "string" ? JSON.parse(options) : options;
  } catch (error) {
    console.warn("Failed to parse options string:", error.message);
    parsedOptions = {};
  }

  // Ensure parsedOptions is an object
  if (!parsedOptions || typeof parsedOptions !== "object") {
    parsedOptions = {};
  }

  // Construct messages array with validation
  const messages = [];

  // Add system prompt if provided and non-empty
  if (prompt && typeof prompt === "string" && prompt.trim()) {
    messages.push({
      role: "system",
      content: prompt.trim(),
    });
  }

  // Add user message with validation
  if (msg && typeof msg === "string") {
    messages.push({
      role: "user",
      content: msg.trim() || "Hello",
    });
  } else {
    // Ensure we always have at least one message
    messages.push({
      role: "user",
      content: "Hello",
    });
  }

  // Make request to OpenAI with safe defaults
  if (DEBUG) console.log(`🚀 Sending request to OpenAI API...`);
  const apiStartTime = Date.now();

  const response = await llm.chat.completions.create({
    ...getAiModelConfig("llmApi"),
    //todo: sipport custom model param
    messages,
  });

  const apiDuration = Date.now() - apiStartTime;
  if (DEBUG) console.log(`⚡ API call completed in ${apiDuration}ms`);

  // Format the response
  const formattedResponse = {
    output: response.choices[0].message.content,
    metadata: {
      // model: modelName,
      usage: response.usage,
      requestId: response._requestid,
    },
  };

  // Save to cache if enabled
  if (useCache && db.llmApiCache) {
    if (DEBUG) console.log(`💾 Saving response to cache...`);
    const cacheKey = createCacheKey(params);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + CACHE_EXPIRY_DAYS);

    const cacheStartTime = Date.now();
    await db.llmApiCache.updateOne(
      { cacheKey },
      {
        $set: {
          cacheKey,
          response: formattedResponse,
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
      console.log(
        `🔍 Response first 50 chars: "${formattedResponse.output.substring(
          0,
          50
        )}${formattedResponse.output.length > 50 ? "..." : ""}"`
      );
      console.log(
        `📊 Tokens: ${response.usage.total_tokens} (${response.usage.prompt_tokens} prompt, ${response.usage.completion_tokens} completion)`
      );
      console.log(`⏱️  Total processing time: ${Date.now() - startTime}ms`);
    }
  }

  return formattedResponse;
};

// Handle both GET and POST requests
router.all("/llm", async (req, res) => {
  try {
    const requestId = Math.random().toString(36).substring(2, 10);
    if (DEBUG)
      console.log(
        `\n🔄 [${requestId}] New LLM request (${
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
      console.log(`LLM function called with ${req.method} params:`, params);
    }

    const result = await processLlmCall(params, useCache);

    if (DEBUG)
      console.log(`✅ [${requestId}] Request completed successfully\n`);
    res.json(result);
  } catch (error) {
    if (DEBUG) {
      console.error(`❌ LLM request failed with error:`);
      console.error(`   - Name: ${error.name}`);
      console.error(`   - Message: ${error.message}`);
      console.error(`   - Stack: ${error.stack}`);
    } else {
      console.error("Error processing LLM request:", error);
    }

    res.status(500).json({
      error: "Failed to process LLM request",
      message: error.message,
    });
  }
});

export default router;
export { processLlmCall };

// Usage example:
// import llmRouter from './llmApi.js';
// app.use('/api/llm', llmRouter);
