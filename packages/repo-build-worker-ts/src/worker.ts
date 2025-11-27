/**
 * Worker Entry Point
 *
 * Modern TypeScript worker using plugin-based architecture.
 */

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import { buildAssets } from './process/buildAssets.js';
import type { JobData, Logger } from './types/job.js';

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT ?? 5522;
const HOST = process.env.HOST ?? '0.0.0.0';

// ============================================================================
// Logger Factory
// ============================================================================

const createLogger = (jobId: string): Logger => ({
  log: (message, context) => console.log(`[${jobId}] ${message}`, context ?? ''),
  warn: (message, context) => console.warn(`[${jobId}] WARN: ${message}`, context ?? ''),
  error: (message, context) => console.error(`[${jobId}] ERROR: ${message}`, context ?? ''),
});

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

// Build assets endpoint
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
