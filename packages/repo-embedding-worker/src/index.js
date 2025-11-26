/**
 * Cloudflare Containers Embedding Worker
 *
 * A lightweight HTTP server that exposes embedding endpoints using
 * Transformer.js models pre-loaded in the Docker image.
 *
 * Endpoints:
 * - GET  /health           - Health check
 * - POST /embed/text       - Text embedding (CLIP)
 * - POST /embed/image      - Image embedding (CLIP)
 * - POST /embed/sentence   - Sentence embedding (MiniLM)
 * - POST /similarity       - Calculate cosine similarity
 */

import { createServer } from "node:http";
import { clipEmbedder } from "./clip-embedder.js";
import { sentenceEmbedder } from "./sentence-embedder.js";

const PORT = process.env.PORT || 8787;

// Simple JSON body parser
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

// Calculate cosine similarity
function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error("Embedding dimensions must match");
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Request handler
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // Health check
    if (path === "/health" && method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        models: {
          clip: clipEmbedder.isInitialized(),
          sentence: sentenceEmbedder.isInitialized(),
        },
      }));
      return;
    }

    // Ready check (models loaded)
    if (path === "/ready" && method === "GET") {
      const clipReady = clipEmbedder.isInitialized();
      const sentenceReady = sentenceEmbedder.isInitialized();
      const allReady = clipReady && sentenceReady;

      res.writeHead(allReady ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ready: allReady,
        models: { clip: clipReady, sentence: sentenceReady },
      }));
      return;
    }

    // Initialize models on first request (lazy load)
    if (path === "/init" && method === "POST") {
      const startTime = Date.now();
      await Promise.all([
        clipEmbedder.initialize(),
        sentenceEmbedder.initialize(),
      ]);
      const duration = Date.now() - startTime;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        initTimeMs: duration,
      }));
      return;
    }

    // Text embedding (CLIP)
    if (path === "/embed/text" && method === "POST") {
      const body = await parseJsonBody(req);
      if (!body.text) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing 'text' field" }));
        return;
      }

      const startTime = Date.now();
      const embedding = await clipEmbedder.textEmbedding(body.text);
      const duration = Date.now() - startTime;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        embedding,
        dimensions: embedding.length,
        durationMs: duration,
        model: "mobileclip_s0",
      }));
      return;
    }

    // Image embedding (CLIP)
    if (path === "/embed/image" && method === "POST") {
      const body = await parseJsonBody(req);
      if (!body.url && !body.base64) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing 'url' or 'base64' field" }));
        return;
      }

      const startTime = Date.now();
      let embedding;

      if (body.url) {
        embedding = await clipEmbedder.imageEmbeddingByUrl(body.url);
      } else {
        embedding = await clipEmbedder.imageEmbeddingFromBase64(body.base64);
      }

      const duration = Date.now() - startTime;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        embedding,
        dimensions: embedding.length,
        durationMs: duration,
        model: "mobileclip_s0",
      }));
      return;
    }

    // Sentence embedding (MiniLM)
    if (path === "/embed/sentence" && method === "POST") {
      const body = await parseJsonBody(req);
      if (!body.text) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing 'text' field" }));
        return;
      }

      const startTime = Date.now();
      const instruction = body.instruction || "Represent the sentence:";
      const embedding = await sentenceEmbedder.getEmbedding(instruction, body.text);
      const duration = Date.now() - startTime;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        embedding,
        dimensions: embedding.length,
        durationMs: duration,
        model: "all-MiniLM-L6-v2",
      }));
      return;
    }

    // Batch sentence embeddings
    if (path === "/embed/sentence/batch" && method === "POST") {
      const body = await parseJsonBody(req);
      if (!body.texts || !Array.isArray(body.texts)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing 'texts' array" }));
        return;
      }

      const startTime = Date.now();
      const instruction = body.instruction || "Represent the sentence:";
      const pairs = body.texts.map(text => [instruction, text]);
      const embeddings = await sentenceEmbedder.batchGetEmbeddings(pairs);
      const duration = Date.now() - startTime;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        embeddings,
        count: embeddings.length,
        dimensions: embeddings[0]?.length || 0,
        durationMs: duration,
        model: "all-MiniLM-L6-v2",
      }));
      return;
    }

    // Cosine similarity
    if (path === "/similarity" && method === "POST") {
      const body = await parseJsonBody(req);
      if (!body.a || !body.b) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing 'a' or 'b' embeddings" }));
        return;
      }

      const similarity = cosineSimilarity(body.a, body.b);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ similarity }));
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));

  } catch (error) {
    console.error("Request error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// Start server
const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Embedding worker running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  // Pre-initialize models in background if PRELOAD_MODELS is set
  if (process.env.PRELOAD_MODELS === "true") {
    console.log("Pre-loading models...");
    Promise.all([
      clipEmbedder.initialize(),
      sentenceEmbedder.initialize(),
    ]).then(() => {
      console.log("Models pre-loaded successfully");
    }).catch((err) => {
      console.error("Failed to pre-load models:", err);
    });
  }
});
