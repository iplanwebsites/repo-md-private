# Build Worker CF Container
# Cloudflare Container-optimized build worker

FROM node:20-slim

# Install git and other required tools
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Configure git
RUN git config --global user.email "build@repo-md.com" \
    && git config --global user.name "repo-md builder" \
    && git config --global init.defaultBranch main

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy compiled source
COPY dist/ ./dist/

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the server
CMD ["node", "dist/server.js"]
