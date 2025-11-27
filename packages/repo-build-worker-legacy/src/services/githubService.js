// github-service-worker.js
import { Octokit } from "octokit";
import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";

/**
 * GitHub Service for build workers - handles repository operations like cloning,
 * template copying, and build operations
 */
class GitHubService {
  /**
   * Initialize the GitHub service with an authentication token
   * @param {string} token - GitHub personal access token
   */
  constructor(token) {
    this.token = token;
    this.octokit = new Octokit({
      auth: token,
    });
  }

  /**
   * Clone a repository to a specified directory
   * @param {string} repoUrl - The repository URL (https or SSH)
   * @param {string} targetDir - The directory to clone into
   * @param {Object} options - Optional clone parameters (branch, depth, shallow)
   * @returns {Promise<Object>} - Clone result with status and path
   */
  async cloneRepository(repoUrl, targetDir, options = {}) {
    try {
      const { branch = "main", depth = 1, shallow = false } = options;

      // Ensure target directory exists
      await fs.mkdir(targetDir, { recursive: true });

      console.log(`📥 Cloning repository: ${repoUrl}`);
      console.log(`📁 Target directory: ${targetDir}`);
      console.log(`🔀 Branch: ${branch}`);

      // Determine if authentication token is available
      const hasToken = !!this.token;

      if (shallow) {
        // For shallow clone, we'll use a simpler approach with git but remove the .git folder
        console.log(`🧠 Using shallow clone (no git history)`);

        // Do a very shallow git clone (depth=1) then remove the .git directory
        console.log(`📚 Cloning with minimal depth`);

        // Prepare git clone command with minimal depth
        let cloneCommand = [
          "git",
          "clone",
          "--depth",
          "1",
          "--branch",
          branch
        ];

        // Add authentication for GitHub URLs if token is available
        if (hasToken && repoUrl.includes('github.com')) {
          console.log('🔑 Using authentication token for private repository');
          // Use the token directly from the instance variable
          const token = this.token;
          const urlWithAuth = repoUrl.replace('https://github.com', `https://x-access-token:${token}@github.com`);
          cloneCommand.push(urlWithAuth);
        } else {
          cloneCommand.push(repoUrl);
        }

        // Add target directory and join to create command string
        cloneCommand.push(targetDir);
        cloneCommand = cloneCommand.join(" ");

        // Execute clone command
        execSync(cloneCommand, { stdio: "inherit" });

        // Remove the .git directory to eliminate all Git metadata
        console.log(`🧹 Removing Git history and metadata`);
        const gitDir = path.join(targetDir, '.git');
        execSync(`rm -rf "${gitDir}"`);

        console.log(`✅ Repository files extracted successfully (no Git metadata)`);
      } else {
        // Regular git clone with history
        console.log(`📚 Using regular git clone with history`);

        // Prepare git clone command
        let cloneCommand = [
          "git",
          "clone",
          "--depth",
          depth,
          "--branch",
          branch
        ];

        // Add authentication for GitHub URLs if token is available
        if (hasToken && repoUrl.includes('github.com')) {
          console.log('🔑 Using authentication token for private repository');
          // Use the token directly from the instance variable
          const token = this.token;
          const urlWithAuth = repoUrl.replace('https://github.com', `https://x-access-token:${token}@github.com`);
          cloneCommand.push(urlWithAuth);
        } else {
          cloneCommand.push(repoUrl);
        }

        // Add target directory and join to create command string
        cloneCommand.push(targetDir);
        cloneCommand = cloneCommand.join(" ");

        // Execute clone command
        execSync(cloneCommand, { stdio: "inherit" });

        console.log(`✅ Repository cloned successfully`);
      }

      return {
        success: true,
        path: targetDir,
        branch,
        shallow,
      };
    } catch (error) {
      console.error(`❌ Error cloning repository:`, error);
      throw error;
    }
  }

  /**
   * Copy a template repository to a user's GitHub namespace
   * @param {string} templateOwner - Owner of the template repository
   * @param {string} templateRepo - Name of the template repository
   * @param {string} newRepoName - Name for the new repository
   * @param {string} newRepoDescription - Description for the new repository
   * @param {boolean} isPrivate - Whether the new repository should be private
   * @returns {Promise<Object>} - Information about the created repository
   */
  async copyTemplateRepo(
    templateOwner,
    templateRepo,
    newRepoName,
    newRepoDescription = "",
    isPrivate = false
  ) {
    try {
      console.log(
        `📋 Copying template repository: ${templateOwner}/${templateRepo}`
      );
      console.log(`🆕 Creating new repository: ${newRepoName}`);

      // Create a new repository from template
      const { data: newRepo } = await this.octokit.request(
        "POST /repos/{template_owner}/{template_repo}/generate",
        {
          template_owner: templateOwner,
          template_repo: templateRepo,
          owner: undefined, // Will use authenticated user by default
          name: newRepoName,
          description: newRepoDescription,
          private: isPrivate,
          include_all_branches: false,
          headers: {
            "x-github-api-version": "2022-11-28",
          },
        }
      );

      console.log(`✅ Repository created: ${newRepo.full_name}`);
      console.log(`🔗 Repository URL: ${newRepo.html_url}`);

      return {
        id: newRepo.id,
        name: newRepo.name,
        full_name: newRepo.full_name,
        html_url: newRepo.html_url,
        clone_url: newRepo.clone_url,
        ssh_url: newRepo.ssh_url,
        private: newRepo.private,
        description: newRepo.description,
      };
    } catch (error) {
      console.error(`❌ Error copying template repository:`, error);
      throw error;
    }
  }

  /**
   * Fork a repository to the authenticated user's account
   * @param {string} owner - Owner of the repository to fork
   * @param {string} repo - Name of the repository to fork
   * @param {string} newName - Optional name for the forked repository
   * @returns {Promise<Object>} - Information about the forked repository
   */
  async forkRepository(owner, repo, newName = null) {
    try {
      console.log(`🍴 Forking repository: ${owner}/${repo}`);

      const { data: forkedRepo } = await this.octokit.request(
        "POST /repos/{owner}/{repo}/forks",
        {
          owner,
          repo,
          name: newName,
          default_branch_only: false,
          headers: {
            "x-github-api-version": "2022-11-28",
          },
        }
      );

      console.log(`✅ Repository forked: ${forkedRepo.full_name}`);
      console.log(`🔗 Fork URL: ${forkedRepo.html_url}`);

      return {
        id: forkedRepo.id,
        name: forkedRepo.name,
        full_name: forkedRepo.full_name,
        html_url: forkedRepo.html_url,
        clone_url: forkedRepo.clone_url,
        ssh_url: forkedRepo.ssh_url,
        private: forkedRepo.private,
        description: forkedRepo.description,
      };
    } catch (error) {
      console.error(`❌ Error forking repository:`, error);
      throw error;
    }
  }

  /**
   * Create a new empty repository
   * @param {string} name - Repository name
   * @param {Object} options - Repository options (description, private, etc.)
   * @returns {Promise<Object>} - Information about the created repository
   */
  async createRepository(name, options = {}) {
    try {
      const {
        description = "",
        private: isPrivate = false,
        auto_init = true,
        gitignore_template = null,
        license_template = null,
      } = options;

      console.log(`🔨 Creating new repository: ${name}`);

      const { data: newRepo } = await this.octokit.request("POST /user/repos", {
        name,
        description,
        private: isPrivate,
        auto_init,
        gitignore_template,
        license_template,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      console.log(`✅ Repository created: ${newRepo.full_name}`);
      console.log(`🔗 Repository URL: ${newRepo.html_url}`);

      return {
        id: newRepo.id,
        name: newRepo.name,
        full_name: newRepo.full_name,
        html_url: newRepo.html_url,
        clone_url: newRepo.clone_url,
        ssh_url: newRepo.ssh_url,
        private: newRepo.private,
        description: newRepo.description,
      };
    } catch (error) {
      console.error(`❌ Error creating repository:`, error);
      throw error;
    }
  }

  /**
   * Run build commands in a cloned repository
   * @param {string} repoPath - Path to the cloned repository
   * @param {Array<string>} buildCommands - Array of build commands to execute
   * @param {Object} options - Build options
   * @returns {Promise<Object>} - Build result
   */
  async performBuild(repoPath, buildCommands, options = {}) {
    try {
      const { timeout = 300000, cwd = repoPath } = options;

      console.log(`🔨 Starting build process in: ${repoPath}`);

      const results = [];

      for (const command of buildCommands) {
        console.log(`▶️ Running command: ${command}`);

        try {
          const output = execSync(command, {
            cwd,
            timeout,
            stdio: "pipe",
            encoding: "utf8",
          });

          results.push({
            command,
            success: true,
            output: output.trim(),
          });

          console.log(`✅ Command completed successfully`);
        } catch (error) {
          results.push({
            command,
            success: false,
            error: error.message,
            stderr: error.stderr ? error.stderr.toString() : null,
            stdout: error.stdout ? error.stdout.toString() : null,
          });

          console.error(`❌ Command failed: ${error.message}`);

          // Stop build process on error
          throw error;
        }
      }

      console.log(`✅ Build completed successfully`);

      return {
        success: true,
        results,
      };
    } catch (error) {
      console.error(`❌ Build failed:`, error);
      return {
        success: false,
        error: error.message,
        results: error.results || [],
      };
    }
  }

  /**
   * Get repository information
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} - Repository information
   */
  async getRepositoryInfo(owner, repo) {
    try {
      const { data: repository } = await this.octokit.request(
        "GET /repos/{owner}/{repo}",
        {
          owner,
          repo,
          headers: {
            "x-github-api-version": "2022-11-28",
          },
        }
      );

      return {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        description: repository.description,
        html_url: repository.html_url,
        clone_url: repository.clone_url,
        ssh_url: repository.ssh_url,
        language: repository.language,
        stargazers_count: repository.stargazers_count,
        forks_count: repository.forks_count,
        visibility: repository.visibility,
        created_at: repository.created_at,
        updated_at: repository.updated_at,
        pushed_at: repository.pushed_at,
        default_branch: repository.default_branch,
        is_template: repository.is_template,
      };
    } catch (error) {
      console.error(`❌ Error getting repository info:`, error);
      throw error;
    }
  }

  /**
   * Check if a repository exists
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<boolean>} - True if repository exists
   */
  async repositoryExists(owner, repo) {
    try {
      await this.getRepositoryInfo(owner, repo);
      return true;
    } catch (error) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Clean up cloned repository
   * @param {string} repoPath - Path to the cloned repository
   * @returns {Promise<void>}
   */
  async cleanupRepository(repoPath) {
    try {
      console.log(`🧹 Cleaning up repository: ${repoPath}`);
      await fs.rm(repoPath, { recursive: true, force: true });
      console.log(`✅ Repository cleaned up successfully`);
    } catch (error) {
      console.error(`❌ Error cleaning up repository:`, error);
      throw error;
    }
  }

  /**
   * Handle API errors
   * @param {Error} error - Error object
   */
  handleError(error) {
    if (error.response) {
      console.error(
        `GitHub API Error: Status ${error.response.status} - ${error.response.data.message}`
      );

      // Handle rate limit errors
      if (
        error.status === 403 &&
        error.response.headers["x-ratelimit-remaining"] === "0"
      ) {
        const resetTimeEpochSeconds =
          error.response.headers["x-ratelimit-reset"];
        const currentTimeEpochSeconds = Math.floor(Date.now() / 1000);
        const secondsToWait = resetTimeEpochSeconds - currentTimeEpochSeconds;
        console.error(
          `Rate limit exceeded. Resets in ${secondsToWait} seconds.`
        );
      }
    } else {
      console.error(`Error with GitHub service:`, error);
    }
    throw error;
  }
}

export default GitHubService;
