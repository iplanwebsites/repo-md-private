/**
 * API request module for RepoMD
 * Handles communication with the repo.md backend API
 */

import { LOG_PREFIXES } from "../logger.js";
import { fetchJson, type FetchJsonOptions } from "../utils.js";

const prefix = LOG_PREFIXES.REPO_MD;
const API_DOMAIN = "api.repo.md";
const API_BASE = `https://${API_DOMAIN}/v1`;

/** Configuration for API client */
export interface ApiClientConfig {
  /** Project ID */
  projectId?: string;
  /** Project slug */
  projectSlug?: string;
  /** Whether to log debug info */
  debug?: boolean;
}

/** Project details response */
export interface ProjectDetails {
  id: string;
  slug?: string;
  name?: string;
  activeRev?: string;
  [key: string]: unknown;
}

/** API response wrapper */
interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

/** API client returned by createApiClient */
export interface ApiClient {
  /** Fetch data from the public API */
  fetchPublicApi: <T = unknown>(path?: string, options?: FetchJsonOptions) => Promise<T>;
  /** Fetch project details */
  fetchProjectDetails: () => Promise<ProjectDetails>;
  /** Fetch project active revision from /rev endpoint */
  fetchProjectActiveRev: () => Promise<string>;
  /** Get the active project revision ID */
  getActiveProjectRev: (forceRefresh?: boolean, skipDetails?: boolean) => Promise<string>;
  /** Ensure latest revision is resolved */
  ensureLatestRev: (rev: string, activeRev?: string) => Promise<string>;
  /** Cleanup resources */
  cleanup: () => void;
}

/**
 * Create an API client for the repo.md API
 * @param config - Configuration object
 * @returns API client functions
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const { projectId, projectSlug, debug = false } = config;

  // Store the in-flight promise for getActiveProjectRev to prevent duplicate calls
  let currentRevisionPromise: Promise<string> | null = null;

  /**
   * Generate the base project path used for API calls
   * @param suffix - Optional suffix to append to the path
   * @returns The project path for API calls
   * @throws If no valid projectId is provided
   */
  function getProjectBasePath(suffix = ""): string {
    // Check if we have a valid projectId
    if (projectId && projectId !== "undefined-project-id") {
      const path = `/project-id/${projectId}${suffix}`;
      if (debug) {
        console.log(`${prefix} 🔍 Using project ID path: ${path}`);
      }
      return path;
    }
    // If no valid projectId is available, throw an error
    throw new Error("No valid projectId provided for API request");
  }

  /**
   * Fetch data from the public API
   * @param path - API path
   * @param options - Fetch options (method, body, headers, etc.)
   * @returns Parsed response data
   */
  async function fetchPublicApi<T = unknown>(path = "/", options: FetchJsonOptions = {}): Promise<T> {
    const url = `${API_BASE}${path}`;

    try {
      const result = await fetchJson<ApiResponse<T>>(
        url,
        {
          errorMessage: `Error fetching public API route: ${path}`,
          useCache: false, // the LRU memory cache - http caching should still apply.
          returnErrorObject: true,
          ...options,
        },
        debug
      );

      // Check if we got an error object back
      if (result && typeof result === 'object' && 'success' in result && result.success === false) {
        throw new Error((result as ApiResponse<T>).error || `Failed to fetch data from ${url}`);
      }

      // If the result is null or undefined, it likely means there was an error
      if (result === null || result === undefined) {
        throw new Error(
          `Failed to fetch data from ${url} - please verify your project credentials`
        );
      }

      return (result as ApiResponse<T>).data as T;
    } catch (error) {
      const errorMsg = `API Request Failed: ${(error as Error).message}`;

      if (debug) {
        console.error(`${prefix} ❌ ${errorMsg}`);
        console.error(`${prefix} 🔍 Failed URL: ${url}`);
      }

      // Provide a user-friendly message that includes project information
      const projectInfo = projectId
        ? `project ID: ${projectId}`
        : projectSlug
        ? `project slug: ${projectSlug}`
        : "unknown project";

      throw new Error(`Failed to access ${projectInfo}: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch project details
   * @returns Project details
   */
  async function fetchProjectDetails(): Promise<ProjectDetails> {
    // Get the base path for this project
    const path = getProjectBasePath();

    // EX: https://api.repo.md/v1/projects-id/680e97604a0559a192640d2c
    const project = await fetchPublicApi<ProjectDetails>(path);
    return project;
  }

  /**
   * Fetch project active revision directly from the /rev endpoint
   * @returns Active revision ID
   */
  async function fetchProjectActiveRev(): Promise<string> {
    try {
      // Get the base path with /rev suffix
      const path = getProjectBasePath("/rev");

      const response = await fetchPublicApi<string>(path);

      if (!response) {
        throw new Error(
          `Empty response from /rev endpoint for project ${
            projectId || projectSlug
          }`
        );
      }

      if (debug) {
        console.log(
          `${prefix} ✅ Successfully fetched revision: ${response} from /rev endpoint`,
          response
        );
      }

      return response;
    } catch (error) {
      if (debug) {
        console.error(
          `${prefix} ❌ Error fetching revision from /rev endpoint: ${(error as Error).message}`
        );
      }
      throw error;
    }
  }

  /**
   * Get the active project revision ID
   * @param forceRefresh - Whether to force a refresh from the server
   * @param skipDetails - Whether to skip fetching project details as fallback
   * @returns Active revision ID
   */
  async function getActiveProjectRev(
    forceRefresh = false,
    skipDetails = false
  ): Promise<string> {
    // Return the ongoing promise if there's already a request in progress
    if (currentRevisionPromise && !forceRefresh) {
      return currentRevisionPromise;
    }

    try {
      // Create a new promise for this request
      currentRevisionPromise = (async () => {
        let activeRev: string | undefined;

        try {
          // Try the faster /rev endpoint first
          activeRev = await fetchProjectActiveRev();
        } catch (error) {
          if (skipDetails) {
            // If we're explicitly told to skip fetching project details, just propagate the error
            throw error;
          }

          if (debug) {
            console.warn(
              `${prefix} ⚠️ Failed to get revision from /rev endpoint, falling back to project details: ${(error as Error).message}`
            );
          }

          // Fall back to the original method if /rev fails and we're not skipping details
          const projectDetails = await fetchProjectDetails();

          if (!projectDetails || typeof projectDetails !== "object") {
            throw new Error("Invalid project details response format");
          }

          activeRev = projectDetails.activeRev;
        }

        if (!activeRev) {
          throw new Error(
            `No active revision found for project ${projectId || projectSlug}`
          );
        }

        return activeRev;
      })();

      // Wait for the result
      const result = await currentRevisionPromise;
      return result;
    } catch (error) {
      if (debug) {
        console.error(
          `${prefix} ❌ Error getting active project revision: ${(error as Error).message}`
        );
      }
      throw new Error(
        `Failed to get active project revision: ${(error as Error).message}`
      );
    } finally {
      // Clear the current promise to allow new requests
      currentRevisionPromise = null;
    }
  }

  /**
   * Ensure latest revision is resolved - simplified since expiry is now handled in URL generator
   * @param rev - Requested revision
   * @param activeRev - Known active revision
   * @returns Resolved revision ID
   */
  async function ensureLatestRev(rev: string, activeRev?: string): Promise<string> {
    try {
      // If we have a specific revision, just return it
      if (rev !== "latest") {
        return rev;
      }

      // If activeRev is provided, use it directly
      if (activeRev) {
        return activeRev;
      }

      // Need to resolve "latest" revision
      if (debug) {
        console.log(
          `${prefix} 🔄 Resolving latest revision for project ${
            projectId || projectSlug
          }`
        );
      }

      // Try the faster /rev endpoint first
      try {
        const latestId = await getActiveProjectRev(false, true);

        if (debug) {
          console.log(
            `${prefix} ✅ Resolved 'latest' to revision: ${latestId} (from /rev endpoint)`
          );
        }

        return latestId;
      } catch (error) {
        if (debug) {
          console.warn(
            `${prefix} ⚠️ Failed to get revision from /rev endpoint, falling back to project details: ${(error as Error).message}`
          );
        }

        // Fall back to project details
        const projectDetails = await fetchProjectDetails();

        if (!projectDetails || typeof projectDetails !== "object") {
          throw new Error("Invalid project details response format");
        }

        const latestId = projectDetails.activeRev;

        if (!latestId) {
          throw new Error("No active revision found in project details");
        }

        if (debug) {
          console.log(
            `${prefix} ✅ Resolved 'latest' to revision: ${latestId} (from project details)`
          );
        }

        return latestId;
      }
    } catch (error) {
      const errorMessage = `Failed to resolve latest revision: ${(error as Error).message}`;
      if (debug) {
        console.error(`${prefix} ❌ ${errorMessage}`);
      }
      throw new Error(errorMessage);
    }
  }

  return {
    fetchPublicApi,
    fetchProjectDetails,
    fetchProjectActiveRev,
    getActiveProjectRev,
    ensureLatestRev,
    cleanup: () => {
      // Clear any in-flight promises
      currentRevisionPromise = null;
      if (debug) {
        console.log(`${prefix} 🧹 API client cleaned up`);
      }
    },
  };
}
