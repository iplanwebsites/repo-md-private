# Cloudflare Containers Embedding Worker
# Pre-downloads Transformer.js models during build for fast cold starts
#
# Models included:
# - Xenova/mobileclip_s0: CLIP for text+image embeddings (~300MB)
# - Xenova/all-MiniLM-L6-v2: Sentence embeddings (~90MB)
#
# Final image size: ~800MB (includes Node.js + models)

FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies for native module compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Set model cache directory
ENV TRANSFORMERS_CACHE=/app/models
ENV HF_HOME=/app/models

# Pre-download models during build
RUN mkdir -p /app/models && \
    node scripts/download-models.js

# ============================================
# Production image
# ============================================
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source code
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts

# Copy pre-downloaded models from builder
COPY --from=builder /app/models /app/models

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8787
ENV TRANSFORMERS_CACHE=/app/models
ENV HF_HOME=/app/models
# Auto-load models on startup for faster first request
ENV PRELOAD_MODELS=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://localhost:8787/health').then(r => process.exit(r.ok ? 0 : 1))"

EXPOSE 8787

CMD ["node", "src/index.js"]
