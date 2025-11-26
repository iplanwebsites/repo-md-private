/**
 * Cloudflare Worker entry point for Embedding Container
 *
 * This Worker acts as a proxy to route requests to the embedding container.
 * The container runs the Node.js embedding server with pre-loaded models.
 */

import { Container, getContainer } from "@cloudflare/containers";

/**
 * Embedding Container class
 * Extends Container to configure the embedding service
 */
export class EmbeddingContainer extends Container {
  // Port the container listens on
  defaultPort = 8787;

  // Keep container alive for 10 minutes after last request
  // This prevents cold starts for frequent embedding requests
  sleepAfter = "10m";

  // Container memory/CPU can be configured here if needed
  // memory = "512Mi";
  // cpu = "1";
}

/**
 * Main Worker handler
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check at Worker level
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(JSON.stringify({
        status: "ok",
        service: "repo-embedding-worker",
        container: "embedding",
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // For embedding requests, route to container
    // Use a single container instance (singleton pattern)
    // For multi-tenant, you could use session IDs to route to different instances
    const containerId = "main";

    try {
      const container = getContainer(env.EMBEDDING_CONTAINER, containerId);

      // Forward the request to the container
      return container.fetch(request);
    } catch (error) {
      return new Response(JSON.stringify({
        error: "Container error",
        message: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
