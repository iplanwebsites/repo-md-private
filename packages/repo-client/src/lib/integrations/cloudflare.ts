/**
 * Cloudflare Workers integration for RepoMD
 * Provides request handlers for edge deployments
 */

import { RepoMD } from '../RepoMd.js';
import { getProjectIdFromEnv } from '../utils/env.js';
import type { BaseProxyOptions } from '../types/common.js';

/** Cloudflare options configuration - extends base proxy options */
export interface CloudflareRepoMdOptions extends BaseProxyOptions {
  /** Return null for non-media requests (default: false) */
  returnNull?: boolean;
}

/** Cloudflare Workers request handler */
export type CloudflareRequestHandler = (request: Request) => Promise<Response | null>;

/** Cloudflare Workers environment bindings */
export interface CloudflareEnv {
  REPO_MD_PROJECT_ID?: string;
  [key: string]: unknown;
}

/** Cloudflare Workers execution context */
export interface CloudflareContext {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

/** Cloudflare Workers fetch handler */
export interface CloudflareWorker {
  fetch: (request: Request, env: CloudflareEnv, ctx: CloudflareContext) => Promise<Response | null>;
  scheduled: (event: unknown, env: CloudflareEnv, ctx: CloudflareContext) => Promise<void>;
}

/** Cloudflare Pages function context */
export interface CloudflarePagesContext {
  request: Request;
  env: CloudflareEnv;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  next: () => Promise<Response>;
  data: Record<string, unknown>;
}

/** Cloudflare Pages function handler */
export type CloudflarePagesFunction = (context: CloudflarePagesContext) => Promise<Response>;

/**
 * Create a Cloudflare Workers request handler for RepoMD
 * @param options - Configuration options or project ID string
 * @returns Cloudflare Workers request handler
 */
export function cloudflareRepoMdHandler(options: CloudflareRepoMdOptions | string = {}): CloudflareRequestHandler {
  const config = typeof options === 'string'
    ? { projectId: options }
    : options;

  const projectId = getProjectIdFromEnv(config.projectId, 'Cloudflare Workers');
  if (!projectId) {
    throw new Error('projectId is required for Cloudflare Workers');
  }

  // If route is provided, construct the mediaUrlPrefix from it
  const _mediaUrlPrefix = config.route
    ? `/${config.route}/medias`
    : config.mediaUrlPrefix;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repo = new (RepoMD as any)({
    projectId,
    debug: config.debug,
    // Note: mediaUrlPrefix is not currently supported by RepoMD for Cloudflare
    // This is here for future compatibility when it's implemented
  });

  // Return a handler function that Cloudflare Workers can use
  return async (request: Request): Promise<Response | null> => {
    const response = await repo.handleCloudflareRequest(request);
    if (response) {
      return response;
    }

    // If not a media request
    if (config.returnNull) {
      return null; // Let other handlers process it
    }

    return new Response('Not Found', { status: 404 });
  };
}

/**
 * Create a Cloudflare Workers fetch handler with additional features
 * @param options - Configuration options
 * @returns Object with fetch and scheduled handlers
 */
export function cloudflareRepoMdWorker(options: CloudflareRepoMdOptions = {}): CloudflareWorker {
  const handler = cloudflareRepoMdHandler(options);

  return {
    // Main fetch handler
    async fetch(request: Request, env: CloudflareEnv, _ctx: CloudflareContext): Promise<Response | null> {
      // Could use env for dynamic configuration
      if (env.REPO_MD_PROJECT_ID && !options.projectId) {
        options.projectId = env.REPO_MD_PROJECT_ID;
      }

      return handler(request);
    },

    // Scheduled handler for cache warming (future feature)
    async scheduled(_event: unknown, _env: CloudflareEnv, _ctx: CloudflareContext): Promise<void> {
      // Could implement cache warming logic here
      if (options.debug) {
        console.log('RepoMD: Scheduled event triggered');
      }
    },
  };
}

/**
 * Create a Cloudflare Pages function for RepoMD
 * @param options - Configuration options or project ID string
 * @returns Cloudflare Pages function
 */
export function cloudflareRepoMdPagesFunction(options: CloudflareRepoMdOptions | string = {}): CloudflarePagesFunction {
  const handler = cloudflareRepoMdHandler(options);

  // Pages Functions have a different signature
  return async (context: CloudflarePagesContext): Promise<Response> => {
    const { request, next } = context;

    // Try RepoMD handler first
    const response = await handler(request);
    if (response) {
      return response;
    }

    // If not handled, pass to next middleware
    return next();
  };
}
