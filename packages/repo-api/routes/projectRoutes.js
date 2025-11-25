import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { router, procedure } from "../lib/trpc/trpc.js";
import { 
  protectedProcedure, 
  adminProcedure,
  projectProcedure,
  projectAdminProcedure,
  projectEditorProcedure,
  projectViewerProcedure,
  projectOwnerProcedure
} from "../lib/trpc/procedures.js";
import { db } from "../db.js";
import namor from "namor";
import GitFileService from "../lib/gitFileService.js";
import GitWorkflowService from "../lib/gitWorkflowService.js";
import { createRepoFromTemplate, listTemplateRepos } from "../lib/github-template.js";
import { TEMPLATES, getTemplateMetadata, getTemplatesByOwner } from "../lib/templates-config.js";
import { GitHubBulkOps } from "../lib/github-bulk-ops.js";
import { generateProjectFromBrief } from "../lib/ai-scaffold-generator.js";
import { triggerRepoDeploy } from "../lib/deploy-helpers.js";
import { Octokit } from "@octokit/rest";
import { RepoGeneratorAgent } from "../lib/repo-generator-agentVolt.js";

// Function to get the GitHub token for a user
async function getUserGithubToken(userId) {
  try {
    // Find user with the given ID
    const user = await db.users.findOne({ id: userId });
    
    // Check if user has a GitHub token
    if (user && user.githubSupaToken) {
      console.log(`Found GitHub token for user ${userId}`);
      return user.githubSupaToken;
    }
  } catch (error) {
    console.log(`Failed to get GitHub token from user record for user ${userId}:`, error.message);
  }
  
  // No fallback - user must have their own GitHub token
  return null;
}

// Helper to get git provider info from project
function getGitProviderInfo(project) {
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

// Import project utility functions
import {
  getProjectById,
  getProjectByHandle,
  listUserProjects,
  updateProject,
  addProjectCollaborator,
  removeProjectCollaborator,
  deleteProject,
} from "../lib/project.js";

function generateRandomProjectKey() {
  // sweet-green-potato
  return namor.generate({ words: 3, dictionary: "default" });
}

// Helper function to check if a user has access to an organization
async function checkOrgAccess(orgId, userId) {
  const org = await db.orgs.findOne({ handle: orgId });

  if (!org) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Organization not found: " + orgId,
    });
  }

  // Check if user is owner or member of the organization
  const hasAccess =
    org.owner === userId ||
    (org.members && org.members.some((member) => member.userId === userId));

  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have access to this organization",
    });
  }

  return org;
}

// Project route implementations
const projectRoutes = {
  // Get project settings (public method)
  getProjectSettings: procedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const { projectId } = input;

        // Get the project
        const project = await getProjectById(projectId);

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Return only the settings object
        return {
          success: true,
          settings: project.settings || {},
        };
      } catch (error) {
        console.error("Error getting project settings:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get project settings",
        });
      }
    }),

  // Update project settings - Using projectAdminProcedure for role-based access
  updateProjectSettings: projectAdminProcedure
    .input(
      z.object({
        settings: z
          .object({
            // Define the whitelisted properties that can be updated
            themeId: z.string().optional(),
            logo: z.string().optional(),
            footerText: z.string().optional(),
            analyticsId: z.string().optional(),
            customStyles: z.string().optional(),
            customScripts: z.string().optional(),
            siteMetadata: z
              .object({
                title: z.string().optional(),
                description: z.string().optional(),
                keywords: z.array(z.string()).optional(),
                ogImage: z.string().optional(),
              })
              .optional(),
            // Build and deployment settings
            build: z
              .object({
                repositoryFolder: z.string().optional(),
                ignoreFiles: z.string().optional(),
                enableAutoDeployment: z.boolean().optional(),
              })
              .optional(),
            // Theme settings
            theme: z
              .object({
                themeId: z.string().optional(),
                siteName: z.string().optional(),
                footerText: z.string().optional(),
                preferredColorScheme: z.string().optional(),
              })
              .optional(),
            // Media settings
            media: z
              .object({
                imageSizes: z.array(z.number()).optional(),
                autoResize: z.boolean().optional(),
                imageQuality: z.number().optional(),
                enableVision: z.boolean().optional(),
              })
              .optional(),
            // Frontmatter settings
            frontmatter: z
              .object({
                titleField: z.string().optional(),
                dateField: z.string().optional(),
                excerptField: z.string().optional(),
                customFields: z.array(z.string()).optional(),
              })
              .optional(),
            // Formatting settings
            formatting: z
              .object({
                dateFormat: z.string().optional(),
                codeTheme: z.string().optional(),
                enableTableOfContents: z.boolean().optional(),
              })
              .optional(),
            // AI agent settings
            agent: z
              .object({
                enabled: z.boolean().optional(),
                systemPrompt: z.string().optional(),
              })
              .optional(),
            // Add more whitelisted properties here as needed
          })
          .strict(), // Only allow the whitelisted properties
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { settings } = input;
        const { project, projectId } = ctx;

        // Update project settings
        await updateProject(projectId, { settings });

        // Get updated project for response
        const updatedProject = await getProjectById(projectId);
        
        return {
          success: true,
          message: "Project settings updated successfully",
          settings: updatedProject.settings || {},
        };
      } catch (error) {
        console.error("Error updating project settings:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to update project settings",
        });
      }
    }),

  // Get public project details (public method)
  getPublicProjectDetails: procedure
    .input(
      z.object({
        projectId: z.string(),
        orgId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const { projectId, orgId } = input;
        let query = { _id: projectId };

        // If orgId is provided, add it to the query
        if (orgId) {
          query = { ...query, orgId };
        }

        // Get the project
        const project = orgId 
          ? await db.projects.findOne(query)
          : await getProjectById(projectId);

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Return selective project details, excluding sensitive information
        return {
          success: true,
          project: {
            _id: project._id,
            name: project.name,
            slug: project.slug,
            description: project.description,
            orgId: project.orgId,
            visibility: project.visibility,
            created_at: project.created_at,
            updated_at: project.updated_at,
            settings: project.settings || {},
            githubRepo: project.githubRepo,
            deployment: project.deployment,
            status: project.status,
          },
        };
      } catch (error) {
        console.error("Error getting public project details:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get project details",
        });
      }
    }),

  // Get active revision (latest completed deployment job)
  getActiveRev: procedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const { projectId } = input;

        // Get the project
        const project = await getProjectById(projectId);

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Find the latest completed job of type REPO_DEPLOY for this project
        const latestJob = await db.jobs.findOne(
          {
            projectId: projectId,
            type: "repo_deploy",
            status: "completed",
          },
          { sort: { completedAt: -1 } }
        );

        if (!latestJob) {
          return {
            success: false,
            message: "No completed deployments found for this project",
          };
        }

        return {
          success: true,
          revision: {
            jobId: latestJob._id.toString(),
            deployedAt: latestJob.completedAt,
            commit: latestJob.input?.commit || "latest",
            branch: latestJob.input?.branch || "main",
            output: latestJob.output,
          },
        };
      } catch (error) {
        console.error("Error getting active revision:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get active revision",
        });
      }
    }),

  // List available revisions (completed deployments) for a project
  listRevisions: projectViewerProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        skip: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input = {}, ctx }) => {
      try {
        const { limit = 20, skip = 0 } = input;
        const { project, projectId } = ctx;

        // Find all completed deployment jobs for this project
        const jobs = await db.jobs
          .find({
            projectId: projectId,
            type: "repo_deploy",
            status: "completed",
          })
          .sort({ completedAt: -1 })
          .limit(limit)
          .skip(skip)
          .toArray();

        // Get the total count for pagination
        const totalCount = await db.jobs.countDocuments({
          projectId: projectId,
          type: "repo_deploy",
          status: "completed",
        });

        // Format the revisions
        const revisions = jobs.map((job) => ({
          jobId: job._id.toString(),
          deployedAt: job.completedAt,
          commit: job.input?.commit || "latest",
          branch: job.input?.branch || "main",
          isActive: project.activeRev === job._id.toString(),
          output: {
            deployUrl: job.output?.deployUrl,
            duration: job.output?.duration,
          },
        }));

        return {
          success: true,
          revisions,
          pagination: {
            total: totalCount,
            limit,
            skip,
            hasMore: skip + limit < totalCount,
          },
        };
      } catch (error) {
        console.error("Error listing revisions:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to list revisions",
        });
      }
    }),

  // Set active revision for a project
  setActiveRevision: projectAdminProcedure
    .input(
      z.object({
        revisionId: z.string(), // This should be a valid job ID
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { revisionId } = input;
        const { project, projectId } = ctx;

        // Validate that the revision (job) exists and belongs to this project
        const job = await db.jobs.findOne({
          _id: new ObjectId(revisionId),
          projectId: projectId,
          type: "repo_deploy",
          status: "completed",
        });

        if (!job) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Revision not found or is not a completed deployment for this project",
          });
        }

        // Update the project's activeRev field
        const updateResult = await db.projects.updateOne(
          { _id: new ObjectId(projectId) },
          {
            $set: {
              activeRev: revisionId,
              updatedAt: new Date(),
            },
          }
        );

        if (updateResult.modifiedCount === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update active revision",
          });
        }

        // Return success with revision details
        return {
          success: true,
          message: "Active revision updated successfully",
          revision: {
            jobId: job._id.toString(),
            deployedAt: job.completedAt,
            commit: job.input?.commit || "latest",
            branch: job.input?.branch || "main",
            output: job.output,
          },
        };
      } catch (error) {
        console.error("Error setting active revision:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to set active revision",
        });
      }
    }),

  // Get all projects for a user
  listProjects: protectedProcedure
    .input(
      z
        .object({
          orgId: z.string().optional(),
          includeCollaborations: z.boolean().default(true),
        })
        .optional()
    )
    .query(async ({ input = {}, ctx }) => {
      try {
        const { orgId, includeCollaborations = true } = input;

        // If orgId is provided, check access to that org first
        if (orgId) {
          await checkOrgAccess(orgId, ctx.user.id);
        }

        // Get projects using the utility function
        const projects = await listUserProjects(ctx.user.id, {
          orgId,
          includeCollaborations,
        });

        return {
          success: true,
          projects,
        };
      } catch (error) {
        console.error("Error listing projects:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to list projects",
        });
      }
    }),

  // Get a single project by ID - Use projectViewerProcedure which already gets the project
  getProject: projectViewerProcedure
    .query(async ({ ctx }) => {
      try {
        // Project is already available in the context
        const { project } = ctx;

        return {
          success: true,
          project,
        };
      } catch (error) {
        console.error("Error getting project:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get project",
        });
      }
    }),

  getProjectByHandle: protectedProcedure
    .input(
      z.object({
        projectHandle: z.string(),
        orgId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { projectHandle, orgId } = input;

        // Check org access first
        await checkOrgAccess(orgId, ctx.user.id);

        // Get the project by handle
        const project = await getProjectByHandle(projectHandle, orgId);

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Check if user has access to this project
        const hasAccess =
          project.ownerId === ctx.user.id ||
          (project.collaborators &&
            project.collaborators.some(
              (collab) => collab.userId === ctx.user.id
            ));

        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        return {
          success: true,
          project,
        };
      } catch (error) {
        console.error("Error getting project:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get project",
        });
      }
    }),

  // Create a new project
  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        slug: z
          .string()
          .min(1, "Slug is required")
          .regex(
            /^[a-z0-9-]+$/,
            "Slug must contain only lowercase letters, numbers, and hyphens"
          ),
        description: z.string().optional(),
        orgId: z.string(),
        visibility: z
          .enum(["public", "private", "organization"])
          .default("private"),
        githubRepo: z
          .object({
            repoId: z.number().optional(),
            fullName: z.string().optional(),
            owner: z.string().optional(),
            name: z.string().optional(),
          })
          .optional(),
        settings: z.object({}).passthrough().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const {
          name,
          slug,
          description,
          orgId,
          visibility,
          githubRepo,
          settings,
        } = input;

        // Verify organization access and existence
        const org = await checkOrgAccess(orgId, ctx.user.id);

        // Check if project slug is already taken within this organization
        const existingProject = await db.projects.findOne({
          orgId,
          name: slug,
        });

        if (existingProject) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A project with this slug already exists in this organization",
          });
        }

        // Create the project
        const newProject = {
          name,
          slug,
          description,
          orgId,
          ownerId: ctx.user.id,
          visibility,
          created_at: new Date(),
          updated_at: new Date(),
          collaborators: [],
          settings: settings || {},
          githubRepo: githubRepo || null,
        };

        const result = await db.projects.insertOne(newProject);

        return {
          success: true,
          message: "Project created successfully",
          project: {
            ...newProject,
            _id: result.insertedId,
          },
        };
      } catch (error) {
        console.error("Error creating project:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create project",
        });
      }
    }),

  // Update a project - Using projectAdminProcedure for role-based access
  updateProject: projectAdminProcedure
    .input(
      z.object({
        updates: z.object({
          name: z.string().min(1, "Name is required").optional(),
          description: z.string().optional(),
          visibility: z.enum(["public", "private", "organization"]).optional(),
          settings: z.object({}).passthrough().optional(),
          githubRepo: z
            .object({
              repoId: z.number().optional(),
              fullName: z.string().optional(),
              owner: z.string().optional(),
              name: z.string().optional(),
            })
            .optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { updates } = input;
        const { projectId } = ctx;

        // Update the project using the utility function
        await updateProject(projectId, updates);

        return {
          success: true,
          message: "Project updated successfully",
        };
      } catch (error) {
        console.error("Error updating project:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to update project",
        });
      }
    }),

  // Add a collaborator to a project - Using projectOwnerProcedure for ownership verification
  addCollaborator: projectOwnerProcedure
    .input(
      z.object({
        userEmail: z.string().email("Invalid email address"),
        role: z.enum(["admin", "editor", "viewer"]).default("editor"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { userEmail, role } = input;
        const { projectId } = ctx;

        // Add collaborator using utility function
        await addProjectCollaborator(projectId, userEmail, role);

        return {
          success: true,
          message: "Collaborator added successfully",
        };
      } catch (error) {
        console.error("Error adding project collaborator:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to add collaborator to project",
        });
      }
    }),

  // Remove a collaborator from a project - Using projectOwnerProcedure for ownership verification
  removeCollaborator: projectOwnerProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId } = input;
        const { projectId } = ctx;

        // Remove collaborator using utility function
        await removeProjectCollaborator(projectId, userId);

        return {
          success: true,
          message: "Collaborator removed successfully",
        };
      } catch (error) {
        console.error("Error removing project collaborator:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message:
            error.message || "Failed to remove collaborator from project",
        });
      }
    }),

  // Link a GitHub repository to a project - Using projectOwnerProcedure for ownership verification
  linkGitHubRepo: projectOwnerProcedure
    .input(
      z.object({
        repoInfo: z.object({
          repoId: z.number(),
          fullName: z.string(),
          owner: z.string(),
          name: z.string(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { repoInfo } = input;
        const { projectId } = ctx;

        // Update the project with GitHub repo info
        await updateProject(projectId, { githubRepo: repoInfo });

        return {
          success: true,
          message: "GitHub repository linked successfully",
        };
      } catch (error) {
        console.error("Error linking GitHub repository:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to link GitHub repository",
        });
      }
    }),

  // Delete a project - Using projectOwnerProcedure for ownership verification
  deleteProject: projectOwnerProcedure
    .mutation(async ({ ctx }) => {
      try {
        const { projectId } = ctx;

        // Delete the project using utility function
        await deleteProject(projectId);

        return {
          success: true,
          message: "Project deleted successfully",
        };
      } catch (error) {
        console.error("Error deleting project:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to delete project",
        });
      }
    }),

  // Get file content from GitHub repository - Using projectViewerProcedure for read access
  getGitHubFileContent: projectViewerProcedure
    .input(
      z.object({
        path: z.string().min(1, "File path is required"),
        ref: z.string().optional().default("main"),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { path, ref } = input;
        const { project, user } = ctx;

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token (will be generalized later)
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        // Initialize git file service
        const gitFileService = new GitFileService(gitInfo.provider, githubToken);

        // Get file content
        const fileContent = await gitFileService.getFileContent(
          gitInfo.owner,
          gitInfo.repo,
          path,
          ref
        );

        if (!fileContent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found in repository",
          });
        }

        return {
          success: true,
          file: fileContent,
          repository: {
            owner: gitInfo.owner,
            name: gitInfo.repo,
            fullName: gitInfo.fullName,
          },
        };
      } catch (error) {
        console.error("Error getting file content:", error);
        
        // Handle specific API errors
        if (error.response) {
          if (error.response.status === 404) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "File not found in repository",
            });
          }
          if (error.response.status === 403) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Access denied to repository",
            });
          }
        }
        
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get file content",
        });
      }
    }),

  // Update file content in repository - Using projectEditorProcedure for write access
  updateGitHubFile: projectEditorProcedure
    .input(
      z.object({
        path: z.string().min(1, "File path is required"),
        content: z.string(),
        message: z.string().min(1, "Commit message is required"),
        branch: z.string().optional().default("main"),
        sha: z.string().optional(), // Required for updating existing files
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { path, content, message, branch, sha } = input;
        const { project, user } = ctx;

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token (will be generalized later)
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        // Initialize git file service
        const gitFileService = new GitFileService(gitInfo.provider, githubToken);

        // Update the file
        const result = await gitFileService.updateFile(
          gitInfo.owner,
          gitInfo.repo,
          path,
          content,
          message,
          branch,
          sha
        );

        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update file in repository",
          });
        }

        return {
          success: true,
          commit: result.commit,
          content: {
            sha: result.content.sha,
            path: result.content.path,
            size: result.content.size,
          },
        };
      } catch (error) {
        console.error("Error updating file:", error);
        
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to update file",
        });
      }
    }),

  // Upload image to repository - Using projectEditorProcedure for write access
  uploadGitHubImage: projectEditorProcedure
    .input(
      z.object({
        imageUrl: z.string().url().optional(),
        imageBase64: z.string().optional(),
        fileName: z.string().min(1, "File name is required"),
        folder: z.string().optional().default("uploads"),
        message: z.string().optional(),
        branch: z.string().optional().default("main"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { imageUrl, imageBase64, fileName, folder, message, branch } = input;
        const { project, user } = ctx;

        // Validate input - must have either imageUrl or imageBase64
        if (!imageUrl && !imageBase64) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Either imageUrl or imageBase64 must be provided",
          });
        }

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token (will be generalized later)
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        let imageBuffer;

        // Download image if URL provided
        if (imageUrl) {
          try {
            imageBuffer = await GitFileService.downloadFromUrl(imageUrl);
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Failed to download image from URL: ${error.message}`,
            });
          }
        } else {
          // Use base64 data
          imageBuffer = Buffer.from(imageBase64, 'base64');
        }

        // Initialize git file service
        const gitFileService = new GitFileService(gitInfo.provider, githubToken);

        // Construct the full path
        const imagePath = `${folder}/${fileName}`;
        const commitMessage = message || `Upload image: ${fileName}`;

        // Upload the image
        const result = await gitFileService.uploadImage(
          gitInfo.owner,
          gitInfo.repo,
          imagePath,
          imageBuffer,
          commitMessage,
          branch
        );

        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to upload image to repository",
          });
        }

        return {
          success: true,
          image: {
            path: result.path,
            sha: result.sha,
            size: result.size,
            download_url: result.download_url,
            html_url: result.html_url,
          },
          commit: result.commit,
        };
      } catch (error) {
        console.error("Error uploading image:", error);
        
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to upload image",
        });
      }
    }),

  // List directory contents in repository - Using projectViewerProcedure for read access
  listGitHubDirectory: projectViewerProcedure
    .input(
      z.object({
        path: z.string().optional().default(''),
        ref: z.string().optional().default('main'),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { path, ref } = input;
        const { project, user } = ctx;

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        // Initialize git file service
        const gitFileService = new GitFileService(gitInfo.provider, githubToken);

        // List directory contents
        const result = await gitFileService.listDirectory(
          gitInfo.owner,
          gitInfo.repo,
          path,
          ref
        );

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Directory not found in repository",
          });
        }

        return {
          success: true,
          directory: result,
          repository: {
            owner: gitInfo.owner,
            name: gitInfo.repo,
            fullName: gitInfo.fullName,
          },
        };
      } catch (error) {
        console.error("Error listing directory:", error);
        
        if (error.response) {
          if (error.response.status === 404) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Directory not found in repository",
            });
          }
          if (error.response.status === 403) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Access denied to repository",
            });
          }
        }
        
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to list directory contents",
        });
      }
    }),

  // List branches in repository - Using projectViewerProcedure for read access
  listGitHubBranches: projectViewerProcedure
    .input(
      z.object({
        protected: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { protected: protectedOnly } = input;
        const { project, user } = ctx;

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        // Initialize git file service
        const gitFileService = new GitFileService(gitInfo.provider, githubToken);

        // List branches
        const branches = await gitFileService.listBranches(gitInfo.owner, gitInfo.repo, {
          protected: protectedOnly
        });

        return {
          success: true,
          branches: branches,
          repository: {
            owner: gitInfo.owner,
            name: gitInfo.repo,
            fullName: gitInfo.fullName,
          },
        };
      } catch (error) {
        console.error("Error listing branches:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to list branches",
        });
      }
    }),

  // Create a new branch - Using projectEditorProcedure for write access
  createGitHubBranch: projectEditorProcedure
    .input(
      z.object({
        branchName: z.string().min(1, "Branch name is required"),
        fromBranch: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { branchName, fromBranch } = input;
        const { project, user } = ctx;

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        // Initialize git file service
        const gitFileService = new GitFileService(gitInfo.provider, githubToken);

        // Create branch
        const branch = await gitFileService.createBranch(
          gitInfo.owner,
          gitInfo.repo,
          branchName,
          fromBranch
        );

        if (!branch) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create branch",
          });
        }

        return {
          success: true,
          branch: branch,
        };
      } catch (error) {
        console.error("Error creating branch:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create branch",
        });
      }
    }),

  // List pull requests - Using projectViewerProcedure for read access
  listGitHubPullRequests: projectViewerProcedure
    .input(
      z.object({
        state: z.enum(['open', 'closed', 'all']).optional().default('open'),
        head: z.string().optional(),
        base: z.string().optional(),
        sort: z.enum(['created', 'updated', 'popularity', 'long-running']).optional(),
        direction: z.enum(['asc', 'desc']).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { project, user } = ctx;

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        // Initialize git file service
        const gitFileService = new GitFileService(gitInfo.provider, githubToken);

        // List PRs
        const pullRequests = await gitFileService.listPullRequests(
          gitInfo.owner,
          gitInfo.repo,
          input
        );

        return {
          success: true,
          pullRequests: pullRequests,
          repository: {
            owner: gitInfo.owner,
            name: gitInfo.repo,
            fullName: gitInfo.fullName,
          },
        };
      } catch (error) {
        console.error("Error listing pull requests:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to list pull requests",
        });
      }
    }),

  // Create pull request - Using projectEditorProcedure for write access
  createGitHubPullRequest: projectEditorProcedure
    .input(
      z.object({
        title: z.string().min(1, "PR title is required"),
        body: z.string().optional().default(''),
        head: z.string().min(1, "Head branch is required"),
        base: z.string().min(1, "Base branch is required"),
        draft: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { title, body, head, base, draft } = input;
        const { project, user } = ctx;

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        // Initialize git file service
        const gitFileService = new GitFileService(gitInfo.provider, githubToken);

        // Create PR
        const pr = await gitFileService.createPullRequest(
          gitInfo.owner,
          gitInfo.repo,
          title,
          body,
          head,
          base,
          draft
        );

        if (!pr) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create pull request",
          });
        }

        return {
          success: true,
          pullRequest: pr,
        };
      } catch (error) {
        console.error("Error creating pull request:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create pull request",
        });
      }
    }),

  // Workflow: Create branch with PR - Using projectEditorProcedure
  workflowCreateBranchWithPR: projectEditorProcedure
    .input(
      z.object({
        branchName: z.string().min(1, "Branch name is required"),
        fromBranch: z.string().optional(),
        prTitle: z.string().min(1, "PR title is required"),
        prBody: z.string().optional().default(''),
        baseBranch: z.string().optional(),
        draft: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { project, user } = ctx;

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        // Initialize workflow service
        const workflowService = new GitWorkflowService(gitInfo.provider, githubToken);

        // Execute workflow
        const result = await workflowService.createBranchWithPR({
          owner: gitInfo.owner,
          repo: gitInfo.repo,
          ...input
        });

        return result;
      } catch (error) {
        console.error("Error in createBranchWithPR workflow:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create branch with PR",
        });
      }
    }),

  // Workflow: Update file with PR - Using projectEditorProcedure
  workflowUpdateFileWithPR: projectEditorProcedure
    .input(
      z.object({
        branch: z.string().min(1, "Branch is required"),
        filePath: z.string().min(1, "File path is required"),
        content: z.string(),
        commitMessage: z.string().min(1, "Commit message is required"),
        currentSha: z.string().optional(),
        prTitle: z.string().optional(),
        prBody: z.string().optional(),
        baseBranch: z.string().optional().default('main'),
        updateExistingPR: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { project, user } = ctx;

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        // Initialize workflow service
        const workflowService = new GitWorkflowService(gitInfo.provider, githubToken);

        // Execute workflow
        const result = await workflowService.updateFileWithPR({
          owner: gitInfo.owner,
          repo: gitInfo.repo,
          ...input
        });

        return result;
      } catch (error) {
        console.error("Error in updateFileWithPR workflow:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to update file with PR",
        });
      }
    }),

  // Workflow: Feature branch workflow - Using projectEditorProcedure
  workflowFeatureBranch: projectEditorProcedure
    .input(
      z.object({
        featureName: z.string().min(1, "Feature name is required"),
        fromBranch: z.string().optional().default('main'),
        files: z.array(z.object({
          path: z.string(),
          content: z.string(),
          message: z.string().optional(),
          sha: z.string().optional(),
        })).min(1, "At least one file is required"),
        commitMessage: z.string().optional(),
        prTitle: z.string().optional(),
        prBody: z.string().optional().default(''),
        draft: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { project, user } = ctx;

        // Get git provider info
        const gitInfo = getGitProviderInfo(project);
        
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        // Initialize workflow service
        const workflowService = new GitWorkflowService(gitInfo.provider, githubToken);

        // Execute workflow
        const result = await workflowService.featureBranchWorkflow({
          owner: gitInfo.owner,
          repo: gitInfo.repo,
          ...input
        });

        return result;
      } catch (error) {
        console.error("Error in featureBranch workflow:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to execute feature branch workflow",
        });
      }
    }),

  // Get specific PR - Using projectViewerProcedure for read access
  getGitHubPullRequest: projectViewerProcedure
    .input(
      z.object({
        pullNumber: z.number().min(1, "PR number is required"),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { pullNumber } = input;
        const { project, user } = ctx;

        const gitInfo = getGitProviderInfo(project);
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        const githubToken = await getUserGithubToken(user.id);
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        const gitFileService = new GitFileService(gitInfo.provider, githubToken);
        const pr = await gitFileService.getPullRequest(gitInfo.owner, gitInfo.repo, pullNumber);

        if (!pr) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Pull request not found",
          });
        }

        return {
          success: true,
          pullRequest: pr,
        };
      } catch (error) {
        console.error("Error getting pull request:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get pull request",
        });
      }
    }),

  // Get PR commits - Using projectViewerProcedure for read access
  getGitHubPullRequestCommits: projectViewerProcedure
    .input(
      z.object({
        pullNumber: z.number().min(1, "PR number is required"),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { pullNumber } = input;
        const { project, user } = ctx;

        const gitInfo = getGitProviderInfo(project);
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        const githubToken = await getUserGithubToken(user.id);
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        const gitFileService = new GitFileService(gitInfo.provider, githubToken);
        const commits = await gitFileService.getPullRequestCommits(gitInfo.owner, gitInfo.repo, pullNumber);

        return {
          success: true,
          commits: commits,
        };
      } catch (error) {
        console.error("Error getting PR commits:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get PR commits",
        });
      }
    }),

  // Check PR mergeability - Using projectViewerProcedure for read access
  checkGitHubPullRequestMergeability: projectViewerProcedure
    .input(
      z.object({
        pullNumber: z.number().min(1, "PR number is required"),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { pullNumber } = input;
        const { project, user } = ctx;

        const gitInfo = getGitProviderInfo(project);
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        const githubToken = await getUserGithubToken(user.id);
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        const gitFileService = new GitFileService(gitInfo.provider, githubToken);
        const status = await gitFileService.checkPullRequestMergeability(gitInfo.owner, gitInfo.repo, pullNumber);

        if (!status) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Pull request not found",
          });
        }

        return {
          success: true,
          ...status,
        };
      } catch (error) {
        console.error("Error checking PR mergeability:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to check PR mergeability",
        });
      }
    }),

  // Merge PR - Using projectEditorProcedure for write access
  mergeGitHubPullRequest: projectEditorProcedure
    .input(
      z.object({
        pullNumber: z.number().min(1, "PR number is required"),
        commitTitle: z.string().optional(),
        commitMessage: z.string().optional(),
        mergeMethod: z.enum(['merge', 'squash', 'rebase']).optional().default('merge'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { pullNumber, commitTitle, commitMessage, mergeMethod } = input;
        const { project, user } = ctx;

        const gitInfo = getGitProviderInfo(project);
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        const githubToken = await getUserGithubToken(user.id);
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        const gitFileService = new GitFileService(gitInfo.provider, githubToken);
        const result = await gitFileService.mergePullRequest(
          gitInfo.owner,
          gitInfo.repo,
          pullNumber,
          commitTitle || '',
          commitMessage || '',
          mergeMethod
        );

        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to merge pull request",
          });
        }

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        console.error("Error merging pull request:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to merge pull request",
        });
      }
    }),

  // Delete file - Using projectEditorProcedure for write access
  deleteGitHubFile: projectEditorProcedure
    .input(
      z.object({
        path: z.string().min(1, "File path is required"),
        message: z.string().min(1, "Commit message is required"),
        sha: z.string().min(1, "File SHA is required"),
        branch: z.string().optional().default("main"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { path, message, sha, branch } = input;
        const { project, user } = ctx;

        const gitInfo = getGitProviderInfo(project);
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        const githubToken = await getUserGithubToken(user.id);
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        const gitFileService = new GitFileService(gitInfo.provider, githubToken);
        const result = await gitFileService.deleteFile(
          gitInfo.owner,
          gitInfo.repo,
          path,
          message,
          sha,
          branch
        );

        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete file",
          });
        }

        return {
          success: true,
          commit: result.commit,
        };
      } catch (error) {
        console.error("Error deleting file:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to delete file",
        });
      }
    }),

  // Get file history - Using projectViewerProcedure for read access
  getGitHubFileHistory: projectViewerProcedure
    .input(
      z.object({
        path: z.string().min(1, "File path is required"),
        ref: z.string().optional().default("main"),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { path, ref, limit } = input;
        const { project, user } = ctx;

        const gitInfo = getGitProviderInfo(project);
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        const githubToken = await getUserGithubToken(user.id);
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        const gitFileService = new GitFileService(gitInfo.provider, githubToken);
        const commits = await gitFileService.getFileHistory(
          gitInfo.owner,
          gitInfo.repo,
          path,
          ref,
          limit
        );

        return {
          success: true,
          commits: commits,
        };
      } catch (error) {
        console.error("Error getting file history:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get file history",
        });
      }
    }),

  // Delete branch - Using projectEditorProcedure for write access
  deleteGitHubBranch: projectEditorProcedure
    .input(
      z.object({
        branchName: z.string().min(1, "Branch name is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { branchName } = input;
        const { project, user } = ctx;

        const gitInfo = getGitProviderInfo(project);
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        const githubToken = await getUserGithubToken(user.id);
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        const gitFileService = new GitFileService(gitInfo.provider, githubToken);
        const success = await gitFileService.deleteBranch(gitInfo.owner, gitInfo.repo, branchName);

        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete branch",
          });
        }

        return {
          success: true,
          message: `Branch ${branchName} deleted successfully`,
        };
      } catch (error) {
        console.error("Error deleting branch:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to delete branch",
        });
      }
    }),

  // Get repository info - Using projectViewerProcedure for read access
  getGitHubRepository: projectViewerProcedure
    .query(async ({ ctx }) => {
      try {
        const { project, user } = ctx;

        const gitInfo = getGitProviderInfo(project);
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        const githubToken = await getUserGithubToken(user.id);
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        const gitFileService = new GitFileService(gitInfo.provider, githubToken);
        const repo = await gitFileService.getRepository(gitInfo.owner, gitInfo.repo);

        if (!repo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Repository not found",
          });
        }

        return {
          success: true,
          repository: repo,
        };
      } catch (error) {
        console.error("Error getting repository info:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get repository info",
        });
      }
    }),

  // Update PR - Using projectEditorProcedure for write access
  updateGitHubPullRequest: projectEditorProcedure
    .input(
      z.object({
        pullNumber: z.number().min(1, "PR number is required"),
        title: z.string().optional(),
        body: z.string().optional(),
        state: z.enum(['open', 'closed']).optional(),
        base: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { pullNumber, ...updates } = input;
        const { project, user } = ctx;

        const gitInfo = getGitProviderInfo(project);
        if (!gitInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project does not have a linked repository",
          });
        }

        const githubToken = await getUserGithubToken(user.id);
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found for user",
          });
        }

        const gitFileService = new GitFileService(gitInfo.provider, githubToken);
        const pr = await gitFileService.updatePullRequest(
          gitInfo.owner,
          gitInfo.repo,
          pullNumber,
          updates
        );

        if (!pr) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update pull request",
          });
        }

        return {
          success: true,
          pullRequest: pr,
        };
      } catch (error) {
        console.error("Error updating pull request:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to update pull request",
        });
      }
    }),

  // Create repository from template - Using protectedProcedure as it creates new resources
  createFromTemplate: protectedProcedure
    .input(
      z.object({
        templateOwner: z.string().min(1, "Template owner is required"),
        templateRepo: z.string().min(1, "Template repository name is required"),
        newRepoName: z.string().min(1, "New repository name is required"),
        orgId: z.string().optional(),
        repoOptions: z.object({
          private: z.boolean().optional(),
          description: z.string().optional(),
          includeAllBranches: z.boolean().optional(),
        }).optional(),
        createProject: z.boolean().optional().default(true),
        triggerDeploy: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { 
          templateOwner, 
          templateRepo, 
          newRepoName, 
          orgId,
          repoOptions,
          createProject,
          triggerDeploy
        } = input;
        const { user } = ctx;

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found. Please connect your GitHub account.",
          });
        }

        // Determine the owner for the new repo
        let userOwner = user.githubHandle;
        
        // If orgId is provided, check if user has access to create repos in that org
        if (orgId) {
          const org = await checkOrgAccess(orgId, user.id);
          // For GitHub orgs, we'd need to check if the user has repo creation permissions
          // For now, we'll use the user's own account
          userOwner = user.githubHandle;
        }

        if (!userOwner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "GitHub username not found for user",
          });
        }

        // Create repository from template
        const result = await createRepoFromTemplate({
          userToken: githubToken,
          templateOwner,
          templateRepo,
          newRepoName,
          userOwner,
          repoOptions,
          triggerDeploy,
        });

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to create repository from template",
          });
        }

        let project = null;
        
        // Create a project for this repository if requested
        if (createProject) {
          const projectHandle = generateRandomProjectKey();
          
          const projectData = {
            name: newRepoName,
            description: repoOptions?.description || `Created from ${templateOwner}/${templateRepo} template`,
            ownerId: user.id,
            orgId: orgId || null,
            repoUrl: `https://github.com/${result.repoFullName}`,
            status: "pending",
            githubRepo: {
              owner: userOwner,
              repoName: result.repoName,
              fullName: result.repoFullName,
            },
            settings: {
              themeId: "default",
              siteMetadata: {
                title: newRepoName,
                description: repoOptions?.description || `Created from ${templateOwner}/${templateRepo} template`,
              },
            },
            isPublic: !repoOptions?.private,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Insert the project
          const insertResult = await db.projects.insertOne(projectData);
          project = {
            ...projectData,
            _id: insertResult.insertedId.toString(),
          };
        }

        // Get template metadata if available
        const templateMetadata = getTemplateMetadata(`${templateOwner}/${templateRepo}`);

        return {
          success: true,
          repository: {
            id: result.repoId,
            name: result.repoName,
            fullName: result.repoFullName,
            url: result.repoUrl,
            cloneUrl: result.cloneUrl,
            sshUrl: result.sshUrl,
            defaultBranch: result.defaultBranch,
            createdAt: result.createdAt,
          },
          project: project,
          deployment: result.deployment,
          deploymentError: result.deploymentError,
          templateInfo: templateMetadata ? {
            name: templateMetadata.name,
            description: templateMetadata.description,
            categories: templateMetadata.categories,
            features: templateMetadata.features,
          } : null,
        };
      } catch (error) {
        console.error("Error creating repo from template:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create repository from template",
        });
      }
    }),

  // List available templates - Public endpoint to show available templates
  listTemplates: procedure
    .input(
      z.object({
        owner: z.string().min(1, "Owner is required").optional().default("repo-md"),
        type: z.enum(['org', 'user']).optional().default('org'),
        includeGithubData: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input }) => {
      try {
        const { owner, type, includeGithubData } = input;

        // Get templates from our config
        const configTemplates = owner === "repo-md" 
          ? TEMPLATES 
          : getTemplatesByOwner(owner);

        // If we need to include GitHub data, fetch it
        let githubTemplates = [];
        if (includeGithubData) {
          const systemToken = process.env.GITHUB_ACCESS_TOKEN;
          
          if (!systemToken) {
            console.warn("System GitHub token not configured, returning config templates only");
          } else {
            // List template repositories from GitHub
            const result = await listTemplateRepos({
              userToken: systemToken,
              owner,
              type,
            });

            if (result.success) {
              githubTemplates = result.templates;
            }
          }
        }

        // Merge config templates with GitHub data if available
        const enrichedTemplates = configTemplates.map(template => {
          const [templateOwner, templateRepo] = template.githubRepo.split('/');
          
          // Find matching GitHub data
          const githubData = githubTemplates.find(
            gt => gt.fullName === template.githubRepo
          );

          return {
            ...template,
            // Override with fresh GitHub data if available
            ...(githubData && {
              defaultBranch: githubData.defaultBranch,
              private: githubData.private,
              createdAt: githubData.createdAt,
              updatedAt: githubData.updatedAt,
            }),
            // Ensure we have the template owner and repo parsed
            templateOwner,
            templateRepo,
          };
        });

        return {
          success: true,
          templates: enrichedTemplates,
          source: includeGithubData && githubTemplates.length > 0 ? 'merged' : 'config',
        };
      } catch (error) {
        console.error("Error listing templates:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to list template repositories",
        });
      }
    }),

  // Create repository from AI brief - Using protectedProcedure as it creates new resources
  createFromBrief: protectedProcedure
    .input(
      z.object({
        brief: z.string().min(10, "Brief must be at least 10 characters"),
        newRepoName: z.string().min(1, "Repository name is required"),
        orgId: z.string().optional(),
        repoOptions: z.object({
          private: z.boolean().optional(),
          description: z.string().optional(),
        }).optional(),
        generationOptions: z.object({
          projectType: z.enum(['web', 'api', 'mobile', 'desktop']).optional(),
          language: z.enum(['javascript', 'typescript']).optional(),
          framework: z.string().optional(),
        }).optional(),
        createProject: z.boolean().optional().default(true),
        triggerDeploy: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { 
          brief,
          newRepoName, 
          orgId,
          repoOptions,
          generationOptions,
          createProject,
          triggerDeploy
        } = input;
        const { user } = ctx;

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found. Please connect your GitHub account.",
          });
        }

        // Determine the owner for the new repo
        let userOwner = user.githubHandle;
        
        // If orgId is provided, check if user has access to create repos in that org
        if (orgId) {
          await checkOrgAccess(orgId, user.id);
          // For GitHub orgs, we'd need to check if the user has repo creation permissions
          // For now, we'll use the user's own account
          userOwner = user.githubHandle;
        }

        if (!userOwner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "GitHub username not found for user",
          });
        }

        // Generate project files from brief
        console.log("Generating project from brief:", brief);
        const generationResult = await generateProjectFromBrief(brief, generationOptions);
        
        if (!generationResult || !generationResult.files) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate project files from brief",
          });
        }

        // Create repository and add generated files
        const github = new GitHubBulkOps(githubToken);
        const bootstrapResult = await github.bootstrapRepo(
          userOwner,
          newRepoName,
          generationResult.files,
          `Initial project setup: ${generationResult.metadata.projectName}`,
          "main"
        );

        if (!bootstrapResult.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: bootstrapResult.error || "Failed to create repository with generated files",
          });
        }

        // Wait a bit for GitHub to process the repository
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update repository settings if needed
        if (repoOptions?.description || repoOptions?.private !== undefined) {
          try {
            const octokit = new Octokit({ auth: githubToken });
            await octokit.rest.repos.update({
              owner: userOwner,
              repo: newRepoName,
              description: repoOptions.description || generationResult.metadata.brief,
              private: repoOptions.private || false,
            });
          } catch (updateError) {
            console.error("Failed to update repository settings:", updateError);
          }
        }

        let project = null;
        
        // Create a project for this repository if requested
        if (createProject) {
          const projectHandle = generateRandomProjectKey();
          
          const projectData = {
            handle: projectHandle,
            name: newRepoName,
            owner: user.id,
            orgId: orgId || null,
            githubRepo: {
              owner: userOwner,
              repoName: newRepoName,
              fullName: `${userOwner}/${newRepoName}`,
            },
            settings: {
              themeId: "default",
              siteMetadata: {
                title: generationResult.metadata.projectName,
                description: generationResult.metadata.brief,
              },
            },
            metadata: {
              generatedFromBrief: true,
              generationDate: new Date(),
              projectType: generationResult.metadata.projectType,
              language: generationResult.metadata.language,
              framework: generationResult.metadata.framework,
            },
            isPublic: !repoOptions?.private,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Insert the project
          const insertResult = await db.projects.insertOne(projectData);
          project = {
            ...projectData,
            _id: insertResult.insertedId.toString(),
          };
        }

        // Trigger deployment if requested
        let deployment = null;
        let deploymentError = null;
        
        if (triggerDeploy) {
          try {
            const deployResult = await triggerRepoDeploy({
              repoFullName: `${userOwner}/${newRepoName}`,
              branch: "main",
              userToken: githubToken,
            });
            deployment = deployResult;
          } catch (deployError) {
            console.error("Deployment trigger failed:", deployError);
            deploymentError = deployError.message;
          }
        }

        return {
          success: true,
          repository: {
            name: newRepoName,
            fullName: `${userOwner}/${newRepoName}`,
            url: `https://github.com/${userOwner}/${newRepoName}`,
            cloneUrl: `https://github.com/${userOwner}/${newRepoName}.git`,
            sshUrl: `git@github.com:${userOwner}/${newRepoName}.git`,
            defaultBranch: "main",
          },
          project: project,
          generation: {
            brief: generationResult.metadata.brief,
            projectType: generationResult.metadata.projectType,
            language: generationResult.metadata.language,
            framework: generationResult.metadata.framework,
            fileCount: generationResult.metadata.fileCount,
            generatedAt: generationResult.metadata.generatedAt,
            prompt: generationResult.prompt,
          },
          deployment: deployment,
          deploymentError: deploymentError,
        };
      } catch (error) {
        console.error("Error creating repo from brief:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create repository from brief",
        });
      }
    }),

  // Create repository from AI prompt - Using protectedProcedure as it creates new resources
  createRepoFromPrompt: protectedProcedure
    .input(
      z.object({
        prompt: z.string(),
        newRepoName: z.string().min(1, "Repository name is required"),
        orgId: z.string().optional(),
        repoOptions: z.object({
          private: z.boolean().optional().default(false),
          description: z.string().optional(),
        }).optional(),
        agentOptions: z.object({
          simulate: z.boolean().optional().default(false),
          verbose: z.boolean().optional().default(true),
        }).optional(),
        createProject: z.boolean().optional().default(true),
        triggerDeploy: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { 
          prompt,
          newRepoName, 
          orgId,
          repoOptions = {},
          agentOptions = {},
          createProject,
          triggerDeploy
        } = input;
        const { user } = ctx;

        console.log("🚀 Creating repository from prompt...");
        console.log(`📝 Prompt: "${prompt}"`);
        console.log(`📁 Target repo: ${newRepoName}`);
        console.log(`👤 User: ${user.id} (${user.email})`);
        console.log(`🔧 Options:`, { repoOptions, agentOptions, createProject, triggerDeploy });

        // Validate prompt
        if (!prompt || prompt.trim().length < 5) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Please provide a more detailed description of what you want to build (at least 5 characters)",
          });
        }

        // Get the user's GitHub token
        const githubToken = await getUserGithubToken(user.id);
        
        if (!githubToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No GitHub access token found. Please connect your GitHub account.",
          });
        }

        // Determine the owner for the new repo
        let userOwner = user.githubHandle;
        
        // If orgId is provided, check if user has access to create repos in that org
        if (orgId) {
          await checkOrgAccess(orgId, user.id);
          // For GitHub orgs, we'd need to check if the user has repo creation permissions
          // For now, we'll use the user's own account
          userOwner = user.githubHandle;
        }

        if (!userOwner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "GitHub username not found for user",
          });
        }

        console.log(`🎯 Creating repo for GitHub user: ${userOwner}`);

        // Initialize the repo generator agent
        const agent = new RepoGeneratorAgent(
          process.env.OPENAI_API_KEY,
          githubToken
        );

        // Generate repository from prompt
        const generationResult = await agent.generateRepoFromPrompt(
          prompt,
          userOwner,
          newRepoName,
          {
            branch: "main",
            simulate: agentOptions.simulate || false,
            verbose: agentOptions.verbose !== false,
            repoOptions: {
              private: repoOptions.private || false,
              description: repoOptions.description || `Generated from prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`
            }
          }
        );

        if (!generationResult.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: generationResult.error || "Failed to generate repository from prompt",
          });
        }

        console.log("✅ Repository generation completed");
        console.log(`📊 Result:`, {
          simulation: generationResult.simulation,
          projectType: generationResult.data?.projectType,
          fileCount: generationResult.data?.fileCount,
        });

        // If simulation mode, return early
        if (generationResult.simulation) {
          return {
            success: true,
            simulation: true,
            data: generationResult.data,
            message: "Repository generation simulated successfully",
          };
        }

        // Wait a bit for GitHub to process the repository
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update repository settings if needed
        if (repoOptions.description || repoOptions.private !== undefined) {
          try {
            console.log("🔧 Updating repository settings...");
            const octokit = new Octokit({ auth: githubToken });
            await octokit.rest.repos.update({
              owner: userOwner,
              repo: newRepoName,
              description: repoOptions.description || generationResult.data.description,
              private: repoOptions.private,
            });
            console.log("✅ Repository settings updated");
          } catch (updateError) {
            console.error("⚠️ Failed to update repository settings:", updateError);
          }
        }

        let project = null;
        
        // Create a project for this repository if requested
        if (createProject) {
          console.log("📋 Creating project record...");
          const projectHandle = generateRandomProjectKey();
          const repoData = generationResult.data.repository;
          
          const repoFullName = repoData?.fullName || `${userOwner}/${newRepoName}`;
          const repoUrl = repoData?.url || `https://github.com/${repoFullName}`;
          
          const projectData = {
            name: newRepoName,
            slug: projectHandle, // Use slug instead of handle
            description: generationResult.data.description,
            ownerId: user.id, // Use ownerId instead of owner
            orgId: orgId || null,
            visibility: repoOptions.private ? 'private' : 'public',
            status: "pending", // Required for project lifecycle
            collaborators: [], // Required field
            created_at: new Date(), // Use created_at instead of createdAt
            updated_at: new Date(), // Use updated_at instead of updatedAt
            repoUrl: repoUrl, // Required for deployment system
            githubRepo: {
              owner: userOwner,
              repoName: newRepoName,
              fullName: repoFullName,
              repoId: repoData?.id,
            },
            settings: {
              themeId: "default",
              siteMetadata: {
                title: newRepoName,
                description: generationResult.data.description,
              },
            },
            metadata: {
              generatedFromPrompt: true,
              generationDate: new Date(),
              projectType: generationResult.data.projectType,
              originalPrompt: prompt,
              aiGenerated: true,
            },
          };

          // Insert the project
          const insertResult = await db.projects.insertOne(projectData);
          project = {
            ...projectData,
            _id: insertResult.insertedId.toString(),
          };

          console.log(`✅ Project created with ID: ${project._id}`);
        }

        // Trigger deployment if requested
        let deployment = null;
        let deploymentError = null;
        
        if (triggerDeploy) {
          try {
            console.log("🚀 Triggering deployment...");
            const deployResult = await triggerRepoDeploy({
              repoFullName: `${userOwner}/${newRepoName}`,
              branch: "main",
              userToken: githubToken,
            });
            deployment = deployResult;
            console.log("✅ Deployment triggered successfully");
          } catch (deployError) {
            console.error("❌ Deployment trigger failed:", deployError);
            deploymentError = deployError.message;
          }
        }

        return {
          success: true,
          repository: generationResult.data.repository || {
            name: newRepoName,
            fullName: `${userOwner}/${newRepoName}`,
            url: `https://github.com/${userOwner}/${newRepoName}`,
            cloneUrl: `https://github.com/${userOwner}/${newRepoName}.git`,
            sshUrl: `git@github.com:${userOwner}/${newRepoName}.git`,
            defaultBranch: "main",
          },
          project: project,
          generation: {
            prompt: prompt,
            projectType: generationResult.data.projectType,
            description: generationResult.data.description,
            fileCount: generationResult.data.fileCount,
            files: generationResult.data.files,
            generatedAt: new Date(),
            commitSha: generationResult.data.commitSha,
            commitUrl: generationResult.data.commitUrl,
          },
          deployment: deployment,
          deploymentError: deploymentError,
        };
      } catch (error) {
        console.error("💥 Error creating repo from prompt:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create repository from prompt",
        });
      }
    }),
};

// Export the router with all project routes
export const projectRouter = router({
  list: projectRoutes.listProjects,
  get: projectRoutes.getProject,
  getProjectByHandle: projectRoutes.getProjectByHandle,
  create: projectRoutes.createProject,
  update: projectRoutes.updateProject,
  addCollaborator: projectRoutes.addCollaborator,
  removeCollaborator: projectRoutes.removeCollaborator,
  linkGitHubRepo: projectRoutes.linkGitHubRepo,
  delete: projectRoutes.deleteProject,
  // Add new public methods
  getSettings: projectRoutes.getProjectSettings,
  updateSettings: projectRoutes.updateProjectSettings,
  getPublicDetails: projectRoutes.getPublicProjectDetails,
  getActiveRev: projectRoutes.getActiveRev,
  listRevisions: projectRoutes.listRevisions,
  setActiveRevision: projectRoutes.setActiveRevision,
  // GitHub integration
  getGitHubFileContent: projectRoutes.getGitHubFileContent,
  updateGitHubFile: projectRoutes.updateGitHubFile,
  uploadGitHubImage: projectRoutes.uploadGitHubImage,
  listGitHubDirectory: projectRoutes.listGitHubDirectory,
  // Branch and PR operations
  listGitHubBranches: projectRoutes.listGitHubBranches,
  createGitHubBranch: projectRoutes.createGitHubBranch,
  deleteGitHubBranch: projectRoutes.deleteGitHubBranch,
  listGitHubPullRequests: projectRoutes.listGitHubPullRequests,
  getGitHubPullRequest: projectRoutes.getGitHubPullRequest,
  createGitHubPullRequest: projectRoutes.createGitHubPullRequest,
  updateGitHubPullRequest: projectRoutes.updateGitHubPullRequest,
  mergeGitHubPullRequest: projectRoutes.mergeGitHubPullRequest,
  getGitHubPullRequestCommits: projectRoutes.getGitHubPullRequestCommits,
  checkGitHubPullRequestMergeability: projectRoutes.checkGitHubPullRequestMergeability,
  // File operations extended
  deleteGitHubFile: projectRoutes.deleteGitHubFile,
  getGitHubFileHistory: projectRoutes.getGitHubFileHistory,
  // Repository info
  getGitHubRepository: projectRoutes.getGitHubRepository,
  // Workflows
  workflowCreateBranchWithPR: projectRoutes.workflowCreateBranchWithPR,
  workflowUpdateFileWithPR: projectRoutes.workflowUpdateFileWithPR,
  workflowFeatureBranch: projectRoutes.workflowFeatureBranch,
  // Template operations
  createFromTemplate: projectRoutes.createFromTemplate,
  listTemplates: projectRoutes.listTemplates,
  createFromBrief: projectRoutes.createFromBrief,
  createRepoFromPrompt: projectRoutes.createRepoFromPrompt,
});