/**
 * Container Server
 * @module @repo-md/build-worker-cf
 *
 * HTTP server that runs inside the Cloudflare Container.
 * Receives build requests from the worker and executes them.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { runBuild } from "./processing/pipeline.js";
import type { BuildJob, BuildResult } from "./types.js";

const PORT = parseInt(process.env.PORT ?? "8080", 10);

/**
 * Parse JSON body from request
 */
async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(
  res: ServerResponse,
  status: number,
  data: unknown
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/**
 * Handle incoming requests
 */
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === "/health" && req.method === "GET") {
    sendJson(res, 200, {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
    return;
  }

  // Build endpoint
  if (url.pathname === "/build" && req.method === "POST") {
    try {
      const job = await parseBody<BuildJob>(req);

      console.log(`[Server] Starting build: ${job.jobId}`);
      const startTime = Date.now();

      // Get R2 bucket bindings from environment
      // In CF Containers, these are passed via the container env
      const env = {
        GIT_CACHE_BUCKET: (globalThis as unknown as { GIT_CACHE_BUCKET: R2Bucket }).GIT_CACHE_BUCKET,
        OUTPUT_BUCKET: (globalThis as unknown as { OUTPUT_BUCKET: R2Bucket }).OUTPUT_BUCKET,
      };

      const result = await runBuild(job, env);

      console.log(
        `[Server] Build ${result.success ? "completed" : "failed"}: ${job.jobId} in ${Date.now() - startTime}ms`
      );

      sendJson(res, result.success ? 200 : 500, result);
    } catch (error) {
      console.error("[Server] Build error:", error);
      sendJson(res, 500, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  // Not found
  sendJson(res, 404, { error: "Not Found" });
}

/**
 * Create and start the server
 */
const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("[Server] Unhandled error:", error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal Server Error" });
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Build server ready on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down...");
  server.close(() => {
    console.log("[Server] Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down...");
  server.close(() => {
    console.log("[Server] Server closed");
    process.exit(0);
  });
});
