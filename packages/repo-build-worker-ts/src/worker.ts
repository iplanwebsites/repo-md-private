/**
 * Worker Entry Point
 *
 * Modern TypeScript worker using plugin-based architecture.
 * Supports legacy /process endpoint for API compatibility.
 */

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';

// Global error handlers for async operations
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
});
import { rm } from 'node:fs/promises';
import { buildAssets } from './process/buildAssets.js';
// @ts-ignore - JS module
import deployRepo from './process/deployRepo.js';
// @ts-ignore - JS module
import publishR2 from './process/publishR2.js';
import type { JobData, Logger } from './types/job.js';

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT ?? 5522;
const HOST = process.env.HOST ?? '0.0.0.0';

// ============================================================================
// Logger Factory
// ============================================================================

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
}

const createLogger = (jobId: string): Logger & { getLogs: () => LogEntry[] } => {
  const logs: LogEntry[] = [];

  const addLog = (level: string, message: string, context?: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
    logs.push(entry);

    // Also log to console
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logFn(`[${jobId}] ${level.toUpperCase()}: ${message}`, context ?? '');
  };

  return {
    log: (message, context) => addLog('info', message, context),
    warn: (message, context) => addLog('warn', message, context),
    error: (message, context) => addLog('error', message, context),
    getLogs: () => logs,
  };
};

// ============================================================================
// Task Router
// ============================================================================

type TaskType = 'deploy-repo' | 'process-all' | 'build-assets';

interface TaskData {
  jobId: string;
  logger: Logger & { getLogs: () => LogEntry[] };
  [key: string]: unknown;
}

async function doWork(task: TaskType, data: TaskData, logger: Logger): Promise<Record<string, unknown>> {
  logger.log(`Processing task: ${task}`, { jobId: data.jobId });

  switch (task) {
    case 'deploy-repo': {
      logger.log('Deploying repository...', { jobId: data.jobId });
      // 1. Clone repo (JS module - use any)
      const deployResult = await (deployRepo as any)(data);
      // 2. Build assets using processor-core plugin system
      const assetsResult = await buildAssets(deployResult as JobData);
      // 3. Publish to R2 - merge original data with assets result for projectId, orgId
      const publishInput = {
        ...data,
        ...assetsResult,
      };
      const publishResult = await (publishR2 as any)(publishInput);
      return publishResult as Record<string, unknown>;
    }

    case 'process-all': {
      logger.log('Running full processing pipeline...', { jobId: data.jobId });
      // Build assets using processor-core plugin system
      const assetsResult = await buildAssets(data as unknown as JobData);
      // Publish to R2 - merge original data with assets result
      const publishInput = {
        ...data,
        ...assetsResult,
      };
      const publishResult = await (publishR2 as any)(publishInput);
      return publishResult as Record<string, unknown>;
    }

    case 'build-assets': {
      logger.log('Building assets only...', { jobId: data.jobId });
      const result = await buildAssets(data as unknown as JobData);
      return result as unknown as Record<string, unknown>;
    }

    default:
      throw new Error(`Unknown task type: ${task}`);
  }
}

// ============================================================================
// Cleanup Utility
// ============================================================================

async function cleanupTempFolder(
  tempPath: string | undefined,
  jobId: string,
  logger: Logger
): Promise<void> {
  if (!tempPath) {
    return;
  }

  try {
    logger.log(`Cleaning up temp folder: ${tempPath}`, { jobId });
    await rm(tempPath, { recursive: true, force: true });
    logger.log('Temp folder cleaned up successfully', { jobId });
  } catch (error) {
    logger.warn(`Failed to cleanup temp folder: ${tempPath}`, {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Process Job (Async with Callback)
// ============================================================================

async function processJob(
  jobId: string,
  task: TaskType,
  data: Record<string, unknown>,
  callbackUrl: string,
  logger: Logger & { getLogs: () => LogEntry[] }
): Promise<void> {
  logger.log('Starting job processing', { jobId, task });

  try {
    const startTime = Date.now();
    const taskData: TaskData = {
      ...data,
      jobId,
      logger,
    };

    const result = await doWork(task, taskData, logger);
    const duration = Date.now() - startTime;

    logger.log('Job completed successfully', {
      jobId,
      task,
      duration: `${duration}ms`,
    });

    // Send callback
    try {
      await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          status: 'completed',
          result,
          processedAt: new Date().toISOString(),
          duration,
          logs: logger.getLogs(),
        }),
      });

      logger.log('Result sent to callback URL', { jobId, callbackUrl });

      // Cleanup temp folder
      const tempPath = (result as Record<string, unknown>).tempFolderPath as string | undefined;
      await cleanupTempFolder(tempPath, jobId, logger);
    } catch (callbackError) {
      logger.error('Failed to send callback', {
        jobId,
        callbackUrl,
        error: callbackError instanceof Error ? callbackError.message : String(callbackError),
      });
    }
  } catch (error) {
    logger.error('Job processing failed', {
      jobId,
      task,
      error: error instanceof Error ? error.message : String(error),
    });

    // Send error callback
    try {
      await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          processedAt: new Date().toISOString(),
          logs: logger.getLogs(),
        }),
      });
    } catch (callbackError) {
      logger.error('Failed to send error callback', {
        jobId,
        error: callbackError instanceof Error ? callbackError.message : String(callbackError),
      });
    }
  }
}

// ============================================================================
// Express App
// ============================================================================

const app = express();
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: '2.0.0',
    architecture: 'plugin-based',
    timestamp: new Date().toISOString(),
  });
});

// Legacy /process endpoint (async with callback)
app.post('/process', async (req: Request, res: Response) => {
  const { jobId, task, data, callbackUrl } = req.body;

  const jobLogger = createLogger(jobId ?? `job-${Date.now()}`);

  jobLogger.log('Received job', { jobId, task });

  // Validate required fields
  if (!jobId || !task || !callbackUrl) {
    jobLogger.error('Missing required fields', { jobId, task, callbackUrl });
    res.status(400).json({
      status: 'error',
      message: 'Missing required fields: jobId, task, and callbackUrl are required',
    });
    return;
  }

  // Acknowledge immediately
  jobLogger.log('Job accepted', { jobId });
  res.json({ status: 'accepted', jobId });

  // Process asynchronously with error handling
  processJob(jobId, task as TaskType, data ?? {}, callbackUrl, jobLogger).catch((error) => {
    console.error(`[${jobId}] UNHANDLED ERROR in processJob:`, error);
  });
});

// Sync build endpoint (for direct API calls)
app.post('/build', async (req: Request, res: Response, next: NextFunction) => {
  const jobId = req.body.jobId ?? `job-${Date.now()}`;
  const logger = createLogger(jobId);

  try {
    logger.log('Received build request');

    const jobData: JobData = {
      ...req.body,
      jobId,
      logger,
    };

    const result = await buildAssets(jobData);

    logger.log('Build completed successfully');
    res.json({
      success: true,
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Build failed', { error: errorMessage });

    res.status(500).json({
      success: false,
      error: errorMessage,
      jobId,
    });
  }
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message,
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(Number(PORT), HOST, () => {
  console.log(`
=====================================
  @repo-md/worker-ts v2.0.0
=====================================
  Architecture: Plugin-based
  Server:       http://${HOST}:${PORT}
  Health:       http://${HOST}:${PORT}/health
  Process:      POST http://${HOST}:${PORT}/process
  Build:        POST http://${HOST}:${PORT}/build
=====================================
  Plugins:
    - @repo-md/processor-core
    - @repo-md/plugin-image-sharp
    - @repo-md/plugin-embed-transformers
    - @repo-md/plugin-embed-clip
    - @repo-md/plugin-database-sqlite
=====================================
  `);
});

export { app, buildAssets };
