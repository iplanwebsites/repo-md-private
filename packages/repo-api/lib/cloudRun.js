/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { JobsClient } from "@google-cloud/run";
import { v4 as uuidv4 } from "uuid";
import { createJob as createJobRecord, JobType } from "./cloudrun/jobModel.js";
import { db } from "../db.js";
import axios from "axios";
import { ObjectId } from "mongodb";
import outgoingWebhookDispatcher from "./webhooks/OutgoingWebhookDispatcher.js";
import deploymentNotifier from "./slack/deploymentNotifier.js";

// Debug flag for detailed worker interaction logging
const DEBUG = process.env.DEBUG_CLOUDRUN === "true" || true;

// Toggle between dev and prod cloud run environment based on flag
const useDevWorker = process.env.USE_DEV_CLOUDRUN_WORKER === "true";

const API_BASE_URL = process.env.API_BASE_URL || "https://api.repo.md";
const BACKEND_URL = process.env.BACKEND_URL || "https://api.repo.md";
// Use environment variables based on development/production mode
const projectId = useDevWorker
  ? process.env.GOOGLE_CLOUD_PROJECT_DEV
  : process.env.GOOGLE_CLOUD_PROJECT;
const location = useDevWorker
  ? process.env.GOOGLE_CLOUD_REGION_DEV ||
    process.env.GOOGLE_CLOUD_REGION ||
    "us-central1"
  : process.env.GOOGLE_CLOUD_REGION || "us-central1";
const baseUrl = useDevWorker
  ? process.env.BACKEND_URL_DEV || BACKEND_URL
  : BACKEND_URL;

// Worker API base URL (from environment variables)

const PROD_REPO_WORKER_API_URL = "https://build-worker1.repo.md";

/**
 * Get the worker API URL based on environment configuration
 * @returns {string} Worker API URL
 */
export const getWorkerUrl = () => {
  const useDevWorker = process.env.USE_DEV_CLOUDRUN_WORKER === "true";

  return useDevWorker
    ? process.env.WORKER_LOCALHOST_DEV_URL ||
        process.env.REPO_WORKER_API_URL ||
        PROD_REPO_WORKER_API_URL
    : PROD_REPO_WORKER_API_URL;
};

const workerApiUrl = getWorkerUrl();

/**
 * Creates and runs a repo worker job
 * @param {string} task - The task identifier
 * @param {Object} data - Data to be passed to the worker
 * @returns {Object} The created job record
 */
async function createJob(task, data) {
  if (DEBUG)
    console.log(
      `🚀 Creating ${task} job with data:`,
      JSON.stringify(data, null, 2)
    );

  // Create a job record in the database
  const jobRecord = await createJobRecord({
    userId: data.userId,
    type: mapTaskToJobType(task),
    input: data,
    projectId: data.projectId,
  });

  if (DEBUG) console.log(`📝 Job record created: ${jobRecord._id.toString()}`);

  // Add type property to jobRecord for consistency with front-end expectations
  jobRecord.type = mapTaskToJobType(task);

  // For development, simulate the job if worker URL is not configured and DEBUG is false
  if (process.env.NODE_ENV !== "production" && !workerApiUrl && !DEBUG) {
    console.log("Worker API URL not configured, simulating job execution");
    simulateJobExecution(jobRecord);
    return jobRecord;
  }

  // Generate callback URL
  const callbackUrl = `${baseUrl}/api/cloudrun/callback`;

  if (DEBUG) {
    console.log(`📞 Callback URL: ${callbackUrl}`);
    console.log(
      `🏗️ Worker API URL: ${
        workerApiUrl || "Not configured - would normally simulate"
      }`
    );
  }

  console.log(
    `[${useDevWorker ? "DEV_WORKER" : "PROD_WORKER"}] Running ${task} job`
  );

  // With DEBUG enabled, always try to call worker API even if not configured
  if (workerApiUrl || DEBUG) {
    try {
      // Create worker request payload based on API documentation
      const workerPayload = {
        jobId: jobRecord._id.toString(),
        task: mapTaskToWorkerTask(task, data),
        callbackUrl,
        data: processDataForWorker(task, data),
      };

      if (DEBUG) {
        console.log(
          `📦 Full worker payload:`,
          JSON.stringify(workerPayload, null, 2)
        );
      } else {
        console.log(`Sending request to worker API: ${workerApiUrl}/process`, {
          jobId: workerPayload.jobId,
          task: workerPayload.task,
        });
      }

      // Determine worker API URL, fallback to localhost for debugging
      const apiUrl = workerApiUrl || "http://localhost:3001";

      if (DEBUG) console.log(`🔗 Sending request to: ${apiUrl}/process`);

      // Build request headers with authentication
      const headers = {
        'Content-Type': 'application/json',
      };

      // Add WORKER_SECRET authentication if configured
      const workerSecret = process.env.WORKER_SECRET;
      if (workerSecret) {
        headers['Authorization'] = `Bearer ${workerSecret}`;
        if (DEBUG) console.log(`🔐 Using WORKER_SECRET authentication`);
      } else if (DEBUG) {
        console.log(`⚠️ WORKER_SECRET not configured - request may be rejected`);
      }

      // Call the worker API
      const response = await axios.post(`${apiUrl}/process`, workerPayload, {
        headers,
      });

      if (DEBUG) {
        console.log(
          `✅ Worker API response:`,
          JSON.stringify(response.data, null, 2)
        );
      } else {
        console.log("Worker API response:", response.data);
      }

      // Update job with "running" status since worker accepted the job
      await db.jobs.updateOne(
        { _id: jobRecord._id },
        {
          $set: {
            status: "running",
            updatedAt: new Date(),
          },
          $push: {
            logs: `Job accepted by worker at ${new Date().toISOString()}`,
          },
        }
      );

      if (DEBUG) console.log(`🔄 Job status updated to running`);

      // Dispatch deployment started webhook for deploy jobs
      if (data.projectId && task === "deploy-repo") {
        await outgoingWebhookDispatcher.dispatch(
          data.projectId,
          "deployment.started",
          {
            projectId: data.projectId,
            jobId: jobRecord._id.toString(),
            branch: data.branch || "main",
            commit: data.commit || null,
            startedAt: new Date(),
            metadata: data,
          }
        );
        
        // Send Slack notification for deployment started
        try {
          const deploymentNotifier = await import("./slack/deploymentNotifier.js");
          await deploymentNotifier.default.notifyDeploymentStarted({
            projectId: data.projectId,
            jobId: jobRecord._id.toString(),
            branch: data.branch || "main",
            triggeredBy: data.userId,
            commitId: data.commit,
            commitMessage: data.commitMessage
          });
          console.log("📱 Slack deployment started notification sent");
        } catch (error) {
          console.error("Failed to send Slack deployment notification:", error);
          // Don't fail the deployment if Slack notification fails
        }
      }

      return jobRecord;
    } catch (error) {
      if (DEBUG) {
        console.error("❌ Error calling worker API:", error);
        console.error(`Error message: ${error.message}`);
        console.error(`Error code: ${error.code}`);
        if (error.response) {
          console.error(`Response status: ${error.response.status}`);
          console.error(`Response data:`, error.response.data);
        }
      } else {
        console.error("Error calling worker API:", error);
      }

      // Mark job as failed in case of API error
      await db.jobs.updateOne(
        { _id: jobRecord._id },
        {
          $set: {
            status: "failed",
            updatedAt: new Date(),
            completedAt: new Date(),
            error: error.message || "Failed to start worker process",
          },
          $push: { logs: `Failed to start worker: ${error.message}` },
        }
      );

      if (DEBUG) console.log(`❌ Job status updated to failed`);

      throw error;
    }
  } else {
    // Fall back to Cloud Run if worker API is not available
    if (DEBUG) console.log(`🔄 Falling back to legacy Cloud Run job execution`);
    return runLegacyCloudRunJob(jobRecord, task, data, callbackUrl);
  }
}

/**
 * Map task type to worker task format
 * @param {string} task - Internal task type
 * @param {Object} data - Job data
 * @returns {string} Worker task type
 */
function mapTaskToWorkerTask(task, data) {
  const taskMap = {
    "clone-repo": "acquire-user-repo",
    "import-repo": "process-with-repo",
    "deploy-repo": "deploy-repo",
  };

  return taskMap[task] || task;
}

/**
 * Process data for the worker API based on task type
 * @param {string} task - Task type
 * @param {Object} data - Original data
 * @returns {Object} Processed data for worker
 */
function processDataForWorker(task, data) {
  // Base required fields
  const workerData = {
    userId: data.userId,
  };

  // Add task-specific data
  if (task === "clone-repo") {
    workerData.repoUrl = `https://github.com/${data.owner}/${data.repoName}`;
    workerData.branch = data.branch || "main";
    workerData.gitToken = data.gitToken;
    workerData.depth = 1;
  } else if (task === "import-repo") {
    workerData.repoUrl = data.sourceUrl;
    workerData.branch = data.branch || "main";
    workerData.gitToken = data.gitToken;
  } else if (task === "deploy-repo") {
    workerData.projectId = data.projectId;
    workerData.commit = data.commit || "latest";
    workerData.branch = data.branch || "main";
    workerData.gitToken = data.gitToken;

    // Formatting settings for media/link paths (from project.formatting)
    workerData.notePrefix = data.notePrefix || "";
    workerData.mediaPrefix = data.mediaPrefix || "/_repo/medias";
    workerData.domain = data.domain || ""; // Domain for absolute URLs (e.g., https://static.repo.md/org/project)

    // Add project slug, org slug, and org ID if available
    if (data.projectSlug) {
      workerData.projectSlug = data.projectSlug;
    }
    if (data.orgSlug) {
      workerData.orgSlug = data.orgSlug;
    }
    if (data.orgId) {
      workerData.orgId = data.orgId;
    }

    // Build settings - repositoryFolder and ignoreFiles
    if (data.repositoryFolder) {
      workerData.repositoryFolder = data.repositoryFolder;
    }
    if (data.ignoreFiles) {
      workerData.ignoreFiles = data.ignoreFiles;
    }

    // Ensure repoUrl is included in worker data
    if (data.repoUrl) {
      workerData.repoUrl = data.repoUrl;
    } else {
      console.warn(
        `⚠️ No repoUrl found in data for deploy-repo task. This may cause issues with the worker.`
      );
      console.log(`  Data:`, data);
    }
  }

  return workerData;
}

/**
 * Fall back to legacy Cloud Run job execution
 * @param {Object} jobRecord - Job record
 * @param {string} task - Task type
 * @param {Object} data - Job data
 * @param {string} callbackUrl - Callback URL
 * @returns {Object} Job record
 */
async function runLegacyCloudRunJob(jobRecord, task, data, callbackUrl) {
  const client = new JobsClient();

  // In production, run the CloudRun job
  const workerJobName = useDevWorker ? "worker-job-dev" : "worker-job";

  if (DEBUG) {
    console.log(`🏭 [LEGACY_MODE] Running ${task} job with details:`);
    console.log(`  📋 Project ID: ${projectId}`);
    console.log(`  🔧 Location: ${location}`);
    console.log(`  🏷️ Worker Job Name: ${workerJobName}`);
    console.log(`  🆔 Job ID: ${jobRecord._id.toString()}`);
  } else {
    console.log(`[LEGACY_MODE] Running ${task} job in project: ${projectId}`);
  }

  try {
    const [operation] = await client.runJob({
      name: `projects/${projectId}/locations/${location}/jobs/${workerJobName}`,
      overrides: {
        containerOverrides: [
          {
            env: [
              { name: "JOB_ID", value: jobRecord._id.toString() },
              { name: "TASK", value: task },
              { name: "DATA", value: JSON.stringify(data) },
              { name: "CALLBACK_URL", value: callbackUrl },
            ],
          },
        ],
      },
    });

    if (DEBUG)
      console.log(`✅ Legacy Cloud Run job operation started successfully`);

    return jobRecord;
  } catch (error) {
    if (DEBUG) {
      console.error(`❌ Error starting legacy Cloud Run job:`);
      console.error(`  Error message: ${error.message}`);
      console.error(`  Error details:`, error);
    }
    throw error;
  }
}

/**
 * Maps a task string to a JobType
 * @param {string} task - The task string
 * @returns {string} The JobType
 */
function mapTaskToJobType(task) {
  const taskMap = {
    "clone-repo": JobType.REPO_CLONE,
    "import-repo": JobType.REPO_IMPORT,
    "deploy-repo": JobType.REPO_DEPLOY,
    // Add more task mappings as needed
  };

  return taskMap[task] || task;
}

/**
 * Generates a unique job ID
 * @returns {string} Unique job ID
 */
function generateJobId() {
  return uuidv4();
}

/**
 * Submit a repo clone job
 * @param {Object} repoData - Repository data
 * @param {string} userId - User ID
 * @returns {Object} Created job
 */
async function submitRepoCloneJob(repoData, userId) {
  // Create a project for the repository
  const projectId = await createProjectForRepo(repoData, userId);

  // Create and run the job
  return createJob("clone-repo", {
    ...repoData,
    userId,
    projectId,
  });
}

/**
 * Create a project for a repository
 * @param {Object} repoData - Repository data
 * @param {string} userId - User ID
 * @returns {string} Created project ID
 */
async function createProjectForRepo(repoData, userId) {
  try {
    const {
      orgId,
      repoName,
      owner,
      projectName,
      projectSlug,
      projectDescription,
      visibility,
    } = repoData;

    // Generate a slug if not provided
    const slug =
      projectSlug || repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");

    // Create project document
    const project = {
      name: projectName || repoName,
      slug,
      description:
        projectDescription || `Cloned from GitHub: ${owner}/${repoName}`,
      visibility: visibility || "private",
      ownerId: userId,
      orgId,
      collaborators: [
        {
          userId,
          role: "admin",
          addedAt: new Date(),
        },
      ],
      github: {
        repoName,
        owner,
        fullName: `${owner}/${repoName}`,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert project into the database
    const result = await db.projects.insertOne(project);
    return result.insertedId.toString();
  } catch (error) {
    console.error("Error creating project for repo clone:", error);
    throw error;
  }
}

/**
 * Simulate job execution for development purposes
 * @param {Object} job - Job to simulate
 */
async function simulateJobExecution(job) {
  if (DEBUG) {
    console.log(`🎭 SIMULATING job execution:`);
    console.log(`  📊 Job Type: ${job.type}`);
    console.log(`  🆔 Job ID: ${job._id}`);
  } else {
    console.log(
      `[${
        useDevWorker ? "DEV_WORKER" : "PROD_WORKER"
      }] Simulating execution of ${job.type} job: ${job._id}`
    );
  }

  // Update job status to running
  await db.jobs.updateOne(
    { _id: job._id },
    {
      $set: {
        status: "running",
        updatedAt: new Date(),
      },
      $push: { logs: `Job started at ${new Date().toISOString()}` },
    }
  );

  if (DEBUG)
    console.log(`⏳ Job status updated to running, starting simulation timer`);

  // Simulate async job execution
  setTimeout(async () => {
    try {
      if (DEBUG)
        console.log(`🏃 Simulating job processing for type: ${job.type}`);

      if (job.type === JobType.REPO_CLONE) {
        await simulateRepoClone(job);
      } else if (job.type === JobType.REPO_IMPORT) {
        await simulateRepoImport(job);
      } else if (job.type === JobType.REPO_DEPLOY) {
        await simulateRepoDeploy(job);
      }

      if (DEBUG)
        console.log(`🏁 Simulation complete, updating job status to completed`);

      // Complete the job
      await db.jobs.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "completed",
            updatedAt: new Date(),
            completedAt: new Date(),
            output: {
              success: true,
              // Set type-specific output data
              ...(job.type === JobType.REPO_CLONE ? { cloned: true } : {}),
              ...(job.type === JobType.REPO_IMPORT ? { imported: true } : {}),
              ...(job.type === JobType.REPO_DEPLOY ? { deployed: true } : {}),
            },
          },
          $push: {
            logs: `Job completed successfully at ${new Date().toISOString()}`,
          },
        }
      );

      if (DEBUG) {
        console.log(`✅ Simulated job ${job._id} completed successfully`);
      } else {
        console.log(
          `[${useDevWorker ? "DEV_WORKER" : "PROD_WORKER"}] Simulated job ${
            job._id
          } completed successfully`
        );
      }
    } catch (error) {
      // Mark job as failed
      await db.jobs.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "failed",
            updatedAt: new Date(),
            completedAt: new Date(),
            error: error.message || String(error),
          },
          $push: {
            logs: `Job failed at ${new Date().toISOString()}: ${error.message}`,
          },
        }
      );

      if (DEBUG) {
        console.error(`❌ Simulated job ${job._id} failed:`);
        console.error(`  Error message: ${error.message}`);
      } else {
        console.error(
          `[${useDevWorker ? "DEV_WORKER" : "PROD_WORKER"}] Simulated job ${
            job._id
          } failed:`,
          error
        );
      }
    }
  }, 5000); // Simulate 5-second job execution
}

/**
 * Submit a repo import job
 * @param {Object} repoData - Repository data
 * @param {string} userId - User ID
 * @returns {Object} Created job
 */
async function submitRepoImportJob(repoData, userId) {
  // Extract owner and repo name from the repository URL
  const repoUrl = repoData.sourceUrl.trim();
  let owner, repoName;

  // Parse GitHub URL to extract owner and repo name
  if (repoUrl.includes("github.com")) {
    const urlParts = repoUrl.split("/");
    const githubIndex = urlParts.findIndex((part) =>
      part.includes("github.com")
    );

    if (githubIndex !== -1 && urlParts.length >= githubIndex + 3) {
      owner = urlParts[githubIndex + 1];
      repoName = urlParts[githubIndex + 2].replace(".git", "");
    }
  }

  if (!owner || !repoName) {
    throw new Error(
      "Invalid GitHub repository URL. Could not extract owner and repository name."
    );
  }

  // Create a project for the repository
  const projectId = await createProjectForRepo(
    {
      ...repoData,
      owner,
      repoName,
    },
    userId
  );

  // Create and run the job
  return createJob("import-repo", {
    ...repoData,
    owner,
    repoName,
    userId,
    projectId,
  });
}

/**
 * Simulate repo clone for development purposes
 * @param {Object} job - Job to simulate
 */
async function simulateRepoClone(job) {
  const { repoName, owner } = job.input;

  if (DEBUG)
    console.log(`📋 Simulating repo clone for ${owner}/${repoName}...`);

  // Add logs to simulate the cloning process
  await db.jobs.updateOne(
    { _id: job._id },
    {
      $push: {
        logs: {
          $each: [
            `Cloning repository ${owner}/${repoName}...`,
            `Initializing git...`,
            `Cloning into '${repoName}'...`,
            `remote: Enumerating objects: 100, done.`,
            `remote: Counting objects: 100% (100/100), done.`,
            `remote: Compressing objects: 100% (80/80), done.`,
            `remote: Total 100 (delta 20), reused 90 (delta 10), pack-reused 0`,
            `Receiving objects: 100% (100/100), 2.5 MiB | 4.2 MiB/s, done.`,
            `Resolving deltas: 100% (20/20), done.`,
            `Repository cloned successfully`,
          ],
        },
      },
    }
  );

  if (DEBUG) console.log(`📝 Added clone logs to job ${job._id}`);

  // Update the project with cloned status
  if (job.projectId) {
    await db.projects.updateOne(
      { _id: job.projectId },
      {
        $set: {
          "github.cloned": true,
          "github.clonedAt": new Date(),
          updatedAt: new Date(),
        },
      }
    );
    if (DEBUG)
      console.log(`✅ Updated project ${job.projectId} with cloned status`);
  }
}

/**
 * Simulate repo import for development purposes
 * @param {Object} job - Job to simulate
 */
async function simulateRepoImport(job) {
  const { repoName, owner } = job.input;

  if (DEBUG)
    console.log(`📥 Simulating repo import for ${owner}/${repoName}...`);

  // Add logs to simulate the import process
  await db.jobs.updateOne(
    { _id: job._id },
    {
      $push: {
        logs: {
          $each: [
            `Importing repository ${owner}/${repoName}...`,
            `Initializing git...`,
            `Importing into '${repoName}'...`,
            `remote: Enumerating objects: 100, done.`,
            `remote: Counting objects: 100% (100/100), done.`,
            `remote: Compressing objects: 100% (80/80), done.`,
            `remote: Total 100 (delta 20), reused 90 (delta 10), pack-reused 0`,
            `Receiving objects: 100% (100/100), 2.5 MiB | 4.2 MiB/s, done.`,
            `Resolving deltas: 100% (20/20), done.`,
            `Repository imported successfully`,
          ],
        },
      },
    }
  );

  if (DEBUG) console.log(`📝 Added import logs to job ${job._id}`);

  // Update the project with imported status
  if (job.projectId) {
    await db.projects.updateOne(
      { _id: job.projectId },
      {
        $set: {
          "github.imported": true,
          "github.importedAt": new Date(),
          updatedAt: new Date(),
        },
      }
    );
    if (DEBUG)
      console.log(`✅ Updated project ${job.projectId} with imported status`);
  }
}

/**
 * Simulate repo deploy for development purposes
 * @param {Object} job - Job to simulate
 */
async function simulateRepoDeploy(job) {
  const { projectId, commit, branch } = job.input;

  if (DEBUG)
    console.log(`🚀 Simulating repo deploy for project ${projectId}...`);
  if (DEBUG)
    console.log(`  Commit: ${commit || "latest"}, Branch: ${branch || "main"}`);

  // Add logs to simulate the deployment process
  await db.jobs.updateOne(
    { _id: job._id },
    {
      $push: {
        logs: {
          $each: [
            `Deploying project ${projectId}...`,
            `Checking out ${branch || "main"} branch...`,
            commit
              ? `Checking out commit ${commit}...`
              : `Using latest commit on ${branch || "main"}...`,
            `Setting up deployment environment...`,
            `Running pre-deployment checks...`,
            `Building project assets...`,
            `Optimizing assets...`,
            `Deploying to server...`,
            `Configuring server...`,
            `Running post-deployment tests...`,
            `Deployment completed successfully!`,
            `Project is now live and accessible`,
          ],
        },
      },
    }
  );

  if (DEBUG) console.log(`📝 Added deployment logs to job ${job._id}`);

  // Update the project with deployed status
  if (projectId) {
    try {
      // Only update activeRev if this job is newer (prevents race condition)
      const project = await db.projects.findOne({ _id: projectId });
      const jobId = job._id.toString();
      const shouldUpdateActiveRev = !project?.activeRev ||
        new ObjectId(jobId).getTimestamp() > new ObjectId(project.activeRev).getTimestamp();

      const updateFields = {
        deployment: {
          deployed: true,
          deployedAt: new Date(),
          commit: commit || "latest",
          branch: branch || "main",
        },
        status: "deployed",
        updatedAt: new Date(),
      };

      if (shouldUpdateActiveRev) {
        updateFields.activeRev = jobId;
      }

      await db.projects.updateOne(
        { _id: projectId },
        { $set: updateFields }
      );
      if (DEBUG) {
        if (shouldUpdateActiveRev) {
          console.log(`✅ Updated project ${projectId} with deployed status and activeRev=${jobId}`);
        } else {
          console.log(`✅ Updated project ${projectId} with deployed status (activeRev unchanged - job is older)`);
        }
      }
    } catch (error) {
      if (DEBUG)
        console.error(`❌ Error updating project ${projectId}:`, error.message);
    }
  }
}

/**
 * Create a job to deploy a repository
 * @param {string} projectId - Project ID
 * @param {Object} ctx - Context object with user information
 * @param {string} commit - Optional commit hash or reference
 * @param {string} branch - Optional branch name (defaults to "main")
 * @returns {Object} Created job
 */
async function createRepoDeployJob(projectId, ctx, commit, branch) {
  try {
    const userId = ctx.user.id;

    // Validate project exists and user has access
    const project = await db.projects.findOne({
      _id: new ObjectId(projectId),
      $or: [{ ownerId: userId }, { "collaborators.userId": userId }],
    });

    if (!project) {
      throw new Error("Project not found or access denied");
    }

    // Get GitHub token for the user
    const gitToken = ctx.user.githubToken || (await getUserGithubToken(userId));

    if (!gitToken) {
      throw new Error("GitHub token not found for user");
    }

    // Ensure we have a repo URL
    const repoUrl =
      project.repoUrl ||
      (project.github && project.github.fullName
        ? `https://github.com/${project.github.fullName}`
        : null);

    if (!repoUrl) {
      throw new Error("Repository URL not found for project");
    }

    // Build the static domain URL for absolute paths
    // Uses project ID format: https://static.repo.md/projects/{projectId}
    const projectSlugValue = project.slug || "_unknown-project-slug-" + project._id.toString();
    const orgSlugValue = project.orgSlug || (project.orgId ? project.orgId.toString() : "_unknown-org-slug");
    const staticDomain = `https://static.repo.md/projects/${project._id.toString()}`;

    // Create a job to deploy the repository
    const job = await createJob("deploy-repo", {
      projectId,
      userId,
      commit: commit || "latest",
      branch: branch || "main",
      repoUrl: repoUrl,
      gitToken: gitToken,
      projectSlug: projectSlugValue,
      orgSlug: orgSlugValue,
      orgId: project.orgId,
      // Build settings from project settings
      repositoryFolder: project.settings?.build?.repositoryFolder || "",
      ignoreFiles: project.settings?.build?.ignoreFiles || "",
      // Formatting settings for media/link paths
      notePrefix: project.formatting?.pageLinkPrefix || "",
      mediaPrefix: project.formatting?.mediaPrefix || "/_repo/medias",
      domain: staticDomain, // Always use absolute paths with static.repo.md
      commitMessage: commit === "latest" ? "Latest commit" : `Commit: ${commit}`,
      triggeredBy: ctx.user.email || ctx.user.id,
    });

    console.log("Deploy job created successfully:", {
      jobId: job.jobId,
      status: job.status,
      projectId,
    });

    // Update project with job ID
    await db.projects.updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          jobId: job._id.toString(),
          updatedAt: new Date(),
        },
      }
    );

    // Note: Slack notification is already sent by createJob()
    // No need to send it again here

    return {
      success: true,
      job: {
        jobId: job._id.toString(),
        status: job.status,
        projectId,
        type: "repo_deploy",
      },
      message: `Repository deploy job created for project ${project.name}`,
    };
  } catch (error) {
    console.error("Error creating repo deploy job:", {
      error: error.message,
      stack: error.stack,
      projectId,
    });

    throw error;
  }
}

/**
 * Get GitHub token for a user
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} GitHub token or null if not found
 */
const GITHUB_TOKEN = process.env.TEMP_GH_TOKEN_FELIX;

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
    console.log(
      `Failed to get GitHub token from user record for user ${userId}:`,
      error.message
    );
    // If we can't get the token from user record, fall back to hardcoded token
  }

  // Fallback to hardcoded token
  return GITHUB_TOKEN;
}

export default {
  createJob,
  submitRepoCloneJob,
  submitRepoImportJob,
  createRepoDeployJob,
  getUserGithubToken,
};
