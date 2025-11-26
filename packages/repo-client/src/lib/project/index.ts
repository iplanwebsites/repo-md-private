/**
 * Project module barrel export for RepoMD
 */

import { createProjectConfig } from './config.js';

export {
  createProjectConfig,
};

// Re-export types
export type { ReleaseInfo, ProjectMetadata, ProjectDetails, ProjectConfigOptions, ProjectConfigService } from './config.js';
