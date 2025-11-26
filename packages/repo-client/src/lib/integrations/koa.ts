/**
 * Koa integration for RepoMD
 * Provides middleware for Koa applications
 */

import { UnifiedProxyConfig } from '../proxy/UnifiedProxyConfig.js';
import {
  parseMediaPath,
  proxyFetch,
  handleProxyError,
  createResponseHeaders,
  debugLog,
  type HeaderMap,
} from '../proxy/nodeUtils.js';

/** Koa options configuration */
export interface KoaRepoMdOptions {
  mediaUrlPrefix?: string;
  r2Url?: string;
  cacheMaxAge?: number;
  debug?: boolean;
  projectPathPrefix?: string;
}

/** Koa context interface */
export interface KoaContext {
  url: string;
  method: string;
  headers: HeaderMap;
  status: number;
  body: unknown;
  set: (key: string, value: string) => void;
}

/** Koa next function */
export type KoaNext = () => Promise<void>;

/** Koa middleware function */
export type KoaMiddleware = (ctx: KoaContext, next: KoaNext) => Promise<void>;

/**
 * Create a Koa middleware for RepoMD media proxy
 * @param projectId - The RepoMD project ID
 * @param options - Middleware configuration options
 * @returns Koa middleware function
 */
export function koaRepoMdMiddleware(projectId: string, options: KoaRepoMdOptions = {}): KoaMiddleware {
  const config = new UnifiedProxyConfig({
    projectId,
    ...options,
  });

  return async (ctx: KoaContext, next: KoaNext): Promise<void> => {
    const mediaPath = parseMediaPath(ctx.url, config.mediaUrlPrefix);

    if (!mediaPath) {
      // Not a media request, continue to next middleware
      await next();
      return;
    }

    debugLog(config.debug, `Koa proxy: ${ctx.url}`);

    try {
      const targetUrl = config.getTargetUrl(mediaPath);

      // Create headers object from request
      const requestHeaders: HeaderMap = {};
      for (const [key, value] of Object.entries(ctx.headers)) {
        if (key.toLowerCase() !== 'host') {
          requestHeaders[key] = value;
        }
      }

      const response = await proxyFetch(targetUrl, {
        method: ctx.method,
        headers: requestHeaders,
      });

      const headers = response.ok
        ? createResponseHeaders(response.headers, config.getCacheHeaders())
        : createResponseHeaders(response.headers, config.getErrorCacheHeaders());

      // Set response headers
      for (const [key, value] of Object.entries(headers)) {
        ctx.set(key, value);
      }

      // Set status code
      ctx.status = response.status;

      // Stream the response
      if (response.body) {
        // For Node.js 18+, response.body is a web stream
        // We need to convert it to a readable buffer
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }

          // Set body as buffer
          ctx.body = Buffer.concat(chunks);
        } finally {
          reader.releaseLock();
        }
      } else {
        ctx.body = null;
      }
    } catch (error) {
      const errorResponse = handleProxyError(error, config.getErrorCacheHeaders(), config.debug);

      for (const [key, value] of Object.entries(errorResponse.headers)) {
        ctx.set(key, value);
      }

      ctx.status = errorResponse.status;
      ctx.body = errorResponse.body;
    }
  };
}

/** Node.js Readable stream interface */
interface NodeReadable {
  push: (chunk: Buffer | null) => void;
  destroy: (error: Error) => void;
}

/**
 * Create a Koa middleware that supports streaming responses
 * This version is more efficient for large files
 * @param projectId - The RepoMD project ID
 * @param options - Middleware configuration options
 * @returns Koa middleware function with streaming support
 */
export function koaRepoMdStreamingMiddleware(projectId: string, options: KoaRepoMdOptions = {}): KoaMiddleware {
  const config = new UnifiedProxyConfig({
    projectId,
    ...options,
  });

  return async (ctx: KoaContext, next: KoaNext): Promise<void> => {
    const mediaPath = parseMediaPath(ctx.url, config.mediaUrlPrefix);

    if (!mediaPath) {
      await next();
      return;
    }

    debugLog(config.debug, `Koa proxy (streaming): ${ctx.url}`);

    try {
      const targetUrl = config.getTargetUrl(mediaPath);

      // Create headers object from request
      const requestHeaders: HeaderMap = {};
      for (const [key, value] of Object.entries(ctx.headers)) {
        if (key.toLowerCase() !== 'host') {
          requestHeaders[key] = value;
        }
      }

      const response = await proxyFetch(targetUrl, {
        method: ctx.method,
        headers: requestHeaders,
      });

      const headers = response.ok
        ? createResponseHeaders(response.headers, config.getCacheHeaders())
        : createResponseHeaders(response.headers, config.getErrorCacheHeaders());

      // Set response headers
      for (const [key, value] of Object.entries(headers)) {
        ctx.set(key, value);
      }

      // Set status code
      ctx.status = response.status;

      // For streaming, we need to create a Node.js readable stream
      if (response.body) {
        const { Readable } = await import('node:stream');
        const reader = response.body.getReader();

        ctx.body = new Readable({
          async read(this: NodeReadable) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                this.push(null);
                reader.releaseLock();
              } else {
                this.push(Buffer.from(value));
              }
            } catch (error) {
              this.destroy(error as Error);
              reader.releaseLock();
            }
          }
        });
      } else {
        ctx.body = null;
      }
    } catch (error) {
      const errorResponse = handleProxyError(error, config.getErrorCacheHeaders(), config.debug);

      for (const [key, value] of Object.entries(errorResponse.headers)) {
        ctx.set(key, value);
      }

      ctx.status = errorResponse.status;
      ctx.body = errorResponse.body;
    }
  };
}
