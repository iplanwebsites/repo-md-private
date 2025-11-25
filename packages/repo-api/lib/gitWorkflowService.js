/**
 * Git Workflow Service - High-level git operations combining multiple actions
 * Provides clean, simple workflows for common git tasks
 */

import GitFileService from "./gitFileService.js";

class GitWorkflowService {
  constructor(provider, token) {
    this.gitService = new GitFileService(provider, token);
    this.provider = provider;
  }

  /**
   * Create a new branch and immediately create a PR
   * @param {Object} params - Workflow parameters
   * @returns {Promise<Object>} Result with branch and PR information
   */
  async createBranchWithPR(params) {
    const {
      owner,
      repo,
      branchName,
      fromBranch = null,
      prTitle,
      prBody = '',
      baseBranch = null,
      draft = false
    } = params;

    try {
      // Create the branch
      const branch = await this.gitService.createBranch(owner, repo, branchName, fromBranch);
      if (!branch) {
        throw new Error('Failed to create branch');
      }

      // Create PR from new branch to base branch (or default branch)
      const pr = await this.gitService.createPullRequest(
        owner,
        repo,
        prTitle,
        prBody,
        branchName,
        baseBranch || fromBranch || 'main',
        draft
      );

      if (!pr) {
        throw new Error('Failed to create pull request');
      }

      return {
        success: true,
        branch: {
          name: branchName,
          sha: branch.sha,
          ref: branch.ref
        },
        pullRequest: pr
      };
    } catch (error) {
      console.error('Error in createBranchWithPR workflow:', error);
      throw error;
    }
  }

  /**
   * Update file on a branch and update/create associated PR
   * @param {Object} params - Workflow parameters
   * @returns {Promise<Object>} Result with commit and PR information
   */
  async updateFileWithPR(params) {
    const {
      owner,
      repo,
      branch,
      filePath,
      content,
      commitMessage,
      currentSha = null,
      prTitle = null,
      prBody = null,
      baseBranch = 'main',
      updateExistingPR = true
    } = params;

    try {
      // Update the file
      const commit = await this.gitService.updateFile(
        owner,
        repo,
        filePath,
        content,
        commitMessage,
        branch,
        currentSha
      );

      if (!commit) {
        throw new Error('Failed to update file');
      }

      // Check for existing PR
      const existingPRs = await this.gitService.listPullRequests(owner, repo, {
        head: `${owner}:${branch}`,
        base: baseBranch,
        state: 'open'
      });

      let pr;
      if (existingPRs.length > 0 && updateExistingPR) {
        // Update existing PR if title or body provided
        if (prTitle || prBody) {
          const updates = {};
          if (prTitle) updates.title = prTitle;
          if (prBody) updates.body = prBody;
          
          pr = await this.gitService.updatePullRequest(
            owner,
            repo,
            existingPRs[0].number,
            updates
          );
        } else {
          pr = existingPRs[0];
        }
      } else if (existingPRs.length === 0) {
        // Create new PR
        pr = await this.gitService.createPullRequest(
          owner,
          repo,
          prTitle || commitMessage,
          prBody || `Updates from branch ${branch}`,
          branch,
          baseBranch,
          false
        );
      }

      return {
        success: true,
        commit: commit,
        pullRequest: pr,
        action: existingPRs.length > 0 ? 'updated' : 'created'
      };
    } catch (error) {
      console.error('Error in updateFileWithPR workflow:', error);
      throw error;
    }
  }

  /**
   * Create a feature branch, make changes, and create PR
   * @param {Object} params - Workflow parameters
   * @returns {Promise<Object>} Result with branch, commits, and PR
   */
  async featureBranchWorkflow(params) {
    const {
      owner,
      repo,
      featureName,
      fromBranch = 'main',
      files = [], // Array of {path, content, action: 'create'|'update', sha?}
      commitMessage,
      prTitle,
      prBody = '',
      draft = false
    } = params;

    try {
      // Generate branch name if not provided
      const branchName = `feature/${featureName.toLowerCase().replace(/\s+/g, '-')}`;

      // Create feature branch
      const branch = await this.gitService.createBranch(owner, repo, branchName, fromBranch);
      if (!branch) {
        throw new Error('Failed to create feature branch');
      }

      // Process file changes
      const commits = [];
      for (const file of files) {
        const commit = await this.gitService.updateFile(
          owner,
          repo,
          file.path,
          file.content,
          file.message || commitMessage || `Update ${file.path}`,
          branchName,
          file.sha || null
        );
        
        if (commit) {
          commits.push({
            path: file.path,
            sha: commit.content.sha,
            commit: commit.commit
          });
        }
      }

      // Create PR
      const pr = await this.gitService.createPullRequest(
        owner,
        repo,
        prTitle || `Feature: ${featureName}`,
        prBody || `This PR implements ${featureName}`,
        branchName,
        fromBranch,
        draft
      );

      return {
        success: true,
        branch: {
          name: branchName,
          sha: branch.sha,
          ref: branch.ref
        },
        commits: commits,
        pullRequest: pr
      };
    } catch (error) {
      console.error('Error in featureBranchWorkflow:', error);
      throw error;
    }
  }

  /**
   * Batch update multiple files on a branch
   * @param {Object} params - Workflow parameters
   * @returns {Promise<Object>} Result with all commits
   */
  async batchUpdateFiles(params) {
    const {
      owner,
      repo,
      branch,
      files = [], // Array of {path, content, message?, sha?}
      defaultMessage = 'Update files'
    } = params;

    try {
      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          const commit = await this.gitService.updateFile(
            owner,
            repo,
            file.path,
            file.content,
            file.message || `${defaultMessage}: ${file.path}`,
            branch,
            file.sha || null
          );

          if (commit) {
            results.push({
              path: file.path,
              success: true,
              sha: commit.content.sha,
              commit: commit.commit
            });
          }
        } catch (error) {
          errors.push({
            path: file.path,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: errors.length === 0,
        results: results,
        errors: errors,
        summary: {
          total: files.length,
          succeeded: results.length,
          failed: errors.length
        }
      };
    } catch (error) {
      console.error('Error in batchUpdateFiles workflow:', error);
      throw error;
    }
  }

  /**
   * Generate a descriptive commit message based on changes
   * @param {string} action - Type of change (create, update, delete, refactor, etc.)
   * @param {string} target - What was changed
   * @param {string} reason - Why it was changed (optional)
   * @returns {string} Formatted commit message
   */
  static generateCommitMessage(action, target, reason = null) {
    const messages = {
      create: `Add ${target}`,
      update: `Update ${target}`,
      delete: `Remove ${target}`,
      refactor: `Refactor ${target}`,
      fix: `Fix ${target}`,
      feat: `Feature: ${target}`,
      docs: `Document ${target}`,
      style: `Style: ${target}`,
      test: `Test: ${target}`,
      chore: `Chore: ${target}`
    };

    let message = messages[action] || `${action} ${target}`;
    if (reason) {
      message += ` - ${reason}`;
    }

    return message;
  }
}

export default GitWorkflowService;