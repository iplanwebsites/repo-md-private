#!/bin/bash
# Prepare Docker build context by copying repo-processor dist
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
MONOREPO_ROOT="$(dirname "$(dirname "$PACKAGE_DIR")")"

echo "📦 Preparing Docker build context..."

# Build repo-processor if not built
if [ ! -d "$MONOREPO_ROOT/packages/repo-processor/dist" ]; then
  echo "🔨 Building repo-processor..."
  cd "$MONOREPO_ROOT/packages/repo-processor"
  npm run build
fi

# Copy repo-processor dist
echo "📋 Copying repo-processor dist..."
rm -rf "$PACKAGE_DIR/vendor/repo-processor"
mkdir -p "$PACKAGE_DIR/vendor/repo-processor"
cp -r "$MONOREPO_ROOT/packages/repo-processor/dist" "$PACKAGE_DIR/vendor/repo-processor/"
cp "$MONOREPO_ROOT/packages/repo-processor/package.json" "$PACKAGE_DIR/vendor/repo-processor/"

echo "✅ Docker context ready"
