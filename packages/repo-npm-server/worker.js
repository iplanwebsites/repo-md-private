import { createTarball, isValidProjectId } from "./utils.js";

const description = "NPM package generator for repo-md";

export default {
  async fetch(request) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter((part) => part);

    // Handle root route
    if (pathParts.length === 0) {
      return new Response(
        JSON.stringify({
          service: "repo-npm-instance",
          description: description,
          usage: {
            endpoint: "/project/{id}",
            example: "/project/680e97604a0559a192640d2c",
            install:
              "npm install my-repo-md@https://npm.repo.md/project/680e97604a0559a192640d2c",
          },
          documentation: "https://repo.md",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    if (
      pathParts.length < 2 ||
      pathParts.length > 2 ||
      pathParts[0] !== "project"
    ) {
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Invalid endpoint. Use /project/{id} to generate packages.",
          example: "/project/680e97604a0559a192640d2c",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    // Parse project ID and version from URL
    const fullProjectPath = pathParts[1];
    const [projectId, requestedVersion] = fullProjectPath.includes("@")
      ? fullProjectPath.split("@")
      : [fullProjectPath, "latest"];

    if (!isValidProjectId(projectId)) {
      return new Response("Invalid project identifier", { 
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    try {
      // Fetch repo-md package info from NPM
      const npmResponse = await fetch("https://registry.npmjs.org/repo-md");
      const npmData = await npmResponse.json();
      const latestVersion = npmData["dist-tags"].latest;

      // Determine version to use
      let version;
      if (requestedVersion === "latest") {
        version = latestVersion;
      } else {
        // Validate requested version exists
        if (!npmData.versions[requestedVersion]) {
          return new Response(
            JSON.stringify({
              error: "Version Not Found",
              message: `Version ${requestedVersion} does not exist for repo-md`,
              availableVersions: Object.keys(npmData.versions).slice(-10), // Last 10 versions
              latest: latestVersion,
            }),
            {
              status: 404,
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
              },
            }
          );
        }
        version = requestedVersion;

        // Log upgrade warning if using older version
        if (version !== latestVersion) {
          console.warn(
            `⚠️  Project ${projectId} is using repo-md@${version}. Latest version is ${latestVersion}.`
          );
          console.warn(
            `   To upgrade, run: npm update repo-md@${latestVersion}`
          );
          console.warn(
            `   Or reinstall with: npm install my-repo-md@https://npm.repo.md/project/${projectId}@${latestVersion}`
          );
        }
      }

      // Generate package files
      const packageFiles = generatePackageFiles(projectId, version);

      // Detect request type and serve appropriate format
      const userAgent = request.headers.get('User-Agent') || '';
      const acceptHeader = request.headers.get('Accept') || '';
      
      // Browser dynamic import requests
      const isBrowserImport = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari');
      
      if (isBrowserImport && acceptHeader.includes('*/*')) {
        // Serve browser-compatible ES module with CDN imports
        return new Response(packageFiles['package/index.browser.mjs'], {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "public, max-age=3600",
            ETag: `"${projectId}-${version}-browser"`,
            "X-Repo-MD-Version": version,
            "X-Latest-Version": latestVersion,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      } else {
        // Create tarball for npm installs (with Node.js-compatible imports)
        const tarball = await createTarball(packageFiles);

        return new Response(tarball, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="my-repo-md-${version}.tgz"`,
            "Cache-Control": "public, max-age=3600",
            ETag: `"${projectId}-${version}"`,
            "X-Repo-MD-Version": version,
            "X-Latest-Version": latestVersion,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
    } catch (error) {
      console.error("Error generating package:", error);
      return new Response("Internal Server Error", { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }
  },
};

function generatePackageFiles(projectId, version) {
  const packageJson = {
    name: "my-repo-md",
    version: version,
    description: `[repo.md] A repo.md SDK instance pre-loaded an instance for project ${projectId}. Install with npm install my-repo-md@https://npm.repo.md/project/${projectId}@latest. Update with npm i`,
    type: "module",
    main: "index.mjs",
    module: "index.mjs",
    exports: {
      ".": {
        import: "./index.mjs",
        require: "./index.js",
      },
    },
    types: "index.d.ts",
    dependencies: {
      "repo-md": `^${version}`,
    },
    website: "https://repo.md",
    homepage: "https://repo.md",

    keywords: ["repo-md", "repository", "markdown"],
    author: "repo-md",
    license: "MIT",
  };

  const indexJs = `// CommonJS wrapper for ES modules
module.exports = async function() {
  const RepoMD = await import('repo-md');
  
  // Create pre-configured instance
  const repo = new RepoMD.RepoMD({
    projectId: '${projectId}'
  });

  return {
    ...RepoMD,
    default: repo,
    repo
  };
};

// Also export the creation function directly
module.exports.createInstance = module.exports;
`;

  const indexMjs = `import * as RepoMDLib from 'repo-md';

// Create pre-configured instance
const repo = new RepoMDLib.RepoMD({
  projectId: '${projectId}'
});

// Re-export all core library exports
export * from 'repo-md';

// Export pre-configured instance and main class
export { repo as default, repo };
export { RepoMD as RepoMd } from 'repo-md';
`;

  const indexBrowserMjs = `// Browser-compatible version with CDN imports
import * as RepoMDLib from 'https://cdn.skypack.dev/repo-md';

// Create pre-configured instance
const repo = new RepoMDLib.RepoMD({
  projectId: '${projectId}'
});

// Make repo globally available for script tag usage
if (typeof window !== 'undefined') {
  window.repo = repo;
  window.RepoMd = RepoMDLib.RepoMD;
}

// Re-export all core library exports
export * from 'https://cdn.skypack.dev/repo-md';

// Export pre-configured instance and main class
export { repo as default, repo };
export { RepoMD as RepoMd } from 'https://cdn.skypack.dev/repo-md';
`;

  const indexDts = `// Re-export all core library types and exports
export * from 'repo-md';

// Import for instance typing
import * as RepoMDLib from 'repo-md';

// Pre-configured instance
declare const repo: RepoMDLib.RepoMD;

// Export pre-configured instance and main class with correct casing
export { repo as default, repo };
export { RepoMD as RepoMd } from 'repo-md';
`;

  const readmeMd = `# my-repo-md

Pre-configured instance of [repo-md](https://npmjs.com/package/repo-md) for project **${projectId}**.

## Usage

\`\`\`javascript
// ES Modules (Recommended) - Pre-configured instance
import repo from 'my-repo-md';
// Or access core library and class
import { RepoMd, repo } from 'my-repo-md';

// Browser Dynamic Import (uses CDN for dependencies)
const { repo } = await import('https://npm.repo.md/project/${projectId}');

// CommonJS - Async wrapper needed for ES modules
const createRepo = require('my-repo-md');
const { repo, RepoMD } = await createRepo();

// Use pre-configured instance
const posts = await repo.getAllPosts();
const readme = await repo.getFile('README.md');

// Or create new instances with core library
const customRepo = new RepoMd({ projectId: 'other-project' });
\`\`\`

## Project ID

This package is pre-configured for project: **${projectId}**

Generated by [repo.md](https://repo.md)
`;

  return {
    "package/package.json": JSON.stringify(packageJson, null, 2),
    "package/index.js": indexJs,
    "package/index.mjs": indexMjs,
    "package/index.browser.mjs": indexBrowserMjs,
    "package/index.d.ts": indexDts,
    "package/README.md": readmeMd,
  };
}
