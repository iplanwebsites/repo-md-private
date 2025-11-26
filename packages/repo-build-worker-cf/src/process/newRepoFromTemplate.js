// src/process/newRepoFromTemplate.js
import path from "path";
import fs from "fs/promises";
import GitHubService from "../services/githubService.js";

/**
 * Creates a new repository from a template repo and clones it
 * @param {Object} data - Job data containing repository information
 * @param {string} data.templateRepoUrl - Template repository URL
 * @param {string} data.newRepoName - Name for the new repository
 * @param {string} data.newRepoDescription - Description for the new repository (optional)
 * @param {boolean} data.isPrivate - Whether the new repository should be private (optional)
 * @param {string} data.gitToken - GitHub token for authentication (required)
 * @param {string} data.jobId - Unique job identifier
 * @param {string} data.tempFolderPath - Path to temporary folder (optional)
 * @returns {Promise<Object>} - Result with repo information
 */
async function newRepoFromTemplate(data) {
  console.log("🔄 Creating new repository from template...", { jobId: data.jobId });
  
  // Validate required data
  if (!data.templateRepoUrl) {
    throw new Error("Template repository URL is required");
  }
  if (!data.newRepoName) {
    throw new Error("New repository name is required");
  }
  if (!data.gitToken && !process.env.GITHUB_TOKEN) {
    throw new Error("GitHub token is required");
  }
  
  // Parse template repo URL to extract owner and repo name
  // Expected format: https://github.com/owner/repo
  let templateOwner, templateRepo;
  try {
    const urlParts = new URL(data.templateRepoUrl).pathname.split('/').filter(Boolean);
    if (urlParts.length < 2) {
      throw new Error("Invalid repository URL format");
    }
    templateOwner = urlParts[0];
    templateRepo = urlParts[1];
  } catch (error) {
    throw new Error(`Failed to parse template repository URL: ${error.message}`);
  }
  
  // Create temporary folder path if not provided
  const tempFolderPath = data.tempFolderPath || path.join(
    process.env.TEMP_DIR || "/tmp",
    `repo-${data.jobId}-${Date.now()}`
  );
  
  try {
    // Initialize GitHub service
    const githubService = new GitHubService(data.gitToken || process.env.GITHUB_TOKEN);
    
    // Create new repository from template
    const newRepo = await githubService.copyTemplateRepo(
      templateOwner,
      templateRepo,
      data.newRepoName,
      data.newRepoDescription || "",
      data.isPrivate || false
    );
    
    // Ensure temp directory exists
    await fs.mkdir(tempFolderPath, { recursive: true });
    
    // Clone the newly created repository
    const cloneResult = await githubService.cloneRepository(
      newRepo.clone_url,
      tempFolderPath,
      { branch: "main", depth: 1 }
    );
    
    console.log("✅ New repository created and cloned successfully", {
      jobId: data.jobId,
      repoName: newRepo.full_name,
      path: tempFolderPath
    });
    
    // Return the data with repo information
    return {
      ...data,
      repoInfo: {
        path: tempFolderPath,
        branch: "main",
        cloned: true,
        newRepo: {
          name: newRepo.name,
          fullName: newRepo.full_name,
          htmlUrl: newRepo.html_url,
          cloneUrl: newRepo.clone_url,
          sshUrl: newRepo.ssh_url,
          isPrivate: newRepo.private
        },
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error("❌ Failed to create repository from template", {
      jobId: data.jobId,
      error: error.message
    });
    throw error;
  }
}

export default newRepoFromTemplate;