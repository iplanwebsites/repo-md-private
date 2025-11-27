/**
 * @repo-md/worker-ts
 *
 * Modern TypeScript worker with plugin-based architecture.
 */

export { buildAssets } from './process/buildAssets.js';
export type {
  JobData,
  BuildResult,
  RepoInfo,
  Logger,
  AssetResult,
  EmbeddingsMetadata,
  ContentHealth,
} from './types/job.js';
