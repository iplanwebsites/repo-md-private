// src/process/deployRepo.js
import path from "path";
import fs from "fs/promises";
import GitHubService from "../services/githubService.js";

// Flag to control if we want just the files without git history
const SHALLOW_CLONE = true;

/**
 * Deploys a repository directly without cloning to user's organization first
 * @param {Object} data - Job data containing repository information
 * @param {string} data.repoUrl - GitHub repository URL
 * @param {string} data.branch - Branch to clone (optional, defaults to 'main')
 * @param {string} data.commit - Specific commit to checkout (optional)
 * @param {string} data.gitToken - GitHub token for authentication (optional for public repos)
 * @param {string} data.jobId - Unique job identifier
 * @param {string} data.tempFolderPath - Path to temporary folder (optional)
 * @param {Array<string>} data.buildCommands - Commands to run during build (optional)
 * @returns {Promise<Object>} - Result with repo and build information
 */
async function deployRepo(data) {
  console.log("🚀 Deploying repository...", { jobId: data.jobId });

  // Validate required data
  if (!data.repoUrl) {
    throw new Error("Repository URL is required");
  }

  // Extract repo information from URL
  const repoUrl = data.repoUrl;
  const branch = data.branch || "main";

  // Create organized folder structure
  const jobFolder =
    data.tempFolderPath ||
    path.join(
      process.env.TEMP_DIR || "/tmp",
      "repo.md/worker-cache",
      `deploy-${Date.now()}-${data.jobId}`
    );

  // Source directory is where we clone the repo
  const tempFolderPath = path.join(jobFolder, "source");

  try {
    // Initialize GitHub service (token optional for public repos)
    const gitToken = data.gitToken || process.env.GITHUB_TOKEN || null;
    if (!gitToken) {
      console.log("ℹ️ No GitHub token provided - attempting public repo clone", { jobId: data.jobId });
    }
    const githubService = new GitHubService(gitToken);

    // Create main job folder and required subdirectories
    await fs.mkdir(jobFolder, { recursive: true });
    await fs.mkdir(tempFolderPath, { recursive: true });
    await fs.mkdir(path.join(jobFolder, "dist"), { recursive: true });

    // Clone the repository
    const cloneResult = await githubService.cloneRepository(
      repoUrl,
      tempFolderPath,
      { 
        branch, 
        depth: data.depth || 1,
        shallow: SHALLOW_CLONE // Use the shallow clone flag
      }
    );

    console.log("✅ Repository cloned successfully", {
      jobId: data.jobId,
      jobFolder: jobFolder,
      sourcePath: tempFolderPath,
      distPath: path.join(jobFolder, "dist"),
    });

    // If a specific commit was specified, check it out (only when not using shallow clone)
    if (data.commit && !SHALLOW_CLONE) {
      // Skip checkout if commit is 'latest' as it's not a valid git reference
      if (data.commit === "latest") {
        console.log(
          `⚠️ Skipping checkout for 'latest' - using default branch ${branch}`,
          { jobId: data.jobId }
        );
      } else {
        console.log(`🔍 Checking out specific commit: ${data.commit}`, {
          jobId: data.jobId,
        });
        await githubService.performBuild(tempFolderPath, [
          `git checkout ${data.commit}`,
        ]);
      }
    } else if (data.commit && SHALLOW_CLONE) {
      console.log(
        `⚠️ Specific commit '${data.commit}' ignored when using shallow clone - using latest ${branch} content instead`,
        { jobId: data.jobId }
      );
    }

    // Run build commands if provided
    let buildResult = { success: true };
    if (
      data.buildCommands &&
      Array.isArray(data.buildCommands) &&
      data.buildCommands.length > 0
    ) {
      console.log(`🔨 Running build commands`, { jobId: data.jobId });
      buildResult = await githubService.performBuild(
        tempFolderPath,
        data.buildCommands
      );
    }

    // Return the data with repo and build information
    return {
      ...data,
      tempFolderPath: jobFolder, // Update tempFolderPath to point to the root job folder for cleanup
      repoInfo: {
        jobFolder: jobFolder,
        path: tempFolderPath,
        distPath: path.join(jobFolder, "dist"),
        branch,
        commit: data.commit,
        deployed: true,
        source: repoUrl,
        timestamp: new Date().toISOString(),
      },
      buildInfo: buildResult,
    };
  } catch (error) {
    console.error("❌ Failed to deploy repository", {
      jobId: data.jobId,
      error: error.message,
    });
    throw error;
  }
}

export default deployRepo;
