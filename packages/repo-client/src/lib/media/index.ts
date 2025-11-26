/**
 * Media module barrel export for RepoMD
 */

import { createMediaHandler } from './handler.js';
import { createMediaSimilarity } from './similarity.js';
import { handleCloudflareRequest } from '../mediaProxy.js';

export {
  createMediaHandler,
  createMediaSimilarity,
  handleCloudflareRequest,
};

// Re-export types
export type { CloudflareRequest, MediaHandlerConfig, MediaHandlerService } from './handler.js';
export type { MediaSimilarityConfig, MediaSimilarityService } from './similarity.js';
