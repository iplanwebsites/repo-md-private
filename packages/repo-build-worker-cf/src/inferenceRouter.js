// src/inferenceRouter.js
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import clipEmbedder from "./lib/clip-embedder.js";
import instructorEmbedder from "./lib/instructor-embedder.js";
import loggerService from "./services/loggerService.js";

const router = express.Router();
const systemLogger = loggerService.getLogger("system");

// Authentication middleware for inference endpoints
function authenticateRequest(req, res, next) {
  const workerSecret = process.env.WORKER_SECRET;

  // If no secret is configured, skip auth (development mode)
  if (!workerSecret) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      status: "error",
      message: "Missing Authorization header",
    });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (token !== workerSecret) {
    return res.status(403).json({
      status: "error",
      message: "Invalid authorization token",
    });
  }

  next();
}

// Apply auth to all inference routes
router.use(authenticateRequest);

// CLIP text embedding endpoint
router.post("/clip-by-text", async (req, res) => {
  const { text } = req.body;
  const startTime = Date.now();
  
  systemLogger.log("🧠 CLIP text embedding request", { textLength: text?.length });

  if (!text) {
    return res.status(400).json({
      status: "error",
      message: "Text is required"
    });
  }

  try {
    const embedding = await clipEmbedder.textEmbedding(text);
    const duration = Date.now() - startTime;
    
    systemLogger.log("✅ CLIP text embedding generated", { 
      textLength: text.length,
      embeddingDimension: embedding.length,
      duration: `${duration}ms`
    });

    res.json({
      status: "success",
      embedding,
      metadata: {
        model: "mobileclip",
        dimension: embedding.length,
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    systemLogger.error("❌ CLIP text embedding error", { error: error.message });
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// CLIP image embedding endpoint
router.post("/clip-by-image", async (req, res) => {
  const { imageUrl, imageData } = req.body;
  const startTime = Date.now();
  
  systemLogger.log("🧠 CLIP image embedding request", { 
    hasUrl: !!imageUrl, 
    hasData: !!imageData 
  });

  if (!imageUrl && !imageData) {
    return res.status(400).json({
      status: "error",
      message: "Either imageUrl or imageData is required"
    });
  }

  try {
    let embedding;
    
    if (imageUrl) {
      embedding = await clipEmbedder.imageEmbeddingByUrl(imageUrl);
    } else if (imageData) {
      // Handle base64 image data by creating a temporary file
      const tempDir = process.env.TEMP_DIR || "/tmp";
      const tempFile = path.join(tempDir, `temp-image-${Date.now()}.jpg`);
      
      try {
        const buffer = Buffer.from(imageData, 'base64');
        await fs.writeFile(tempFile, buffer);
        const fileUrl = `file://${tempFile}`;
        embedding = await clipEmbedder.imageEmbeddingByUrl(fileUrl);
        
        // Clean up temp file
        await fs.unlink(tempFile);
      } catch (fileError) {
        systemLogger.error("❌ Error handling image data", { error: fileError.message });
        throw new Error("Failed to process image data");
      }
    }

    const duration = Date.now() - startTime;
    
    systemLogger.log("✅ CLIP image embedding generated", {
      embeddingDimension: embedding.length,
      duration: `${duration}ms`
    });

    res.json({
      status: "success",
      embedding,
      metadata: {
        model: "mobileclip",
        dimension: embedding.length,
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    systemLogger.error("❌ CLIP image embedding error", { error: error.message });
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// Text embedding endpoint
router.post("/text-embedding", async (req, res) => {
  const { text, instruction = "Represent the document for semantic search:" } = req.body;
  const startTime = Date.now();
  
  systemLogger.log("🧠 Text embedding request", { 
    textLength: text?.length,
    instruction 
  });

  if (!text) {
    return res.status(400).json({
      status: "error",
      message: "Text is required"
    });
  }

  try {
    const embedding = await instructorEmbedder.getEmbedding(instruction, text);
    const duration = Date.now() - startTime;
    
    systemLogger.log("✅ Text embedding generated", {
      textLength: text.length,
      embeddingDimension: embedding.length,
      duration: `${duration}ms`
    });

    res.json({
      status: "success",
      embedding,
      metadata: {
        model: "all-MiniLM-L6-v2",
        dimension: embedding.length,
        duration,
        instruction,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    systemLogger.error("❌ Text embedding error", { error: error.message });
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

export default router;