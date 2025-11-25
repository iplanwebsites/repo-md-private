/**
 * Standalone Git Service - Decoupled from project context
 * Can be used in workers, scripts, or other contexts
 */

import GitFileService from "./gitFileService.js";
import GitWorkflowService from "./gitWorkflowService.js";

class StandaloneGitService {
  constructor(config) {
    const { provider = 'github', token, owner, repo } = config;
    
    if (!token) {
      throw new Error('Git token is required');
    }
    if (!owner || !repo) {
      throw new Error('Repository owner and name are required');
    }

    this.provider = provider;
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    
    this.fileService = new GitFileService(provider, token);
    this.workflowService = new GitWorkflowService(provider, token);
  }

  // File operations
  async listDirectory(path = '', ref = 'main') {
    return this.fileService.listDirectory(this.owner, this.repo, path, ref);
  }

  async getFileContent(path, ref = 'main') {
    return this.fileService.getFileContent(this.owner, this.repo, path, ref);
  }

  async updateFile(path, content, message, branch = 'main', sha = null) {
    return this.fileService.updateFile(this.owner, this.repo, path, content, message, branch, sha);
  }

  async deleteFile(path, message, sha, branch = 'main') {
    return this.fileService.deleteFile(this.owner, this.repo, path, message, sha, branch);
  }

  async uploadImage(path, imageBuffer, message, branch = 'main') {
    return this.fileService.uploadImage(this.owner, this.repo, path, imageBuffer, message, branch);
  }

  async getFileHistory(path, ref = 'main', limit = 10) {
    return this.fileService.getFileHistory(this.owner, this.repo, path, ref, limit);
  }

  // Branch operations
  async listBranches(options = {}) {
    return this.fileService.listBranches(this.owner, this.repo, options);
  }

  async createBranch(branch, fromBranch = null) {
    return this.fileService.createBranch(this.owner, this.repo, branch, fromBranch);
  }

  async deleteBranch(branch) {
    return this.fileService.deleteBranch(this.owner, this.repo, branch);
  }

  // PR operations
  async listPullRequests(options = {}) {
    return this.fileService.listPullRequests(this.owner, this.repo, options);
  }

  async createPullRequest(title, body, head, base, draft = false) {
    return this.fileService.createPullRequest(this.owner, this.repo, title, body, head, base, draft);
  }

  async updatePullRequest(pullNumber, updates) {
    return this.fileService.updatePullRequest(this.owner, this.repo, pullNumber, updates);
  }

  async mergePullRequest(pullNumber, commitTitle = '', commitMessage = '', mergeMethod = 'merge') {
    return this.fileService.mergePullRequest(this.owner, this.repo, pullNumber, commitTitle, commitMessage, mergeMethod);
  }

  // Repository info
  async getRepository() {
    return this.fileService.getRepository(this.owner, this.repo);
  }

  // Workflows
  async createBranchWithPR(params) {
    return this.workflowService.createBranchWithPR({
      owner: this.owner,
      repo: this.repo,
      ...params
    });
  }

  async updateFileWithPR(params) {
    return this.workflowService.updateFileWithPR({
      owner: this.owner,
      repo: this.repo,
      ...params
    });
  }

  async featureBranchWorkflow(params) {
    return this.workflowService.featureBranchWorkflow({
      owner: this.owner,
      repo: this.repo,
      ...params
    });
  }

  async batchUpdateFiles(params) {
    return this.workflowService.batchUpdateFiles({
      owner: this.owner,
      repo: this.repo,
      ...params
    });
  }

  // Utility methods
  async downloadFromUrl(url) {
    return GitFileService.downloadFromUrl(url);
  }

  generateCommitMessage(action, target, reason = null) {
    return GitWorkflowService.generateCommitMessage(action, target, reason);
  }

  // Factory method for creating from various sources
  static fromRepository(repoInfo, token) {
    // Support different repo info formats
    if (typeof repoInfo === 'string') {
      // Parse "owner/repo" format
      const [owner, repo] = repoInfo.split('/');
      return new StandaloneGitService({ provider: 'github', token, owner, repo });
    }
    
    // Support object format
    const { provider = 'github', owner, repo, fullName } = repoInfo;
    if (fullName && !owner) {
      const [parsedOwner, parsedRepo] = fullName.split('/');
      return new StandaloneGitService({ provider, token, owner: parsedOwner, repo: parsedRepo });
    }
    
    return new StandaloneGitService({ provider, token, owner, repo });
  }
}

export default StandaloneGitService;