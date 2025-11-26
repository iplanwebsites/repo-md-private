/**
 * Unified proxy configuration system for RepoMD
 * Provides a common interface for all framework proxy implementations
 */

import { LOG_PREFIXES } from '../logger.js';
import { type CacheHeaders } from './nodeUtils.js';

// Re-export for backwards compatibility
export type { CacheHeaders };

const prefix = LOG_PREFIXES.REPO_MD;

/** Configuration options for the proxy */
export interface ProxyConfigOptions {
  projectId: string;
  mediaUrlPrefix?: string;
  r2Url?: string;
  cacheMaxAge?: number;
  debug?: boolean;
  projectPathPrefix?: string;
}

/** Vite proxy configuration handler */
export interface ViteProxyHandler {
  target: string;
  changeOrigin: boolean;
  rewrite: (path: string) => string;
  configure: (proxy: ViteProxyEvents) => void;
}

/** Vite proxy event handler type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ViteProxyEventHandler = (...args: any[]) => void;

/** Vite proxy events interface */
export interface ViteProxyEvents {
  on: (event: string, handler: ViteProxyEventHandler) => void;
}

/** Vite proxy configuration */
export type ViteProxyConfig = Record<string, ViteProxyHandler>;

/** Next.js rewrite configuration */
export interface NextRewrite {
  source: string;
  destination: string;
}

/** Next.js header entry */
export interface NextHeader {
  key: string;
  value: string;
}

/** Next.js headers configuration */
export interface NextHeadersConfig {
  source: string;
  headers: NextHeader[];
}

/** Next.js configuration for proxy */
export interface NextConfig {
  rewrites: () => Promise<NextRewrite[]>;
  headers: () => Promise<NextHeadersConfig[]>;
}

/** Remix loader context */
export interface RemixLoaderContext {
  request: Request;
}

/** Remix loader function type */
export type RemixLoader = (context: RemixLoaderContext) => Promise<Response | null>;

// Default configuration values
export const REPO_MD_DEFAULTS = {
  mediaUrlPrefix: '/_repo/medias/',
  r2Url: 'https://static.repo.md',
  cacheMaxAge: 31536000, // 1 year in seconds
  debug: false,
  projectPathPrefix: 'projects', // Default path prefix for project resources
};

// Keep internal reference for backward compatibility
const DEFAULTS = REPO_MD_DEFAULTS;

/**
 * Base configuration for all proxy implementations
 */
export class UnifiedProxyConfig {
  projectId: string;
  mediaUrlPrefix: string;
  r2Url: string;
  cacheMaxAge: number;
  debug: boolean;
  projectPathPrefix: string;

  constructor({
    projectId,
    mediaUrlPrefix = DEFAULTS.mediaUrlPrefix,
    r2Url = DEFAULTS.r2Url,
    cacheMaxAge = DEFAULTS.cacheMaxAge,
    debug = DEFAULTS.debug,
    projectPathPrefix = DEFAULTS.projectPathPrefix,
  }: ProxyConfigOptions) {
    if (!projectId) {
      throw new Error('projectId is required for proxy configuration');
    }

    this.projectId = projectId;
    this.mediaUrlPrefix = mediaUrlPrefix;
    this.r2Url = r2Url;
    this.cacheMaxAge = cacheMaxAge;
    this.debug = debug;
    this.projectPathPrefix = projectPathPrefix;

    // Remove trailing slash from URLs
    this.mediaUrlPrefix = this.mediaUrlPrefix.replace(/\/$/, '');
    this.r2Url = this.r2Url.replace(/\/$/, '');
  }

  /**
   * Get the target URL for a given media path
   * @param mediaPath - The media file path
   * @returns The full CDN URL
   */
  getTargetUrl(mediaPath: string): string {
    // Remove leading slash if present
    const cleanPath = mediaPath.replace(/^\//, '');
    return `${this.r2Url}/${this.projectPathPrefix}/${this.projectId}/_shared/medias/${cleanPath}`;
  }

  /**
   * Get the source pattern for matching requests
   * @returns The pattern to match incoming requests
   */
  getSourcePattern(): string {
    return `${this.mediaUrlPrefix}/:path*`;
  }

  /**
   * Get cache headers for successful responses
   * @returns Headers object
   */
  getCacheHeaders(): CacheHeaders {
    return {
      'Cache-Control': `public, max-age=${this.cacheMaxAge}, immutable`,
      'X-Repo-Proxy': 'true',
    };
  }

  /**
   * Get error cache headers
   * @returns Headers object for error responses
   */
  getErrorCacheHeaders(): CacheHeaders {
    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Expires': '0',
      'Pragma': 'no-cache',
    };
  }

  /**
   * Log a debug message if debug mode is enabled
   * @param message - The message to log
   */
  log(message: string): void {
    if (this.debug) {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Create a Vite proxy configuration
   * @returns Vite proxy config
   */
  toViteConfig(): ViteProxyConfig {
    const proxyPath = this.mediaUrlPrefix;

    return {
      [proxyPath]: {
        target: this.r2Url,
        changeOrigin: true,
        rewrite: (path: string): string => {
          const rewritten = path.replace(proxyPath, `/projects/${this.projectId}/_shared/medias`);
          this.log(`Vite proxy rewrite: ${path} → ${rewritten}`);
          return rewritten;
        },
        configure: (proxy: ViteProxyEvents): void => {
          if (this.debug) {
            proxy.on('error', (err, req) => {
              console.error(`${prefix} Vite proxy error:`, err, (req as { url?: string })?.url);
            });
            proxy.on('proxyReq', (_proxyReq, req) => {
              this.log(`Vite proxy request: ${(req as { url?: string })?.url}`);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              this.log(`Vite proxy response: ${(proxyRes as { statusCode?: number })?.statusCode} for ${(req as { url?: string })?.url}`);
            });
          }
        },
      },
    };
  }

  /**
   * Create a Next.js rewrite configuration
   * @returns Next.js config object
   */
  toNextConfig(): NextConfig {
    const self = this;
    return {
      async rewrites(): Promise<NextRewrite[]> {
        return [
          {
            source: `${self.mediaUrlPrefix}:path*`,
            destination: `${self.r2Url}/projects/${self.projectId}/_shared/medias/:path*`,
          },
        ];
      },
      async headers(): Promise<NextHeadersConfig[]> {
        return [
          {
            source: `${self.mediaUrlPrefix}:path*`,
            headers: Object.entries(self.getCacheHeaders()).map(([key, value]) => ({
              key,
              value: String(value),
            })),
          },
        ];
      },
    };
  }

  /**
   * Create a Remix loader configuration
   * @returns Remix loader function
   */
  toRemixLoader(): RemixLoader {
    return async ({ request }: RemixLoaderContext): Promise<Response | null> => {
      const url = new URL(request.url);

      if (!url.pathname.startsWith(this.mediaUrlPrefix)) {
        return null;
      }

      const mediaPath = url.pathname.replace(this.mediaUrlPrefix, '');
      const targetUrl = this.getTargetUrl(mediaPath);

      this.log(`Remix proxy: ${url.pathname} → ${targetUrl}`);

      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: request.headers,
        });

        const headers = new Headers(response.headers);

        if (response.ok) {
          for (const [key, value] of Object.entries(this.getCacheHeaders())) {
            headers.set(key, value);
          }
        } else {
          for (const [key, value] of Object.entries(this.getErrorCacheHeaders())) {
            headers.set(key, value);
          }
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        if (this.debug) {
          console.error(`${prefix} Remix proxy error:`, error);
        }

        const headers = new Headers(this.getErrorCacheHeaders());
        headers.set('Content-Type', 'text/plain');

        return new Response('Proxy error', {
          status: 502,
          headers,
        });
      }
    };
  }

  /**
   * Get generic framework configuration instructions
   * @param framework - The framework name
   * @returns Configuration instructions
   */
  getFrameworkInstructions(framework: string): string {
    const instructions: Record<string, string> = {
      vite: `// vite.config.js
import { defineConfig } from 'vite';
import { RepoMD } from 'repo-md';

const repo = new RepoMD({ projectId: '${this.projectId}' });
const proxyConfig = repo.getUnifiedProxyConfig();

export default defineConfig({
  server: {
    proxy: proxyConfig.toViteConfig()
  }
});`,

      nextjs: `// next.config.js
import { RepoMD } from 'repo-md';

const repo = new RepoMD({ projectId: '${this.projectId}' });
const proxyConfig = repo.getUnifiedProxyConfig();

export default {
  ...proxyConfig.toNextConfig()
};`,

      remix: `// app/routes/$.tsx
import { RepoMD } from 'repo-md';

const repo = new RepoMD({ projectId: '${this.projectId}' });
const proxyConfig = repo.getUnifiedProxyConfig();

export const loader = proxyConfig.toRemixLoader();`,

      vue: `// vue.config.js
const { RepoMD } = require('repo-md');

const repo = new RepoMD({ projectId: '${this.projectId}' });
const proxyConfig = repo.getUnifiedProxyConfig();

module.exports = {
  devServer: {
    proxy: proxyConfig.toViteConfig()
  }
};`,
    };

    return instructions[framework.toLowerCase()] || 'Framework not supported';
  }
}

/**
 * Factory function to create a unified proxy configuration
 * @param config - Configuration options
 * @returns Configured proxy instance
 */
export function createUnifiedProxyConfig(config: ProxyConfigOptions): UnifiedProxyConfig {
  return new UnifiedProxyConfig(config);
}
