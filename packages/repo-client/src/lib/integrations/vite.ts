/**
 * Vite integration for RepoMD
 * Provides proxy configuration for Vite dev server
 */

import { UnifiedProxyConfig, type ViteProxyConfig } from '../proxy/UnifiedProxyConfig.js';
import { getProjectIdFromEnv } from '../utils/env.js';

/** Vite plugin options */
export interface ViteRepoMdOptions {
  projectId?: string;
  route?: string;
  mediaUrlPrefix?: string;
  r2Url?: string;
  cacheMaxAge?: number;
  debug?: boolean;
}

/** Vite server configuration for plugins */
export interface ViteServerConfig {
  proxy: ViteProxyConfig;
}

/** Vite config returned by plugin */
export interface VitePluginConfig {
  server: ViteServerConfig;
}

/** Vite plugin object */
export interface VitePlugin {
  name: string;
  configureServer: (server: unknown) => void;
  config: () => VitePluginConfig;
}

/**
 * Create a Vite proxy configuration for RepoMD
 * @param options - Configuration options or project ID string
 * @returns Vite server proxy configuration
 */
export function viteRepoMdProxy(options: ViteRepoMdOptions | string = {}): ViteProxyConfig {
  const config = typeof options === 'string'
    ? { projectId: options }
    : options;

  const projectId = getProjectIdFromEnv(config.projectId, 'Vite proxy');
  if (!projectId) {
    throw new Error('projectId is required for Vite proxy');
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

  return proxyConfig.toViteConfig();
}

/**
 * Create a Vite plugin for RepoMD (future enhancement)
 * This could provide additional features beyond just proxy
 * @param options - Configuration options or project ID string
 * @returns Vite plugin object
 */
export function viteRepoMdPlugin(options: ViteRepoMdOptions | string = {}): VitePlugin {
  const config = typeof options === 'string'
    ? { projectId: options }
    : options;

  const projectId = getProjectIdFromEnv(config.projectId, 'Vite plugin');
  if (!projectId) {
    throw new Error('projectId is required for Vite plugin');
  }

  return {
    name: 'vite-plugin-repo-md',
    configureServer(_server: unknown): void {
      // Could add custom middleware here if needed
      if (config.debug) {
        console.log(`RepoMD: Vite plugin loaded for project ${projectId}`);
      }
    },
    config(): VitePluginConfig {
      // Return Vite config with proxy
      const proxyConfig = new UnifiedProxyConfig({
        projectId,
        mediaUrlPrefix: config.mediaUrlPrefix,
        r2Url: config.r2Url,
        cacheMaxAge: config.cacheMaxAge,
        debug: config.debug,
      });

      return {
        server: {
          proxy: proxyConfig.toViteConfig()
        }
      };
    }
  };
}
