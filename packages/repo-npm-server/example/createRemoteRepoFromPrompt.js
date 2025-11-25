#!/usr/bin/env node

import { spawn } from "child_process";
import { promisify } from "util";

/**
 * Mock API function that simulates creating a repo.md project from a prompt
 * In a real implementation, this would call the repo.md API
 */
export async function createRemoteRepoFromPrompt(prompt, options = {}) {
  const {
    apiUrl = "https://api.repo.md/v1",
    timeout = 30000,
    verbose = false,
  } = options;

  if (verbose) {
    console.log(`🚀 Creating repo.md project from prompt: "${prompt}"`);
  }

  // Simulate API call delay
  await new Promise((resolve) =>
    setTimeout(resolve, 1000 + Math.random() * 2000)
  );

  // Mock project creation response
  const mockProjectId = generateMockProjectId();

  if (verbose) {
    console.log(`✅ Project created successfully!`);
    console.log(`📋 Project ID: ${mockProjectId}`);
  }

  return {
    success: true,
    projectId: mockProjectId,
    prompt: prompt,
    createdAt: new Date().toISOString(),
    status: "ready",
    endpoints: {
      api: `${apiUrl}/project/${mockProjectId}`,
      npm: `https://npm.repo.md/project/${mockProjectId}`,
      web: `https://repo.md/project/${mockProjectId}`,
    },
  };
}

/**
 * Generate a realistic mock project ID (similar to MongoDB ObjectId)
 */
function generateMockProjectId() {
  const timestamp = Math.floor(Date.now() / 1000).toString(16);
  const randomBytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");

  return timestamp + randomBytes.substring(0, 16);
}

/**
 * Install the dynamic npm package for a project
 */
export async function installRepoMdPackage(projectId, options = {}) {
  const {
    packageName = "my-repo-md",
    npmRegistry = "https://npm.repo.md",
    directory = process.cwd(),
    verbose = false,
  } = options;

  const packageUrl = `${npmRegistry}/project/${projectId}`;
  const installCommand = `npm install ${packageName}@${packageUrl}`;

  if (verbose) {
    console.log(`📦 Installing package from: ${packageUrl}`);
    console.log(`💻 Running: ${installCommand}`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["install", `${packageName}@${packageUrl}`], {
      cwd: directory,
      stdio: verbose ? "inherit" : "pipe",
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    if (!verbose) {
      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });
    }

    child.on("close", (code) => {
      if (code === 0) {
        if (verbose) {
          console.log(`✅ Package installed successfully!`);
        }
        resolve({
          success: true,
          packageUrl,
          installCommand,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      } else {
        reject(new Error(`npm install failed with code ${code}\n${stderr}`));
      }
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start npm install: ${error.message}`));
    });
  });
}

/**
 * Complete workflow: create project and install package
 */
export async function createAndInstallRepo(prompt, options = {}) {
  const { installDir = process.cwd(), verbose = true, ...apiOptions } = options;

  try {
    // Step 1: Create remote repo from prompt
    if (verbose) {
      console.log(`\n🔧 Step 1: Creating repo.md project...`);
    }

    const project = await createRemoteRepoFromPrompt(prompt, {
      ...apiOptions,
      verbose,
    });

    // Step 2: Install npm package
    if (verbose) {
      console.log(`\n📦 Step 2: Installing npm package...`);
    }

    const installation = await installRepoMdPackage(project.projectId, {
      directory: installDir,
      verbose,
    });

    // Step 3: Success summary
    if (verbose) {
      console.log(`\n🎉 Complete! Your repo.md project is ready.`);
      console.log(`\n📋 Project Details:`);
      console.log(`   Project ID: ${project.projectId}`);
      console.log(`   Package URL: ${installation.packageUrl}`);
      console.log(`\n💡 Usage Example:`);
      console.log(`   import { repo } from 'my-repo-md';`);
      console.log(`   const posts = await repo.getAllPosts();`);
      console.log(`\n🌐 URLs:`);
      console.log(`   API: ${project.endpoints.api}`);
      console.log(`   NPM: ${project.endpoints.npm}`);
      console.log(`   Web: ${project.endpoints.web}`);
    }

    return {
      project,
      installation,
      success: true,
    };
  } catch (error) {
    if (verbose) {
      console.error(`\n❌ Error: ${error.message}`);
    }
    throw error;
  }
}

// CLI functionality when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const prompt = process.argv[2];

  if (!prompt) {
    console.error(
      'Usage: node createRemoteRepoFromPrompt.js "your prompt here"'
    );
    console.error(
      'Example: node createRemoteRepoFromPrompt.js "Create a cooking blog with recipes"'
    );
    process.exit(1);
  }

  try {
    await createAndInstallRepo(prompt, {
      verbose: true,
      installDir: process.cwd(),
    });
  } catch (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
}
