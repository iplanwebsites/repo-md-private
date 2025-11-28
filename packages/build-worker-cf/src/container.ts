/**
 * Build Container - Cloudflare Durable Object for container routing
 * @module @repo-md/build-worker-cf
 */

import type { Env, BuildJob, BuildResult } from "./types.js";
import { runBuild } from "./processing/pipeline.js";

/**
 * BuildContainer Durable Object
 *
 * Routes requests to the container and manages lifecycle.
 * The container stays warm for 10 minutes between jobs.
 */
export class BuildContainer implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Handle incoming fetch requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        id: this.state.id.toString(),
        timestamp: new Date().toISOString(),
      });
    }

    // Build endpoint
    if (url.pathname === "/build" && request.method === "POST") {
      try {
        const job: BuildJob = await request.json();
        console.log(`Container ${this.state.id.toString().slice(0, 8)} processing job: ${job.jobId}`);

        const result = await runBuild(job, {
          GIT_CACHE_BUCKET: this.env.GIT_CACHE_BUCKET,
          OUTPUT_BUCKET: this.env.OUTPUT_BUCKET,
        });

        return Response.json(result, {
          status: result.success ? 200 : 500,
        });
      } catch (error) {
        console.error("Build error:", error);
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
          { status: 500 }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
