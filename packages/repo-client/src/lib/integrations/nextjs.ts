/**
 * Next.js integration for RepoMD
 * Provides middleware and configuration options
 */

import { UnifiedProxyConfig, type NextConfig } from '../proxy/UnifiedProxyConfig.js';
import { RepoMD } from '../RepoMd.js';
import { getProjectIdFromEnv } from '../utils/env.js';

/** Next.js options configuration */
export interface NextRepoMdOptions {
  projectId?: string;
  route?: string;
  mediaUrlPrefix?: string;
  r2Url?: string;
  cacheMaxAge?: number;
  debug?: boolean;
}

/** Next.js middleware result */
export interface NextMiddlewareResult {
  middleware: (request: unknown) => Promise<Response>;
  config: NextConfig;
}

/** Rewrite entry for Next.js */
export interface NextRewrite {
  source: string;
  destination: string;
}

/** Header configuration for Next.js */
export interface NextHeaderConfig {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

/** Merged Next.js configuration */
export interface MergedNextConfig {
  rewrites: () => Promise<NextRewrite[]>;
  headers: () => Promise<NextHeaderConfig[]>;
  [key: string]: unknown;
}

/**
 * Create a Next.js middleware handler for RepoMD
 * @param options - Configuration options or project ID string
 * @returns Object containing middleware function and config
 */
export function nextRepoMdMiddleware(options: NextRepoMdOptions | string = {}): NextMiddlewareResult {
  const config = typeof options === 'string'
    ? { projectId: options }
    : options;

  const projectId = getProjectIdFromEnv(config.projectId, 'Next.js middleware');
  if (!projectId) {
    throw new Error('projectId is required for Next.js middleware');
  }

  // If route is provided, construct the mediaUrlPrefix from it
  const mediaUrlPrefix = config.route
    ? `/${config.route}/medias`
    : config.mediaUrlPrefix;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repo = new (RepoMD as any)({
    projectId,
    debug: config.debug,
  });

  // createNextMiddleware returns both middleware and config
  return repo.createNextMiddleware({ ...config, mediaUrlPrefix }) as NextMiddlewareResult;
}

/**
 * Create a Next.js configuration object for RepoMD
 * @param options - Configuration options or project ID string
 * @returns Next.js configuration object with rewrites and headers
 */
export function nextRepoMdConfig(options: NextRepoMdOptions | string = {}): NextConfig {
  const config = typeof options === 'string'
    ? { projectId: options }
    : options;

  const projectId = getProjectIdFromEnv(config.projectId, 'Next.js config');
  if (!projectId) {
    throw new Error('projectId is required for Next.js config');
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

  return proxyConfig.toNextConfig();
}

/**
 * Create a complete Next.js configuration with RepoMD proxy
 * This merges RepoMD config with existing Next.js config
 * @param existingConfig - Existing Next.js configuration
 * @param repoMdOptions - RepoMD options or project ID
 * @returns Merged Next.js configuration
 */
export function withRepoMd(
  existingConfig: Partial<MergedNextConfig> = {},
  repoMdOptions: NextRepoMdOptions | string = {}
): MergedNextConfig {
  const repoMdConfig = nextRepoMdConfig(repoMdOptions);

  return {
    ...existingConfig,
    async rewrites(): Promise<NextRewrite[]> {
      const existingRewrites = await (existingConfig.rewrites?.() || []);
      const repoMdRewrites = await repoMdConfig.rewrites();

      return [
        ...existingRewrites,
        ...repoMdRewrites,
      ];
    },
    async headers(): Promise<NextHeaderConfig[]> {
      const existingHeaders = await (existingConfig.headers?.() || []);
      const repoMdHeaders = await repoMdConfig.headers();

      return [
        ...existingHeaders,
        ...repoMdHeaders,
      ];
    },
  };
}
