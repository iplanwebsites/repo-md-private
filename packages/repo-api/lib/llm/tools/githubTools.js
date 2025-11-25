import { Octokit } from '@octokit/rest';
import { ObjectId } from 'mongodb';
import { db } from '../../../db.js';

/**
 * GitHub tools for pushing generated projects
 */

export const createGithubRepoTool = {
  type: 'function',
  function: {
    name: 'create_github_repo',
    description: 'Create a new GitHub repository',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Repository name'
        },
        description: {
          type: 'string',
          description: 'Repository description'
        },
        private: {
          type: 'boolean',
          description: 'Whether the repo should be private',
          default: false
        }
      },
      required: ['name']
    }
  }
};

export const pushToGithubTool = {
  type: 'function',
  function: {
    name: 'push_to_github',
    description: 'Push all project files to GitHub repository',
    parameters: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name (owner/repo format)'
        },
        branch: {
          type: 'string',
          description: 'Branch name',
          default: 'main'
        },
        commitMessage: {
          type: 'string',
          description: 'Commit message',
          default: 'Initial commit'
        }
      },
      required: ['repo']
    }
  }
};

// Tool implementations
export async function create_github_repo({ name, description, private: isPrivate }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  const user = await db.users.findOne({ 
    _id: conversation.userId 
  });
  
  if (!user?.githubAccessToken) {
    return { 
      success: false, 
      error: 'No GitHub access token found. User needs to authenticate with GitHub.' 
    };
  }
  
  try {
    const octokit = new Octokit({
      auth: user.githubAccessToken
    });
    
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate || false,
      auto_init: false
    });
    
    // Store repo info in conversation context
    await db.convos.updateOne(
      { _id: new ObjectId(conversationId) },
      { 
        $set: { 
          'context.githubRepo': {
            owner: data.owner.login,
            name: data.name,
            fullName: data.full_name,
            url: data.html_url,
            cloneUrl: data.clone_url
          }
        }
      }
    );
    
    return {
      success: true,
      repo: data.full_name,
      url: data.html_url
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function push_to_github({ repo, branch = 'main', commitMessage = 'Initial commit' }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  const user = await db.users.findOne({ 
    _id: conversation.userId 
  });
  
  if (!user?.githubAccessToken) {
    return { 
      success: false, 
      error: 'No GitHub access token found' 
    };
  }
  
  if (!conversation.context.files || Object.keys(conversation.context.files).length === 0) {
    return {
      success: false,
      error: 'No files to push'
    };
  }
  
  try {
    const octokit = new Octokit({
      auth: user.githubAccessToken
    });
    
    // Parse repo format
    const [owner, repoName] = repo.includes('/') ? repo.split('/') : [user.githubUsername, repo];
    
    // Create a tree with all files
    const tree = [];
    for (const [path, content] of Object.entries(conversation.context.files)) {
      tree.push({
        path,
        mode: '100644',
        type: 'blob',
        content
      });
    }
    
    // Create tree
    const { data: treeData } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree
    });
    
    // Create commit
    const { data: commitData } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: commitMessage,
      tree: treeData.sha,
      parents: [] // No parents for initial commit
    });
    
    // Update reference
    try {
      await octokit.git.createRef({
        owner,
        repo: repoName,
        ref: `refs/heads/${branch}`,
        sha: commitData.sha
      });
    } catch (error) {
      // If ref exists, update it
      if (error.status === 422) {
        await octokit.git.updateRef({
          owner,
          repo: repoName,
          ref: `heads/${branch}`,
          sha: commitData.sha,
          force: true
        });
      } else {
        throw error;
      }
    }
    
    return {
      success: true,
      message: `Pushed ${Object.keys(conversation.context.files).length} files to ${repo}`,
      commit: commitData.sha,
      url: `https://github.com/${owner}/${repoName}/tree/${branch}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Export all tools
export const allGithubTools = [createGithubRepoTool, pushToGithubTool];