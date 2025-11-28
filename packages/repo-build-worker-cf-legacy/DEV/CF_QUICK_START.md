# Cloudflare Containers - Quick Start

Get started with Cloudflare Containers deployment in 5 minutes.

## Prerequisites

✅ Docker running
✅ Node.js 20+
✅ Cloudflare account

## Step-by-Step Setup

### 1. Install Dependencies

Wrangler is already in `devDependencies`, no global install needed:

```bash
npm install
```

### 2. Login to Cloudflare

```bash
npm run cf:login
```

This opens a browser for authentication.

> **Note:** We use local wrangler (no `npm install -g` needed). See `DEV/LOCAL_WRANGLER.md` for details.

### 3. Test Locally

```bash
# Run workflow validation
npm run cf:workflow

# Run container tests
npm run cf:test
```

### 4. Deploy to Dev

```bash
npm run cf:deploy:dev
```

This will:
- ✅ Build container image
- ✅ Test locally
- ✅ Deploy to Cloudflare
- ✅ Verify deployment

### 5. Verify Deployment

```bash
# Check status
npm run cf:status

# Stream logs
npm run cf:logs

# Test endpoint
curl https://repo-build-worker.YOUR_ACCOUNT.workers.dev/health
```

## Common Commands

```bash
# Development
npm run cf:dev              # Local dev mode
npm run cf:test             # Test container

# Deployment
npm run cf:deploy:dev       # Deploy to dev
npm run cf:deploy:staging   # Deploy to staging
npm run cf:deploy:production # Deploy to production

# Management
npm run cf:status           # Check status
npm run cf:logs             # Stream logs
npm run cf:manage           # Management CLI
```

## Set Secrets

```bash
wrangler secret put GITHUB_TOKEN
wrangler secret put OPENAI_API_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_BUCKET_NAME
```

Or use the helper:

```bash
npm run cf:manage secrets put GITHUB_TOKEN
```

## Key Configuration

### SKIP_EMBEDDINGS

**Required for CF Containers**: Set `SKIP_EMBEDDINGS=true` to disable ML models.

Already configured in:
- ✅ `wrangler.toml` → `vars.SKIP_EMBEDDINGS = "true"`
- ✅ `Dockerfile.cf` → `ENV SKIP_EMBEDDINGS=true`
- ✅ `src/cf-worker.js` → `envVars.SKIP_EMBEDDINGS = "true"`

### Port Configuration

CF Containers use port **8080** (not 5522).

Already configured in:
- ✅ `Dockerfile.cf` → `EXPOSE 8080`
- ✅ `src/cf-worker.js` → `defaultPort = 8080`

## Troubleshooting

### Docker not running

```
Error: Cannot connect to Docker daemon
```

**Fix**: Start Docker Desktop

### Not authenticated

```
Error: Not logged in
```

**Fix**: Run `wrangler login`

### Build fails

```
Error building container
```

**Fix**: Check Docker logs

```bash
docker build -f Dockerfile.cf -t test . 2>&1 | tail -20
```

### Deployment timeout

**Normal**: First deployment takes 2-5 minutes for container provisioning.

Check status:
```bash
wrangler containers list
```

## Next Steps

1. ✅ Review `CF_DEPLOYMENT_GUIDE.md` for comprehensive guide
2. ✅ Check `CLOUDFLARE_MIGRATION_INDEX.md` for migration details
3. ✅ Test with real job: Send POST to `/process`
4. ✅ Set up monitoring in dashboard
5. ✅ Configure custom domain

## Architecture

```
Request
  ↓
Cloudflare Edge (Worker)
  ↓
cf-worker.js (Router)
  ↓
Durable Object (Container)
  ↓
Express App (worker.js)
  ↓
Job Processor
```

## Important Notes

### Embeddings Disabled

When `SKIP_EMBEDDINGS=true`:
- ✅ Markdown processing works
- ✅ Asset building works
- ✅ Database creation works
- ❌ Semantic search disabled (no embeddings)
- ❌ Image similarity disabled (no embeddings)

### Migration from GCP

| Feature | GCP | CF Containers |
|---------|-----|---------------|
| Port | 5522 | 8080 |
| Embeddings | Local models | Disabled/API |
| Timeout | 60 min | 10 min |
| Storage | /tmp | KV + R2 |

## Resources

- **Full Guide**: `CF_DEPLOYMENT_GUIDE.md`
- **Migration**: `CLOUDFLARE_MIGRATION_INDEX.md`
- **Requirements**: `PROCESSOR_LIB_REQUIREMENTS.md`
- **CF Docs**: https://developers.cloudflare.com/containers/
- **Dashboard**: https://dash.cloudflare.com

## Support

- GitHub Issues: [Create issue]
- CF Discord: https://discord.gg/cloudflaredev
- Documentation: Read the guides above

---

**Ready to deploy?**

```bash
npm run cf:workflow && npm run cf:deploy:dev
```

🚀 **Happy deploying!**
