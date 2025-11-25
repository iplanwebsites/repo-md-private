/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

// github-service.js
import { Octokit } from "octokit";
import { db } from "../db.js";

/**
 * GitHub Service to list repositories and organizations for a user
 */
class GitHubService {
  /**
   * Initialize the GitHub service with an authentication token
   * @param {string} token - GitHub personal access token
   */
  constructor(token) {
    this.octokit = new Octokit({
      auth: token,
    });
  }
  
  /**
   * Register a GitHub user in the database
   * @param {string} token - GitHub access token
   * @param {Object} userData - User data from Supabase auth
   * @returns {Promise<Object>} - Registered user data
   */
  async registerGithubUser(token, userData) {
    try {
      console.log("🔍 Getting GitHub profile from token...");
      
      // Extract GitHub info from Supabase user identities if available
      let githubIdentity = null;
      if (userData.identities) {
        githubIdentity = userData.identities.find(id => id.provider === "github");
        console.log("🔗 GitHub identity from Supabase:", githubIdentity ? "Found" : "Not found");
      }
      
      // Get GitHub profile using the token
      const github = new GitHubService(token);
      const { data: profile } = await github.octokit.request("GET /user");
      
      console.log(`✅ GitHub profile retrieved: ${profile.login} (${profile.name || 'No name'})`);
      
      if (!profile || !profile.login) {
        console.error("❌ Failed to retrieve complete GitHub profile");
        throw new Error("Failed to retrieve GitHub profile");
      }
      
      // Check if user already exists
      console.log("🔍 Checking if user exists in database...");
      const existingUser = await db.users.findOne({ 
        $or: [
          { "github.id": profile.id },
          { id: userData.id }
        ]
      });
      
      if (existingUser) {
        console.log(`🔄 Updating existing user: ${existingUser.email}`);
        
        // Update the existing user with GitHub info if needed
        await db.users.updateOne(
          { _id: existingUser._id },
          { 
            $set: {
              github: {
                id: profile.id,
                login: profile.login,
                avatar_url: profile.avatar_url,
                html_url: profile.html_url,
                name: profile.name,
                email: profile.email,
              },
              githubHandle: profile.login,
              last_login: new Date()
            }
          }
        );
        
        console.log("✅ User updated successfully");
        
        return { 
          ...existingUser, 
          githubHandle: profile.login,
          github: {
            id: profile.id,
            login: profile.login,
            avatar_url: profile.avatar_url,
            html_url: profile.html_url,
            name: profile.name,
            email: profile.email,
          } 
        };
      }
      
      // Create new user
      console.log(`🆕 Creating new user with GitHub profile: ${profile.login}`);
      
      const newUser = {
        id: userData.id,
        email: userData.email,
        name: profile.name || profile.login,
        githubHandle: profile.login,
        created_at: new Date(),
        updated_at: new Date(),
        last_login: new Date(),
        github: {
          id: profile.id,
          login: profile.login,
          avatar_url: profile.avatar_url,
          html_url: profile.html_url,
          name: profile.name,
          email: profile.email,
        }
      };
      
      // Add additional info from Supabase identities if available
      if (githubIdentity?.identity_data) {
        newUser.github.identity_data = githubIdentity.identity_data;
        console.log("📋 Added identity data from Supabase");
      }
      
      // Insert user in the database
      const userInsertResult = await db.users.insertOne(newUser);
      console.log(`✅ User created successfully: ${userInsertResult.insertedId}`);
      
      // Create personal organization for the user
      console.log(`🏢 Creating personal organization for user: ${profile.login}`);
      
      const personalOrg = {
        name: `${profile.login}'s Space`,
        handle: profile.login,
        created_at: new Date(),
        updated_at: new Date(),
        owner: userData.id,
        is_personal: true,
      };
      
      // Insert organization in the database
      const orgInsertResult = await db.orgs.insertOne(personalOrg);
      console.log(`✅ Personal organization created: ${orgInsertResult.insertedId}`);
      
      return newUser;
    } catch (error) {
      console.error("❌ Error registering GitHub user:", error);
      throw error;
    }
  }

  /**
   * Get repositories for a specified user
   * @param {string} username - GitHub username
   * @param {Object} options - Optional parameters (per_page, page, sort, direction, type)
   * @returns {Promise<Array>} - List of repositories
   */
  async getUserRepositories(username, options = {}) {
    try {
      const repos = await this.octokit.paginate("GET /users/{username}/repos", {
        username,
        per_page: options.per_page || 100,
        sort: options.sort || "updated",
        direction: options.direction || "desc",
        type: options.type || "all",
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        visibility: repo.visibility,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        owner: {
          login: repo.owner.login,
          id: repo.owner.id,
          avatar_url: repo.owner.avatar_url,
        },
      }));
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Get organizations for a specified user
   * @param {string} username - GitHub username
   * @param {Object} options - Optional parameters (per_page, page)
   * @returns {Promise<Array>} - List of organizations
   */
  async getUserOrganizations(username, options = {}) {
    try {
      const orgs = await this.octokit.paginate("GET /users/{username}/orgs", {
        username,
        per_page: options.per_page || 300,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return orgs.map((org) => ({
        id: org.id,
        login: org.login,
        url: org.url,
        repos_url: org.repos_url,
        description: org.description,
        avatar_url: org.avatar_url,
      }));
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Get authenticated user's repositories
   * @param {Object} options - Optional parameters (per_page, page, visibility, affiliation, sort, direction)
   * @returns {Promise<Array>} - List of repositories
   */
  async getMyRepositories(options = {}) {
    try {
      // Note: We've removed the 'type' parameter to avoid conflicts with visibility/affiliation
      const repos = await this.octokit.paginate("GET /user/repos", {
        per_page: options.per_page || 100,
        visibility: options.visibility || "all", // all, public, private (optional)
        affiliation:
          options.affiliation || "owner,collaborator,organization_member",
        sort: options.sort || "updated", // created, updated, pushed, full_name
        direction: options.direction || "desc", // asc or desc
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return repos.map((repo) => ({
        id: repo.id,
        ...repo,
        /*
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        visibility: repo.visibility,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        owner: {
          login: repo.owner.login,
          id: repo.owner.id,
          avatar_url: repo.owner.avatar_url,
        },*/
      }));
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Get authenticated user's organizations
   * @param {Object} options - Optional parameters (per_page, page)
   * @returns {Promise<Array>} - List of organizations
   */
  async getMyOrganizations(options = {}) {
    try {
      const orgs = await this.octokit.paginate("GET /user/orgs", {
        per_page: options.per_page || 100,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return orgs.map((org) => ({
        id: org.id,
        login: org.login,
        url: org.url,
        repos_url: org.repos_url,
        description: org.description,
        avatar_url: org.avatar_url,
      }));
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Get file content from a GitHub repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} ref - Git reference (branch, tag, or commit SHA)
   * @returns {Promise<Object>} - File content and metadata
   */
  async getFileContent(owner, repo, path, ref = 'main') {
    try {
      const response = await this.octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo,
        path,
        ref,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      const file = response.data;
      
      // Decode base64 content if it's a file
      if (file.type === 'file' && file.content) {
        const content = Buffer.from(file.content, 'base64').toString('utf-8');
        
        return {
          type: file.type,
          name: file.name,
          path: file.path,
          sha: file.sha,
          size: file.size,
          content,
          download_url: file.download_url,
          html_url: file.html_url,
          encoding: file.encoding,
        };
      }
      
      // Return directory listing if it's a directory
      if (Array.isArray(file)) {
        return {
          type: 'dir',
          path,
          contents: file.map(item => ({
            type: item.type,
            name: item.name,
            path: item.path,
            sha: item.sha,
            size: item.size,
            html_url: item.html_url,
          })),
        };
      }
      
      return file;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * List files and directories in a GitHub repository path
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - Directory path (empty string for root)
   * @param {string} ref - Git reference (branch, tag, or commit SHA)
   * @returns {Promise<Object>} - Directory contents
   */
  async listDirectory(owner, repo, path = '', ref = 'main') {
    try {
      const response = await this.octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo,
        path,
        ref,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      const items = Array.isArray(response.data) ? response.data : [response.data];
      
      return {
        type: 'dir',
        path: path || '/',
        ref,
        items: items.map(item => ({
          type: item.type,
          name: item.name,
          path: item.path,
          sha: item.sha,
          size: item.size || 0,
          download_url: item.download_url || null,
          html_url: item.html_url,
          // For directories, include whether they have contents
          ...(item.type === 'dir' && { has_contents: true })
        })).sort((a, b) => {
          // Sort directories first, then files
          if (a.type === 'dir' && b.type !== 'dir') return -1;
          if (a.type !== 'dir' && b.type === 'dir') return 1;
          // Then sort alphabetically
          return a.name.localeCompare(b.name);
        })
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Update or create a file in a GitHub repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} content - File content
   * @param {string} message - Commit message
   * @param {string} branch - Branch to commit to
   * @param {string} sha - SHA of the file being replaced (required for updates)
   * @returns {Promise<Object>} - Commit information
   */
  async updateFile(owner, repo, path, content, message, branch = 'main', sha = null) {
    try {
      const encodedContent = Buffer.from(content).toString('base64');
      
      const params = {
        owner,
        repo,
        path,
        message,
        content: encodedContent,
        branch,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      };
      
      // Add SHA if updating existing file
      if (sha) {
        params.sha = sha;
      }
      
      const response = await this.octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", params);
      
      return {
        content: response.data.content,
        commit: response.data.commit,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Upload an image to a GitHub repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} imagePath - Path where the image should be stored
   * @param {Buffer} imageBuffer - Image data as buffer
   * @param {string} message - Commit message
   * @param {string} branch - Branch to commit to
   * @returns {Promise<Object>} - Upload result with download URL
   */
  async uploadImage(owner, repo, imagePath, imageBuffer, message, branch = 'main') {
    try {
      const encodedContent = imageBuffer.toString('base64');
      
      const response = await this.octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo,
        path: imagePath,
        message,
        content: encodedContent,
        branch,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });
      
      return {
        path: response.data.content.path,
        sha: response.data.content.sha,
        size: response.data.content.size,
        download_url: response.data.content.download_url,
        html_url: response.data.content.html_url,
        commit: response.data.commit,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Create a new branch
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - New branch name
   * @param {string} fromBranch - Source branch (defaults to default branch)
   * @returns {Promise<Object>} - Branch information
   */
  async createBranch(owner, repo, branch, fromBranch = null) {
    try {
      // Get the SHA of the source branch
      let sha;
      if (fromBranch) {
        const ref = await this.octokit.request("GET /repos/{owner}/{repo}/git/ref/heads/{branch}", {
          owner,
          repo,
          branch: fromBranch,
        });
        sha = ref.data.object.sha;
      } else {
        // Use default branch
        const repoData = await this.octokit.request("GET /repos/{owner}/{repo}", {
          owner,
          repo,
        });
        const defaultBranch = repoData.data.default_branch;
        const ref = await this.octokit.request("GET /repos/{owner}/{repo}/git/ref/heads/{branch}", {
          owner,
          repo,
          branch: defaultBranch,
        });
        sha = ref.data.object.sha;
      }

      // Create the new branch
      const response = await this.octokit.request("POST /repos/{owner}/{repo}/git/refs", {
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return {
        ref: response.data.ref,
        sha: response.data.object.sha,
        branch: branch,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Create a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} title - PR title
   * @param {string} body - PR description
   * @param {string} head - Branch containing changes
   * @param {string} base - Branch to merge into
   * @param {boolean} draft - Create as draft PR
   * @returns {Promise<Object>} - Pull request information
   */
  async createPullRequest(owner, repo, title, body, head, base, draft = false) {
    try {
      const response = await this.octokit.request("POST /repos/{owner}/{repo}/pulls", {
        owner,
        repo,
        title,
        body,
        head,
        base,
        draft,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return {
        number: response.data.number,
        html_url: response.data.html_url,
        state: response.data.state,
        title: response.data.title,
        body: response.data.body,
        head: {
          ref: response.data.head.ref,
          sha: response.data.head.sha,
        },
        base: {
          ref: response.data.base.ref,
          sha: response.data.base.sha,
        },
        mergeable: response.data.mergeable,
        created_at: response.data.created_at,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Update a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @param {Object} updates - Updates to apply (title, body, state, base)
   * @returns {Promise<Object>} - Updated pull request information
   */
  async updatePullRequest(owner, repo, pullNumber, updates) {
    try {
      const response = await this.octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: pullNumber,
        ...updates,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return {
        number: response.data.number,
        html_url: response.data.html_url,
        state: response.data.state,
        title: response.data.title,
        body: response.data.body,
        updated_at: response.data.updated_at,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * List branches in repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Options (protected, per_page)
   * @returns {Promise<Array>} - List of branches
   */
  async listBranches(owner, repo, options = {}) {
    try {
      const branches = await this.octokit.paginate("GET /repos/{owner}/{repo}/branches", {
        owner,
        repo,
        per_page: options.per_page || 100,
        protected: options.protected,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return branches.map(branch => ({
        name: branch.name,
        protected: branch.protected,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url,
        },
      }));
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Get pull requests for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Filter options (state, head, base, sort, direction)
   * @returns {Promise<Array>} - List of pull requests
   */
  async listPullRequests(owner, repo, options = {}) {
    try {
      const pulls = await this.octokit.paginate("GET /repos/{owner}/{repo}/pulls", {
        owner,
        repo,
        state: options.state || 'open',
        head: options.head,
        base: options.base,
        sort: options.sort || 'created',
        direction: options.direction || 'desc',
        per_page: options.per_page || 100,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return pulls.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        html_url: pr.html_url,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha,
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha,
        },
        user: {
          login: pr.user.login,
          avatar_url: pr.user.avatar_url,
        },
      }));
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Delete a file from repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} message - Commit message
   * @param {string} sha - Current file SHA (required)
   * @param {string} branch - Branch to commit to
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteFile(owner, repo, path, message, sha, branch = 'main') {
    try {
      const response = await this.octokit.request("DELETE /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo,
        path,
        message,
        sha,
        branch,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return {
        commit: response.data.commit,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Get file history (commits)
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} sha - Starting SHA or branch
   * @param {number} perPage - Results per page
   * @returns {Promise<Array>} - List of commits
   */
  async getFileHistory(owner, repo, path, sha = 'main', perPage = 10) {
    try {
      const commits = await this.octokit.paginate("GET /repos/{owner}/{repo}/commits", {
        owner,
        repo,
        path,
        sha,
        per_page: perPage,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
          date: commit.commit.author.date,
        },
        committer: {
          name: commit.commit.committer.name,
          email: commit.commit.committer.email,
          date: commit.commit.committer.date,
        },
        html_url: commit.html_url,
      }));
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Delete a branch
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @returns {Promise<boolean>} - Success status
   */
  async deleteBranch(owner, repo, branch) {
    try {
      await this.octokit.request("DELETE /repos/{owner}/{repo}/git/refs/heads/{branch}", {
        owner,
        repo,
        branch,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });
      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  /**
   * Compare two branches
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} base - Base branch
   * @param {string} head - Head branch to compare
   * @returns {Promise<Object>} - Comparison result with files and commits
   */
  async compareBranches(owner, repo, base, head) {
    try {
      const response = await this.octokit.request("GET /repos/{owner}/{repo}/compare/{basehead}", {
        owner,
        repo,
        basehead: `${base}...${head}`,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return {
        status: response.data.status,
        ahead_by: response.data.ahead_by,
        behind_by: response.data.behind_by,
        commits: response.data.total_commits,
        files: response.data.files || [],
        url: response.data.html_url,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Get repository tree
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} tree_sha - Tree SHA or branch name
   * @param {boolean} recursive - Get tree recursively
   * @returns {Promise<Array>} - Repository tree
   */
  async getRepositoryTree(owner, repo, tree_sha, recursive = true) {
    try {
      const response = await this.octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
        owner,
        repo,
        tree_sha,
        recursive: recursive ? 1 : undefined,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return response.data.tree;
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Merge a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @param {string} commitTitle - Merge commit title
   * @param {string} commitMessage - Merge commit message
   * @param {string} mergeMethod - Merge method (merge, squash, rebase)
   * @returns {Promise<Object>} - Merge result
   */
  async mergePullRequest(owner, repo, pullNumber, commitTitle = '', commitMessage = '', mergeMethod = 'merge') {
    try {
      const response = await this.octokit.request("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
        owner,
        repo,
        pull_number: pullNumber,
        commit_title: commitTitle,
        commit_message: commitMessage,
        merge_method: mergeMethod,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return {
        merged: response.data.merged,
        message: response.data.message,
        sha: response.data.sha,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Get a specific pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<Object>} - Pull request details
   */
  async getPullRequest(owner, repo, pullNumber) {
    try {
      const response = await this.octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: pullNumber,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return {
        number: response.data.number,
        state: response.data.state,
        title: response.data.title,
        body: response.data.body,
        html_url: response.data.html_url,
        created_at: response.data.created_at,
        updated_at: response.data.updated_at,
        merged_at: response.data.merged_at,
        mergeable: response.data.mergeable,
        mergeable_state: response.data.mergeable_state,
        head: {
          ref: response.data.head.ref,
          sha: response.data.head.sha,
          repo: response.data.head.repo ? {
            full_name: response.data.head.repo.full_name
          } : null
        },
        base: {
          ref: response.data.base.ref,
          sha: response.data.base.sha,
        },
        user: {
          login: response.data.user.login,
          avatar_url: response.data.user.avatar_url,
        },
        commits: response.data.commits,
        additions: response.data.additions,
        deletions: response.data.deletions,
        changed_files: response.data.changed_files,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Get commits for a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<Array>} - List of commits
   */
  async getPullRequestCommits(owner, repo, pullNumber) {
    try {
      const commits = await this.octokit.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/commits", {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
          date: commit.commit.author.date,
        },
        committer: {
          name: commit.commit.committer.name,
          email: commit.commit.committer.email,
          date: commit.commit.committer.date,
        },
        html_url: commit.html_url,
      }));
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Check if a pull request is mergeable
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<Object>} - Mergeable status
   */
  async checkPullRequestMergeability(owner, repo, pullNumber) {
    try {
      const pr = await this.getPullRequest(owner, repo, pullNumber);
      if (!pr) return null;

      return {
        mergeable: pr.mergeable,
        mergeable_state: pr.mergeable_state,
        state: pr.state,
        merged: pr.merged_at !== null,
        commits: pr.commits,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Get repository information including default branch
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} - Repository info
   */
  async getRepository(owner, repo) {
    try {
      const response = await this.octokit.request("GET /repos/{owner}/{repo}", {
        owner,
        repo,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return {
        id: response.data.id,
        name: response.data.name,
        full_name: response.data.full_name,
        default_branch: response.data.default_branch,
        visibility: response.data.visibility,
        private: response.data.private,
        description: response.data.description,
        topics: response.data.topics,
        created_at: response.data.created_at,
        updated_at: response.data.updated_at,
        pushed_at: response.data.pushed_at,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Create a commit with multiple files using the GitHub Trees API
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Array} files - Array of file objects with path, content, and encoding
   * @param {string} message - Commit message
   * @param {string} branch - Target branch
   * @returns {Promise<Object>} - Commit information
   */
  async createCommitWithFiles(owner, repo, files, message, branch = 'main') {
    try {
      // Get the current branch reference
      const refResponse = await this.octokit.request("GET /repos/{owner}/{repo}/git/ref/heads/{branch}", {
        owner,
        repo,
        branch,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      const currentCommitSha = refResponse.data.object.sha;

      // Get the current commit
      const commitResponse = await this.octokit.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", {
        owner,
        repo,
        commit_sha: currentCommitSha,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      const currentTreeSha = commitResponse.data.tree.sha;

      // Create blobs for each file
      const blobs = await Promise.all(
        files.map(async (file) => {
          const blobResponse = await this.octokit.request("POST /repos/{owner}/{repo}/git/blobs", {
            owner,
            repo,
            content: file.content,
            encoding: file.encoding || "base64",
            headers: {
              "x-github-api-version": "2022-11-28",
            },
          });

          return {
            path: file.path,
            mode: "100644", // File mode
            type: "blob",
            sha: blobResponse.data.sha,
          };
        })
      );

      // Create a new tree
      const treeResponse = await this.octokit.request("POST /repos/{owner}/{repo}/git/trees", {
        owner,
        repo,
        base_tree: currentTreeSha,
        tree: blobs,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      const newTreeSha = treeResponse.data.sha;

      // Create the commit
      const newCommitResponse = await this.octokit.request("POST /repos/{owner}/{repo}/git/commits", {
        owner,
        repo,
        message,
        tree: newTreeSha,
        parents: [currentCommitSha],
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      const newCommitSha = newCommitResponse.data.sha;

      // Update the branch reference
      await this.octokit.request("PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}", {
        owner,
        repo,
        branch,
        sha: newCommitSha,
        force: false,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });

      return {
        sha: newCommitSha,
        html_url: `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
        files: files.map(f => f.path),
        message: message,
      };
    } catch (error) {
      this.handleError(error);
      return null;
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
      console.error("Error with GitHub service:", error);
    }
    throw error;
  }
}

export default GitHubService;
