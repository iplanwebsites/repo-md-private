import express from "express";

const app = express();
const PORT = process.env.PORT || 5522;

app.get("/", (req, res) => {
  res.json({ status: "test server running" });
});

const server = app.listen(PORT, () => {
  console.log(`Test server listening on port ${PORT}`);
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});