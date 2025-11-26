/**
 * Nuxt 3 integration for RepoMD
 * Provides both Nitro plugin and Nuxt module approaches
 */

import { UnifiedProxyConfig } from '../proxy/UnifiedProxyConfig.js';
import {
  parseMediaPath,
  proxyFetch,
  handleProxyError,
  createResponseHeaders,
  debugLog,
  type HeaderMap,
  type ProxyErrorResponse,
} from '../proxy/nodeUtils.js';

/** Nuxt options configuration */
export interface NuxtRepoMdOptions {
  mediaUrlPrefix?: string;
  r2Url?: string;
  cacheMaxAge?: number;
  debug?: boolean;
  projectPathPrefix?: string;
}

/** Nuxt node event */
export interface NuxtNodeEvent {
  node: {
    req: {
      url: string;
      method: string;
      headers: HeaderMap;
    };
    res: {
      setHeader: (key: string, value: string) => void;
      statusCode: number;
      write: (chunk: Uint8Array) => void;
      end: (body?: string) => void;
    };
  };
}

/** Nitro app interface */
export interface NitroApp {
  hooks: {
    hook: (event: string, handler: (event: NuxtNodeEvent) => Promise<void>) => void;
  };
}

/** Nuxt plugin function */
export type NuxtPlugin = (nitroApp: NitroApp) => void;

/** Cached handler response */
export interface CachedHandlerResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer | string;
}

/** Cached handler result */
export interface CachedHandlerResult {
  handler: (event: NuxtNodeEvent) => Promise<CachedHandlerResponse | ProxyErrorResponse | null>;
  options: {
    maxAge: number;
    name: string;
    getKey: (event: NuxtNodeEvent) => string;
  };
}

/**
 * Create a Nuxt/Nitro plugin for RepoMD media proxy
 * @param projectId - The RepoMD project ID
 * @param options - Plugin configuration options
 * @returns Nitro plugin function
 */
export function nuxtRepoMdPlugin(projectId: string, options: NuxtRepoMdOptions = {}): NuxtPlugin {
  const config = new UnifiedProxyConfig({
    projectId,
    ...options,
  });

  return (nitroApp: NitroApp): void => {
    nitroApp.hooks.hook('request', async (event: NuxtNodeEvent): Promise<void> => {
      const mediaPath = parseMediaPath(event.node.req.url, config.mediaUrlPrefix);

      if (!mediaPath) {
        return; // Not a media request, continue normally
      }

      debugLog(config.debug, `Nuxt proxy: ${event.node.req.url}`);

      try {
        const targetUrl = config.getTargetUrl(mediaPath);
        const response = await proxyFetch(targetUrl, {
          method: event.node.req.method,
          headers: event.node.req.headers,
        });

        const headers = response.ok
          ? createResponseHeaders(response.headers, config.getCacheHeaders())
          : createResponseHeaders(response.headers, config.getErrorCacheHeaders());

        // Set response headers
        Object.entries(headers).forEach(([key, value]) => {
          event.node.res.setHeader(key, value);
        });

        // Set status code
        event.node.res.statusCode = response.status;

        // Stream the response body
        if (response.body) {
          const reader = response.body.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              event.node.res.write(value);
            }
          } finally {
            reader.releaseLock();
          }
        }

        event.node.res.end();
      } catch (error) {
        const errorResponse = handleProxyError(error, config.getErrorCacheHeaders(), config.debug);

        Object.entries(errorResponse.headers).forEach(([key, value]) => {
          event.node.res.setHeader(key, value);
        });

        event.node.res.statusCode = errorResponse.status;
        event.node.res.end(errorResponse.body);
      }
    });
  };
}

/**
 * Create a cached event handler for Nuxt/Nitro
 * This provides edge caching support
 * @param projectId - The RepoMD project ID
 * @param options - Handler configuration options
 * @returns Cached event handler
 */
export function nuxtRepoMdCachedHandler(projectId: string, options: NuxtRepoMdOptions = {}): CachedHandlerResult {
  const config = new UnifiedProxyConfig({
    projectId,
    ...options,
  });

  // This function should be wrapped with defineCachedEventHandler in user's code
  const handler = async (event: NuxtNodeEvent): Promise<CachedHandlerResponse | ProxyErrorResponse | null> => {
    const mediaPath = parseMediaPath(event.node.req.url, config.mediaUrlPrefix);

    if (!mediaPath) {
      return null; // Not a media request
    }

    const targetUrl = config.getTargetUrl(mediaPath);

    try {
      const response = await proxyFetch(targetUrl, {
        method: event.node.req.method,
        headers: event.node.req.headers,
      });

      const body = await response.arrayBuffer();

      return {
        status: response.status,
        headers: response.ok
          ? config.getCacheHeaders()
          : config.getErrorCacheHeaders(),
        body: Buffer.from(body),
      };
    } catch (error) {
      const errorResponse = handleProxyError(error, config.getErrorCacheHeaders(), config.debug);
      return errorResponse;
    }
  };

  // Return handler with cache configuration
  return {
    handler,
    options: {
      maxAge: config.cacheMaxAge,
      name: 'repo-md-media',
      getKey: (event: NuxtNodeEvent): string => event.node.req.url,
    }
  };
}
