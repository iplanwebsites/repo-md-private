/**
 * Example of refactored project routes using helpers
 * Shows how to reduce boilerplate and improve code reuse
 */

import { z } from "zod";
import { router } from "../lib/trpc/trpc.js";
import { 
  protectedProcedure,
  projectViewerProcedure,
  projectEditorProcedure,
} from "../lib/trpc/procedures.js";
import { 
  createGitQuery, 
  createGitMutation, 
  createWorkflowRoute,
  commonInputs 
} from "../lib/gitRouteFactory.js";
import { getGitProviderInfo } from "../lib/gitRouteHelpers.js";

// Import the getUserGithubToken function from original routes
import { getUserGithubToken } from "./projectRoutes.js";

// Example of how routes can be simplified
const gitRoutes = {
  // List directory - reduced from 40+ lines to ~10
  listGitHubDirectory: createGitQuery({
    procedure: projectViewerProcedure,
    getUserToken: getUserGithubToken,
    input: z.object({
      path: z.string().optional().default(''),
      ref: commonInputs.ref,
    }),
    handler: async ({ input, gitCtx }) => {
      const result = await gitCtx.gitService.listDirectory(
        gitCtx.gitInfo.owner,
        gitCtx.gitInfo.repo,
        input.path,
        input.ref
      );
      
      if (!result) {
        throw new Error('Directory not found');
      }
      
      return { directory: result };
    }
  }),

  // Get file content - similar reduction
  getGitHubFileContent: createGitQuery({
    procedure: projectViewerProcedure,
    getUserToken: getUserGithubToken,
    input: z.object({
      path: commonInputs.path,
      ref: commonInputs.ref,
    }),
    handler: async ({ input, gitCtx }) => {
      const file = await gitCtx.gitService.getFileContent(
        gitCtx.gitInfo.owner,
        gitCtx.gitInfo.repo,
        input.path,
        input.ref
      );
      
      if (!file) {
        throw new Error('File not found');
      }
      
      return { file };
    }
  }),

  // Update file - mutation example
  updateGitHubFile: createGitMutation({
    procedure: projectEditorProcedure,
    getUserToken: getUserGithubToken,
    input: z.object({
      path: commonInputs.path,
      content: z.string(),
      message: commonInputs.message,
      branch: commonInputs.branch,
      sha: commonInputs.sha,
    }),
    handler: async ({ input, gitCtx }) => {
      const result = await gitCtx.gitService.updateFile(
        gitCtx.gitInfo.owner,
        gitCtx.gitInfo.repo,
        input.path,
        input.content,
        input.message,
        input.branch,
        input.sha
      );
      
      if (!result) {
        throw new Error('Failed to update file');
      }
      
      return {
        commit: result.commit,
        content: {
          sha: result.content.sha,
          path: result.content.path,
          size: result.content.size,
        }
      };
    }
  }),

  // Delete file - new operation
  deleteGitHubFile: createGitMutation({
    procedure: projectEditorProcedure,
    getUserToken: getUserGithubToken,
    input: z.object({
      path: commonInputs.path,
      message: commonInputs.message,
      sha: z.string().min(1, "SHA is required for deletion"),
      branch: commonInputs.branch,
    }),
    handler: async ({ input, gitCtx }) => {
      const result = await gitCtx.gitService.deleteFile(
        gitCtx.gitInfo.owner,
        gitCtx.gitInfo.repo,
        input.path,
        input.message,
        input.sha,
        input.branch
      );
      
      if (!result) {
        throw new Error('Failed to delete file');
      }
      
      return { commit: result.commit };
    }
  }),

  // Get file history - new operation
  getGitHubFileHistory: createGitQuery({
    procedure: projectViewerProcedure,
    getUserToken: getUserGithubToken,
    input: z.object({
      path: commonInputs.path,
      ref: commonInputs.ref,
      limit: z.number().optional().default(10),
    }),
    handler: async ({ input, gitCtx }) => {
      const commits = await gitCtx.gitService.getFileHistory(
        gitCtx.gitInfo.owner,
        gitCtx.gitInfo.repo,
        input.path,
        input.ref,
        input.limit
      );
      
      return { commits };
    }
  }),

  // Workflow example - extremely simplified
  workflowCreateBranchWithPR: createWorkflowRoute({
    procedure: projectEditorProcedure,
    getUserToken: getUserGithubToken,
    workflowMethod: 'createBranchWithPR',
    input: z.object({
      branchName: z.string().min(1),
      fromBranch: z.string().optional(),
      prTitle: z.string().min(1),
      prBody: z.string().optional().default(''),
      baseBranch: z.string().optional(),
      draft: z.boolean().optional().default(false),
    }),
  }),

  // Batch operations - showing how to handle complex workflows
  batchUpdateFiles: createGitMutation({
    procedure: projectEditorProcedure,
    getUserToken: getUserGithubToken,
    input: z.object({
      branch: commonInputs.branch,
      files: z.array(z.object({
        path: z.string(),
        content: z.string(),
        message: z.string().optional(),
        sha: z.string().optional(),
      })).min(1),
      defaultMessage: z.string().optional().default('Update files'),
    }),
    handler: async ({ input, gitCtx }) => {
      const result = await gitCtx.workflowService.batchUpdateFiles({
        owner: gitCtx.gitInfo.owner,
        repo: gitCtx.gitInfo.repo,
        branch: input.branch,
        files: input.files,
        defaultMessage: input.defaultMessage,
      });
      
      return result;
    }
  }),
};

// Export router with all routes
export const gitRouter = router(gitRoutes);

// Example of using the standalone service in other contexts
import StandaloneGitService from "../lib/standaloneGitService.js";

export async function exampleWorkerUsage() {
  // In a worker or script context
  const gitService = StandaloneGitService.fromRepository(
    'owner/repo',
    process.env.GITHUB_TOKEN
  );
  
  // Direct usage without project context
  const files = await gitService.listDirectory();
  const content = await gitService.getFileContent('README.md');
  
  // Workflow usage
  const result = await gitService.featureBranchWorkflow({
    featureName: 'New Feature',
    files: [
      { path: 'src/feature.js', content: '// New feature' }
    ],
    prTitle: 'Add new feature'
  });
  
  return result;
}