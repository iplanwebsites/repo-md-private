// src/cf-worker.js
// Cloudflare Containers entry point with transformer.js embeddings support
// https://developers.cloudflare.com/containers/
//
// This version uses pre-loaded models for text and image embeddings

import { Container } from '@cloudflare/containers';

/**
 * RepoBuildContainer - Durable Object that manages individual container instances
 * Each container handles build jobs with isolated state and resources.
 *
 * This version has embeddings ENABLED via pre-loaded transformer.js models.
 */
export class RepoBuildContainer extends Container {
  // Default port where the Express app listens in the container
  defaultPort = 8080;

  // Container will sleep after 10 minutes of inactivity
  // Increased from 5m to reduce cold starts for embedding-heavy workloads
  sleepAfter = '10m';

  // Maximum execution time (15 minutes for heavy embedding tasks)
  maxExecutionTime = '15m';

  // Environment variables passed to the container
  // IMPORTANT: SKIP_EMBEDDINGS=false enables transformer.js embeddings
  envVars = {
    NODE_ENV: 'production',
    PORT: '8080',
    // Embeddings ENABLED - models are pre-loaded in Docker image
    SKIP_EMBEDDINGS: 'false',
    // Use cached models (offline mode)
    TRANSFORMERS_OFFLINE: '1',
    HF_HUB_OFFLINE: '1',
    // Model cache location
    TRANSFORMERS_CACHE: '/app/models',
    HF_HOME: '/root/.cache/huggingface',
  };

  /**
   * Lifecycle hook: Called when container successfully starts
   */
  override onStart() {
    console.log('Build container started with embeddings support', {
      containerId: this.id,
      port: this.defaultPort,
      embeddings: 'enabled',
      offlineMode: true,
    });
  }

  /**
   * Lifecycle hook: Called when container shuts down
   */
  override onStop() {
    console.log('Build container shut down', {
      containerId: this.id,
    });
  }

  /**
   * Lifecycle hook: Called when container encounters an error
   */
  override onError(error) {
    console.error('Build container error', {
      containerId: this.id,
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Helper function to get a random container for load balancing
 * @param {DurableObjectNamespace} namespace - The container namespace
 * @param {number} count - Number of containers in the pool
 * @returns {Promise<DurableObjectStub>} - A container stub
 */
async function getRandomContainer(namespace, count = 3) {
  const index = Math.floor(Math.random() * count);
  return namespace.getByName(`container-${index}`);
}

/**
 * Main Worker fetch handler
 * Routes incoming requests to appropriate containers
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health check endpoint (handled by Worker, not container)
    if (pathname === '/health' || pathname === '/') {
      return new Response(JSON.stringify({
        status: 'healthy',
        worker: 'repo-build-worker',
        timestamp: new Date().toISOString(),
        platform: 'cloudflare-containers',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Route /process requests to containers with sticky sessions
    if (pathname === '/process') {
      try {
        // Parse job request
        const body = await request.json();
        const { jobId } = body;

        if (!jobId) {
          return new Response(JSON.stringify({
            status: 'error',
            message: 'jobId is required',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Use jobId-based routing for sticky sessions
        // This ensures the same job always goes to the same container
        const container = env.BUILD_CONTAINER.getByName(jobId);

        // Forward request to container
        const response = await container.fetch(request);
        return response;

      } catch (error) {
        console.error('Error routing request to container:', error);
        return new Response(JSON.stringify({
          status: 'error',
          message: error.message,
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Load-balanced route for general requests (optional)
    if (pathname.startsWith('/lb/')) {
      try {
        const container = await getRandomContainer(env.BUILD_CONTAINER, 3);
        return await container.fetch(request);
      } catch (error) {
        console.error('Error in load-balanced route:', error);
        return new Response(JSON.stringify({
          status: 'error',
          message: error.message,
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Inference endpoints (route to specific container)
    if (pathname.startsWith('/inference/')) {
      try {
        const container = env.BUILD_CONTAINER.getByName('inference-0');
        return await container.fetch(request);
      } catch (error) {
        console.error('Error routing to inference container:', error);
        return new Response(JSON.stringify({
          status: 'error',
          message: error.message,
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Unknown route
    return new Response(JSON.stringify({
      status: 'error',
      message: 'Unknown route',
      available_routes: ['/', '/health', '/process', '/lb/*', '/inference/*'],
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },

  /**
   * Scheduled event handler (optional - for cron jobs)
   */
  async scheduled(event, env, ctx) {
    console.log('🕐 Scheduled event triggered', {
      scheduledTime: event.scheduledTime,
      cron: event.cron,
    });

    // Example: Clean up old containers or perform maintenance
    // ctx.waitUntil(performMaintenance(env));
  },

  /**
   * Queue message handler (optional - for async job processing)
   */
  async queue(batch, env, ctx) {
    console.log('📬 Queue batch received', {
      messages: batch.messages.length,
    });

    // Example: Process each job in the batch
    for (const message of batch.messages) {
      try {
        const job = message.body;
        const container = env.BUILD_CONTAINER.getByName(job.jobId);

        // Process job asynchronously
        ctx.waitUntil(
          container.fetch(new Request('http://localhost/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job),
          }))
        );

        // Acknowledge message
        message.ack();
      } catch (error) {
        console.error('Error processing queue message:', error);
        message.retry();
      }
    }
  },
};

/**
 * Export Durable Object class
 */
export { RepoBuildContainer };
