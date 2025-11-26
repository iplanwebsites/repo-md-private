# CLAUDE.md - Embedding Worker

## Package Purpose

Dedicated embedding service for Cloudflare Containers. Provides HTTP API for text and image embeddings using Transformer.js with pre-loaded models.

## Key Files

- `src/index.js` - HTTP server entry point (runs in container)
- `src/worker.js` - Cloudflare Worker proxy (routes to container)
- `src/clip-embedder.js` - CLIP model for text/image embeddings
- `src/sentence-embedder.js` - MiniLM model for sentence embeddings
- `scripts/download-models.js` - Pre-downloads models during Docker build
- `Dockerfile` - Production image with pre-loaded models
- `wrangler.jsonc` - Cloudflare Containers configuration

## Models

| Model | Type | Dimensions | Size |
|-------|------|------------|------|
| Xenova/mobileclip_s0 | CLIP | 512 | ~300MB |
| Xenova/all-MiniLM-L6-v2 | Sentence | 384 | ~90MB |

## Development Commands

```bash
npm run dev                # Run locally
npm test                   # Test embeddings
npm run docker:build       # Build Docker image
npm run docker:run         # Run container
npm run cf:deploy          # Deploy to Cloudflare
```

## Architecture Notes

- Models are pre-downloaded during `docker build` to avoid cold-start delays
- Worker uses singleton pattern for model loading
- Container stays alive for 10 minutes after last request (`sleepAfter`)
- Max 3 instances by default to control costs

## Integration

Other services call this via HTTP:
```javascript
const response = await fetch('http://embedding-worker/embed/text', {
  method: 'POST',
  body: JSON.stringify({ text: 'Hello world' })
});
```
