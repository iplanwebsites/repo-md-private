// src/process/acquireUserRepo.js
import path from "path";
import fs from "fs/promises";
import GitHubService from "../services/githubService.js";

/**
 * Clones a given GitHub repository into a temporary folder
 * @param {Object} data - Job data containing repository information
 * @param {string} data.repoUrl - GitHub repository URL
 * @param {string} data.branch - Branch to clone (optional, defaults to 'main')
 * @param {string} data.gitToken - GitHub token for authentication (optional for public repos)
 * @param {string} data.jobId - Unique job identifier
 * @param {string} data.tempFolderPath - Path to temporary folder (optional)
 * @returns {Promise<Object>} - Result with repo information
 */
async function acquireUserRepo(data) {
  console.log("🔍 Acquiring user repository...", { jobId: data.jobId });
  
  // Validate required data
  if (!data.repoUrl) {
    throw new Error("Repository URL is required");
  }
  
  // Extract repo information from URL
  const repoUrl = data.repoUrl;
  const branch = data.branch || "main";
  
  // Create temporary folder path if not provided
  const tempFolderPath = data.tempFolderPath || path.join(
    process.env.TEMP_DIR || "/tmp",
    `repo-${data.jobId}-${Date.now()}`
  );
  
  try {
    // Initialize GitHub service
    const gitToken = data.gitToken || process.env.GITHUB_TOKEN;
    if (!gitToken && repoUrl.includes('github.com') && !repoUrl.startsWith('https://github.com/public/')) {
      console.error("❌ GitHub authentication token missing for potentially private repository", { jobId: data.jobId });
      throw new Error("GitHub authentication token is required for private repositories");
    }
    const githubService = new GitHubService(gitToken);
    
    // Ensure temp directory exists and is empty
    await fs.mkdir(tempFolderPath, { recursive: true });
    
    // Clone the repository
    const cloneResult = await githubService.cloneRepository(
      repoUrl,
      tempFolderPath,
      { branch, depth: data.depth || 1 }
    );
    
    console.log("✅ Repository acquired successfully", { 
      jobId: data.jobId,
      path: tempFolderPath
    });
    
    // Return the data with repo information
    return {
      ...data,
      tempFolderPath, // Add tempFolderPath at root level for cleanup
      repoInfo: {
        path: tempFolderPath,
        branch,
        cloned: true,
        source: repoUrl,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error("❌ Failed to acquire repository", {
      jobId: data.jobId,
      error: error.message
    });
    throw error;
  }
}

export default acquireUserRepo;