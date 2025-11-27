# Cloudflare Containers Migration - Quick Reference

## Compatibility Summary

| Category | Status | Impact | Action |
|----------|--------|--------|--------|
| **File System** | ❌ Incompatible | CRITICAL | Migrate to KV + R2 |
| **SQLite/better-sqlite3** | ❌ Incompatible | CRITICAL | Use PostgreSQL or sql.js |
| **Model Inference** | ❌ Incompatible | CRITICAL | Switch to API-based (OpenAI/Together) |
| **Long Processes** | ❌ Incompatible | CRITICAL | Decompose into tasks |
| **Git CLI** | ❌ Incompatible | HIGH | Use GitHub REST API |
| **Express.js** | ✅ Compatible | - | Keep as-is |
| **R2 Storage** | ✅ Compatible | - | Minimal changes |
| **OpenAI/GitHub APIs** | ✅ Compatible | - | Keep as-is |

## Critical Issues

### 🔴 BLOCKING ISSUES (Must Fix)

1. **Filesystem Storage**
   - Problem: No persistent `/tmp` in CF Containers
   - Current: Job temp folders, database files, model cache
   - Solution: Migrate to Cloudflare Workers KV + R2

2. **SQLite + better-sqlite3**
   - Problem: Native C++ module won't compile
   - Current: All database operations
   - Solution: PostgreSQL (Neon) OR sql.js (WASM)

3. **Model Loading**
   - Problem: 100-300MB models exceed memory limits
   - Current: CLIP embeddings, text embeddings
   - Solution: OpenAI API (~$0.00002 per 1K tokens) or Together.ai

4. **Long-Running Jobs**
   - Problem: Jobs can take 30+ minutes, CF limit is 600 seconds
   - Current: Single async process
   - Solution: Break into micro-tasks with KV state persistence

## Rewrite Scope

```
Total Codebase: ~3500 lines
Code Needing Changes: ~2100 lines (60%)
Code Needing Complete Rewrite: ~1400 lines (40%)

Files by Impact:
  src/worker.js                     30% changes
  src/inferenceRouter.js           100% changes
  src/process/buildAssets.js        80% changes
  src/process/buildSqliteDatabase   100% rewrite
  src/process/computeEmbeddings    100% changes
  src/services/githubService.js     70% changes
  src/lib/clip-embedder.js         100% replace
  src/lib/instructor-embedder.js   100% replace
```

## Migration Path

### Week 1: Infrastructure
```
[ ] Neon PostgreSQL setup
[ ] OpenAI API integration testing
[ ] Cloudflare Workers KV setup
[ ] R2 staging bucket creation
```

### Week 2-3: Core Services
```
[ ] Storage layer refactor (KV + R2)
[ ] SQLite → PostgreSQL migration
[ ] Model inference → API calls
[ ] Remove binary dependencies
[ ] Update package.json
```

### Week 3-4: Job Processing
```
[ ] Task decomposition
[ ] KV-based state persistence
[ ] Timeout handling
[ ] Cleanup logic
```

### Week 4-5: Testing
```
[ ] Integration tests
[ ] Performance tuning
[ ] Load testing
[ ] Production deployment
```

## Cost Impact Analysis

### Current (GCP Cloud Run)
- Compute: $0.00002400/CPU-second + $0.0000025/GB-second
- Storage: R2 ~$0.015/GB/month
- Typical cost: $100-300/month for moderate load

### Post-Migration (CF Containers)
- Containers: $0.50/million requests
- PostgreSQL (Neon): $5-50/month
- API Calls (OpenAI): $0.00002 per 1K tokens
  - 100,000 requests/month = ~$2-5 at typical token counts
- R2 (unchanged): ~$0.015/GB/month
- **Estimated cost: $200-500/month** (higher due to API calls)

**Trade-off**: Better scalability but higher operational costs

## Key Decisions Required

1. **Database**: PostgreSQL? sql.js? Keep SQLite hybrid?
2. **Embeddings**: OpenAI ($$$) or Together.ai (cheaper)?
3. **Job Queue**: KV (native) or external RabbitMQ?
4. **API Compatibility**: Maintain current API or redesign?
5. **Repo Sizes**: Max ~250MB for memory constraints?
6. **Backwards Compatibility**: Break existing job queue?

## Dependency Changes

### Remove (Won't Work)
```json
{
  "better-sqlite3": "^12.4.1",
  "sharp": "^0.x.x",
  "@huggingface/transformers": "^3.5.0"
}
```

### Add (New Requirements)
```json
{
  "pg": "^8.x.x",              // PostgreSQL client
  "sql.js": "^1.x.x",          // Optional: WASM SQLite
  "wrangler": "^3.x.x",        // CF tooling
  "dotenv": "^16.5.0",         // Already present
  "@cloudflare/workers-types": "^4.x.x"
}
```

## File Operations - Before/After

### Before (Current)
```javascript
const tempFolder = path.join(process.env.TEMP_DIR || "/tmp", `repo-${jobId}`);
await fs.mkdir(tempFolder, { recursive: true });
// ... process files ...
await fs.rm(tempFolder, { recursive: true, force: true });
```

### After (CF Containers)
```javascript
// Store in KV
const jobStateKey = `job:${jobId}`;
await KV.put(jobStateKey, JSON.stringify(jobState), {
  expirationTtl: 86400  // 24 hours
});
// ... process in memory ...
await KV.delete(jobStateKey);
```

## Performance Expectations

| Operation | Before (Cloud Run) | After (CF Containers) | Delta |
|-----------|-------------------|----------------------|-------|
| Build assets (100 posts) | 15s | 25s | +67% |
| Embeddings API (vs local) | 5s | 15s | +200% |
| SQLite create (vs PostgreSQL) | 2s | 5s | +150% |
| Total job (medium repo) | 45s | 120s | +167% |

**Rationale**: API calls add latency but enable simpler scaling

## Next Steps

1. **Review this analysis** with team
2. **Decide on options** (DB, embeddings, architecture)
3. **Prototype Week 1** (infrastructure setup)
4. **Parallel development** (services refactor)
5. **Integration testing** (Week 4)
6. **Staged rollout** or big bang migration

## Questions?

See `CF_CONTAINERS_ANALYSIS.md` for detailed breakdown of:
- Current architecture (Section 1)
- Component analysis (Section 3)
- Code examples (Section 9)
- Task-specific feasibility (Section 5)
