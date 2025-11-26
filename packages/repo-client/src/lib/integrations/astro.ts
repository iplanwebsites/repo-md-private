/**
 * Astro integration for RepoMD
 * Provides both middleware and integration approaches
 */

import { UnifiedProxyConfig } from '../proxy/UnifiedProxyConfig.js';
import {
  parseMediaPath,
  proxyFetch,
  handleProxyError,
  createResponseHeaders,
  debugLog,
} from '../proxy/nodeUtils.js';
import type { BaseProxyOptions } from '../types/common.js';

/** Astro options configuration - extends base proxy options */
export interface AstroRepoMdOptions extends BaseProxyOptions {
  // Astro-specific options can be added here
}

/** Astro context interface */
export interface AstroContext {
  request: Request;
  url: URL;
}

/** Astro next function */
export type AstroNext = () => Promise<Response>;

/** Astro middleware function */
export type AstroMiddleware = (context: AstroContext, next: AstroNext) => Promise<Response>;

/** Astro update config function */
export type AstroUpdateConfig = (config: AstroConfig) => void;

/** Astro config object */
export interface AstroConfig {
  vite?: {
    server?: {
      proxy?: Record<string, unknown>;
    };
  };
}

/** Astro config setup context */
export interface AstroConfigSetupContext {
  updateConfig: AstroUpdateConfig;
  injectScript?: (stage: string, content: string) => void;
}

/** Astro server setup context */
export interface AstroServerSetupContext {
  server: unknown;
}

/** Astro integration hooks */
export interface AstroIntegrationHooks {
  'astro:config:setup'?: (context: AstroConfigSetupContext) => void;
  'astro:server:setup'?: (context: AstroServerSetupContext) => void;
}

/** Astro integration object */
export interface AstroIntegration {
  name: string;
  hooks: AstroIntegrationHooks;
}

/**
 * Create an Astro middleware for RepoMD media proxy
 * @param projectId - The RepoMD project ID
 * @param options - Middleware configuration options
 * @returns Astro middleware function
 */
export function astroRepoMdMiddleware(projectId: string, options: AstroRepoMdOptions = {}): AstroMiddleware {
  const config = new UnifiedProxyConfig({
    projectId,
    ...options,
  });

  return async (context: AstroContext, next: AstroNext): Promise<Response> => {
    const { request, url } = context;
    const mediaPath = parseMediaPath(url.pathname, config.mediaUrlPrefix);

    if (!mediaPath) {
      // Not a media request, continue to next middleware
      return next();
    }

    debugLog(config.debug, `Astro proxy: ${url.pathname}`);

    try {
      const targetUrl = config.getTargetUrl(mediaPath);
      const response = await proxyFetch(targetUrl, {
        method: request.method,
        headers: request.headers as unknown as Record<string, string>,
      });

      const headers = response.ok
        ? createResponseHeaders(response.headers, config.getCacheHeaders())
        : createResponseHeaders(response.headers, config.getErrorCacheHeaders());

      // Convert headers object to Headers instance
      const responseHeaders = new Headers();
      Object.entries(headers).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      const errorResponse = handleProxyError(error, config.getErrorCacheHeaders(), config.debug);

      const errorHeaders = new Headers();
      Object.entries(errorResponse.headers).forEach(([key, value]) => {
        errorHeaders.set(key, value);
      });

      return new Response(errorResponse.body, {
        status: errorResponse.status,
        headers: errorHeaders,
      });
    }
  };
}

/**
 * Create an Astro integration for RepoMD
 * This adds Vite configuration for dev server support
 * @param projectId - The RepoMD project ID
 * @param options - Integration configuration options
 * @returns Astro integration object
 */
export function astroRepoMdIntegration(projectId: string, options: AstroRepoMdOptions = {}): AstroIntegration {
  const config = new UnifiedProxyConfig({
    projectId,
    ...options,
  });

  return {
    name: 'repo-md-proxy',
    hooks: {
      'astro:config:setup': ({ updateConfig }: AstroConfigSetupContext): void => {
        // Add Vite proxy configuration for dev server
        updateConfig({
          vite: {
            server: {
              proxy: config.toViteConfig(),
            },
          },
        });
      },
      'astro:server:setup': (_context: AstroServerSetupContext): void => {
        // Log when dev server starts with proxy
        if (config.debug) {
          console.log(`RepoMD proxy enabled for project: ${config.projectId}`);
          console.log(`Media URL prefix: ${config.mediaUrlPrefix}`);
        }
      },
    },
  };
}

/**
 * Create an Astro integration with middleware support
 * This combines both dev server proxy and production middleware
 * @param projectId - The RepoMD project ID
 * @param options - Integration configuration options
 * @returns Astro integration object with middleware
 */
export function astroRepoMdFullIntegration(projectId: string, options: AstroRepoMdOptions = {}): AstroIntegration {
  const config = new UnifiedProxyConfig({
    projectId,
    ...options,
  });

  return {
    name: 'repo-md-proxy-full',
    hooks: {
      'astro:config:setup': ({ updateConfig }: AstroConfigSetupContext): void => {
        // Add Vite proxy configuration for dev server
        updateConfig({
          vite: {
            server: {
              proxy: config.toViteConfig(),
            },
          },
        });

        // Note: Middleware should be manually added to src/middleware.js
        // as Astro doesn't support injecting middleware via integrations yet
        if (config.debug) {
          console.log('RepoMD: Add the following to your src/middleware.js:');
          console.log(`
import { astroRepoMdMiddleware } from 'repo-md';

export const onRequest = astroRepoMdMiddleware('${config.projectId}');
          `);
        }
      },
    },
  };
}
