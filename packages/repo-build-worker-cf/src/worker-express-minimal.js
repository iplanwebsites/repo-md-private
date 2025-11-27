// src/worker-express-minimal.js
// Minimal Express server - tests if Express works on CF Containers
import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    platform: "cloudflare-containers",
    version: "express-minimal",
    uptime: process.uptime()
  });
});

app.get("/test", (req, res) => {
  res.json({
    status: "success",
    message: "Express minimal server is working!",
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT
    },
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Express minimal server listening on 0.0.0.0:${PORT}`);
  console.log(`Memory: ${JSON.stringify(process.memoryUsage())}`);
});

// Keep-alive logging
setInterval(() => {
  console.log(`[keepalive] uptime=${process.uptime().toFixed(0)}s mem=${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB`);
}, 5000);
