/**
 * Express integration for RepoMD
 * Provides middleware for Express applications
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

/** Express options configuration */
export interface ExpressRepoMdOptions {
  mediaUrlPrefix?: string;
  r2Url?: string;
  cacheMaxAge?: number;
  debug?: boolean;
  projectPathPrefix?: string;
}

/** Express request interface */
export interface ExpressRequest {
  url: string;
  method: string;
  headers: HeaderMap;
}

/** Express response interface */
export interface ExpressResponse {
  setHeader: (key: string, value: string) => void;
  status: (code: number) => ExpressResponse;
  write: (chunk: Uint8Array) => void;
  end: () => void;
  send: (body: string) => void;
  json: (data: unknown) => void;
}

/** Express next function */
export type ExpressNextFunction = (error?: unknown) => void;

/** Express middleware function */
export type ExpressMiddleware = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction
) => Promise<void>;

/** Express error middleware function */
export type ExpressErrorMiddleware = (
  err: Error,
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction
) => void;

/**
 * Create an Express middleware for RepoMD media proxy
 * @param projectId - The RepoMD project ID
 * @param options - Middleware configuration options
 * @returns Express middleware function (req, res, next)
 */
export function expressRepoMdMiddleware(
  projectId: string,
  options: ExpressRepoMdOptions = {}
): ExpressMiddleware {
  const config = new UnifiedProxyConfig({
    projectId,
    ...options,
  });

  return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction): Promise<void> => {
    const mediaPath = parseMediaPath(req.url, config.mediaUrlPrefix);

    if (!mediaPath) {
      // Not a media request, continue to next middleware
      next();
      return;
    }

    debugLog(config.debug, `Express proxy: ${req.url}`);

    try {
      const targetUrl = config.getTargetUrl(mediaPath);

      // Create headers object from request
      const requestHeaders: HeaderMap = {};
      Object.entries(req.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'host') {
          requestHeaders[key] = value;
        }
      });

      const response = await proxyFetch(targetUrl, {
        method: req.method,
        headers: requestHeaders,
      });

      const headers = response.ok
        ? createResponseHeaders(response.headers, config.getCacheHeaders())
        : createResponseHeaders(response.headers, config.getErrorCacheHeaders());

      // Set response headers
      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Set status code
      res.status(response.status);

      // Stream the response
      if (response.body) {
        // For Node.js 18+, response.body is a web stream
        // We need to convert it to a Node.js stream
        const reader = response.body.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            res.write(value);
          }
        } finally {
          reader.releaseLock();
        }

        res.end();
      } else {
        res.end();
      }
    } catch (error) {
      const errorResponse = handleProxyError(error, config.getErrorCacheHeaders(), config.debug);

      Object.entries(errorResponse.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      res.status(errorResponse.status).send(errorResponse.body);
    }
  };
}

/** Error handler options */
export interface ExpressErrorHandlerOptions {
  debug?: boolean;
}

/**
 * Create an Express error-handling middleware for RepoMD
 * This can be used after the main middleware to handle any proxy errors
 * @param options - Error handler configuration options
 * @returns Express error middleware function (err, req, res, next)
 */
export function expressRepoMdErrorHandler(
  options: ExpressErrorHandlerOptions = {}
): ExpressErrorMiddleware {
  const { debug = false } = options;

  return (
    err: Error,
    req: ExpressRequest,
    res: ExpressResponse,
    next: ExpressNextFunction
  ): void => {
    // Only handle errors for media requests
    if (!req.url.includes('/_repo/medias/')) {
      next(err);
      return;
    }

    debugLog(debug, 'Express proxy error handler:', err);

    res.status(502).json({
      error: 'Proxy error',
      message: debug ? err.message : 'Failed to fetch media resource',
    });
  };
}
