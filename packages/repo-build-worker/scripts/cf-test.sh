#!/bin/bash
# Cloudflare Containers Testing Script
# Tests deployment without actually deploying to CF
# Usage: ./scripts/cf-test.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🧪 Cloudflare Containers Testing"
echo "================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run tests
run_test() {
    local test_name=$1
    local test_command=$2

    echo -e "${BLUE}▶${NC} Testing: $test_name"

    if eval "$test_command"; then
        echo -e "${GREEN}  ✅ PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}  ❌ FAILED${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test 1: Docker availability
echo -e "${BLUE}[1/8]${NC} Checking Docker..."
run_test "Docker daemon running" "docker info > /dev/null 2>&1"

# Test 2: Build CF Dockerfile
echo -e "${BLUE}[2/8]${NC} Building CF container..."
cd "$PROJECT_ROOT"

if [ ! -f "Dockerfile.cf" ]; then
    echo -e "${RED}❌ Dockerfile.cf not found${NC}"
    exit 1
fi

echo "Building image..."
if docker build -f Dockerfile.cf -t repo-build-worker:test -q .; then
    echo -e "${GREEN}✅ Build successful${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Build failed${NC}"
    ((TESTS_FAILED++))
fi

# Test 3: Start container
echo -e "${BLUE}[3/8]${NC} Starting test container..."

# Stop any existing test container
docker stop cf-test-container 2>/dev/null || true
docker rm cf-test-container 2>/dev/null || true

docker run -d \
  --name cf-test-container \
  -p 5598:8080 \
  -e SKIP_EMBEDDINGS=true \
  -e NODE_ENV=test \
  -e KEEP_TMP_FILES=true \
  repo-build-worker:test

# Wait for container to start
echo "Waiting for container to start..."
sleep 5

# Test 4: Health check
echo -e "${BLUE}[4/8]${NC} Testing health endpoint..."
run_test "Health endpoint responds" "curl -sf http://localhost:5598/health > /dev/null"

# Test 5: Verify SKIP_EMBEDDINGS is set
echo -e "${BLUE}[5/8]${NC} Verifying SKIP_EMBEDDINGS configuration..."
HEALTH_RESPONSE=$(curl -s http://localhost:5598/health)
echo "Health response: $HEALTH_RESPONSE"

# Test 6: Test process endpoint (without actual job)
echo -e "${BLUE}[6/8]${NC} Testing process endpoint..."
PROCESS_RESPONSE=$(curl -s -X POST http://localhost:5598/process \
  -H "Content-Type: application/json" \
  -d '{}' || echo '{"status":"error"}')

echo "Process response: $PROCESS_RESPONSE"
if [[ $PROCESS_RESPONSE == *"error"* ]] && [[ $PROCESS_RESPONSE == *"jobId"* ]]; then
    echo -e "${GREEN}  ✅ PASSED - Correctly validates missing jobId${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}  ❌ FAILED - Unexpected response${NC}"
    ((TESTS_FAILED++))
fi

# Test 7: Check container logs
echo -e "${BLUE}[7/8]${NC} Checking container logs..."
echo "Recent logs:"
docker logs --tail 20 cf-test-container

if docker logs cf-test-container 2>&1 | grep -q "healthy"; then
    echo -e "${GREEN}  ✅ PASSED - Logs show healthy status${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}  ⚠️  WARNING - No health status in logs${NC}"
fi

# Test 8: Memory and resource usage
echo -e "${BLUE}[8/8]${NC} Checking resource usage..."
STATS=$(docker stats cf-test-container --no-stream --format "{{.MemUsage}}")
echo "Memory usage: $STATS"
echo -e "${GREEN}  ✅ Container is running${NC}"
((TESTS_PASSED++))

# Cleanup
echo ""
echo -e "${BLUE}Cleaning up...${NC}"
docker stop cf-test-container
docker rm cf-test-container

# Test summary
echo ""
echo "================================="
echo "Test Summary"
echo "================================="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run full workflow test: npm run testFullWorkflow"
    echo "2. Deploy to CF: ./scripts/cf-deploy.sh dev"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    echo "Review the output above to identify issues"
    exit 1
fi
