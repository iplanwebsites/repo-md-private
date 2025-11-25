import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, procedure } from "../lib/trpc/trpc.js";
import { protectedProcedure } from "../lib/trpc/procedures.js";
import {
  listJobs,
  getJob,
  JobStatus,
  updateJob,
  RepoCloneJobInputSchema,
  RepoImportJobInputSchema,
} from "../lib/cloudrun/jobModel.js";
import cloudRunService from "../lib/cloudRun.js";
import { db } from "../db.js";
import { ObjectId } from "mongodb";

const API_BASE_URL = process.env.API_BASE_URL || "https://api.repo.md";
/**
 * Creates a project in the database and links it to a job
 */
const createProject = async (projectData, jobId, userId) => {
  const repoUrl = `https://github.com/${projectData.gitScope}/${projectData.name}`;

  // Check if a project with the same repository URL already exists
  const existingProject = await db.projects.findOne({ repoUrl });

  if (existingProject) {
    console.log("Project with repo URL already exists:", repoUrl);

    // Update the existing project with the new job ID
    await db.projects.updateOne(
      { _id: existingProject._id },
      {
        $set: {
          jobId,
          updatedAt: new Date(),
        },
      }
    );

    // Update the job with the existing project ID
    await updateJob(jobId, { projectId: existingProject._id.toString() });

    console.log("Updated existing project and linked to job");

    return {
      id: existingProject._id.toString(),
      name: existingProject.name,
      description: existingProject.description,
    };
  }

  // Create a new project without manually assigning _id
  const project = {
    name: projectData.name,
    description: projectData.description,
    ownerId: userId,
    orgId: projectData.gitScope,
    repoUrl,
    sourceRepo: projectData.sourceRepo,
    templateId: projectData.templateId,
    templateRepoUrl: projectData.templateId
      ? projectData.sourceRepo?.url
      : undefined,
    jobId,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log("Creating project entry:", project);

  // Insert the project into the database (MongoDB will generate _id)
  const result = await db.projects.insertOne(project);

  // Update the job with the project ID
  await updateJob(jobId, { projectId: result.insertedId.toString() });

  console.log("Project created and linked to job");

  return {
    id: result.insertedId.toString(),
    name: project.name,
    description: project.description,
  };
};

const cloudRunRoutes = {
  // Submit a job to deploy a repository
  createRepoDeployJob: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        commit: z.string().optional(),
        branch: z.string().optional().default("main"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log("Deploy repository request received:", {
        userId: ctx.user.id,
        projectId: input.projectId,
        commit: input.commit,
        branch: input.branch,
      });

      try {
        const { projectId, commit, branch } = input;

        // Use the centralized method in cloudRunService
        const result = await cloudRunService.createRepoDeployJob(
          projectId,
          ctx,
          commit,
          branch
        );

        return result;
      } catch (error) {
        console.error("Error creating repo deploy job:", {
          error: error.message,
          stack: error.stack,
          projectId: input.projectId,
        });

        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create repository deploy job",
          cause: error,
        });
      }
    }),

  // Submit a job to import a GitHub repository directly
  importGitHubRepo: protectedProcedure
    .input(RepoImportJobInputSchema)
    .mutation(async ({ input, ctx }) => {
      console.log("Import GitHub repository request received:", {
        userId: ctx.user.id,
        input: {
          ...input,
          // Don't log sensitive data in production
          repoUrl: input.repoUrl,
          branch: input.branch,
          isPrivate: input.isPrivate,
        },
      });

      try {
        const userId = ctx.user.id;

        // Validate input data
        if (!input.sourceUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing required field: sourceUrl",
          });
        }

        if (!input.projectName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "New projectName   is required",
          });
        }

        // Submit the job to import the repository
        const job = await cloudRunService.submitRepoImportJob(
          {
            ...input,
            // Add any additional properties needed by the worker
          },
          userId
        );

        console.log("Import job created successfully:", {
          jobId: job.jobId,
          status: job.status,
          projectId: job.projectId,
        });

        // Create a project entry in the database using the dedicated function
        const projectData = {
          name: input.projectName,
          description: input.description || `Imported from ${input.repoUrl}`,
          gitScope: input.gitScope,
          sourceRepo: {
            url: input.repoUrl,
            branch: input.branch,
          },
        };

        const project = await createProject(projectData, job.jobId, userId);

        // Set project ID for the job in the response
        job.projectId = project.id;

        return {
          success: true,
          job: {
            ...job,
            projectId: project.id,
          },
          project,
          org: {
            id: input.gitScope,
            handle: input.gitScope,
          },
          dashboardUrl: `/${input.orgId}/${input.projectName}`,
          message: `Repository import job created for ${input.repoUrl}`,
        };
      } catch (error) {
        console.error("Error creating repo import job:", {
          error: error.message,
          stack: error.stack,
          input: {
            repoUrl: input.repoUrl,
            newRepoName: input.newRepoName,
            gitScope: input.gitScope,
          },
        });

        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create repository import job",
          cause: error,
        });
      }
    }),

  // Submit a job to clone a repository
  cloneRepository: protectedProcedure
    .input(RepoCloneJobInputSchema)
    .mutation(async ({ input, ctx }) => {
      console.log("Clone repository request received:", {
        userId: ctx.user.id,
        input: {
          ...input,
          // Don't log sensitive data in production
          branch: input.branch,
          isPrivate: input.isPrivate,
        },
      });

      try {
        const userId = ctx.user.id;

        // Validate input data
        if (!input.owner || !input.repoName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing required fields: owner and repoName",
          });
        }

        if (!input.newRepoName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "New repository name is required",
          });
        }

        if (!input.gitScope) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Git scope is required",
          });
        }

        // Add metadata for the job
        const jobMetadata = {
          sourceType: input.templateId ? "template" : "repository",
          templateId: input.templateId,
          originalOwner: input.owner,
          originalRepo: input.repoName,
          gitScope: input.gitScope,
          description: input.description,
        };

        console.log("Creating job with metadata:", jobMetadata);

        // Submit the job with additional metadata
        const job = await cloudRunService.submitRepoCloneJob(
          {
            ...input,
            metadata: jobMetadata,
            // Add any additional properties needed by the worker
          },
          userId
        );

        console.log("Job created successfully:", {
          jobId: job.jobId,
          status: job.status,
          projectId: job.projectId,
        });

        // Create a project entry in the database using the dedicated function
        const projectData = {
          name: input.newRepoName,
          description:
            input.description || `Cloned from ${input.owner}/${input.repoName}`,
          gitScope: input.gitScope,
          sourceRepo: {
            owner: input.owner,
            name: input.repoName,
            branch: input.branch,
          },
          templateId: input.templateId,
        };

        const project = await createProject(projectData, job.jobId, userId);

        // Set project ID for the job in the response
        job.projectId = project.id;

        return {
          success: true,
          job: {
            ...job,
            projectId: project.id,
          },
          project,
          org: {
            id: input.gitScope,
            handle: input.gitScope,
          },
          dashboardUrl: `${input.gitScope}/${input.newRepoName}`,
          message: `Repository clone job created for ${input.owner}/${input.repoName}`,
        };
      } catch (error) {
        console.error("Error creating repo clone job:", {
          error: error.message,
          stack: error.stack,
          input: {
            owner: input.owner,
            repoName: input.repoName,
            newRepoName: input.newRepoName,
            gitScope: input.gitScope,
          },
        });

        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create repository clone job",
          cause: error,
        });
      }
    }),

  // ... rest of the routes remain the same ...
  listJobs: protectedProcedure
    .input(
      z.object({
        type: z.string().optional(),
        status: z.string().optional(),
        projectId: z.string().optional(),
        projectHandle: z.string().optional(),
        orgId: z.string().optional(),
        limit: z.number().optional().default(50),
        page: z.number().optional().default(1),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const userId = ctx.user.id;
        const { type, status, projectId, limit, page, projectHandle, orgId } =
          input;

        const filter = { userId };
        if (type) filter.type = type;
        if (status) filter.status = status;
        if (projectId) filter.projectId = projectId;

        const options = {
          sort: { createdAt: -1 },
          limit,
          skip: (page - 1) * limit,
        };

        const jobs = await listJobs(filter, options);
        const total = await db.jobs.countDocuments(filter);

        return {
          success: true,
          jobs,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        console.error("Error listing jobs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to list jobs",
        });
      }
    }),

  getJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const userId = ctx.user.id;
        const { jobId } = input;

        console.log("+-+-+-+-+-+-+- getting job:", jobId);

        const job = await getJob(jobId);

        if (!job || job.userId !== userId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found",
          });
        }
        return job;
        /*
        return {
          success: true,
          job,
        };*/
      } catch (error) {
        console.error(`Error getting job ${input.jobId}:`, error);

        if (error.code === "NOT_FOUND") {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get job",
        });
      }
    }),

  listProjects: protectedProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional().default(50),
        page: z.number().optional().default(1),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const userId = ctx.user.id;
        const { orgId, search, limit, page } = input;

        const filter = {
          $or: [{ ownerId: userId }, { "collaborators.userId": userId }],
        };

        if (orgId) {
          filter.orgId = orgId;
        }

        if (search) {
          filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ];
        }

        const options = {
          sort: { updatedAt: -1 },
          limit,
          skip: (page - 1) * limit,
        };

        const projects = await db.projects.find(filter, options).toArray();
        const total = await db.projects.countDocuments(filter);

        return {
          success: true,
          projects,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        console.error("Error listing projects:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to list projects",
        });
      }
    }),

  getProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const userId = ctx.user.id;
        const { projectId } = input;

        const project = await db.projects.findOne({
          _id: new ObjectId(projectId),
          $or: [{ ownerId: userId }, { "collaborators.userId": userId }],
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        return {
          success: true,
          project,
        };
      } catch (error) {
        console.error(`Error getting project ${input.projectId}:`, error);

        if (error.code === "NOT_FOUND") {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get project",
        });
      }
    }),
};

// Export the router with all CloudRun routes
const cloudRunRouter = router({
  createRepoDeployJob: cloudRunRoutes.createRepoDeployJob,
  importGitHubRepo: cloudRunRoutes.importGitHubRepo,
  cloneRepository: cloudRunRoutes.cloneRepository,
  listJobs: cloudRunRoutes.listJobs,
  getJob: cloudRunRoutes.getJob,
  getJobStatus: cloudRunRoutes.getJob, // Alias for getJob to match expected route name
  listProjects: cloudRunRoutes.listProjects,
  getProject: cloudRunRoutes.getProject,
});

export { cloudRunRouter };
