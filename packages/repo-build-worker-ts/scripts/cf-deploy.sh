#!/bin/bash
# Cloudflare Containers Deployment Script
# Usage: ./scripts/cf-deploy.sh [environment]
# Environments: dev, staging, production

set -e  # Exit on error

ENVIRONMENT="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Cloudflare Containers Deployment"
echo "===================================="
echo "Environment: $ENVIRONMENT"
echo "Project: $PROJECT_ROOT"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}[1/6]${NC} Checking prerequisites..."

# Check if wrangler is installed (local or global)
if ! npx wrangler --version &> /dev/null && ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found${NC}"
    echo "Install with: npm install (already in devDependencies)"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "Please start Docker Desktop or Docker daemon"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites met${NC}"

# Verify authentication
echo -e "${BLUE}[2/6]${NC} Verifying Cloudflare authentication..."
if ! npx wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Cloudflare${NC}"
    echo "Running: npx wrangler login"
    npx wrangler login
fi
echo -e "${GREEN}✅ Authenticated${NC}"

# Build container image
echo -e "${BLUE}[3/6]${NC} Building container image..."
cd "$PROJECT_ROOT"

# Use CF-specific Dockerfile
if [ ! -f "Dockerfile.cf" ]; then
    echo -e "${RED}❌ Dockerfile.cf not found${NC}"
    exit 1
fi

echo "Building image: repo-build-worker:$ENVIRONMENT"
docker build -f Dockerfile.cf -t "repo-build-worker:$ENVIRONMENT" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Container image built successfully${NC}"
else
    echo -e "${RED}❌ Container build failed${NC}"
    exit 1
fi

# Test container locally before deploying
echo -e "${BLUE}[4/6]${NC} Testing container locally..."
echo "Starting container on port 5599..."

# Stop any existing test container
docker stop cf-worker-test 2>/dev/null || true
docker rm cf-worker-test 2>/dev/null || true

# Start container
docker run -d \
  --name cf-worker-test \
  -p 5599:8080 \
  -e SKIP_EMBEDDINGS=true \
  -e NODE_ENV=production \
  "repo-build-worker:$ENVIRONMENT"

# Wait for container to be ready
echo "Waiting for container to be ready..."
sleep 5

# Test health endpoint
HEALTH_CHECK=$(curl -s http://localhost:5599/health || echo "failed")
if [[ $HEALTH_CHECK == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Container health check passed${NC}"
    echo "Health response: $HEALTH_CHECK"
else
    echo -e "${RED}❌ Container health check failed${NC}"
    echo "Response: $HEALTH_CHECK"
    docker logs cf-worker-test
    docker stop cf-worker-test
    docker rm cf-worker-test
    exit 1
fi

# Clean up test container
docker stop cf-worker-test
docker rm cf-worker-test

# Deploy to Cloudflare
echo -e "${BLUE}[5/6]${NC} Deploying to Cloudflare..."

# Set environment-specific configuration
case $ENVIRONMENT in
  production)
    WRANGLER_ENV="production"
    echo -e "${YELLOW}⚠️  Deploying to PRODUCTION${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
      echo "Deployment cancelled"
      exit 0
    fi
    ;;
  staging)
    WRANGLER_ENV="staging"
    ;;
  *)
    WRANGLER_ENV=""
    ;;
esac

# Run wrangler deploy
if [ -n "$WRANGLER_ENV" ]; then
  npx wrangler deploy --env "$WRANGLER_ENV"
else
  npx wrangler deploy
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Verify deployment
echo -e "${BLUE}[6/6]${NC} Verifying deployment..."

# Wait for deployment to propagate
echo "Waiting for deployment to propagate (10s)..."
sleep 10

# Check container status
echo "Container status:"
npx wrangler containers list

# Check image status
echo "Image status:"
npx wrangler containers images list

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the deployed worker: curl https://repo-build-worker.YOUR_ACCOUNT.workers.dev/health"
echo "2. Monitor logs: npm run cf:logs"
echo "3. View dashboard: https://dash.cloudflare.com"
echo ""
echo "Useful commands:"
echo "  npm run cf:logs                  # Stream logs"
echo "  npm run cf:status                # Check status"
echo "  npx wrangler delete              # Delete deployment"
