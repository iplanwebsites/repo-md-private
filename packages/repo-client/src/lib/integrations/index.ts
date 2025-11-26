/**
 * Framework integrations for RepoMD
 * Central export point for all framework-specific integrations
 */

import { UnifiedProxyConfig, type ViteProxyConfig, type NextConfig, type RemixLoader } from '../proxy/UnifiedProxyConfig.js';
import { RepoMD } from '../RepoMd.js';
import { getProjectIdFromEnv } from '../utils/env.js';
import { nuxtRepoMdPlugin } from './nuxt.js';

/** Detection result for framework */
export type DetectedFramework =
  | 'nextjs'
  | 'nuxt'
  | 'vite'
  | 'remix'
  | 'astro'
  | 'vue'
  | 'svelte'
  | 'react'
  | 'express'
  | 'fastify'
  | 'koa'
  | null;

/** Options for auto-detect proxy */
export interface RepoMdProxyOptions {
  projectId?: string;
  framework?: string;
  route?: string;
  mediaUrlPrefix?: string;
  debug?: boolean;
}

/** Nuxt proxy result */
export interface NuxtProxyResult {
  plugin: () => ReturnType<typeof nuxtRepoMdPlugin>;
  instructions: string;
}

/** Generic proxy result */
export interface GenericProxyResult {
  vite: ViteProxyConfig;
  next: NextConfig;
  remix: RemixLoader;
  getConfig: () => UnifiedProxyConfig;
  _warning: string;
}

/** Proxy result type */
export type ProxyResult = ViteProxyConfig | NextConfig | RemixLoader | NuxtProxyResult | GenericProxyResult;

/** Create RepoMD options */
export interface CreateRepoMdOptions {
  projectId?: string;
  debug?: boolean;
  [key: string]: unknown;
}

// Declare global types for framework detection
declare const window: {
  Vue?: unknown;
  __VUE__?: unknown;
  __svelte?: unknown;
  React?: unknown;
} | undefined;

declare const global: {
  express?: unknown;
  fastify?: unknown;
  koa?: unknown;
} | undefined;

declare const globalThis: {
  astroConfig?: unknown;
};

/**
 * Auto-detect the current framework/environment
 * @returns The detected framework name
 */
export function detectFramework(): DetectedFramework {
  // Check for framework-specific globals or environment variables
  if (typeof process !== 'undefined' && process.env) {
    // Next.js detection
    if (process.env.NEXT_RUNTIME || process.env.__NEXT_PRIVATE_PREBUNDLED_REACT) {
      return 'nextjs';
    }

    // Nuxt detection
    if (process.env.NUXT_ENV || process.env._NUXT_VERSION) {
      return 'nuxt';
    }

    // Vite detection
    if (process.env.VITE || (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE?: unknown } }).env?.VITE)) {
      return 'vite';
    }

    // Remix detection
    if (process.env.REMIX_DEV_SERVER_WS_PORT) {
      return 'remix';
    }

    // Astro detection
    if (process.env.ASTRO || globalThis.astroConfig) {
      return 'astro';
    }
  }

  // Browser-based detection
  if (typeof window !== 'undefined') {
    // Vue detection
    if (window.Vue || window.__VUE__) {
      return 'vue';
    }

    // Svelte detection
    if (window.__svelte) {
      return 'svelte';
    }

    // React detection (less reliable, as React doesn't set global markers)
    if (window.React || document.querySelector('[data-reactroot]')) {
      return 'react';
    }
  }

  // Node.js framework detection
  if (typeof global !== 'undefined') {
    // Express detection
    if (global.express) {
      return 'express';
    }

    // Fastify detection
    if (global.fastify) {
      return 'fastify';
    }

    // Koa detection
    if (global.koa) {
      return 'koa';
    }
  }

  return null;
}

/**
 * Universal proxy configuration getter
 * Works with any framework by returning the appropriate configuration
 *
 * @param options - Configuration options or project ID string
 * @returns Framework-specific configuration object
 */
export function repoMdProxy(options: RepoMdProxyOptions | string = {}): ProxyResult {
  // Allow simple string parameter for project ID
  const config = typeof options === 'string'
    ? { projectId: options }
    : options;

  const projectId = getProjectIdFromEnv(config.projectId, 'auto-detect proxy');
  if (!projectId) {
    throw new Error('projectId is required for proxy configuration');
  }
  const framework = config.framework || detectFramework();

  // If route is provided, construct the mediaUrlPrefix from it
  const mediaUrlPrefix = config.route
    ? `/${config.route}/medias`
    : config.mediaUrlPrefix;

  // Create the proxy configuration
  const proxyConfig = new UnifiedProxyConfig({
    projectId,
    mediaUrlPrefix,
    debug: config.debug,
  });

  // Return framework-specific configuration
  switch (framework) {
    case 'vite':
    case 'vue':
      return proxyConfig.toViteConfig();

    case 'nextjs':
      // For Next.js, return the config object (not the full next.config.js)
      return proxyConfig.toNextConfig();

    case 'remix':
      return proxyConfig.toRemixLoader();

    case 'nuxt':
      // Return instructions for Nuxt
      return {
        plugin: () => nuxtRepoMdPlugin(projectId, config as Record<string, unknown>),
        instructions: 'Use nuxtRepoMdPlugin or see nuxtModuleExample for module setup',
      };

    default:
      // Return a generic object with all configurations
      return {
        vite: proxyConfig.toViteConfig(),
        next: proxyConfig.toNextConfig(),
        remix: proxyConfig.toRemixLoader(),
        // Helper to manually get proxy config
        getConfig: () => proxyConfig,
        // Framework detection failed message
        _warning: framework
          ? `Unknown framework: ${framework}`
          : 'Could not auto-detect framework. Use framework-specific exports or config.vite, config.next, config.remix',
      };
  }
}

/**
 * Create a RepoMD instance with environment-based configuration
 * @param options - Optional configuration overrides
 * @returns Configured RepoMD instance
 */
export function createRepoMd(options: CreateRepoMdOptions = {}): RepoMD {
  const projectId = options.projectId || getProjectIdFromEnv() || undefined;

  return new RepoMD({
    projectId,
    ...options,
  });
}

// Re-export the main class for convenience
export { RepoMD };

// Export all framework-specific integrations
export { viteRepoMdProxy, viteRepoMdPlugin } from './vite.js';
export { nextRepoMdMiddleware, nextRepoMdConfig, withRepoMd } from './nextjs.js';
export { remixRepoMdLoader, remixRepoMdAction, remixRepoMdRoute } from './remix.js';
export { cloudflareRepoMdHandler, cloudflareRepoMdWorker, cloudflareRepoMdPagesFunction } from './cloudflare.js';
export { nuxtRepoMdPlugin, nuxtRepoMdCachedHandler } from './nuxt.js';
export { nuxtRepoMdModuleConfig, createNuxtModuleSetup, nuxtModuleExample } from './nuxt-module.mjs';
export { svelteKitRepoMdHandle, svelteKitRepoMdSequenceHandle } from './sveltekit.js';
export { expressRepoMdMiddleware, expressRepoMdErrorHandler } from './express.js';
export { fastifyRepoMdPlugin } from './fastify.js';
export { koaRepoMdMiddleware, koaRepoMdStreamingMiddleware } from './koa.js';
export { astroRepoMdMiddleware, astroRepoMdIntegration, astroRepoMdFullIntegration } from './astro.js';

// Re-export types
export type { ViteRepoMdOptions, VitePlugin, VitePluginConfig } from './vite.js';
export type { NextRepoMdOptions, NextMiddlewareResult, MergedNextConfig } from './nextjs.js';
export type { RemixRepoMdOptions, RemixAction, RemixRouteModule } from './remix.js';
export type {
  CloudflareRepoMdOptions,
  CloudflareRequestHandler,
  CloudflareEnv,
  CloudflareWorker,
  CloudflarePagesFunction,
} from './cloudflare.js';
export type { NuxtRepoMdOptions, NuxtPlugin, CachedHandlerResult } from './nuxt.js';
export type { SvelteKitRepoMdOptions, SvelteKitHandle } from './sveltekit.js';
export type {
  ExpressRepoMdOptions,
  ExpressMiddleware,
  ExpressErrorMiddleware,
} from './express.js';
export type { FastifyRepoMdOptions, FastifyPlugin } from './fastify.js';
export type { KoaRepoMdOptions, KoaMiddleware } from './koa.js';
export type { AstroRepoMdOptions, AstroMiddleware, AstroIntegration } from './astro.js';
