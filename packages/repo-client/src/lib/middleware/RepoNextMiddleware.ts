/**
 * Next.js middleware integration for RepoMD
 * Handles proxying of _repo/medias/* requests to the RepoMD CDN
 */

import { UnifiedProxyConfig, type ProxyConfigOptions } from '../proxy/UnifiedProxyConfig.js';

// Declare NextResponse as a global (provided by Next.js runtime)
declare const NextResponse: {
  next: () => Response;
} | undefined;

/** Next.js request interface */
export interface NextRequest {
  nextUrl: URL;
  url: string;
  method: string;
  headers: Headers;
}

/** Next.js middleware handler type */
export type NextMiddlewareHandler = (request: NextRequest) => Promise<Response>;

export class RepoNextMiddleware {
  config: UnifiedProxyConfig;

  constructor(options: ProxyConfigOptions) {
    // Let UnifiedProxyConfig handle all defaults
    this.config = new UnifiedProxyConfig(options);
  }

  /**
   * Handle the middleware request
   * @param request - NextRequest from next/server
   * @returns Promise resolving to Response
   */
  async handle(request: NextRequest): Promise<Response> {
    const url = request.nextUrl;

    // Check if this is a repo media request
    if (!url.pathname.startsWith(this.config.mediaUrlPrefix)) {
      // Try to get NextResponse from global scope (provided by Next.js runtime)
      if (typeof NextResponse !== 'undefined') {
        return NextResponse.next();
      }
      // Fallback for non-Next.js environments
      return new Response(null, { status: 404 });
    }

    // Extract the media path
    const mediaPath = url.pathname.replace(this.config.mediaUrlPrefix, '');
    const targetUrl = this.config.getTargetUrl(mediaPath);

    this.config.log(`Next.js middleware proxying: ${url.pathname} → ${targetUrl}`);

    try {
      // Proxy the request to the CDN
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
      });

      // Create a new response with the proxied content
      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      // Add appropriate cache headers
      const cacheHeaders = response.ok
        ? this.config.getCacheHeaders()
        : this.config.getErrorCacheHeaders();

      for (const [key, value] of Object.entries(cacheHeaders)) {
        modifiedResponse.headers.set(key, value);
      }

      return modifiedResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.config.log(`Next.js middleware proxy error: ${errorMessage}`);

      const headers = new Headers(this.config.getErrorCacheHeaders());
      headers.set('Content-Type', 'text/plain');

      return new Response('Proxy error', {
        status: 502,
        headers,
      });
    }
  }

  /**
   * Get the matcher config for Next.js middleware
   * @param prefix - URL prefix to match
   * @returns Matcher pattern string
   */
  static getMatcher(prefix: string = '/_repo'): string {
    return `${prefix}/:path*`;
  }
}

/**
 * Factory function to create a configured middleware handler
 * @param config - Configuration options
 * @returns Middleware handler function
 */
export function createRepoMiddleware(config: ProxyConfigOptions): NextMiddlewareHandler {
  const middleware = new RepoNextMiddleware(config);
  return (request: NextRequest) => middleware.handle(request);
}
