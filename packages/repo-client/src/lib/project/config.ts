/**
 * Project Configuration module for RepoMD
 * Provides functions for handling project configuration and releases
 */

import { LOG_PREFIXES } from '../logger.js';

const prefix = LOG_PREFIXES.REPO_MD;

/** Release information */
export interface ReleaseInfo {
  current: string | null;
  all: string[];
  projectId: string | null;
  projectName: string | null;
}

/** Project metadata */
export interface ProjectMetadata {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  owner?: string;
  orgSlug?: string;
  visibility?: string;
  activeRev?: string;
  created?: string;
  updated?: string;
}

/** Project details response from API */
export interface ProjectDetails {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  owner?: string;
  orgSlug?: string;
  visibility?: string;
  activeRev?: string;
  created?: string;
  updated?: string;
  latest_release?: string;
  releases?: string[];
  [key: string]: unknown;
}

/** Project config configuration */
export interface ProjectConfigOptions {
  fetchProjectDetails: () => Promise<ProjectDetails>;
  debug?: boolean;
}

/** Project config service interface */
export interface ProjectConfigService {
  getReleaseInfo: (projectId?: string) => Promise<ReleaseInfo>;
  getProjectMetadata: () => Promise<ProjectMetadata>;
}

/**
 * Create a project configuration service
 * @param config - Configuration object
 * @returns Project configuration functions
 */
export function createProjectConfig(config: ProjectConfigOptions): ProjectConfigService {
  const { fetchProjectDetails, debug = false } = config;

  /**
   * Get release information
   * @param projectId - Project ID
   * @returns Release information
   */
  async function getReleaseInfo(projectId?: string): Promise<ReleaseInfo> {
    try {
      const projectConfig = await fetchProjectDetails();

      if (!projectConfig || typeof projectConfig !== 'object') {
        throw new Error('Invalid project configuration response');
      }

      return {
        current: projectConfig.latest_release || null,
        all: projectConfig.releases || [],
        projectId: projectConfig.id || projectId || null,
        projectName: projectConfig.name || null,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (debug) {
        console.error(
          `${prefix} ❌ Error getting release information: ${errorMessage}`
        );
      }
      throw new Error(`Failed to get release information: ${errorMessage}`);
    }
  }

  /**
   * Get project metadata
   * @returns Project metadata
   */
  async function getProjectMetadata(): Promise<ProjectMetadata> {
    try {
      const projectConfig = await fetchProjectDetails();

      if (!projectConfig || typeof projectConfig !== 'object') {
        throw new Error('Invalid project configuration response');
      }

      return {
        id: projectConfig.id,
        name: projectConfig.name,
        slug: projectConfig.slug,
        description: projectConfig.description,
        owner: projectConfig.owner,
        orgSlug: projectConfig.orgSlug,
        visibility: projectConfig.visibility,
        activeRev: projectConfig.activeRev,
        created: projectConfig.created,
        updated: projectConfig.updated,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (debug) {
        console.error(
          `${prefix} ❌ Error getting project metadata: ${errorMessage}`
        );
      }
      throw new Error(`Failed to get project metadata: ${errorMessage}`);
    }
  }

  return {
    getReleaseInfo,
    getProjectMetadata,
  };
}
