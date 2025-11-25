/**
 * Git Route Helpers - Shared utilities for git operations in routes
 * Reduces boilerplate and improves code reuse
 */

import { TRPCError } from "@trpc/server";
import GitFileService from "./gitFileService.js";
import GitWorkflowService from "./gitWorkflowService.js";

/**
 * Create a git service context with proper error handling
 * @param {Object} project - Project object
 * @param {Object} user - User object
 * @param {Function} getUserToken - Function to get user's git token
 * @returns {Promise<Object>} Git service context
 */
export async function createGitContext(project, user, getUserToken) {
  // Get git provider info
  const gitInfo = getGitProviderInfo(project);
  
  if (!gitInfo) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Project does not have a linked repository",
    });
  }

  // Get the user's token
  const token = await getUserToken(user.id);
  
  if (!token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "No GitHub access token found for user",
    });
  }

  return {
    gitInfo,
    token,
    gitService: new GitFileService(gitInfo.provider, token),
    workflowService: new GitWorkflowService(gitInfo.provider, token)
  };
}

/**
 * Get git provider info from project
 * @param {Object} project - Project object
 * @returns {Object|null} Git provider info
 */
export function getGitProviderInfo(project) {
  const githubInfo = project.githubRepo || project.github;
  
  if (githubInfo && githubInfo.owner && githubInfo.repoName) {
    return {
      provider: 'github',
      owner: githubInfo.owner,
      repo: githubInfo.repoName,
      fullName: githubInfo.fullName || `${githubInfo.owner}/${githubInfo.repoName}`
    };
  }
  
  // Future: Add GitLab, Bitbucket detection here
  
  return null;
}

/**
 * Wrap async route handler with consistent error handling
 * @param {Function} handler - Async route handler
 * @returns {Function} Wrapped handler
 */
export function withErrorHandling(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(`Error in git operation:`, error);
      
      // Enhance error messages for common git errors
      if (error.response) {
        if (error.response.status === 404) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message || "Resource not found in repository",
          });
        }
        if (error.response.status === 403) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to repository",
          });
        }
        if (error.response.status === 422) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.response.data?.message || "Invalid request to git provider",
          });
        }
      }
      
      throw new TRPCError({
        code: error.code || "INTERNAL_SERVER_ERROR",
        message: error.message || "Git operation failed",
      });
    }
  };
}

/**
 * Create standard response format
 * @param {Object} data - Response data
 * @param {Object} gitInfo - Git provider info
 * @returns {Object} Standardized response
 */
export function createResponse(data, gitInfo) {
  return {
    success: true,
    ...data,
    repository: {
      provider: gitInfo.provider,
      owner: gitInfo.owner,
      name: gitInfo.repo,
      fullName: gitInfo.fullName,
    }
  };
}