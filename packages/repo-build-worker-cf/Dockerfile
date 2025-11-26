# Cloudflare Containers Dockerfile with Pre-loaded Transformer Models
# Optimized for fast cold starts with transformer.js embeddings
#
# Build: docker build -t repo-worker-cf .
# Run:   docker run -p 8080:8080 repo-worker-cf

# =============================================================================
# Stage 1: Model Download Stage
# Download and cache transformer.js models during build time
# =============================================================================
FROM node:20-slim AS model-downloader

WORKDIR /models

# Install minimal deps for model download
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Install only transformers for model download
RUN npm init -y && \
    npm install @huggingface/transformers@3.5.0

# Create model preload script
RUN cat > preload.mjs << 'EOF'
import { AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor, CLIPVisionModelWithProjection, pipeline } from "@huggingface/transformers";

const CLIP_MODEL = "Xenova/mobileclip_s0";
const TEXT_MODEL = "Xenova/all-MiniLM-L6-v2";

console.log("🚀 Pre-loading transformer models...");
console.log(`📦 CLIP Model: ${CLIP_MODEL}`);
console.log(`📦 Text Model: ${TEXT_MODEL}`);

const start = Date.now();

try {
  // Download CLIP models
  console.log("\n⏳ Downloading CLIP tokenizer...");
  await AutoTokenizer.from_pretrained(CLIP_MODEL);
  console.log("✓ CLIP tokenizer downloaded");

  console.log("⏳ Downloading CLIP text model...");
  await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL);
  console.log("✓ CLIP text model downloaded");

  console.log("⏳ Downloading CLIP processor...");
  await AutoProcessor.from_pretrained(CLIP_MODEL);
  console.log("✓ CLIP processor downloaded");

  console.log("⏳ Downloading CLIP vision model...");
  await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL);
  console.log("✓ CLIP vision model downloaded");

  // Download text embedding model
  console.log("\n⏳ Downloading text embedding pipeline...");
  await pipeline("feature-extraction", TEXT_MODEL);
  console.log("✓ Text embedding model downloaded");

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n✅ All models pre-loaded successfully in ${duration}s`);

} catch (error) {
  console.error("❌ Model pre-loading failed:", error);
  process.exit(1);
}
EOF

# Set cache directory and download models
ENV TRANSFORMERS_CACHE=/models/cache
ENV HF_HOME=/models/cache

# Run model preload
RUN node preload.mjs

# List cached models for verification
RUN echo "📁 Cached models:" && ls -la /models/cache/ 2>/dev/null || true && \
    echo "📊 Total cache size:" && du -sh /models/cache/ 2>/dev/null || echo "Cache in default location"

# =============================================================================
# Stage 2: Application Build Stage
# Install dependencies and prepare the app
# =============================================================================
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
    ca-certificates \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies
# Try with native modules first, fallback to --ignore-scripts
RUN npm ci || npm install || (npm install --ignore-scripts && echo "WARNING: Native modules skipped")

# Copy application code
COPY . .

# Remove dev dependencies for smaller image
RUN npm prune --production 2>/dev/null || true

# =============================================================================
# Stage 3: Production Runtime
# Minimal image with pre-loaded models
# =============================================================================
FROM node:20-slim AS runtime

WORKDIR /app

# Install only runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-loaded models from downloader stage
# Models are cached in ~/.cache/huggingface by default
COPY --from=model-downloader /root/.cache/huggingface /root/.cache/huggingface
COPY --from=model-downloader /models/cache /app/models 2>/dev/null || true

# Copy application from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV TRANSFORMERS_CACHE=/app/models
ENV HF_HOME=/root/.cache/huggingface

# IMPORTANT: Do NOT skip embeddings - this image has pre-loaded models
ENV SKIP_EMBEDDINGS=false

# Disable telemetry and enable offline mode (use cached models)
ENV DO_NOT_TRACK=1
ENV TRANSFORMERS_OFFLINE=1
ENV HF_HUB_OFFLINE=1

# Create temp directory
RUN mkdir -p /tmp/repo.md /app/models

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 8080

# Start the application
CMD ["node", "src/worker.js"]
