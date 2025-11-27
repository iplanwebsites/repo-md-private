# Cloudflare Containers Dockerfile - Lite worker with repo-processor
# Run ./scripts/prepare-docker.sh before building
# Build: docker build -t repo-worker-cf .

FROM node:20-alpine AS builder

WORKDIR /build

# Copy repo-processor from vendor (prepared by prepare-docker.sh)
COPY vendor/repo-processor /build/repo-processor

# Copy worker files
COPY package-lite.json /build/worker/package.json
COPY src/worker-lite.js /build/worker/src/

WORKDIR /build/worker

# Install dependencies with sharp as optional
RUN npm pkg set dependencies.@repo-md/processor="file:../repo-processor" && \
    npm install --omit=optional --ignore-scripts --legacy-peer-deps && \
    rm -rf /root/.npm /root/.cache

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /build/worker/node_modules ./node_modules
COPY --from=builder /build/worker/package.json ./
COPY --from=builder /build/worker/src ./src

ENV NODE_ENV=production
ENV PORT=8080
ENV SKIP_EMBEDDINGS=true
ENV SKIP_SQLITE=true
ENV TEMP_DIR=/tmp/repo.md

RUN mkdir -p /tmp/repo.md

HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=2 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 8080

CMD ["node", "src/worker-lite.js"]
