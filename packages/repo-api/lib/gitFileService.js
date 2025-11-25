/**
 * Git File Service - Provider-agnostic interface for git file operations
 * Supports GitHub now, can be extended for GitLab, Bitbucket, etc.
 */

import GitHubService from "./githubService.js";

class GitFileService {
  constructor(provider, token) {
    this.provider = provider;
    this.token = token;
    
    // Initialize the appropriate service based on provider
    switch (provider) {
      case 'github':
        this.service = new GitHubService(token);
        break;
      case 'gitlab':
        // this.service = new GitLabService(token);
        throw new Error('GitLab provider not yet implemented');
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Get file content from repository
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} ref - Branch/tag/commit reference
   * @returns {Promise<Object>} File content and metadata
   */
  async getFileContent(owner, repo, path, ref = 'main') {
    return this.service.getFileContent(owner, repo, path, ref);
  }

  /**
   * Update or create a file in repository
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} content - File content
   * @param {string} message - Commit message
   * @param {string} branch - Target branch
   * @param {string} sha - Current file SHA (for updates)
   * @returns {Promise<Object>} Commit information
   */
  async updateFile(owner, repo, path, content, message, branch = 'main', sha = null) {
    return this.service.updateFile(owner, repo, path, content, message, branch, sha);
  }

  /**
   * Upload an image to repository
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} path - Image path in repository
   * @param {Buffer} imageBuffer - Image data as buffer
   * @param {string} message - Commit message
   * @param {string} branch - Target branch
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage(owner, repo, path, imageBuffer, message, branch = 'main') {
    return this.service.uploadImage(owner, repo, path, imageBuffer, message, branch);
  }

  /**
   * Create a commit with multiple files
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {Array} files - Array of file objects with path, content, and encoding
   * @param {string} message - Commit message
   * @param {string} branch - Target branch
   * @returns {Promise<Object>} Commit information
   */
  async createCommitWithFiles(owner, repo, files, message, branch = 'main') {
    if (this.service.createCommitWithFiles) {
      return this.service.createCommitWithFiles(owner, repo, files, message, branch);
    }
    // Fallback to sequential updates if not implemented
    throw new Error('createCommitWithFiles not implemented for this provider');
  }

  /**
   * List files and directories in a repository path
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} path - Directory path (empty string for root)
   * @param {string} ref - Branch/tag/commit reference
   * @returns {Promise<Object>} Directory contents
   */
  async listDirectory(owner, repo, path = '', ref = 'main') {
    return this.service.listDirectory(owner, repo, path, ref);
  }

  /**
   * Create a new branch
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} branch - New branch name
   * @param {string} fromBranch - Source branch
   * @returns {Promise<Object>} Branch information
   */
  async createBranch(owner, repo, branch, fromBranch = null) {
    return this.service.createBranch(owner, repo, branch, fromBranch);
  }

  /**
   * Create a pull request
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} title - PR title
   * @param {string} body - PR description
   * @param {string} head - Branch containing changes
   * @param {string} base - Branch to merge into
   * @param {boolean} draft - Create as draft PR
   * @returns {Promise<Object>} Pull request information
   */
  async createPullRequest(owner, repo, title, body, head, base, draft = false) {
    return this.service.createPullRequest(owner, repo, title, body, head, base, draft);
  }

  /**
   * Update a pull request
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated pull request information
   */
  async updatePullRequest(owner, repo, pullNumber, updates) {
    return this.service.updatePullRequest(owner, repo, pullNumber, updates);
  }

  /**
   * List branches in repository
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} List of branches
   */
  async listBranches(owner, repo, options = {}) {
    return this.service.listBranches(owner, repo, options);
  }

  /**
   * List pull requests for repository
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} List of pull requests
   */
  async listPullRequests(owner, repo, options = {}) {
    return this.service.listPullRequests(owner, repo, options);
  }

  /**
   * Delete a file from repository
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} message - Commit message
   * @param {string} branch - Target branch
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFile(owner, repo, path, message, branch = 'main') {
    // First get the file to obtain its SHA
    const file = await this.getFileContent(owner, repo, path, branch);
    return this.service.deleteFile(owner, repo, path, message, file.sha, branch);
  }

  /**
   * Create or update a file (convenience method)
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} content - File content
   * @param {string} message - Commit message
   * @param {string} branch - Target branch
   * @param {string} sha - Current file SHA (optional)
   * @returns {Promise<Object>} Commit information
   */
  async createOrUpdateFile(owner, repo, path, content, message, branch = 'main', sha = null) {
    return this.updateFile(owner, repo, path, content, message, branch, sha);
  }

  /**
   * Compare two branches
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} base - Base branch
   * @param {string} head - Head branch
   * @returns {Promise<Object>} Comparison result
   */
  async compareBranches(owner, repo, base, head) {
    if (this.service.compareBranches) {
      return this.service.compareBranches(owner, repo, base, head);
    }
    // Fallback implementation
    throw new Error('compareBranches not implemented for this provider');
  }

  /**
   * Get repository tree
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} ref - Branch/tag/commit reference
   * @param {boolean} recursive - Get tree recursively
   * @returns {Promise<Array>} Repository tree
   */
  async getRepositoryTree(owner, repo, ref = 'main', recursive = true) {
    if (this.service.getRepositoryTree) {
      return this.service.getRepositoryTree(owner, repo, ref, recursive);
    }
    // Fallback to listing directory recursively
    const tree = [];
    const processDir = async (path = '') => {
      const items = await this.listDirectory(owner, repo, path, ref);
      for (const item of items) {
        tree.push(item);
        if (recursive && item.type === 'dir') {
          await processDir(item.path);
        }
      }
    };
    await processDir();
    return tree;
  }

  /**
   * Search repository for content
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchRepository(owner, repo, query, options = {}) {
    if (this.service.searchRepository) {
      return this.service.searchRepository(owner, repo, query, options);
    }
    // Fallback implementation - basic file name search
    const tree = await this.getRepositoryTree(owner, repo, options.ref || 'main');
    const results = [];
    const extensions = options.extensions || [];
    
    for (const item of tree) {
      if (item.type === 'file') {
        const matches = item.path.toLowerCase().includes(query.toLowerCase());
        const hasValidExt = extensions.length === 0 || 
          extensions.some(ext => item.path.endsWith(`.${ext}`));
        
        if (matches && hasValidExt) {
          results.push({
            path: item.path,
            name: item.path.split('/').pop(),
            size: item.size
          });
        }
      }
    }
    
    return results.slice(0, options.limit || 20);
  }

  /**
   * Get file history
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} ref - Branch/tag/commit reference
   * @param {number} limit - Number of commits to retrieve
   * @returns {Promise<Array>} List of commits
   */
  async getFileHistory(owner, repo, path, ref = 'main', limit = 10) {
    return this.service.getFileHistory(owner, repo, path, ref, limit);
  }

  /**
   * Delete a branch
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @returns {Promise<boolean>} Success status
   */
  async deleteBranch(owner, repo, branch) {
    return this.service.deleteBranch(owner, repo, branch);
  }

  /**
   * Merge a pull request
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @param {string} commitTitle - Merge commit title
   * @param {string} commitMessage - Merge commit message
   * @param {string} mergeMethod - Merge method
   * @returns {Promise<Object>} Merge result
   */
  async mergePullRequest(owner, repo, pullNumber, commitTitle = '', commitMessage = '', mergeMethod = 'merge') {
    return this.service.mergePullRequest(owner, repo, pullNumber, commitTitle, commitMessage, mergeMethod);
  }

  /**
   * Get repository information
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Repository info
   */
  async getRepository(owner, repo) {
    return this.service.getRepository(owner, repo);
  }

  /**
   * Get a specific pull request
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<Object>} Pull request details
   */
  async getPullRequest(owner, repo, pullNumber) {
    return this.service.getPullRequest(owner, repo, pullNumber);
  }

  /**
   * Get commits for a pull request
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<Array>} List of commits
   */
  async getPullRequestCommits(owner, repo, pullNumber) {
    return this.service.getPullRequestCommits(owner, repo, pullNumber);
  }

  /**
   * Check if a pull request is mergeable
   * @param {string} owner - Repository owner/namespace
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<Object>} Mergeable status
   */
  async checkPullRequestMergeability(owner, repo, pullNumber) {
    return this.service.checkPullRequestMergeability(owner, repo, pullNumber);
  }

  /**
   * Download file from URL
   * @param {string} url - File URL
   * @returns {Promise<Buffer>} File buffer
   */
  static async downloadFromUrl(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export default GitFileService;