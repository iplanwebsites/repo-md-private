// src/process/wpImport.js
import path from "path";
import fs from "fs/promises";
import { stat } from "fs/promises";
import WpImporter from "../lib/wpImporter.js";
import GitHubService from "../services/githubService.js";

/**
 * Process WordPress export.xml file, convert it to markdown, create a git repo with it, and deploy
 * @param {Object} data - Job data containing WordPress export information
 * @param {string} data.xmlFilePath - Path to the WordPress export XML file
 * @param {string} data.repoName - Name for the new repository
 * @param {string} data.gitToken - GitHub token for authentication
 * @param {string} data.jobId - Unique job identifier
 * @param {Object} data.wpImportOptions - Options for WordPress import (optional)
 * @param {boolean} data.isPrivate - Whether the new repository should be private (optional)
 * @returns {Promise<Object>} - Result with repo and import information
 */
async function wpImport(data) {
  console.log("🔄 Processing WordPress import...", { jobId: data.jobId });

  // Validate required data
  if (!data.xmlFilePath) {
    throw new Error("WordPress export XML file path is required");
  }
  
  try {
    // Check that the XML file exists and has content
    const fileStats = await stat(data.xmlFilePath);
    if (fileStats.size === 0) {
      throw new Error("WordPress export XML file is empty");
    }
    console.log(`✅ WordPress export XML file verified: ${data.xmlFilePath} (${fileStats.size} bytes)`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`WordPress export XML file not found at: ${data.xmlFilePath}`);
    }
    throw error;
  }

  if (!data.repoName) {
    throw new Error("Repository name is required");
  }
  
  // Generate a default repo name if not provided
  if (!data.repoName) {
    data.repoName = `wordpress-import-${Date.now()}`;
    console.log(`⚠️ No repository name provided, using default: ${data.repoName}`);
  }

  // Create organized folder structure
  const jobFolder = path.join(
    process.env.TEMP_DIR || "/tmp",
    "repo.md/wp-import",
    `import-${Date.now()}-${data.jobId}`
  );

  // Source directory is where we'll store the converted markdown
  const sourceFolderPath = path.join(jobFolder, "source");
  
  try {
    // Initialize GitHub service
    const githubService = new GitHubService(
      data.gitToken || process.env.GITHUB_TOKEN
    );
    
    // Create main job folder and required subdirectories
    await fs.mkdir(jobFolder, { recursive: true });
    await fs.mkdir(sourceFolderPath, { recursive: true });
    
    console.log("✅ Temporary directories created", {
      jobId: data.jobId,
      jobFolder,
      sourcePath: sourceFolderPath
    });
    
    // Copy XML file to work directory if it exists
    try {
      await fs.copyFile(data.xmlFilePath, path.join(jobFolder, "export.xml"));
      console.log("✅ WordPress export file copied to work directory", {
        jobId: data.jobId
      });
    } catch (error) {
      console.error("❌ Failed to copy WordPress export file", {
        jobId: data.jobId,
        error: error.message
      });
      throw new Error(`Failed to copy WordPress export file: ${error.message}`);
    }
    
    // Configure WordPress importer
    const wpImportOptions = {
      outputDir: sourceFolderPath,
      exportFile: path.join(jobFolder, "export.xml"),
      ...data.wpImportOptions // Allow user to override default options
    };
    
    const wpImporter = new WpImporter(wpImportOptions);
    
    // Run the import process
    console.log("🚀 Starting WordPress import conversion", { jobId: data.jobId });
    const importResult = await wpImporter.import();
    
    if (!importResult) {
      throw new Error("WordPress import conversion failed");
    }
    
    console.log("✅ WordPress import conversion completed", { jobId: data.jobId });
    
    // Create a new repository
    console.log("🔄 Creating new repository from imported content", { 
      jobId: data.jobId,
      repoName: data.repoName
    });
    
    const newRepo = await githubService.createRepository(data.repoName, {
      description: data.repoDescription || "WordPress import created by Repo MD",
      private: data.isPrivate === true,
      auto_init: false
    });
    
    console.log("✅ Repository created", {
      jobId: data.jobId,
      repoName: newRepo.full_name,
      repoUrl: newRepo.html_url
    });
    
    // Initialize git repo, commit all files, and push to GitHub
    console.log("🔄 Initializing git repository and committing files", { 
      jobId: data.jobId 
    });
    
    const gitInitCommands = [
      `git init`,
      `git config --local user.name "Repo MD"`,
      `git config --local user.email "no-reply@repomd.com"`,
      `git remote add origin ${newRepo.clone_url}`,
      `git add .`,
      `git commit -m "Initial import from WordPress"`,
      `git branch -M main`,
      `git push -u origin main`
    ];
    
    const buildResult = await githubService.performBuild(
      sourceFolderPath,
      gitInitCommands
    );
    
    if (!buildResult.success) {
      throw new Error("Failed to commit and push imported content");
    }
    
    console.log("✅ WordPress import committed and pushed to repository", {
      jobId: data.jobId
    });
    
    // Return the data with repo information
    return {
      ...data,
      tempFolderPath: jobFolder, // Add root temp folder for cleanup
      repoInfo: {
        jobFolder,
        path: sourceFolderPath,
        repoName: newRepo.name,
        fullName: newRepo.full_name,
        html_url: newRepo.html_url,
        clone_url: newRepo.clone_url,
        deployed: true,
        source: "wp-import",
        timestamp: new Date().toISOString(),
      },
      wpImportInfo: {
        importSuccess: true,
        contentCount: "See files in repository",
      }
    };
  } catch (error) {
    console.error("❌ Failed to process WordPress import", {
      jobId: data.jobId,
      error: error.message
    });
    throw error;
  }
}

export default wpImport;