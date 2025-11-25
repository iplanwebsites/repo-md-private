// server.js
import dotenv from "dotenv";
dotenv.config();
import "./instrument.mjs";

import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import * as Sentry from "@sentry/node";

import morgan from "morgan";
import { connectDb, db } from "./db.js";
import cors from "cors";
import { createContext } from "./lib/trpc/trpc.js";

//import agoraTokenRoutes from "./routes/agoraTokenRoutes.js";
//import calendarRoutes from "./routes/calendarRoutes.js";
//import llmApi from "./routes/llmApi.js";
//import dalleApi from "./routes/dalleApi.js";
import cloudRunCallbackRoutes from "./routes/express/cloudRunCallbackRoutes.js";
import githubCallbackRoutes from "./routes/express/githubCallbackRoutes.js";
import githubWebhookRoutes from "./routes/express/githubWebhookRoutes.js";
import projectWebhookRoutes from "./routes/express/projectWebhookRoutes.js";
import publicApiRoutes from "./routes/express/publicApi.js";
import mediaUploadRoutes from "./routes/express/mediaUploadRoutes.js";
import projectGenerationStreamRoutes from "./routes/express/projectGenerationStreamRoutes.js";
import slackRoutes from "./routes/express/slackRoutes.js";
import scheduleRoutes from "./routes/express/scheduleRoutes.js";

// Initialize express app and configure environment variables
const app = express();

const MAX_UPLOAD_SIZE = process.env.MAX_UPLOAD_SIZE || "20mb";
// 1h de recording a 64Kbps  ca fait 230.4mb.

// Import routes
import appRouter from "./routes/trpc.js";
// import userRoutes from "./routes/userRoutes_OLD.js";

import { setupOpenAIProxy } from "./lib/openaiProxy.js";

// Connect to database
await connectDb();

// Create context function for tRPC
// In JavaScript, we remove the type annotations but keep the function structure
//const createContext = ({ req, res }) => ({});

// Define CORS configuration
const corsOptions = {
  origin: [
    "https://repo.md",
    "https://www.repo.md",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5177",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "trpc-batch",
    "accept",
    "accept-language",
    "content-type",
    //duplicate headers
    "Content-Type",
    "Authorization",
    "x-trpc-source",
    "trpc-batch-mode", // Required for tRPC batching
    "Access-Control-Allow-Origin", // Important for CORS preflight
    "Access-Control-Allow-Credentials", // Important for credentials

    "origin",
    "referer",
    "user-agent",
    "accept-encoding",
    "accept-language",
    "accept",
    "sec-fetch-site",
  ],
  maxAge: 86400, // CORS preflight cache time in seconds (24 hours)
};

// Apply CORS middleware before any routes

app.use(cors(corsOptions));

// Configure standard middleware BEFORE routes
app.use(express.json({ limit: MAX_UPLOAD_SIZE }));
app.use(express.urlencoded({ limit: MAX_UPLOAD_SIZE, extended: true }));
app.use(morgan("dev")); // HTTP request logger

//app.use("/agora/token", agoraTokenRoutes);
//app.use("/calendar", calendarRoutes);
//app.use("/llmApi", llmApi);
//app.use("/dalleApi", dalleApi);
// Register public API routes
app.use("/v1", publicApiRoutes);
// Register Cloud Run callback routes
// When USE_DEV_CLOUDRUN_WORKER=true, both endpoints will be available to handle callbacks from either environment
console.log("\n🔌 ====== REGISTERING CLOUDRUN CALLBACK ROUTES ======");
console.log("📡 Registering production callback route: /api/cloudrun");
app.use("/api/cloudrun", cloudRunCallbackRoutes);
app.use("/auth/github", githubCallbackRoutes);

// Register GitHub webhook routes
console.log("🎣 Registering GitHub webhook routes: /api/github");
app.use("/api/github", githubWebhookRoutes);

// Register project webhook routes
console.log("🎯 Registering project webhook routes: /api/webhooks");
app.use("/api/webhooks", projectWebhookRoutes);

// Register media upload routes
console.log("📷 Registering media upload routes: /api/projects");
app.use("/api/projects", mediaUploadRoutes);

// Register project generation streaming routes
console.log("🤖 Registering project generation streaming routes: /api/project-generation/stream");
app.use("/api/project-generation/stream", projectGenerationStreamRoutes);

// Register Slack routes
console.log("💬 Registering Slack routes: /api/slack");
app.use("/api/slack", slackRoutes);

// Register LLM routes
console.log("🤖 Registering LLM routes: /api/llm");
const llmRoutes = await import("./routes/llm.js");
app.use("/api/llm", llmRoutes.default);

// Register EditorChat streaming routes
console.log("💬 Registering EditorChat streaming routes: /api/editorChat");
import editorChatStreamRoutes from "./routes/express/editorChatStreamRoutes.js";
app.use("/api/editorChat", editorChatStreamRoutes);

// Register EditorChat action routes
console.log("⚡ Registering EditorChat action routes: /api/editorChat/actions");
import editorChatActionsRoutes from "./routes/express/editorChatActionsRoutes.js";
app.use("/api/editorChat/actions", editorChatActionsRoutes);

// Register Public Agent routes
console.log("🌐 Registering Public Agent routes: /api/public/agent");
import publicAgentRoutes from "./routes/express/publicAgentRoutes.js";
app.use("/api/public/agent", publicAgentRoutes);

// Register Scheduling routes
console.log("📅 Registering Scheduling routes: /api/schedule");
app.use("/api/schedule", scheduleRoutes);

if (process.env.USE_DEV_CLOUDRUN_WORKER === "true") {
  console.log("📡 Registering development callback route: /api/cloudrun-dev");
  console.log("🔧 DEV_WORKER mode is enabled");
  app.use("/api/cloudrun-dev", cloudRunCallbackRoutes);
} else {
  console.log(
    "ℹ️ DEV_WORKER mode is disabled, only production route available"
  );
}
app.use(express.static("public")); ///wiki

setupOpenAIProxy(app);
// Set up tRPC middleware

// Initialize tRPC instance
// Remove TypeScript generic type and simply create the instance
const t = initTRPC.create();

const corsMiddleware = (req, res, next) => {
  // Handle OPTIONS preflight requests
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", corsOptions.methods.join(","));
    res.header(
      "Access-Control-Allow-Headers",
      corsOptions.allowedHeaders.join(",")
    );
    res.header("Access-Control-Max-Age", corsOptions.maxAge);
    return res.status(204).send();
  }
  next();
};

app.use(
  "/trpc",
  corsMiddleware,
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, type, path, input, ctx, req }) => {
      // Error logging
      console.error(`[tRPC][${type}][${path}]`, error);
    },
  })
);

// Middleware already configured above

// Set up API routes
// app.use("/api/users", userRoutes);

// Define root route
app.get("/", (req, res) => {
  res.json({
    response: "Repo.md servers are up!   check out repo.md for your dashboard",
    date: new Date().toISOString(),
  });
});

app.use("/boom3334444841", (req, res) => {
  throw new Error("Boom goes the dynamite");
});

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);
// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + "\n");
});

// Start server
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server is Running on Port ${PORT}`));
