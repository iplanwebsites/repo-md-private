import { createStarterProjectFromBrief } from "../lib/mdAgent.js";
import GitHubService from "../services/githubService.js";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Generate a new project from a brief, create GitHub repo, and prepare for deployment
 *
 * Expected data structure:
 * {
 *   brief: "Create a personal blog about...",
 *   repoName?: "optional-repo-name",
 *   repoDescription?: "optional description",
 *   isPrivate?: false,
 *   gitToken?: "github_token_for_real_repo_creation"
 * }
 */
async function generateProjectFromBrief(data) {
  const { logger, jobId } = data;

  if (!logger) {
    throw new Error("Logger is required for generateProjectFromBrief process");
  }

  logger.log("🎯 Starting project generation from brief", { jobId });

  const {
    brief,
    repoName,
    repoDescription,
    isPrivate = false,
    gitToken,
    tempDir = process.env.TEMP_DIR || "/tmp",
  } = data;

  if (!brief) {
    throw new Error("Brief is required for project generation");
  }

  // Generate repository name if not provided
  const finalRepoName = repoName || generateRepoName(brief);
  const finalDescription =
    repoDescription || `Generated project: ${brief.substring(0, 100)}...`;

  // Create temp directory for this job
  const projectDir = path.join(tempDir, `project-${jobId}`, finalRepoName);

  logger.log("📝 Project configuration", {
    jobId,
    brief: `${brief.substring(0, 100)}...`,
    repoName: finalRepoName,
    projectDir,
    hasGitToken: !!gitToken,
  });

  try {
    // Step 1: Generate project files
    logger.log("🎨 Generating project files from brief", { jobId });

    const projectResult = await createStarterProjectFromBrief(brief, {
      outputDir: projectDir,
      mockMode: !process.env.OPENAI_API_KEY,
    });

    logger.log("✅ Project files generated", {
      jobId,
      filesCount: projectResult.files.length,
      outputDir: projectResult.outputDir,
    });

    // Step 2: Create GitHub repository (if token provided)
    let githubRepo = null;
    if (gitToken) {
      logger.log("📱 Creating GitHub repository", {
        jobId,
        repoName: finalRepoName,
      });

      const githubService = new GitHubService(gitToken);

      try {
        // Create repository
        githubRepo = await githubService.createRepository(finalRepoName, {
          description: finalDescription,
          private: isPrivate,
          auto_init: false,
        });

        logger.log("✅ GitHub repository created", {
          jobId,
          repoUrl: githubRepo.html_url,
          cloneUrl: githubRepo.clone_url,
        });

        // Initialize git and push
        await initializeAndPushRepo(
          projectDir,
          githubRepo.clone_url,
          gitToken,
          logger,
          jobId
        );
      } catch (error) {
        logger.error("❌ Failed to create GitHub repository", {
          jobId,
          error: error.message,
        });
        // Don't throw - continue with local files
        githubRepo = {
          name: finalRepoName,
          html_url: `https://github.com/mock-user/${finalRepoName}`,
          clone_url: `https://github.com/mock-user/${finalRepoName}.git`,
          error: error.message,
        };
      }
    } else {
      logger.log("ℹ️ No GitHub token provided, skipping repository creation", {
        jobId,
      });
      githubRepo = {
        name: finalRepoName,
        html_url: `https://github.com/mock-user/${finalRepoName}`,
        clone_url: `https://github.com/mock-user/${finalRepoName}.git`,
        mock: true,
      };
    }

    // Step 3: Prepare result for deployment pipeline
    const result = {
      success: true,
      brief,
      projectGeneration: {
        files: projectResult.files,
        filesCount: projectResult.files.length,
        outputDir: projectResult.outputDir,
      },
      githubRepo,
      tempFolderPath: path.dirname(projectDir), // For cleanup

      // Standard fields for integration with existing pipeline
      assets: {
        distFolder: projectDir,
        contentPath: path.join(projectDir, "_project-summary.md"),
      },
      repoUrl: githubRepo.clone_url,
      repoInfo: githubRepo,

      // Metadata
      generatedAt: new Date().toISOString(),
      jobId,
    };

    logger.log("🎉 Project generation workflow completed", {
      jobId,
      success: true,
      filesGenerated: result.projectGeneration.filesCount,
      repoCreated: !githubRepo.mock && !githubRepo.error,
    });

    return result;
  } catch (error) {
    logger.error("❌ Project generation failed", {
      jobId,
      error: error.message,
      projectDir,
    });

    // Attempt cleanup
    try {
      await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
      logger.log("🧹 Cleaned up project directory after error", { jobId });
    } catch (cleanupError) {
      logger.warn("⚠️ Failed to cleanup project directory", {
        jobId,
        cleanupError: cleanupError.message,
      });
    }

    throw error;
  }
}

/**
 * Initialize git repository and push to GitHub
 */
async function initializeAndPushRepo(
  projectDir,
  cloneUrl,
  gitToken,
  logger,
  jobId
) {
  try {
    // Use authenticated URL for pushing
    const authUrl = cloneUrl.replace(
      "https://github.com",
      `https://x-access-token:${gitToken}@github.com`
    );

    const commands = [
      "git init --initial-branch=main",
      "git add .",
      'git commit -m "Initial commit: Generated project from brief"',
      `git remote add origin ${authUrl}`,
      "git branch -M main",
      "git push -u origin main",
    ];

    for (const command of commands) {
      logger.log(`▶️ ${command.replace(gitToken, "***")}`, { jobId });
      try {
        execSync(command, {
          cwd: projectDir,
          stdio: "pipe",
          timeout: 30000, // 30 second timeout
        });
      } catch (error) {
        logger.error(`❌ Git command failed: ${command}`, {
          jobId,
          error: error.message,
        });
        throw error;
      }
    }

    logger.log("✅ Code pushed to GitHub successfully", { jobId });
  } catch (error) {
    logger.error("❌ Failed to push to GitHub", {
      jobId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Generate repository name from brief
 */
function generateRepoName(brief) {
  return (
    brief
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(" ")
      .slice(0, 3)
      .join("-")
      .substring(0, 50) + `-${Date.now().toString().slice(-4)}`
  );
}

export default generateProjectFromBrief;
