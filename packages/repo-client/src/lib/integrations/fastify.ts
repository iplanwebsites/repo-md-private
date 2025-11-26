/**
 * Fastify integration for RepoMD
 * Provides a Fastify plugin for media proxy
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
import type { BaseProxyOptions } from '../types/common.js';

/** Fastify plugin options - extends base proxy options */
export interface FastifyRepoMdOptions extends BaseProxyOptions {
  /** Project ID (required for Fastify plugin) */
  projectId: string;
}

/** Fastify request interface */
export interface FastifyRequest {
  url: string;
  method: string;
  headers: HeaderMap;
}

/** Fastify reply interface */
export interface FastifyReply {
  code: (statusCode: number) => FastifyReply;
  header: (key: string, value: string) => FastifyReply;
  send: (payload?: unknown) => FastifyReply;
}

/** Fastify route handler */
export type FastifyRouteHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

/** Fastify instance interface */
export interface FastifyInstance {
  get: (path: string, handler: FastifyRouteHandler) => void;
  head: (path: string, handler: FastifyRouteHandler) => void;
}

/** Fastify plugin done callback */
export type FastifyDone = () => void;

/** Fastify plugin function */
export type FastifyPlugin = (
  fastify: FastifyInstance,
  options: FastifyRepoMdOptions,
  done: FastifyDone
) => Promise<void>;

/**
 * Create a Fastify plugin for RepoMD media proxy
 * @param fastify - Fastify instance
 * @param options - Plugin options including projectId
 * @param done - Callback to signal plugin registration complete
 */
async function fastifyRepoMdPlugin(
  fastify: FastifyInstance,
  options: FastifyRepoMdOptions,
  done: FastifyDone
): Promise<void> {
  const { projectId, ...proxyOptions } = options;

  if (!projectId) {
    throw new Error('RepoMD Fastify plugin requires a projectId option');
  }

  const config = new UnifiedProxyConfig({
    projectId,
    ...proxyOptions,
  });

  // Register a wildcard route for media files
  fastify.get(`${config.mediaUrlPrefix}*`, async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const mediaPath = parseMediaPath(request.url, config.mediaUrlPrefix);

    if (!mediaPath) {
      // This shouldn't happen with our route, but just in case
      reply.code(404).send('Not found');
      return;
    }

    debugLog(config.debug, `Fastify proxy: ${request.url}`);

    try {
      const targetUrl = config.getTargetUrl(mediaPath);

      // Create headers object from request
      const requestHeaders: HeaderMap = {};
      Object.entries(request.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'host') {
          requestHeaders[key] = value;
        }
      });

      const response = await proxyFetch(targetUrl, {
        method: request.method,
        headers: requestHeaders,
      });

      const headers = response.ok
        ? createResponseHeaders(response.headers, config.getCacheHeaders())
        : createResponseHeaders(response.headers, config.getErrorCacheHeaders());

      // Set response headers
      Object.entries(headers).forEach(([key, value]) => {
        reply.header(key, value);
      });

      // Set status code
      reply.code(response.status);

      // Stream the response
      if (response.body) {
        // For Node.js 18+, response.body is a web stream
        // We need to convert it to a Node.js stream
        const reader = response.body.getReader();

        try {
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }

          // Combine all chunks and send
          const buffer = Buffer.concat(chunks);
          reply.send(buffer);
        } finally {
          reader.releaseLock();
        }
      } else {
        reply.send();
      }
    } catch (error) {
      const errorResponse = handleProxyError(error, config.getErrorCacheHeaders(), config.debug);

      Object.entries(errorResponse.headers).forEach(([key, value]) => {
        reply.header(key, value);
      });

      reply.code(errorResponse.status).send(errorResponse.body);
    }
  });

  // Also handle HEAD requests for media files
  fastify.head(`${config.mediaUrlPrefix}*`, async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const mediaPath = parseMediaPath(request.url, config.mediaUrlPrefix);

    if (!mediaPath) {
      reply.code(404).send();
      return;
    }

    try {
      const targetUrl = config.getTargetUrl(mediaPath);
      const response = await proxyFetch(targetUrl, {
        method: 'HEAD',
        headers: request.headers,
      });

      const headers = response.ok
        ? createResponseHeaders(response.headers, config.getCacheHeaders())
        : createResponseHeaders(response.headers, config.getErrorCacheHeaders());

      Object.entries(headers).forEach(([key, value]) => {
        reply.header(key, value);
      });

      reply.code(response.status).send();
    } catch {
      reply.code(502).send();
    }
  });

  done();
}

// Set Fastify plugin metadata
const pluginMeta = {
  fastify: '4.x',
  name: 'repo-md-proxy',
};

// Attach metadata to plugin
(fastifyRepoMdPlugin as FastifyPlugin & { [key: symbol]: typeof pluginMeta })[Symbol.for('plugin-meta')] = pluginMeta;

/**
 * Export the plugin function
 * Usage: fastify.register(fastifyRepoMdPlugin, { projectId: 'your-project-id' })
 */
export { fastifyRepoMdPlugin };
