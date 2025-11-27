// src/worker-lite.js
// CF Containers compatible worker - no native modules
// Features: Express, repo-processor (no media), no SQLite/embeddings

import express from "express";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { RepoProcessor } from "@repo-md/processor";

const app = express();
app.use(express.json({ limit: "50mb" }));

const TEMP_DIR = process.env.TEMP_DIR || "/tmp/repo.md";

// Track active jobs
const activeJobs = new Map();

// Ensure temp directory exists
async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (e) {
    // ignore if exists
  }
}

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    platform: "cloudflare-containers",
    version: "lite",
    uptime: process.uptime(),
    activeJobs: activeJobs.size,
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    }
  });
});

app.get("/test", async (req, res) => {
  const startTime = Date.now();
  const marks = { init: 0 };

  try {
    // Create test job
    const jobId = `test-${Date.now()}`;
    const jobFolder = path.join(TEMP_DIR, jobId);
    const inputFolder = path.join(jobFolder, "input");
    const outputFolder = path.join(jobFolder, "output");

    await ensureTempDir();
    await fs.mkdir(inputFolder, { recursive: true });
    await fs.mkdir(outputFolder, { recursive: true });
    marks["dirs-created"] = Date.now() - startTime;

    // Create sample markdown content
    await fs.writeFile(
      path.join(inputFolder, "hello-world.md"),
      `---
title: Hello World
date: 2024-01-01
tags: [test, demo]
---

# Hello World

This is a **test post** with some markdown.

- Item 1
- Item 2
- Item 3

Check out [[second-post]] for more.
`
    );

    await fs.writeFile(
      path.join(inputFolder, "second-post.md"),
      `---
title: Second Post
date: 2024-01-02
---

# Second Post

This links back to [[hello-world]].

\`\`\`javascript
console.log("Hello from code block");
\`\`\`
`
    );
    marks["content-created"] = Date.now() - startTime;

    // Process with RepoProcessor (skip media!)
    marks["processing-start"] = Date.now() - startTime;

    const processor = new RepoProcessor({
      inputPath: inputFolder,
      buildDir: outputFolder,
      skipMedia: true,  // IMPORTANT: skip media to avoid sharp
      debug: 0
    });

    const result = await processor.process();
    marks["processing-done"] = Date.now() - startTime;

    // List created files
    const files = await fs.readdir(outputFolder);
    marks["list-files"] = Date.now() - startTime;

    // Get sample output
    let samplePost = null;
    try {
      const postsPath = path.join(outputFolder, "posts.json");
      const postsData = await fs.readFile(postsPath, "utf8");
      const posts = JSON.parse(postsData);
      samplePost = posts[0];
    } catch (e) {
      // ignore
    }

    // Cleanup
    await fs.rm(jobFolder, { recursive: true });
    marks["cleanup"] = Date.now() - startTime;

    res.json({
      status: "success",
      message: "Lite worker with RepoProcessor is working!",
      version: "lite-processor",
      timing: {
        total: Date.now() - startTime,
        marks
      },
      result: {
        jobId,
        filesGenerated: files.length,
        files,
        postsProcessed: result.posts?.length || 0,
        samplePost: samplePost ? {
          slug: samplePost.slug,
          title: samplePost.title,
          htmlPreview: samplePost.html?.substring(0, 200) + "..."
        } : null
      },
      env: {
        NODE_ENV: process.env.NODE_ENV,
        SKIP_SQLITE: process.env.SKIP_SQLITE,
        SKIP_EMBEDDINGS: process.env.SKIP_EMBEDDINGS
      },
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
      stack: error.stack
    });
  }
});

// Process endpoint - accepts job data and processes it
app.post("/process", async (req, res) => {
  const startTime = Date.now();
  const { jobId, taskType, data, callbackUrl } = req.body;

  if (!jobId) {
    return res.status(400).json({ status: "error", message: "jobId is required" });
  }

  // Track job
  activeJobs.set(jobId, {
    status: "processing",
    startTime,
    taskType
  });

  try {
    // Create job folder
    const jobFolder = path.join(TEMP_DIR, jobId);
    await ensureTempDir();
    await fs.mkdir(jobFolder, { recursive: true });

    // For now, just acknowledge receipt and simulate work
    const result = {
      jobId,
      taskType,
      status: "completed",
      timing: {
        total: Date.now() - startTime
      },
      message: "Job processed (lite mode - no actual processing yet)",
      note: "This lite worker is for testing CF Containers. Full processing needs repo-processor."
    };

    // Update job status
    activeJobs.set(jobId, {
      status: "completed",
      startTime,
      endTime: Date.now(),
      result
    });

    // Cleanup job folder
    await fs.rm(jobFolder, { recursive: true }).catch(() => {});

    // If callback URL provided, send result
    if (callbackUrl) {
      try {
        await fetch(callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result)
        });
      } catch (e) {
        console.error("Callback failed:", e.message);
      }
    }

    res.json(result);
  } catch (error) {
    activeJobs.set(jobId, {
      status: "failed",
      startTime,
      endTime: Date.now(),
      error: error.message
    });

    res.status(500).json({
      status: "error",
      jobId,
      message: error.message
    });
  }
});

// Get job status
app.get("/jobs/:jobId", (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ status: "error", message: "Job not found" });
  }
  res.json(job);
});

// List active jobs
app.get("/jobs", (req, res) => {
  const jobs = Array.from(activeJobs.entries()).map(([id, job]) => ({
    jobId: id,
    ...job
  }));
  res.json({ jobs, count: jobs.length });
});

// System info
app.get("/system", (req, res) => {
  res.json({
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    uptime: process.uptime(),
    memory: {
      free: os.freemem(),
      total: os.totalmem(),
      process: process.memoryUsage()
    },
    cpus: os.cpus().length,
    loadavg: os.loadavg()
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Lite worker listening on 0.0.0.0:${PORT}`);
  console.log(`📊 Memory: ${JSON.stringify(process.memoryUsage())}`);
  console.log(`🔧 Features: SKIP_SQLITE=${process.env.SKIP_SQLITE}, SKIP_EMBEDDINGS=${process.env.SKIP_EMBEDDINGS}`);
});

// Keep-alive logging
setInterval(() => {
  console.log(`[keepalive] uptime=${process.uptime().toFixed(0)}s mem=${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB jobs=${activeJobs.size}`);
}, 10000);
