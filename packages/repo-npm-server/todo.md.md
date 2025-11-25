# Dynamic NPM Package Implementation Plan - repo-md

## Overview

This document outlines the implementation of a dynamic NPM package system for `repo-md` using Cloudflare Workers. Users will be able to install pre-configured instances of repo-md with their repository settings embedded.

### Key Requirements

- **Package Name**: `repo-md` (matching the public NPM package)
- **Import Name**: Users import as `repo` from `"my-repo-md"`
- **Version**: Symmetric with the public `repo-md` package on NPM
- **Infrastructure**: Cloudflare Workers for dynamic package generation

## Architecture

### URL Structure

```
https://npm.repo.md/project/:id
```

Example:

```bash
npm install my-repo-md@https://npm.repo.md/project/123456
```

## Implementation Components

### 1. Cloudflare Worker - Package Generator

```javascript
// worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");

    if (pathParts[1] !== "repo" || pathParts.length !== 4) {
      return new Response("Not Found", { status: 404 });
    }

    const owner = pathParts[2];
    const repoName = pathParts[3];

    // Fetch current repo-md version from NPM
    const npmResponse = await fetch(
      "https://registry.npmjs.org/repo-md/latest"
    );
    const npmData = await npmResponse.json();
    const version = npmData.version;

    // Generate package files
    const packageFiles = generatePackageFiles(owner, repoName, version);

    // Create tarball
    const tarball = await createTarball(packageFiles);

    return new Response(tarball, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
        ETag: `"${owner}-${repoName}-${version}"`,
      },
    });
  },
};
```

### 2. Package File Generation

```javascript
function generatePackageFiles(owner, repoName, version) {
  return {
    "package.json": JSON.stringify(
      {
        name: "my-repo-md",
        version: version,
        description: `Pre-configured repo-md for ${owner}/${repoName}`,
        main: "index.js",
        module: "index.mjs",
        types: "index.d.ts",
        dependencies: {
          "repo-md": `^${version}`,
        },
        repository: {
          type: "git",
          url: `https://github.com/${owner}/${repoName}`,
        },
      },
      null,
      2
    ),

    "index.js": `
const { RepoMD } = require('repo-md');

const repo = new RepoMD({
  owner: '${owner}',
  name: '${repoName}',
  // Default configuration
  branch: 'main',
  baseUrl: 'https://github.com/${owner}/${repoName}'
});

module.exports = repo;
`,

    "index.mjs": `
import { RepoMD } from 'repo-md';

const repo = new RepoMD({
  owner: '${owner}',
  name: '${repoName}',
  // Default configuration
  branch: 'main',
  baseUrl: 'https://github.com/${owner}/${repoName}'
});

export default repo;
export { repo };
`,

    "index.d.ts": `
import { RepoMD } from 'repo-md';

declare const repo: RepoMD;
export default repo;
export { repo };
`,
  };
}
```

### 3. Tarball Creation Utility

```javascript
async function createTarball(files) {
  const tar = new TarBuilder();

  for (const [filename, content] of Object.entries(files)) {
    tar.addFile(filename, content);
  }

  return tar.build();
}
```

## User Experience

### Installation

```bash
# Install pre-configured repo-md for project/123456.js
npm install my-repo-md@https://npm.repo.md/repo/project/123456.js
```

### Usage in Code

```javascript
// CommonJS
const repo = require("my-repo-md");

// ES Modules
import repo from "my-repo-md";

// Usage examples
const readme = await repo.getFile("README.md");
const docs = await repo.getDirectory("docs");
const contributors = await repo.getContributors();
```

### Package.json After Installation

```json
{
  "dependencies": {
    "my-repo-md": "https://npm.repo.md/repo/project/123456.js"
  }
}
```

## Implementation Steps

### Phase 1: Basic Implementation (Week 1)

1. Set up Cloudflare Worker project
2. Implement basic package generation
3. Add tarball creation functionality
4. Deploy to Cloudflare Workers

### Phase 2: Version Management (Week 2)

1. Implement NPM registry API calls for version checking
2. Add caching layer for package versions
3. Support version ranges in URLs (optional)

### Phase 3: Enhanced Features (Week 3)

1. Add configuration options via query parameters
2. Implement package signing for security
3. Add metrics and logging
4. Create documentation site

## Technical Considerations

### Caching Strategy

- Cache generated packages for 1 hour
- Use ETags for client-side caching
- Invalidate cache when repo-md version updates

### Security

- Validate owner/repo names to prevent injection
- Rate limit requests per IP
- Consider adding authentication for private repos

### Performance

- Use Cloudflare KV for caching frequently requested packages
- Implement streaming tarball generation for large packages
- Use Cloudflare's global network for distribution

## Error Handling

```javascript
// Handle various error cases
if (!isValidRepoName(owner, repoName)) {
  return new Response("Invalid repository name", { status: 400 });
}

try {
  // Verify repository exists
  const githubCheck = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}`
  );
  if (!githubCheck.ok) {
    return new Response("Repository not found", { status: 404 });
  }
} catch (error) {
  return new Response("Failed to verify repository", { status: 500 });
}
```

## Monitoring & Analytics

### Metrics to Track

- Package generation requests per repository
- Cache hit/miss rates
- Error rates and types
- Popular repositories
- Version distribution

### Logging

```javascript
// Log package requests
await env.ANALYTICS.writeDataPoint({
  timestamp: Date.now(),
  owner,
  repoName,
  version,
  userAgent: request.headers.get("User-Agent"),
});
```

## Future Enhancements

1. **Custom Configurations**

   ```
   https://npm.repo.md/repo/project/123456.js?branch=canary&auth=token
   ```

2. **Multiple Repository Support**

   ```javascript
   import { repo1, repo2 } from "my-repo-md";
   ```

3. **CLI Tool**

   ```bash
   npx create-repo-md project/123456.js
   ```

4. **Private Repository Support**
   - GitHub OAuth integration
   - Token-based authentication

## Success Criteria

- [ ] Users can install pre-configured repo-md packages with one command
- [ ] Package versions stay in sync with public repo-md
- [ ] Installation time < 5 seconds for average package
- [ ] 99.9% uptime for the service
- [ ] Zero configuration required for basic usage

## Contact & Support

- **Technical Lead**: [Your Name]
- **Slack Channel**: #repo-md-dynamic
- **Documentation**: https://docs.repo.md/repo-md
