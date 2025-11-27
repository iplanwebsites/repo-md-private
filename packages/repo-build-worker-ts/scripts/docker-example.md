# Docker Example for repo-build-worker

This document shows how to use the repo-processor in a Docker environment without relying on GitHub packages.

## Step-by-Step Instructions for Dokku Deployment

1. **Copy repo-processor dist files locally**
   ```bash
   npm run copy:repo-processor
   ```

2. **Verify that the dist files were copied correctly**
   ```bash
   ls -la src/modules/repo-processor/dist/
   ```

3. **Update your import paths in buildAssets.js**
   ```js
   // Change this
   import { RepoProcessor } from "../../../repo-processor/dist/index.js";
   
   // To this
   import { RepoProcessor } from "../modules/repo-processor/dist/index.js";
   ```

4. **Test the setup locally**
   ```bash
   npm run test:docker-build
   ```

5. **Deploy to Dokku**
   ```bash
   git add src/modules/repo-processor
   git add src/process/buildAssets.js
   git commit -m "Add repo-processor module for Docker deployment"
   git push dokku main:master
   ```

## Dockerfile Example

```dockerfile
FROM node:20-slim as builder

WORKDIR /app

# Copy only package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# -----------------
# Production image
FROM node:20-slim

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package*.json ./

# Create directories
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

## Usage with Existing Dockerfile

If you're updating an existing Dockerfile, you need to:

1. Run the copy script locally before building:
   ```bash
   npm run copy:repo-processor
   ```

2. Update import statements in your code:
   ```javascript
   // Change this:
   import { RepoProcessor } from "../../../repo-processor/dist/index.js";
   
   // To this:
   import { RepoProcessor } from "../modules/repo-processor/dist/index.js";
   ```

3. Commit both the code changes and the copied files:
   ```bash
   git add src/process/buildAssets.js
   git add src/modules/repo-processor/
   git commit -m "Update import path and add repo-processor files for Docker"
   ```

## Testing the Docker Configuration

You can test if your application works with the Docker-friendly repo-processor setup:

1. Run the test script:
   ```bash
   npm run test:docker
   ```

2. If successful, it will:
   - Copy repo-processor files to src/modules/repo-processor
   - Create a test version of buildAssets.js that uses the module
   - Test loading the RepoProcessor from the new location

## Troubleshooting

If you encounter issues:

1. Check that the repo-processor files were copied correctly
2. Verify the import paths in your code are updated
3. Make sure the repo-processor dependencies are installed correctly in Docker
4. Look for any path resolution issues in the Docker environment