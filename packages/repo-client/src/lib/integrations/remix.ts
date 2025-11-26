/**
 * Remix integration for RepoMD
 * Provides loader functions for resource routes
 */

import { UnifiedProxyConfig, type RemixLoader } from '../proxy/UnifiedProxyConfig.js';
import { getProjectIdFromEnv } from '../utils/env.js';
import type { BaseProxyOptions } from '../types/common.js';

/** Remix options configuration - extends base proxy options */
export interface RemixRepoMdOptions extends BaseProxyOptions {
  // Remix-specific options can be added here
}

/** Remix action context */
export interface RemixActionContext {
  request: Request;
}

/** Remix action function type */
export type RemixAction = (context: RemixActionContext) => Promise<Response>;

/** Remix meta entry */
export interface RemixMetaEntry {
  name: string;
  content: string;
}

/** Remix route module exports */
export interface RemixRouteModule {
  loader: RemixLoader;
  meta: () => RemixMetaEntry[];
}

/**
 * Create a Remix loader for RepoMD media proxy
 * @param options - Configuration options or project ID string
 * @returns Remix loader function
 */
export function remixRepoMdLoader(options: RemixRepoMdOptions | string = {}): RemixLoader {
  const config = typeof options === 'string'
    ? { projectId: options }
    : options;

  const projectId = getProjectIdFromEnv(config.projectId, 'Remix loader');
  if (!projectId) {
    throw new Error('projectId is required for Remix loader');
  }

  // If route is provided, construct the mediaUrlPrefix from it
  const mediaUrlPrefix = config.route
    ? `/${config.route}/medias`
    : config.mediaUrlPrefix;

  const proxyConfig = new UnifiedProxyConfig({
    projectId,
    mediaUrlPrefix,
    r2Url: config.r2Url,
    cacheMaxAge: config.cacheMaxAge,
    debug: config.debug,
  });

  return proxyConfig.toRemixLoader();
}

/**
 * Create a Remix action for RepoMD (for future POST/PUT support)
 * @param options - Configuration options or project ID string
 * @returns Remix action function
 */
export function remixRepoMdAction(options: RemixRepoMdOptions | string = {}): RemixAction {
  const config = typeof options === 'string'
    ? { projectId: options }
    : options;

  // Validate project ID even though we don't use it yet
  const _projectId = getProjectIdFromEnv(config.projectId, 'Remix action');

  return async (_context: RemixActionContext): Promise<Response> => {
    // For now, just return method not allowed
    // Future: could handle file uploads to R2
    return new Response('Method not allowed', {
      status: 405,
      headers: {
        'Allow': 'GET, HEAD'
      }
    });
  };
}

/**
 * Create a complete Remix route module for RepoMD
 * This exports both loader and meta functions
 * @param options - Configuration options or project ID string
 * @returns Remix route module exports
 */
export function remixRepoMdRoute(options: RemixRepoMdOptions | string = {}): RemixRouteModule {
  return {
    loader: remixRepoMdLoader(options),
    // Meta function to prevent indexing of media routes
    meta: (): RemixMetaEntry[] => [
      { name: 'robots', content: 'noindex, nofollow' }
    ],
  };
}
