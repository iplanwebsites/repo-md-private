// src/worker.js
// SKIP_SQLITE=true - Disable SQLite features (required for CF Containers - better-sqlite3 native module doesn't work)
const SKIP_SQLITE = process.env.SKIP_SQLITE === 'true';

import express from "express";
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import loggerService from "./services/loggerService.js";

import WpImporter from "./lib/wpImporter.js";

// Skip inference router if embeddings are disabled (for CF Containers)
let inferenceRouter = null;
if (process.env.SKIP_EMBEDDINGS !== 'true') {
  inferenceRouter = (await import('./inferenceRouter.js')).default;
}

// Import services
import buildAssets from "./process/buildAssets.js";
import buildSqliteDatabase from "./process/buildSqliteDatabase.js";
import enrichData from "./process/enrichData.js";
import acquireUserRepo from "./process/acquireUserRepo.js";
import newRepoFromTemplate from "./process/newRepoFromTemplate.js";
import deployRepo from "./process/deployRepo.js";
import publishBuildFiles from "./process/publishBuildFilesAsIs.js";
import publishR2 from "./process/publishR2.js";
import wpImport from "./process/wpImport.js";
import generateProjectFromBrief from "./process/generateProjectFromBrief.js";
import fetchExistingAssets from "./process/fetchExistingAssets.js";
import scanFrontmatterSchema from "./process/scanFrontmatterSchema.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

// Mount inference router (only if embeddings enabled)
if (inferenceRouter) {
  app.use("/inference", inferenceRouter);
}

// System logger for non-job related logging
const systemLogger = loggerService.getLogger("system");

// Cleanup utility function
async function cleanupTempFolder(tempFolderPath, jobId, logger) {
  // Skip cleanup if KEEP_TMP_FILES environment variable is set to true
  if (process.env.KEEP_TMP_FILES === "true") {
    logger.log("🔒 Skipping temp folder cleanup (KEEP_TMP_FILES=true)", {
      jobId,
      tempFolderPath,
    });
    return;
  }

  // Skip cleanup if PURGE_TMP_DIR is explicitly set to false
  if (process.env.PURGE_TMP_DIR === "false") {
    logger.log("🔒 Skipping temp folder cleanup (PURGE_TMP_DIR=false)", {
      jobId,
      tempFolderPath,
    });
    return;
  }

  if (!tempFolderPath) {
    logger.log("⚠️ No temp folder path provided for cleanup", { jobId });
    return;
  }

  try {
    logger.log("🧹 Cleaning up temp folder", { jobId, tempFolderPath });
    await fs.rm(tempFolderPath, { recursive: true, force: true });
    logger.log("✅ Temp folder cleaned up successfully", {
      jobId,
      tempFolderPath,
    });
  } catch (error) {
    logger.error("❌ Error cleaning up temp folder", {
      jobId,
      tempFolderPath,
      error: error.message,
    });
  }
}

// Health check endpoint

app.get("/", (req, res) => {
  systemLogger.log("Health check");
  res.json({ status: "healthy", msg: "This is a build worker for repo.md" });
});

app.get("/health", (req, res) => {
  systemLogger.log("Health check");
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Self-contained test endpoint - runs a build pipeline test and returns timing metrics
app.get("/test", async (req, res) => {
  systemLogger.log("🧪 Running self-contained build test");

  const timing = {
    testStart: Date.now(),
    marks: {}
  };

  const mark = (label) => {
    timing.marks[label] = Date.now() - timing.testStart;
  };

  try {
    mark('init');

    // Create temp directory
    const tempDir = path.join(process.env.TEMP_DIR || '/tmp', `repo-test-${Date.now()}`);
    const sourceDir = path.join(tempDir, 'source');
    const distDir = path.join(tempDir, 'dist');

    await fs.mkdir(path.join(sourceDir, 'posts'), { recursive: true });
    await fs.mkdir(distDir, { recursive: true });
    mark('dirs-created');

    // Create test markdown files
    await fs.writeFile(path.join(sourceDir, 'posts', 'test-post-1.md'), `---
title: Test Post One
date: 2024-01-15
tags: [test, cloudflare]
draft: false
---

# Test Post One

This is a **test post** for the CF container build pipeline.

## Features
- Markdown processing
- Frontmatter parsing
- Wiki links like [[test-post-2]]
`);

    await fs.writeFile(path.join(sourceDir, 'posts', 'test-post-2.md'), `---
title: Test Post Two
date: 2024-01-16
category: testing
---

# Test Post Two

Second test post with a link back to [[test-post-1|the first post]].
`);
    mark('content-created');

    // Run build pipeline
    const testData = {
      jobId: `test-${Date.now()}`,
      tempDir,
      repoInfo: { path: sourceDir, distPath: distDir },
      assets: { distFolder: distDir },
      config: {
        embeddings: false,  // Skip for faster test
        mediaOptimization: false
      }
    };

    mark('build-start');
    const result = await buildAssets(testData);
    mark('build-complete');

    // Check results
    const files = await fs.readdir(distDir);
    mark('results-checked');

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    mark('cleanup');

    const totalDuration = Date.now() - timing.testStart;

    systemLogger.log(`✅ Test completed in ${totalDuration}ms`);

    res.json({
      status: 'success',
      message: 'Build pipeline test completed',
      timing: {
        total: totalDuration,
        marks: timing.marks,
        breakdown: {
          setup: timing.marks['content-created'] - timing.marks['init'],
          build: timing.marks['build-complete'] - timing.marks['build-start'],
          cleanup: timing.marks['cleanup'] - timing.marks['results-checked']
        }
      },
      result: {
        jobId: result.jobId,
        filesGenerated: files.length,
        files: files
      }
    });

  } catch (error) {
    const totalDuration = Date.now() - timing.testStart;
    systemLogger.error('❌ Test failed:', error.message);

    res.status(500).json({
      status: 'error',
      message: error.message,
      timing: {
        total: totalDuration,
        marks: timing.marks
      }
    });
  }
});

// Full integration test endpoint - clones a sample repo and processes it
app.get("/test/full", async (req, res) => {
  systemLogger.log("🧪 Running full integration test");

  const timing = {
    testStart: Date.now(),
    marks: {}
  };

  const mark = (label) => {
    timing.marks[label] = Date.now() - timing.testStart;
  };

  // Use query params or default test repo
  const repoUrl = req.query.repo || 'https://github.com/repo-md/sample-blog';
  const skipR2 = req.query.skipR2 !== 'false';  // Skip R2 upload by default for tests

  try {
    mark('init');

    const jobId = `fulltest-${Date.now()}`;
    const tempDir = path.join(process.env.TEMP_DIR || '/tmp', jobId);

    // Clone repo
    mark('clone-start');
    const cloneResult = await acquireUserRepo({
      jobId,
      tempDir,
      repoUrl,
      gitToken: process.env.GITHUB_TOKEN
    });
    mark('clone-complete');

    // Build assets
    mark('build-start');
    const buildResult = await buildAssets({
      ...cloneResult,
      config: {
        embeddings: process.env.SKIP_EMBEDDINGS !== 'true',
        mediaOptimization: true
      }
    });
    mark('build-complete');

    // Enrich data
    mark('enrich-start');
    const enrichResult = await enrichData(buildResult);
    mark('enrich-complete');

    // List output files
    const distPath = enrichResult.assets?.distFolder || path.join(tempDir, 'dist');
    let files = [];
    try {
      files = await fs.readdir(distPath);
    } catch (e) {
      // dist folder might not exist
    }
    mark('results-checked');

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    mark('cleanup');

    const totalDuration = Date.now() - timing.testStart;

    systemLogger.log(`✅ Full test completed in ${totalDuration}ms`);

    res.json({
      status: 'success',
      message: 'Full integration test completed',
      repoUrl,
      timing: {
        total: totalDuration,
        marks: timing.marks,
        breakdown: {
          clone: timing.marks['clone-complete'] - timing.marks['clone-start'],
          build: timing.marks['build-complete'] - timing.marks['build-start'],
          enrich: timing.marks['enrich-complete'] - timing.marks['enrich-start'],
          cleanup: timing.marks['cleanup'] - timing.marks['results-checked']
        }
      },
      result: {
        jobId,
        filesGenerated: files.length,
        files: files.slice(0, 20)  // Limit to first 20 files
      }
    });

  } catch (error) {
    const totalDuration = Date.now() - timing.testStart;
    systemLogger.error('❌ Full test failed:', error.message);

    res.status(500).json({
      status: 'error',
      message: error.message,
      timing: {
        total: totalDuration,
        marks: timing.marks
      }
    });
  }
});

// Authentication middleware for /process endpoint
function authenticateRequest(req, res, next) {
  const workerSecret = process.env.WORKER_SECRET;

  // If no secret is configured, skip auth (development mode)
  if (!workerSecret) {
    systemLogger.log("Warning: WORKER_SECRET not configured, skipping auth");
    return next();
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      status: "error",
      message: "Missing Authorization header",
    });
  }

  // Support both "Bearer <token>" and raw token
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (token !== workerSecret) {
    systemLogger.log("Auth failed: invalid token");
    return res.status(403).json({
      status: "error",
      message: "Invalid authorization token",
    });
  }

  next();
}

app.post("/process", authenticateRequest, async (req, res) => {
  const { jobId, task, data, callbackUrl } = req.body;

  // Get a logger for this job
  const jobLogger = loggerService.getLogger(jobId);

  jobLogger.log("📥 Received job", { jobId, task });

  // Validate required fields
  if (!jobId || !task || !callbackUrl) {
    jobLogger.error("❌ Missing required fields", { jobId, task, callbackUrl });
    return res.status(400).json({
      status: "error",
      message:
        "Missing required fields: jobId, task, and callbackUrl are required",
    });
  }

  // Acknowledge immediately
  jobLogger.log("✅ Job accepted", { jobId });
  jobLogger.log("✅ task, ", jobId);

  // Define sensitive properties that should be anonymized in logs
  const sensitiveProps = [
    "gitToken",
    "accessToken",
    "secretKey",
    "password",
    "apiKey",
    "key",
    "token",
    "auth",
  ];

  // Create anonymized data by replacing sensitive properties with masked values
  const anonymizedData = JSON.parse(JSON.stringify(data));

  // Function to anonymize sensitive strings
  const anonymizeValue = (value) => {
    if (typeof value !== "string" || value.length < 8) {
      return "********";
    }
    // Show only first 3 and last 3 characters
    const firstThree = value.substring(0, 3);
    const lastThree = value.substring(value.length - 3);
    return `${firstThree}****${lastThree}`;
  };

  // Recursively search for sensitive properties and anonymize them
  const anonymizeObject = (obj) => {
    if (!obj || typeof obj !== "object") return;

    Object.keys(obj).forEach((key) => {
      // Check if this is a sensitive property
      if (
        sensitiveProps.some((prop) =>
          key.toLowerCase().includes(prop.toLowerCase())
        )
      ) {
        obj[key] = anonymizeValue(obj[key]);
      } else if (typeof obj[key] === "object") {
        // Recursively process nested objects
        anonymizeObject(obj[key]);
      }
    });
  };

  anonymizeObject(anonymizedData);

  jobLogger.log("✅ RECEIVED SPECS:", anonymizedData);

  res.json({ status: "accepted", jobId });

  // Process asynchronously
  processJob(jobId, task, data || {}, callbackUrl, jobLogger);
});

async function processJob(jobId, task, data, callbackUrl, logger) {
  logger.log("🚀 Starting job processing", { jobId, task });

  try {
    // Your job processing logic here
    const startTime = Date.now();
    // Pass the logger in the data object so child processes can access it
    const result = await doWork(
      task,
      {
        ...data,
        jobId,
        logger, // Pass logger to child processes
      },
      logger
    );
    const duration = Date.now() - startTime;

    logger.log("✨ Job completed successfully", {
      jobId,
      task,
      duration: `${duration}ms`,
    });

    // Callback to your existing API using fetch (exact same structure as before)
    try {
      await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          status: "completed",
          result,
          processedAt: new Date().toISOString(),
          duration,
          logs: logger.getLogs(), // Get logs for this specific job
        }),
      });

      logger.log("📤 Result sent to callback URL", { jobId, callbackUrl });

      // Clean up temp folder and job logger after successful callback
      // Use tempFolderPath from result if available, otherwise fall back to data.tempFolderPath
      const tempPath = result?.tempFolderPath || data.tempFolderPath;
      await cleanupTempFolder(tempPath, jobId, logger);
      loggerService.removeLogger(jobId);
    } catch (callbackError) {
      logger.error("🔴 CANNOT REACH BACK TO SERVER", {
        jobId,
        callbackUrl,
        error: callbackError.message,
      });
    }
  } catch (error) {
    logger.error("💥 Job processing failed", {
      jobId,
      task,
      error: error.message,
    });

    try {
      await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          status: "failed",
          error: error.message,
          processedAt: new Date().toISOString(),
          logs: logger.getLogs(), // Get logs for this specific job
        }),
      });

      logger.log("📤 Error sent to callback URL", { jobId, callbackUrl });

      // Clean up temp folder and job logger after error callback
      await cleanupTempFolder(data.tempFolderPath, jobId, logger);
      loggerService.removeLogger(jobId);
    } catch (callbackError) {
      logger.error("🔴 CANNOT REACH BACK TO SERVER", {
        jobId,
        callbackUrl,
        error: callbackError.message,
      });
    }
  }
}

async function doWork(task, data, logger) {
  logger.log("🔧 Processing task", { task, jobId: data.jobId });

  // Implement task router
  switch (task) {
    case "process-all":
      logger.log("🔄 Running full processing pipeline", { jobId: data.jobId });
      // Run all processing steps in sequence
      const dataWithAssets = await fetchExistingAssets(data);
      const assetsResult = await buildAssets(dataWithAssets); // Now includes embedding, Vectra, and SQLite generation
      return await enrichData(assetsResult);

    case "build-assets":
      const buildDataWithAssets = await fetchExistingAssets(data);
      return await buildAssets(buildDataWithAssets);

    case "build-database":
      return await buildSqliteDatabase(data);

    // case "create-vectra":
    //   return await createVectraIndex(data);

    //   case "compute-embeddings":
    //   return await computeEmbeddings(data);

    case "enrich-data":
      return await enrichData(data);

    case "acquire-user-repo":
      return await acquireUserRepo(data);

    case "new-repo-from-template":
      return await newRepoFromTemplate(data);

    case "process-with-repo":
      logger.log("🔄 Processing with repo acquisition", { jobId: data.jobId });
      // First acquire repo, then process
      const repoResult = await acquireUserRepo(data);
      const repoWithAssets = await fetchExistingAssets(repoResult);
      const processedAssets = await buildAssets(repoWithAssets); // Now includes embedding, Vectra, and SQLite generation
      return await enrichData(processedAssets);

    case "process-from-template":
      logger.log("🔄 Processing from template repo", { jobId: data.jobId });
      // Create repo from template, then process
      const templateResult = await newRepoFromTemplate(data);
      const templateWithAssets = await fetchExistingAssets(templateResult);
      const templateAssets = await buildAssets(templateWithAssets); // Now includes embedding, Vectra, and SQLite generation
      return await enrichData(templateAssets);

    case "wp-import":
      logger.log("🔄 Processing WordPress import", { jobId: data.jobId });

      // Save the WordPress XML data to a file if provided
      if (data.wpXml) {
        try {
          // Create upload directory if it doesn't exist
          const uploadDir = path.join(
            process.env.TEMP_DIR || "/tmp",
            "repo.md/uploads"
          );
          await fs.mkdir(uploadDir, { recursive: true });

          // Create a unique file name for the XML data
          const xmlFileName = `wp-export-${data.jobId}-${Date.now()}.xml`;
          const xmlFilePath = path.join(uploadDir, xmlFileName);

          // Save the XML data to a file (assuming it's Base64 encoded)
          const xmlBuffer = Buffer.from(data.wpXml, "base64");
          await fs.writeFile(xmlFilePath, xmlBuffer);

          logger.log(`✅ WordPress export saved to file: ${xmlFilePath}`);

          // Add the file path to the data object
          data.xmlFilePath = xmlFilePath;
        } catch (error) {
          logger.error(
            `❌ Failed to save WordPress XML data: ${error.message}`
          );
          throw new Error(
            `Failed to save WordPress XML data: ${error.message}`
          );
        }
      }

      // Process WordPress import, create repo, then deploy
      const wpImportResult = await wpImport(data);

      // Run the deploy pipeline with the new repository
      const wpDeployResult = await deployRepo({
        ...data,
        repoUrl: wpImportResult.repoInfo.clone_url,
      });
      const wpWithAssets = await fetchExistingAssets(wpDeployResult);
      const wpAssets = await buildAssets(wpWithAssets); // Now includes embedding, Vectra, and SQLite generation
      const wpEnriched = await enrichData(wpAssets);
      const wpPublishResult = await publishR2(wpEnriched);
      return {
        ...wpPublishResult,
        wpImport: wpImportResult.wpImportInfo,
      };

    case "deploy-repo":
      logger.log("🚀 Deploying repository", { jobId: data.jobId });
      // Deploy repo directly and build assets
      const deployResult = await deployRepo(data);
      // Fetch existing assets for optimization
      const deployWithAssets = await fetchExistingAssets(deployResult);
      const deployAssets = await buildAssets(deployWithAssets); // Now includes embedding, Vectra, and SQLite generation
      const enrichedData = await enrichData(deployAssets);
      // Publish build files to R2 storage
      //  return await publishBuildFiles(enrichedData);
      const publishResult = await publishR2(enrichedData);
      return publishResult;

    case "publish-build-files":
      logger.log("📤 Publishing build files to R2", { jobId: data.jobId });
      // Only publish build files (useful for re-publishing or publishing from existing build)
      return await publishBuildFiles(data);

    case "publish-r2":
      logger.log("📤 Publishing repository files to R2", {
        jobId: data.jobId,
      });
      // Publish repository files to R2 with media separation
      return await publishR2(data);

    case "generate-project-from-brief":
      logger.log("🎨 Generating project from brief", { jobId: data.jobId });
      // Generate project files from brief, optionally create GitHub repo
      return await generateProjectFromBrief(data);

    case "generate-and-deploy-project":
      logger.log("🚀 Generating and deploying project from brief", {
        jobId: data.jobId,
      });
      // Generate project, create repo, then run full deployment pipeline
      const generatedProject = await generateProjectFromBrief(data);
      const generatedWithAssets = await fetchExistingAssets(generatedProject);
      const deployedAssets = await buildAssets(generatedWithAssets);
      const enrichedProject = await enrichData(deployedAssets);
      return await publishR2(enrichedProject);

    default:
      throw new Error(`Unknown task type: ${task}`);
  }
}

// Node.js version compatibility check for better-sqlite3
async function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

  systemLogger.log(`🔍 Node.js version: ${nodeVersion} (module version: ${process.versions.modules})`);

  // Skip SQLite check if SKIP_SQLITE is set (for CF Containers)
  if (SKIP_SQLITE) {
    systemLogger.log(`⚠️  SKIP_SQLITE=true - Skipping better-sqlite3 check (SQLite features disabled)`);
    return;
  }

  try {
    // Try to actually instantiate better-sqlite3 to verify compatibility
    // (import alone doesn't trigger the native module load)
    const Database = (await import('better-sqlite3')).default;
    const testDb = new Database(':memory:');
    testDb.close();
    systemLogger.log(`✅ better-sqlite3 loaded and tested successfully`);
  } catch (error) {
    if (error.message.includes('NODE_MODULE_VERSION')) {
      const compiledVersion = error.message.match(/NODE_MODULE_VERSION (\d+)/)?.[1];
      systemLogger.error(`\n❌ ❌ ❌ better-sqlite3 COMPATIBILITY ERROR ❌ ❌ ❌`);
      systemLogger.error(`Current Node.js: ${nodeVersion} (module version ${process.versions.modules})`);
      if (compiledVersion) {
        systemLogger.error(`Module compiled for: NODE_MODULE_VERSION ${compiledVersion}`);
      }
      systemLogger.error(`\n💡 QUICK FIX: Run 'npm rebuild better-sqlite3'`);
      systemLogger.error(`💡 Alternative: Run 'npm install'\n`);

      // Don't exit in development to allow fixing
      if (process.env.NODE_ENV === 'production') {
        systemLogger.error(`⛔ Exiting in production mode`);
        process.exit(1);
      } else {
        systemLogger.error(`⚠️  Server will continue but jobs WILL FAIL until fixed!\n`);
      }
    } else {
      throw error;
    }
  }
}

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, async () => {
  systemLogger.log(`🌐 Worker service listening on port ${PORT}`);
  await checkNodeVersion();
});

// Handle process termination gracefully
process.on("SIGINT", () => {
  systemLogger.log("⏹️ Received SIGINT, shutting down gracefully...");
  server.close(() => {
    systemLogger.log("🛑 Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  systemLogger.log("⏹️ Received SIGTERM, shutting down gracefully...");
  server.close(() => {
    systemLogger.log("🛑 Server closed");
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  systemLogger.error("💥 Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  systemLogger.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Keep the process alive
//setInterval(() => {}, 1 << 30);
