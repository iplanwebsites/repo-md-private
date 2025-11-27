// src/cf-worker.ts
// Cloudflare Containers entry point
// https://developers.cloudflare.com/containers/

import { DurableObject } from 'cloudflare:workers';

interface Env {
  BUILD_CONTAINER: DurableObjectNamespace;
  WORKER_SECRET?: string;
}

interface Container {
  running: boolean;
  start(): Promise<void>;
  monitor(): Promise<void>;
  destroy(): Promise<void>;
  signal(sig: string): Promise<void>;
  getTcpPort(port: number): { fetch(request: Request): Promise<Response> };
  setInactivityTimeout(ms: number): void;
}

interface ContainerContext {
  container: Container;
  storage: DurableObjectStorage;
  id: DurableObjectId;
  props: unknown;
}

/**
 * RepoBuildContainer - Container Durable Object
 * Extends DurableObject to get proper container support in CF Containers beta
 */
export class RepoBuildContainer extends DurableObject {
  // Container configuration (read by CF runtime)
  defaultPort = 8080;
  sleepAfter = '10m';

  // Proxy requests to the container via this.ctx.container
  async fetch(request: Request): Promise<Response> {
    try {
      const ctx = this.ctx as unknown as ContainerContext;
      const container = ctx.container;

      if (!container) {
        return new Response(JSON.stringify({
          status: 'error',
          message: 'Container not available',
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Start container if not running
      if (!container.running) {
        console.log('Starting container...');
        await container.start();

        // Wait for container to be ready
        let attempts = 0;
        while (!container.running && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }

        if (!container.running) {
          return new Response(JSON.stringify({
            status: 'error',
            message: 'Container failed to start after 30 seconds',
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Set inactivity timeout (10 minutes)
      container.setInactivityTimeout(10 * 60 * 1000);

      // Get the TCP port proxy
      const port = container.getTcpPort(this.defaultPort);
      const url = new URL(request.url);
      url.protocol = 'http:';
      const httpRequest = new Request(url.toString(), request);

      // Retry connection as server may need time to start
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          // Re-check container is running each attempt
          if (!container.running) {
            console.log(`Container stopped, restarting (attempt ${attempt + 1})...`);
            await container.start();
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          return await port.fetch(httpRequest);
        } catch (error: any) {
          lastError = error;
          const msg = error.message || '';
          if (msg.includes('not listening') || msg.includes('not running')) {
            // Wait and retry if server isn't ready
            console.log(`Server not ready (attempt ${attempt + 1}): ${msg}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          throw error;
        }
      }

      throw lastError || new Error('Container failed to respond after 30 attempts');
    } catch (error: any) {
      return new Response(JSON.stringify({
        status: 'error',
        message: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Lifecycle methods for CF Containers
  onStart() {
    console.log('Container started', { port: this.defaultPort });
  }

  onStop() {
    console.log('Container stopped');
  }

  onError(error: unknown) {
    console.error('Container error:', error);
  }
}

/**
 * Main Worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const headers = { 'Content-Type': 'application/json' };

    // Health check (handled by Worker)
    if (pathname === '/health' || pathname === '/') {
      return new Response(JSON.stringify({
        status: 'healthy',
        worker: 'repo-build-worker-cf',
        timestamp: new Date().toISOString(),
        platform: 'cloudflare-containers',
      }), { headers });
    }

    // Test endpoints - route to container
    if (pathname === '/test' || pathname.startsWith('/test/')) {
      try {
        const id = env.BUILD_CONTAINER.idFromName('test-runner');
        const container = env.BUILD_CONTAINER.get(id);
        return await container.fetch(request);
      } catch (error: any) {
        return new Response(JSON.stringify({
          status: 'error',
          message: error.message,
        }), { status: 500, headers });
      }
    }

    // System info - route to container
    if (pathname === '/system' || pathname === '/jobs' || pathname.startsWith('/jobs/')) {
      try {
        const id = env.BUILD_CONTAINER.idFromName('system-info');
        const container = env.BUILD_CONTAINER.get(id);
        return await container.fetch(request);
      } catch (error: any) {
        return new Response(JSON.stringify({
          status: 'error',
          message: error.message,
        }), { status: 500, headers });
      }
    }

    // Process endpoint - route to container by jobId
    if (pathname === '/process') {
      try {
        const body = await request.clone().json() as { jobId?: string };
        const { jobId } = body;

        if (!jobId) {
          return new Response(JSON.stringify({
            status: 'error',
            message: 'jobId is required',
          }), { status: 400, headers });
        }

        const id = env.BUILD_CONTAINER.idFromName(jobId);
        const container = env.BUILD_CONTAINER.get(id);
        return await container.fetch(request);
      } catch (error: any) {
        return new Response(JSON.stringify({
          status: 'error',
          message: error.message,
        }), { status: 500, headers });
      }
    }

    // Inference endpoints
    if (pathname.startsWith('/inference/')) {
      try {
        const id = env.BUILD_CONTAINER.idFromName('inference-0');
        const container = env.BUILD_CONTAINER.get(id);
        return await container.fetch(request);
      } catch (error: any) {
        return new Response(JSON.stringify({
          status: 'error',
          message: error.message,
        }), { status: 500, headers });
      }
    }

    return new Response(JSON.stringify({
      status: 'error',
      message: 'Unknown route',
      routes: ['/', '/health', '/test', '/system', '/jobs', '/process', '/inference/*'],
    }), { status: 404, headers });
  },
};
