/**
 * Git Route Factory - Creates tRPC routes with minimal boilerplate
 * Reduces repetitive code and improves maintainability
 */

import { z } from "zod";
import { 
  createGitContext, 
  createResponse, 
  withErrorHandling 
} from "./gitRouteHelpers.js";

/**
 * Create a git query route
 * @param {Object} config - Route configuration
 * @returns {Object} tRPC query procedure
 */
export function createGitQuery(config) {
  const {
    input = z.object({}),
    procedure,
    getUserToken,
    handler
  } = config;

  return procedure
    .input(input)
    .query(withErrorHandling(async ({ input, ctx }) => {
      const gitCtx = await createGitContext(ctx.project, ctx.user, getUserToken);
      const result = await handler({ input, ctx, gitCtx });
      return createResponse(result, gitCtx.gitInfo);
    }));
}

/**
 * Create a git mutation route
 * @param {Object} config - Route configuration
 * @returns {Object} tRPC mutation procedure
 */
export function createGitMutation(config) {
  const {
    input = z.object({}),
    procedure,
    getUserToken,
    handler
  } = config;

  return procedure
    .input(input)
    .mutation(withErrorHandling(async ({ input, ctx }) => {
      const gitCtx = await createGitContext(ctx.project, ctx.user, getUserToken);
      const result = await handler({ input, ctx, gitCtx });
      return createResponse(result, gitCtx.gitInfo);
    }));
}

/**
 * Create a workflow route
 * @param {Object} config - Route configuration
 * @returns {Object} tRPC mutation procedure
 */
export function createWorkflowRoute(config) {
  const {
    input,
    procedure,
    getUserToken,
    workflowMethod
  } = config;

  return procedure
    .input(input)
    .mutation(withErrorHandling(async ({ input, ctx }) => {
      const gitCtx = await createGitContext(ctx.project, ctx.user, getUserToken);
      
      const result = await gitCtx.workflowService[workflowMethod]({
        owner: gitCtx.gitInfo.owner,
        repo: gitCtx.gitInfo.repo,
        ...input
      });

      return result; // Workflows return their own format
    }));
}

/**
 * Common input schemas for reuse
 */
export const commonInputs = {
  ref: z.string().optional().default('main'),
  branch: z.string().optional().default('main'),
  path: z.string().min(1, "Path is required"),
  message: z.string().min(1, "Message is required"),
  sha: z.string().optional(),
  prBase: z.object({
    title: z.string().min(1, "Title is required"),
    body: z.string().optional().default(''),
    draft: z.boolean().optional().default(false),
  })
};