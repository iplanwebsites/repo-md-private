// src/worker-barebones.js
// Absolute minimal test server - pure Node.js, no dependencies
import http from 'node:http';

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader('Content-Type', 'application/json');

  if (url.pathname === '/health' || url.pathname === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      platform: 'cloudflare-containers',
      version: 'barebones',
      uptime: process.uptime()
    }));
    return;
  }

  if (url.pathname === '/test') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'success',
      message: 'Barebones server is working!',
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: PORT
      },
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Barebones server listening on 0.0.0.0:${PORT}`);
  console.log(`Memory: ${JSON.stringify(process.memoryUsage())}`);
});

// Keep-alive logging
setInterval(() => {
  console.log(`[keepalive] uptime=${process.uptime().toFixed(0)}s mem=${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB`);
}, 5000);
