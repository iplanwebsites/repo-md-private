import { Octokit } from "@octokit/rest";
import crypto from 'crypto';

export class GitHubBulkOps {
  constructor(token) {
    this.octokit = new Octokit({ auth: token });
  }

  /**
   * Create a new repository and bootstrap it with files
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} files - Object with file paths as keys and content as values
   * @param {string} commitMessage - Commit message
   * @param {Object} repoOptions - Repository creation options
   */
  async createAndBootstrapRepo(owner, repo, files, commitMessage = "Initial commit", repoOptions = {}) {
    try {
      console.log(`🏗️ Creating repository ${owner}/${repo}...`);
      
      // Create the repository
      const { data: repository } = await this.octokit.rest.repos.createForAuthenticatedUser({
        name: repo,
        private: repoOptions.private || false,
        description: repoOptions.description || '',
        auto_init: true, // This creates an initial commit with README
      });

      console.log(`✅ Repository created: ${repository.html_url}`);
      
      // Wait a moment for GitHub to process the repository
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Now bootstrap with files
      console.log(`📁 Adding files to repository...`);
      const bootstrapResult = await this.bootstrapRepo(owner, repo, files, commitMessage, 'main');
      
      return {
        success: true,
        repository: {
          id: repository.id,
          name: repository.name,
          fullName: repository.full_name,
          url: repository.html_url,
          cloneUrl: repository.clone_url,
          sshUrl: repository.ssh_url,
          defaultBranch: repository.default_branch,
          createdAt: repository.created_at,
        },
        commitSha: bootstrapResult.commitSha,
        commitUrl: bootstrapResult.commitUrl,
      };
    } catch (error) {
      console.error("Error creating and bootstrapping repo:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Bootstrap a new repository with multiple files in a single commit
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} files - Object with file paths as keys and content as values
   * @param {string} commitMessage - Commit message
   * @param {string} branch - Target branch (default: 'main')
   */
  async bootstrapRepo(owner, repo, files, commitMessage = "Initial commit", branch = "main") {
    try {
      // Get the default branch reference
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });

      // Get the commit object
      const { data: commit } = await this.octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: ref.object.sha,
      });

      // Create tree entries for all files
      const tree = await this._createTreeEntries(owner, repo, files);

      // Create new tree
      const { data: newTree } = await this.octokit.rest.git.createTree({
        owner,
        repo,
        tree,
        base_tree: commit.tree.sha,
      });

      // Create new commit
      const { data: newCommit } = await this.octokit.rest.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: newTree.sha,
        parents: [commit.sha],
      });

      // Update reference
      await this.octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
      });

      return {
        success: true,
        commitSha: newCommit.sha,
        commitUrl: newCommit.html_url,
      };
    } catch (error) {
      console.error("Error bootstrapping repo:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Load repository files into memory for processing
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string[]} filePaths - Array of file paths to load
   * @param {string} branch - Branch to load from (default: 'main')
   */
  async loadFiles(owner, repo, filePaths, branch = "main") {
    try {
      const files = {};
      const filePromises = filePaths.map(async (path) => {
        try {
          const { data } = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path,
            ref: branch,
          });

          if (data.type === 'file') {
            files[path] = {
              content: Buffer.from(data.content, 'base64').toString('utf-8'),
              sha: data.sha,
              encoding: data.encoding,
            };
          }
        } catch (error) {
          if (error.status !== 404) {
            throw error;
          }
          // File doesn't exist, will be created as new
          files[path] = {
            content: '',
            sha: null,
            encoding: 'utf-8',
          };
        }
      });

      await Promise.all(filePromises);

      return {
        success: true,
        files,
      };
    } catch (error) {
      console.error("Error loading files:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Apply find-and-replace operations to loaded files
   * @param {Object} files - Files object from loadFiles
   * @param {Array} operations - Array of {find, replace, files} operations
   */
  applyFindReplace(files, operations) {
    const modifiedFiles = { ...files };

    operations.forEach(({ find, replace, filePatterns = ['**/*'] }) => {
      Object.keys(modifiedFiles).forEach((filePath) => {
        // Simple pattern matching (you could use minimatch for more complex patterns)
        const shouldModify = filePatterns.some(pattern => 
          pattern === '**/*' || 
          filePath.includes(pattern.replace('*', '')) ||
          new RegExp(pattern.replace(/\*/g, '.*')).test(filePath)
        );

        if (shouldModify) {
          const originalContent = modifiedFiles[filePath].content;
          let newContent;

          if (find instanceof RegExp) {
            newContent = originalContent.replace(find, replace);
          } else {
            newContent = originalContent.replaceAll(find, replace);
          }

          if (newContent !== originalContent) {
            modifiedFiles[filePath] = {
              ...modifiedFiles[filePath],
              content: newContent,
              modified: true,
            };
          }
        }
      });
    });

    return modifiedFiles;
  }

  /**
   * Commit modified files back to repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} files - Modified files object
   * @param {string} commitMessage - Commit message
   * @param {string} branch - Target branch (default: 'main')
   */
  async commitChanges(owner, repo, files, commitMessage, branch = "main") {
    try {
      // Filter only modified files
      const modifiedFiles = Object.fromEntries(
        Object.entries(files).filter(([, fileData]) => fileData.modified)
      );

      if (Object.keys(modifiedFiles).length === 0) {
        return {
          success: true,
          message: "No changes to commit",
        };
      }

      // Get the current branch reference
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });

      // Get the commit object
      const { data: commit } = await this.octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: ref.object.sha,
      });

      // Create tree entries for modified files
      const tree = await this._createTreeEntries(
        owner,
        repo,
        Object.fromEntries(
          Object.entries(modifiedFiles).map(([path, fileData]) => [
            path,
            fileData.content,
          ])
        )
      );

      // Create new tree
      const { data: newTree } = await this.octokit.rest.git.createTree({
        owner,
        repo,
        tree,
        base_tree: commit.tree.sha,
      });

      // Create new commit
      const { data: newCommit } = await this.octokit.rest.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: newTree.sha,
        parents: [commit.sha],
      });

      // Update reference
      await this.octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
      });

      return {
        success: true,
        commitSha: newCommit.sha,
        commitUrl: newCommit.html_url,
        filesChanged: Object.keys(modifiedFiles),
      };
    } catch (error) {
      console.error("Error committing changes:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Helper method to create tree entries from files
   * @private
   */
  async _createTreeEntries(owner, repo, files) {
    const tree = [];

    for (const [path, content] of Object.entries(files)) {
      // Create blob for file content
      const { data: blob } = await this.octokit.rest.git.createBlob({
        owner: owner,
        repo: repo,
        content: Buffer.from(content, 'utf-8').toString('base64'),
        encoding: 'base64',
      });

      tree.push({
        path,
        mode: '100644', // Regular file
        type: 'blob',
        sha: blob.sha,
      });
    }

    return tree;
  }

  /**
   * Convenience method: Load, modify, and commit in one operation
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string[]} filePaths - Files to load and modify
   * @param {Array} operations - Find-replace operations
   * @param {string} commitMessage - Commit message
   * @param {string} branch - Branch to work on
   */
  async processAndCommit(owner, repo, filePaths, operations, commitMessage, branch = "main") {
    // Load files
    const loadResult = await this.loadFiles(owner, repo, filePaths, branch);
    if (!loadResult.success) return loadResult;

    // Apply modifications
    const modifiedFiles = this.applyFindReplace(loadResult.files, operations);

    // Commit changes
    return await this.commitChanges(owner, repo, modifiedFiles, commitMessage, branch);
  }
}

// Usage examples:

// Initialize
// const github = new GitHubBulkOps('your-token');

// Example 1: Bootstrap new repo
// const bootstrapFiles = {
//   'README.md': '# My New Project\n\nThis is a new project.',
//   'package.json': JSON.stringify({
//     name: 'my-project',
//     version: '1.0.0',
//     dependencies: {}
//   }, null, 2),
//   'src/index.js': 'console.log("Hello World!");',
//   '.gitignore': 'node_modules/\n.env\n'
// };

// await github.bootstrapRepo('owner', 'repo', bootstrapFiles, 'Initial setup');

// Example 2: Load, modify, and commit
// const operations = [
//   {
//     find: /PROJECT_NAME/g,
//     replace: 'MyAwesomeProject',
//     filePatterns: ['**/*.md', '**/*.json']
//   },
//   {
//     find: 'localhost:3000',
//     replace: 'myapp.com',
//     filePatterns: ['**/*.js', '**/*.ts']
//   }
// ];

// await github.processAndCommit(
//   'owner',
//   'repo',
//   ['README.md', 'package.json', 'src/config.js'],
//   operations,
//   'Update project configuration'
// );