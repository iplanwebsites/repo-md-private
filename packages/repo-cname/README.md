# Repo CNAME Worker

cname.repo.md

A Cloudflare Worker that acts as a CNAME proxy, relaying requests to specific worker URLs based on the incoming domain.

## How it Works

1. Receives incoming requests
2. Maps the hostname to a target worker URL using an internal configuration table
3. Forwards the request to the corresponding worker (`https://{target}.workers.dev`)
4. Passes along the original domain and target as custom headers
5. Returns the response from the target worker

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to Cloudflare
npm run deploy
```

## Configuration

Edit the `DOMAIN_TARGETS` object in `src/index.js` to map domains to their target worker URLs.

For example:

```javascript
const DOMAIN_TARGETS = {
  "example.com": "https://simple-blog-remix.repo.md",
  "blog.example.org": "https://another-worker-url",
};
```

With this configuration, requests to `example.com` will be forwarded directly to `https://simple-blog-remix.repo.md` (including the original path and query parameters), and the theme name will be passed as an `x-theme` header.
