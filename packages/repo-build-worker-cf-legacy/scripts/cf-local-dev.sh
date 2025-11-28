#!/bin/bash
# Cloudflare Containers Local Development Script
# Runs the container locally with hot-reloading and proper environment
# Usage: ./scripts/cf-local-dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔧 Cloudflare Containers Local Development"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load environment variables if .env exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${BLUE}Loading .env file...${NC}"
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

# Set CF-specific environment
export SKIP_EMBEDDINGS=true
export NODE_ENV=development
export PORT=5522
export KEEP_TMP_FILES=true
export PURGE_TMP_DIR=false

echo -e "${BLUE}Environment Configuration:${NC}"
echo "  SKIP_EMBEDDINGS: $SKIP_EMBEDDINGS"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo ""

# Check if we should use Docker or local Node
USE_DOCKER="${USE_DOCKER:-false}"

if [ "$USE_DOCKER" = "true" ]; then
    echo -e "${BLUE}Starting in Docker mode...${NC}"

    # Build image
    docker build -f Dockerfile.cf -t repo-build-worker:dev .

    # Stop existing container
    docker stop cf-dev 2>/dev/null || true
    docker rm cf-dev 2>/dev/null || true

    # Run container with volume mount for hot-reloading
    docker run -it --rm \
        --name cf-dev \
        -p 5522:8080 \
        -v "$PROJECT_ROOT/src:/app/src" \
        -e SKIP_EMBEDDINGS=true \
        -e NODE_ENV=development \
        -e PORT=8080 \
        -e GITHUB_TOKEN="${GITHUB_TOKEN}" \
        -e OPENAI_API_KEY="${OPENAI_API_KEY}" \
        -e R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
        -e R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
        -e R2_ACCOUNT_ID="${R2_ACCOUNT_ID}" \
        -e R2_BUCKET_NAME="${R2_BUCKET_NAME}" \
        repo-build-worker:dev
else
    echo -e "${BLUE}Starting in local Node mode...${NC}"
    echo -e "${YELLOW}Note: This simulates CF environment but runs locally${NC}"
    echo ""

    cd "$PROJECT_ROOT"

    # Use nodemon for hot-reloading
    if command -v nodemon &> /dev/null; then
        echo "Starting with nodemon (auto-restart enabled)..."
        nodemon src/worker.js
    else
        echo "Starting with node (manual restart required)..."
        node src/worker.js
    fi
fi

# Cleanup function
cleanup() {
    echo ""
    echo -e "${BLUE}Shutting down...${NC}"
    if [ "$USE_DOCKER" = "true" ]; then
        docker stop cf-dev 2>/dev/null || true
    fi
    exit 0
}

trap cleanup INT TERM
