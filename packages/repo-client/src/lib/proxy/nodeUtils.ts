/**
 * Shared utilities for Node.js framework integrations
 */

import { LOG_PREFIXES } from '../logger.js';

const prefix = LOG_PREFIXES.REPO_MD;

/** HTTP header map type */
export type HeaderMap = Record<string, string | string[] | undefined>;

/** Cache headers type */
export type CacheHeaders = Record<string, string>;

/** Error response type from proxy */
export interface ProxyErrorResponse {
  status: number;
  headers: CacheHeaders;
  body: string;
}

/** Fetch options for proxy */
export interface ProxyFetchOptions {
  method?: string;
  headers?: HeaderMap;
}

/** Target response interface for streaming */
export interface StreamTarget {
  write?: (chunk: Uint8Array) => void;
  end?: () => void;
  send?: (data: unknown) => void;
  body?: unknown;
  pipe?: (target: unknown) => void;
}

/** Supported framework names for streaming */
export type StreamFramework = 'express' | 'fastify' | 'koa' | string;

/**
 * Parse request URL to extract media path
 * @param url - The request URL
 * @param mediaUrlPrefix - The media URL prefix
 * @returns The media path or null if not a media request
 */
export function parseMediaPath(url: string, mediaUrlPrefix: string): string | null {
  try {
    const parsedUrl = new URL(url, 'http://localhost');
    const pathname = parsedUrl.pathname;

    if (!pathname.startsWith(mediaUrlPrefix)) {
      return null;
    }

    return pathname.slice(mediaUrlPrefix.length);
  } catch {
    return null;
  }
}

/**
 * Create response headers with caching
 * @param originalHeaders - Original response headers
 * @param cacheHeaders - Cache headers to apply
 * @returns Combined headers object
 */
export function createResponseHeaders(
  originalHeaders: Headers | HeaderMap | null | undefined,
  cacheHeaders: CacheHeaders
): CacheHeaders {
  const headers: CacheHeaders = {};

  // Copy original headers
  if (originalHeaders instanceof Headers) {
    originalHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (originalHeaders) {
    Object.entries(originalHeaders).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(', ');
      }
    });
  }

  // Apply cache headers
  Object.assign(headers, cacheHeaders);

  return headers;
}

/**
 * Handle proxy error response
 * @param error - The error that occurred
 * @param errorCacheHeaders - Error cache headers
 * @param debug - Debug mode flag
 * @returns Error response object with status, headers, and body
 */
export function handleProxyError(
  error: unknown,
  errorCacheHeaders: CacheHeaders,
  debug: boolean
): ProxyErrorResponse {
  if (debug) {
    console.error(`${prefix} Proxy error:`, error);
  }

  const headers: CacheHeaders = {
    ...errorCacheHeaders,
    'Content-Type': 'text/plain',
  };

  return {
    status: 502,
    headers,
    body: 'Proxy error',
  };
}

/**
 * Stream response body for better performance
 * @param response - The fetch response
 * @param targetResponse - The target response object (varies by framework)
 * @param framework - The framework name for specific handling
 */
export async function streamResponse(
  response: Response,
  targetResponse: StreamTarget,
  framework: StreamFramework
): Promise<void> {
  if (!response.body) {
    return;
  }

  switch (framework) {
    case 'express':
      // Express: pipe directly
      if (targetResponse.pipe) {
        (response.body as unknown as { pipe: (target: unknown) => void }).pipe(targetResponse);
      }
      break;

    case 'fastify':
      // Fastify: use reply.send with stream
      if (targetResponse.send) {
        targetResponse.send(response.body);
      }
      break;

    case 'koa':
      // Koa: set body to stream
      targetResponse.body = response.body;
      break;

    default: {
      // Generic: read and write chunks
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (typeof targetResponse.write === 'function') {
            targetResponse.write(value);
          }
        }
      } finally {
        reader.releaseLock();
        if (typeof targetResponse.end === 'function') {
          targetResponse.end();
        }
      }
    }
  }
}

/**
 * Check if the request is for a media file
 * @param url - The request URL
 * @param mediaUrlPrefix - The media URL prefix
 * @returns True if it's a media request
 */
export function isMediaRequest(url: string, mediaUrlPrefix: string): boolean {
  return parseMediaPath(url, mediaUrlPrefix) !== null;
}

/**
 * Create a fetch request for proxying
 * @param targetUrl - The target URL to fetch
 * @param options - Fetch options
 * @returns The fetch response
 */
export async function proxyFetch(targetUrl: string, options: ProxyFetchOptions = {}): Promise<Response> {
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: options.headers as HeadersInit || {},
    redirect: 'follow',
  };

  // Remove host header to avoid conflicts
  const cleanHeaders: HeaderMap = { ...(fetchOptions.headers as HeaderMap) };
  if ('host' in cleanHeaders) {
    delete cleanHeaders.host;
  }
  fetchOptions.headers = cleanHeaders as HeadersInit;

  return await fetch(targetUrl, fetchOptions);
}

/**
 * Log debug information if debug mode is enabled
 * @param debug - Debug mode flag
 * @param message - The message to log
 * @param args - Additional arguments to log
 */
export function debugLog(debug: boolean, message: string, ...args: unknown[]): void {
  if (debug) {
    console.log(`${prefix} ${message}`, ...args);
  }
}
