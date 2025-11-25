/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { createProxyMiddleware } from "http-proxy-middleware";

// Final fixed OpenAI API proxy configuration
export const setupOpenAIProxy = (app) => {
  // First handle preflight requests
  app.options("/openai/*", (req, res) => {
    // Get origin from request or use a safe default
    const origin = req.headers.origin || "*";

    console.log("OPTIONS request received for /openai/*:", origin);

    // Set CORS headers for preflight (exactly matching your tRPC setup)
    res.header("Access-Control-Allow-Origin", origin);
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, accept, accept-language, content-type, trpc-batch, x-trpc-source"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Max-Age", "86400");

    // Send 204 No Content for preflight
    return res.status(204).send();
  });

  // Log all requests to /openai to debug routing issues
  app.use("/openai", (req, res, next) => {
    console.log(`OpenAI request received: ${req.method} ${req.originalUrl}`);
    next();
  });

  // Then set up the actual proxy middleware - IMPORTANT: use /openai/* to catch all paths
  const proxyMiddleware = createProxyMiddleware({
    target: "https://oai.helicone.ai",
    changeOrigin: true,
    pathRewrite: {
      "^/openai": "/v1", // Rewrite /openai to /v1 for Helicone
    },
    onProxyReq: (proxyReq, req, res) => {
      // Fixed: Get origin from request headers (removed undefined reference)
      const requestOrigin = req.headers.origin || "*";
      console.log("Proxying request from origin:", requestOrigin);

      // Add OpenAI API key
      proxyReq.setHeader(
        "Authorization",
        `Bearer ${process.env.OPENAI_API_KEY || "nokey"}`
      );

      // Add Helicone headers
      proxyReq.setHeader("Helicone-User-Id", "repo-md-app");
      proxyReq.setHeader("Helicone-Auth", "Bearer sk-helic mxy");

      // Log request for debugging
      console.log(
        `Proxying to Helicone: ${req.method} ${req.originalUrl} → ${proxyReq.path}`
      );
    },
    onProxyRes: (proxyRes, req, res) => {
      // Get origin from request or use a safe default
      const origin = req.headers.origin || "*";

      // Add CORS headers to response
      proxyRes.headers["Access-Control-Allow-Origin"] = origin;
      proxyRes.headers["Access-Control-Allow-Credentials"] = "true";

      console.log(`OpenAI proxy response: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res
        .status(500)
        .json({ error: "OpenAI proxy error", message: err.message });
    },
  });

  // Apply the proxy middleware to /openai path - use /openai/* to catch all subpaths
  app.use("/openai/*", proxyMiddleware);

  // Also apply to /openai directly to catch top-level requests
  app.use("/openai", proxyMiddleware);

  // Add a test endpoint to verify the proxy is accessible
  app.get("/test-openai-route", (req, res) => {
    res.json({
      message: "OpenAI proxy is running",
      endpoints: {
        proxy: "/openai",
        completions: "/openai/chat/completions",
        test: "/test-openai",
      },
    });
  });
};
