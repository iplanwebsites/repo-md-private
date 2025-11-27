# Cloudflare Containers Deployment Guide

Complete guide for deploying and managing repo-build-worker on Cloudflare Containers.

## Quick Start

```bash
# 1. Install dependencies (includes wrangler)
npm install

# 2. Login to Cloudflare
npm run cf:login

# 3. Test locally
npm run cf:test

# 4. Deploy to dev environment
npm run cf:deploy:dev
```

> **Note:** We use local wrangler (no `npm install -g` needed). See [LOCAL_WRANGLER.md](./LOCAL_WRANGLER.md) for details.

## Prerequisites

### Required Software

1. **Node.js 20+**
   ```bash
   node --version  # Should be >= 20
   ```

2. **Docker Desktop** (or Docker daemon)
   ```bash
   docker --version
   docker info  # Should show running daemon
   ```

3. **Wrangler CLI** (local installation)
   ```bash
   npm install  # Installs wrangler locally (already in devDependencies)
   npx wrangler --version
   ```

   > **Note:** No global installation needed! We use `npx wrangler` throughout. See [LOCAL_WRANGLER.md](./LOCAL_WRANGLER.md)

4. **Cloudflare Account**
   - Sign up at https://dash.cloudflare.com
   - Containers beta access required

### Required Secrets

Set these using npm scripts or npx:

```bash
# Option 1: Use management CLI (recommended)
npm run cf:manage secrets put GITHUB_TOKEN
npm run cf:manage secrets put OPENAI_API_KEY
npm run cf:manage secrets put R2_ACCESS_KEY_ID
npm run cf:manage secrets put R2_SECRET_ACCESS_KEY
npm run cf:manage secrets put R2_ACCOUNT_ID
npm run cf:manage secrets put R2_BUCKET_NAME

# Option 2: Use npx directly
npx wrangler secret put GITHUB_TOKEN
```

## npm Scripts Reference

### Development

```bash
# Local development (simulates CF environment)
npm run cf:dev

# Local development with Docker
npm run cf:dev:docker

# Test container locally
npm run cf:test

# Build container image
npm run cf:build
```

### Deployment

```bash
# Deploy to dev (default)
npm run cf:deploy
npm run cf:deploy:dev

# Deploy to staging
npm run cf:deploy:staging

# Deploy to production (requires confirmation)
npm run cf:deploy:production
```

### Management

```bash
# Show deployment status
npm run cf:status

# Stream live logs
npm run cf:logs

# Manage secrets
npm run cf:manage secrets list
npm run cf:manage secrets put GITHUB_TOKEN

# Clean up Docker resources
npm run cf:cleanup
```

## Deployment Process

### 1. Local Testing

Before deploying, test the container locally:

```bash
# Run all CF tests
npm run cf:test

# This will:
# - Build Dockerfile.cf
# - Start container on port 5598
# - Test health endpoint
# - Test process endpoint
# - Check resource usage
# - Clean up
```

### 2. Deploy to Dev

```bash
npm run cf:deploy:dev
```

This script will:

1. ✅ Check prerequisites (Docker, Wrangler)
2. ✅ Verify Cloudflare authentication
3. ✅ Build container image
4. ✅ Test container locally on port 5599
5. ✅ Deploy to Cloudflare
6. ✅ Verify deployment

### 3. Monitor Deployment

```bash
# Check container status
wrangler containers list

# Check image status
wrangler containers images list

# Stream logs
npm run cf:logs
```

### 4. Test Deployed Worker

```bash
# Get your worker URL from deployment output
curl https://repo-build-worker.YOUR_ACCOUNT.workers.dev/health

# Should return:
# {
#   "status": "healthy",
#   "worker": "repo-build-worker",
#   "timestamp": "...",
#   "platform": "cloudflare-containers"
# }
```

## Configuration

### wrangler.toml

Main configuration file for Cloudflare Workers:

```toml
name = "repo-build-worker"
main = "src/cf-worker.js"

[[containers]]
max_instances = 10
class_name = "RepoBuildContainer"
image = "./Dockerfile.cf"

[vars]
SKIP_EMBEDDINGS = "true"
NODE_ENV = "production"
```

### Dockerfile.cf

Optimized Dockerfile for Cloudflare Containers:

- Base: `node:20-slim`
- Port: 8080 (CF Container default)
- Environment: `SKIP_EMBEDDINGS=true`
- No native modules (better-sqlite3, sharp, transformers)

### src/cf-worker.js

Cloudflare Worker entry point that:

- Routes requests to containers
- Manages container lifecycle
- Provides health checks
- Handles load balancing

## Architecture

### Request Flow

```
User Request
    ↓
Cloudflare Edge (Worker)
    ↓
cf-worker.js (Router)
    ↓
Durable Object (Container Manager)
    ↓
Docker Container (Express App)
    ↓
worker.js (Job Processor)
```

### Container Routing

**Sticky Sessions (Recommended)**
```javascript
// Routes to same container for same jobId
const container = env.BUILD_CONTAINER.getByName(jobId);
```

**Load Balancing**
```javascript
// Routes to random container from pool
const container = await getRandomContainer(env.BUILD_CONTAINER, 3);
```

## Environment-Specific Configuration

### Development

```bash
npm run cf:deploy:dev
```

- Environment: `dev`
- Max instances: 10
- Embeddings: Disabled
- Debugging: Enabled

### Staging

```bash
npm run cf:deploy:staging
```

- Environment: `staging`
- Max instances: 10
- Embeddings: Disabled
- Testing environment for production

### Production

```bash
npm run cf:deploy:production
```

- Environment: `production`
- Max instances: 10
- Embeddings: Disabled (use external API)
- Requires confirmation

## Monitoring & Debugging

### View Logs

```bash
# Stream live logs
npm run cf:logs

# Or directly with wrangler
wrangler tail

# Filter logs
wrangler tail --format pretty
```

### Dashboard

Visit https://dash.cloudflare.com to view:

- Container status & health
- Request metrics
- Error rates
- Performance graphs
- Deployment history

### Debug Container Locally

```bash
# Build and run container
docker build -f Dockerfile.cf -t repo-build-worker:debug .

docker run -it --rm \
  -p 5522:8080 \
  -e SKIP_EMBEDDINGS=true \
  -e NODE_ENV=development \
  repo-build-worker:debug

# Test endpoints
curl http://localhost:5522/health

# View logs
docker logs <container-id>
```

## Troubleshooting

### Issue: Docker not running

```
Error: Cannot connect to Docker daemon
```

**Solution:** Start Docker Desktop or Docker daemon

```bash
# macOS/Windows: Start Docker Desktop
# Linux:
sudo systemctl start docker
```

### Issue: Wrangler not authenticated

```
Error: Not logged in
```

**Solution:** Login to Cloudflare

```bash
wrangler login
```

### Issue: Container build fails

```
Error building container image
```

**Solution:** Check Dockerfile.cf and dependencies

```bash
# Test build locally
docker build -f Dockerfile.cf -t test .

# Check Docker logs
docker build --progress=plain -f Dockerfile.cf -t test . 2>&1 | less
```

### Issue: Deployment timeout

```
Error: Deployment timed out
```

**Solution:** Containers take 2-5 minutes to provision on first deploy

```bash
# Wait and check status
wrangler containers list

# Status should show "ready" after a few minutes
```

### Issue: Container not responding

```
Error: Container health check failed
```

**Solution:** Check container logs and environment

```bash
# View container logs
npm run cf:logs

# Check if PORT is set correctly (should be 8080)
# Verify SKIP_EMBEDDINGS=true
```

### Issue: Native module errors

```
Error: Cannot find module 'better-sqlite3'
```

**Solution:** Native modules not supported in CF Containers

- Use `SKIP_EMBEDDINGS=true` to bypass ML models
- Replace better-sqlite3 with D1 or Neon PostgreSQL
- See `CF_CONTAINERS_ANALYSIS.md` for migration guide

## Performance Optimization

### Container Sleep Configuration

Containers sleep after inactivity to save resources:

```javascript
// In src/cf-worker.js
sleepAfter = '5m';  // 5 minutes
maxExecutionTime = '10m';  // 10 minutes
```

### Max Instances

Control concurrent container instances:

```toml
# In wrangler.toml
[[containers]]
max_instances = 10  # Adjust based on load
```

### Environment Variables

Optimize performance with flags:

```toml
[vars]
SKIP_EMBEDDINGS = "true"  # Required for CF
PURGE_TMP_DIR = "false"   # Keep files for debugging
KEEP_TMP_FILES = "false"  # Clean up temp files
```

## Cost Management

### Pricing Factors

- **Container runtime** - Per second billing
- **Requests** - Per million requests
- **Storage** - R2 storage costs
- **Egress** - Data transfer costs

### Cost Optimization Tips

1. **Enable container sleep** - Reduces runtime costs
2. **Set max instances** - Prevents runaway costs
3. **Use R2 for storage** - Cheaper than KV for large files
4. **Monitor usage** - Check dashboard regularly

### Estimated Costs

| Workload | Containers | Requests/mo | Est. Cost |
|----------|------------|-------------|-----------|
| Light | 1-2 | 10K | $5-20 |
| Medium | 3-5 | 100K | $50-100 |
| Heavy | 5-10 | 1M | $200-500 |

See `CLOUDFLARE_MIGRATION_INDEX.md` for detailed cost analysis.

## Migration from GCP Cloud Run

### Key Differences

| Aspect | GCP Cloud Run | CF Containers |
|--------|---------------|---------------|
| Port | 5522 (custom) | 8080 (default) |
| Embeddings | Local models | Disabled/API |
| SQLite | better-sqlite3 | D1 or Neon |
| Storage | /tmp | KV + R2 |
| Timeout | 60 min | 10 min |

### Migration Steps

1. ✅ Add `SKIP_EMBEDDINGS=true`
2. ✅ Update port to 8080 in Dockerfile.cf
3. ⏳ Migrate SQLite to D1/Neon (optional)
4. ⏳ Replace git CLI with GitHub API (optional)
5. ⏳ Implement external embeddings API (optional)

See `CF_CONTAINERS_ANALYSIS.md` for complete migration guide.

## Advanced Usage

### Custom Domains

```bash
# Add custom domain
wrangler route add repo-worker.example.com production
```

### KV Namespaces

```bash
# Create KV namespace for job state
wrangler kv:namespace create "JOB_STATE"

# Update wrangler.toml
[[kv_namespaces]]
binding = "JOB_STATE"
id = "YOUR_KV_NAMESPACE_ID"
```

### R2 Buckets

```bash
# Create R2 bucket
wrangler r2 bucket create repo-build-assets

# Update wrangler.toml
[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "repo-build-assets"
```

### D1 Database

```bash
# Create D1 database
wrangler d1 create repo_build_db

# Update wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "repo_build_db"
database_id = "YOUR_D1_DATABASE_ID"
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to CF Containers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install -g wrangler
      - run: npm run cf:test
      - run: wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
deploy:
  image: node:20
  stage: deploy
  script:
    - npm install -g wrangler
    - npm run cf:test
    - wrangler deploy
  only:
    - main
```

## Next Steps

1. ✅ Test locally: `npm run cf:test`
2. ✅ Deploy to dev: `npm run cf:deploy:dev`
3. ⏳ Set up monitoring and alerts
4. ⏳ Configure custom domain
5. ⏳ Implement external embeddings API
6. ⏳ Migrate database to D1 or Neon

## Resources

- **CF Containers Docs:** https://developers.cloudflare.com/containers/
- **Wrangler Docs:** https://developers.cloudflare.com/workers/wrangler/
- **Dashboard:** https://dash.cloudflare.com
- **Community:** https://discord.gg/cloudflaredev

## Support

- GitHub Issues: Create issue in repo
- Cloudflare Support: https://support.cloudflare.com
- Community Discord: https://discord.gg/cloudflaredev

---

**Last Updated:** November 2, 2025
**Version:** 1.0.0
