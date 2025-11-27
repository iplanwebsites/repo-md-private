// src/worker-minimal.js
// Minimal test server for CF Containers debugging
import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    platform: "cloudflare-containers",
    version: "minimal"
  });
});

app.get("/test", (req, res) => {
  res.json({
    status: "success",
    message: "Minimal test server is working!",
    env: {
      NODE_ENV: process.env.NODE_ENV,
      SKIP_EMBEDDINGS: process.env.SKIP_EMBEDDINGS,
      SKIP_SQLITE: process.env.SKIP_SQLITE
    }
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Minimal worker listening on 0.0.0.0:${PORT}`);
});
