/**
 * Build Worker CF - Cloudflare Worker Entrypoint
 * @module @repo-md/build-worker-cf
 *
 * Queue consumer that routes build jobs to containers
 */

import type { Env, BuildJob, BuildResult } from "./types.js";
import { GitCache } from "@repo-md/git-cache";

export { BuildContainer } from "./container.js";

/**
 * Queue consumer handler
 */
async function handleQueue(
  batch: MessageBatch<BuildJob>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body;

    console.log(`Processing build job: ${job.jobId} for consumer: ${job.consumerId}`);

    try {
      // Get or create container for this consumer
      const containerId = env.BUILD_CONTAINER.idFromName(job.consumerId);
      const container = env.BUILD_CONTAINER.get(containerId);

      // Send build request to container
      const response = await container.fetch("http://container/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Build failed: ${errorText}`);
      }

      const result: BuildResult = await response.json();

      if (!result.success) {
        throw new Error(result.error ?? "Unknown build error");
      }

      console.log(`Build ${job.jobId} completed successfully`);

      // Send callback if configured
      if (job.callbackUrl) {
        await sendCallback(job.callbackUrl, result).catch((err) => {
          console.error(`Failed to send callback: ${err}`);
        });
      }

      message.ack();
    } catch (error) {
      console.error(`Build error for ${job.jobId}:`, error);

      // Send failure callback
      if (job.callbackUrl) {
        await sendCallback(job.callbackUrl, {
          success: false,
          jobId: job.jobId,
          error: error instanceof Error ? error.message : String(error),
          bundleUrl: "",
          manifest: {} as BuildResult["manifest"],
          stats: {
            duration: 0,
            cacheHit: false,
            staleCommits: 0,
            filesProcessed: 0,
            imagesOptimized: 0,
            bundleSizeBytes: 0,
          },
        }).catch(() => {});
      }

      // Retry the message
      message.retry();
    }
  }
}

/**
 * Send callback with result
 */
async function sendCallback(url: string, result: BuildResult): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  });
}

/**
 * HTTP request handler
 */
async function handleFetch(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const auth = request.headers.get("Authorization");

  // Verify authentication
  if (auth !== `Bearer ${env.API_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Health check
  if (url.pathname === "/health") {
    return Response.json({ status: "ok", timestamp: new Date().toISOString() });
  }

  // Queue a build job
  if (url.pathname === "/build" && request.method === "POST") {
    try {
      const job: BuildJob = await request.json();

      if (!job.jobId || !job.consumerId || !job.repoUrl) {
        return Response.json(
          { error: "Missing required fields: jobId, consumerId, repoUrl" },
          { status: 400 }
        );
      }

      await env.BUILD_QUEUE.send(job);
      return Response.json({ queued: true, jobId: job.jobId });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid request" },
        { status: 400 }
      );
    }
  }

  // Invalidate cache
  if (url.pathname === "/cache/invalidate" && request.method === "POST") {
    try {
      const { consumerId } = await request.json() as { consumerId: string };

      if (!consumerId) {
        return Response.json(
          { error: "Missing consumerId" },
          { status: 400 }
        );
      }

      const cache = new GitCache({ r2Bucket: env.GIT_CACHE_BUCKET });
      await cache.invalidate(consumerId);
      return Response.json({ invalidated: true, consumerId });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Failed to invalidate" },
        { status: 500 }
      );
    }
  }

  // Get cache stats
  if (url.pathname.startsWith("/cache/stats/") && request.method === "GET") {
    try {
      const consumerId = url.pathname.replace("/cache/stats/", "");
      const cache = new GitCache({ r2Bucket: env.GIT_CACHE_BUCKET });
      const stats = await cache.stats(consumerId);
      return Response.json(stats ?? { error: "No cache found" });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Failed to get stats" },
        { status: 500 }
      );
    }
  }

  // Prune old caches
  if (url.pathname === "/cache/prune" && request.method === "POST") {
    try {
      const { olderThanDays = 30, dryRun = true } = await request.json() as {
        olderThanDays?: number;
        dryRun?: boolean;
      };

      const cache = new GitCache({ r2Bucket: env.GIT_CACHE_BUCKET });
      const pruned = await cache.prune({ olderThanDays, dryRun });
      return Response.json({ pruned, count: pruned.length, dryRun });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Failed to prune" },
        { status: 500 }
      );
    }
  }

  return new Response("Not Found", { status: 404 });
}

/**
 * Worker exports
 */
export default {
  queue: handleQueue,
  fetch: handleFetch,
};
