# Repo NPM Server

A Cloudflare Worker that serves dynamic npm packages for repo-md, allowing users to install pre-configured instances with their repository settings embedded.

> **⚠️ Deployment Note**: This worker must be deployed using Wrangler commands directly (`npm run deploy`), not via git push. See deployment instructions below.

## Overview

This worker generates custom npm packages on-demand that include pre-configured repo-md instances for specific project IDs. Users can install these packages using standard npm commands.

## Architecture

- **URL Structure**: `https://npm.repo.md/project/{id}`
- **Package Name**: `my-repo-md` (dynamic)
- **Version**: Synced with the latest `repo-md` package on npm

## Setup & Deployment

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers enabled
- Wrangler CLI installed globally

### Installation

```bash
npm install
```

### Development

```bash
# Start local development server
npm run dev

# Test the worker locally
curl http://localhost:8787/project/owner-reponame
```

### Deployment

#### Staging Environment

```bash
npm run deploy:staging
```

This deploys to `npm-staging.repo.md/*`

#### Production Environment

```bash
npm run deploy:production
```

This deploys to `npm.repo.md/*`

### DNS Configuration

Ensure your `repo.md` domain has the following DNS records:

```
npm.repo.md        CNAME    your-worker.your-subdomain.workers.dev
npm-staging.repo.md CNAME   your-worker-staging.your-subdomain.workers.dev
```

## Usage

### Installing Dynamic Packages

```bash
# Install pre-configured repo-md for project ID
npm install my-repo-md@https://npm.repo.md/project/123456
```

### Using in Code

```javascript
// ES Modules (Recommended) - Pre-configured instance
import repo from 'my-repo-md';
// Or access core library and class
import { RepoMd, repo } from 'my-repo-md';

// CommonJS - Async wrapper needed for ES modules
const createRepo = require('my-repo-md');
const { repo, RepoMD } = await createRepo();

// Use pre-configured instance
const posts = await repo.getAllPosts();
const readme = await repo.getFile('README.md');
const contributors = await repo.getContributors();

// Or create new instances with core library
const customRepo = new RepoMd({ projectId: 'other-project' });
const otherPosts = await customRepo.getAllPosts();
```

### Real-World Examples

```javascript
// Blog integration
import repo from 'my-repo-md';

// Get all blog posts
const posts = await repo.getAllPosts();
console.log(`Found ${posts.length} posts`);

// Get specific file
const readme = await repo.getFile('README.md');
console.log(readme.content);

// Get directory contents
const docs = await repo.getDirectory('docs');
docs.forEach(file => console.log(file.name));

// Multiple repositories
import { RepoMd } from 'my-repo-md';

const blogRepo = new RepoMd({ projectId: 'blog-project-id' });
const docsRepo = new RepoMd({ projectId: 'docs-project-id' });

const [blogPosts, docFiles] = await Promise.all([
  blogRepo.getAllPosts(),
  docsRepo.getDirectory('guides')
]);
```

## Testing the Library

There are **3 main ways** to test and use the dynamic packages:

### 1. NPM Package Installation (Recommended for Production)

```bash
# Install as a regular npm package
npm install my-repo-md@https://npm.repo.md/project/YOUR_PROJECT_ID

# Use in your Node.js/bundler environment
import repo from 'my-repo-md';
const posts = await repo.getAllPosts();
```

**Best for**: Production applications, bundled environments (Vite, Webpack, etc.)

### 2. Browser Dynamic Import (Great for Testing)

```javascript
// Direct browser import - no installation needed
const { repo } = await import('https://npm.repo.md/project/YOUR_PROJECT_ID');
const posts = await repo.getAllPosts();
```

**Best for**: Quick testing, prototyping, client-side only applications

### 3. Script Tag Loading (Legacy/Simple Integration)

```html
<!-- Load as ES module script -->
<script type="module" src="https://npm.repo.md/project/YOUR_PROJECT_ID"></script>

<script>
// repo is automatically available globally
const posts = await window.repo.getAllPosts();
</script>
```

**Best for**: Simple HTML pages, legacy environments, quick demos

## Testing Files

This repository includes test files to demonstrate each approach:

- **`test-dynamic-import.html`** - Browser dynamic import example
- **`test-script-tag.html`** - Script tag loading example

## Environment Considerations

### Node.js/Bundler Environments
- Uses standard npm imports (`import 'repo-md'`)
- Works with all bundlers (Vite, Webpack, Rollup, etc.)
- Tree-shakable and optimized by bundlers
- Full TypeScript support

### Browser Direct Usage
- Uses CDN imports (`import 'https://cdn.skypack.dev/repo-md'`)
- No build step required
- Automatically handles dependencies
- CORS-enabled for cross-origin requests

### Performance Notes
- **NPM Install**: Fastest loading, optimized by bundlers
- **Dynamic Import**: Moderate loading, cached by browser
- **Script Tag**: Similar to dynamic import, globally accessible

## Browser Optimization Opportunities

### Current Implementation
The service intelligently serves different code based on the requesting environment:
- **Bundler requests** → Standard npm package with bare imports
- **Browser requests** → CDN-based imports for direct usage

### Future Optimizations

1. **All-in-One Bundle** 
   ```javascript
   // Potential optimization: serve pre-bundled version
   // Single file with all dependencies included
   // Faster loading, no external CDN dependencies
   ```

2. **Compression & Minification**
   - Serve minified ES modules for browsers
   - Use brotli/gzip compression
   - Tree-shake unused exports

3. **HTTP/2 Server Push**
   - Pre-push common dependencies
   - Optimize critical loading path

4. **Edge Caching Strategy**
   - Cache popular packages closer to users
   - Implement smarter cache invalidation

5. **Bundle Size Analysis**
   ```bash
   # Future feature: bundle analysis endpoint
   GET /project/{id}/bundle-analysis
   # Returns size breakdown and optimization suggestions
   ```

### Implementation Ideas

```javascript
// Example future API endpoints:
// Serve optimized bundle
GET /project/{id}?format=bundle&optimize=size
GET /project/{id}?format=bundle&optimize=speed

// Get package analytics
GET /project/{id}/stats
// Returns: bundle size, dependencies, load time metrics
```

### Current Bundle Strategy
- **Development**: Separate modules for easier debugging
- **Production**: Could serve optimized bundles automatically
- **Size vs Speed**: Currently optimizes for speed (CDN) over size

## API Endpoints

### `GET /project/{id}`

Generates and returns a tarball for the specified project.

**Parameters:**
- `id`: Project identifier (alphanumeric with dots, hyphens, underscores)

**Response:**
- Content-Type: `application/octet-stream`
- Body: Gzipped tarball containing the npm package

**Example:**
```bash
curl https://npm.repo.md/project/123456 > my-repo-md.tgz
```

## File Structure

```
worker.js           # Main worker entry point
utils.js           # Utility functions for tarball creation
wrangler.toml      # Cloudflare Workers configuration
package.json       # Node.js dependencies and scripts
README.md          # This file
```

## Generated Package Structure

Each generated package contains:

```
package/
├── package.json    # NPM package metadata
├── index.js        # CommonJS entry point
├── index.mjs       # ES Module entry point
├── index.d.ts      # TypeScript definitions
└── README.md       # Package-specific documentation
```

## Configuration

### Environment Variables

The worker supports the following environment variables (configured in Cloudflare dashboard):

- `GITHUB_TOKEN`: Optional GitHub token for private repositories
- `CACHE_TTL`: Cache time-to-live in seconds (default: 3600)

### Wrangler Configuration

Key settings in `wrangler.toml`:

```toml
name = "repo-npm-server"
main = "worker.js"
compatibility_date = "2024-06-27"
compatibility_flags = ["nodejs_compat"]
```

## Monitoring

### Logs

View real-time logs:

```bash
npm run tail
```

### Analytics

The worker logs key metrics:
- Package generation requests
- Repository validation attempts
- Error rates and types

## Development

### Local Testing

```bash
# Start development server
npm run dev

# Test different endpoints
curl http://localhost:8787/project/123456
curl http://localhost:8787/project/invalid@format  # Should return 400
```

### Running Tests

```bash
npm test
```

## Error Handling

The worker handles various error scenarios:

- **404**: Repository not found or invalid format
- **400**: Invalid repository identifier
- **500**: Internal server errors (npm registry unavailable, etc.)

## Security Considerations

- Repository names are validated to prevent injection attacks
- GitHub API calls verify repository existence
- Rate limiting is handled by Cloudflare Workers platform
- No sensitive data is stored or logged

## Caching Strategy

- Generated packages are cached for 1 hour
- ETags are used for client-side caching
- Cache keys include repository info and version

## Troubleshooting

### Common Issues

1. **"Invalid project identifier"**
   - Ensure proper naming conventions
   - Project IDs must be alphanumeric with dots, hyphens, underscores
   - Cannot start with dots or hyphens

2. **Deployment fails**
   - Verify Wrangler authentication: `wrangler auth login`
   - Check domain configuration in Cloudflare dashboard

### Debug Mode

Enable debug logging by setting the `DEBUG` environment variable:

```bash
DEBUG=true npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev`
5. Deploy to staging with `npm run deploy:staging`
6. Create a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-org/repo-npm-server/issues)
- Documentation: [docs.repo.md](https://docs.repo.md)