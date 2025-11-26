import express from "express";
import {
  updateJob,
  getJob,
  addJobLog,
  completeJob,
  failJob,
  JobStatus,
} from "../../lib/cloudrun/jobModel.js";
import { db } from "../../db.js";
import { ObjectId } from "mongodb";
import asyncHandler from "../../utils/asyncHandler.js";
import outgoingWebhookDispatcher from "../../lib/webhooks/OutgoingWebhookDispatcher.js";
import { sendSlackNotification } from "../slackRoutes.js";
import deploymentNotifier from "../../lib/slack/deploymentNotifier.js";

const router = express.Router();

// Middleware to validate job callback requests
const validateCallback = (req, res, next) => {
  const { jobId, status, logs, output, error } = req.body;

  if (!jobId) {
    return res.status(400).json({
      success: false,
      message: "Job ID is required",
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required",
    });
  }

  // Validate status
  const validStatuses = Object.values(JobStatus);
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  next();
};

// CloudRun job callback endpoint
router.post("/callback", validateCallback, asyncHandler(async (req, res) => {
  const {
    jobId,
    status,
    logs,
    output,
    error,
    result,
    processedAt,
    duration,
  } = req.body;

  console.log("\n🔄 ====== CLOUDRUN CALLBACK RECEIVED ======");
  console.log("📥 Callback details:", {
    jobId,
    status,
    processedAt,
    hasOutput: !!output || !!result,
    hasError: !!error,
    hasLogs: Array.isArray(logs) && logs.length > 0,
  });

  // Log full error if present
  if (error) {
    console.log(
      "❌ ERROR DETAILS:",
      typeof error === "string" ? error : JSON.stringify(error, null, 2)
    );
  }

  // Log result/output summary if present
  if (output || result) {
    console.log(
      "✅ RESULT SUMMARY:",
      JSON.stringify(output || result, null, 2)
    );
  }

  // Get existing job to verify it exists
  const job = await getJob(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      message: `Job ${jobId} not found`,
    });
  }

  // Add logs if provided
  if (logs && Array.isArray(logs) && logs.length > 0) {
    for (const log of logs) {
      await addJobLog(jobId, log);
    }
  }

  // Handle worker API format (status: "completed" or "failed" with result/error)
  if (status === "completed" || status === JobStatus.COMPLETED) {
    // Worker API sends result instead of output
    const outputData = result || output || {};

    // Add processing metadata if available
    if (processedAt || duration) {
      outputData.workerMetadata = {
        processedAt: processedAt || new Date().toISOString(),
        duration: duration || 0,
      };
    }

    await completeJob(jobId, outputData);

    // Update project with activeRev=jobId for completed jobs
    if (job.projectId && job.type === "repo_deploy") {
      // Get project details for notifications
      const project = await db.projects.findOne({ _id: new ObjectId(job.projectId) });
      
      // Dispatch deployment completed webhook
      await outgoingWebhookDispatcher.dispatch(
        job.projectId,
        'deployment.completed',
        {
          projectId: job.projectId,
          jobId: jobId,
          status: 'success',
          duration: duration || null,
          completedAt: new Date(),
          metadata: job.data || {}
        }
      );
      
      // Find existing deployment by jobId
      const existingDeployment = await db.deploys.findOne({ jobId });
      
      if (existingDeployment) {
        // Update existing deployment with completion
        const stats = {
          pageCount: outputData?.stats?.pageCount,
          fileCount: outputData?.stats?.fileCount,
          totalSize: outputData?.stats?.totalSize,
          buildTime: duration ? Math.round(duration / 1000) : undefined
        };
        
        // Update Slack notification with completion status
        if (project && project.orgId) {
          await deploymentNotifier.notifyDeploymentCompleted(existingDeployment._id, stats);
        }
      } else {
        // Fallback: create new deployment record if not found
        const deploymentData = {
          projectId: new ObjectId(job.projectId),
          jobId: jobId,
          status: 'completed',
          startedAt: job.createdAt,
          completedAt: new Date(),
          branch: job.data?.branch || 'main',
          commitId: job.data?.commitId,
          triggeredBy: job.createdBy,
          stats: {
            pageCount: outputData?.stats?.pageCount,
            fileCount: outputData?.stats?.fileCount,
            totalSize: outputData?.stats?.totalSize,
            buildTime: duration ? Math.round(duration / 1000) : undefined
          }
        };
        
        const deploymentResult = await db.deploys.insertOne({
          ...deploymentData,
          createdAt: new Date()
        });
        
        // Send new notification (fallback)
        if (project && project.orgId) {
          await deploymentNotifier.updateDeploymentNotification(deploymentResult.insertedId, 'completed');
        }
      }
      // Only update activeRev if this job is newer than the current one (prevents race condition
      // where an older job completing after a newer one would regress the activeRev)
      const shouldUpdateActiveRev = !project?.activeRev ||
        new ObjectId(jobId).getTimestamp() > new ObjectId(project.activeRev).getTimestamp();

      if (shouldUpdateActiveRev) {
        console.log(
          `✅ Setting completed job ${jobId} as activeRev for project ${job.projectId}`
        );
        try {
          await db.projects.updateOne(
            { _id: new ObjectId(job.projectId) },
            {
              $set: {
                activeRev: jobId,
                updatedAt: new Date(),
              },
            }
          );
          console.log(
            `✅ Project ${job.projectId} updated with activeRev=${jobId}`
          );
        } catch (err) {
          console.error(
            `❌ Error updating project ${job.projectId} with activeRev:`,
            err
          );
          // Re-throw to let asyncHandler catch and log it properly
          throw err;
        }
      } else {
        console.log(
          `⏭️ Skipping activeRev update for project ${job.projectId} - job ${jobId} is older than current activeRev ${project.activeRev}`
        );
      }
    }
  } else if (status === "failed" || status === JobStatus.FAILED) {
    // Extract error message from either format
    const errorMessage =
      typeof error === "string" ? error : error?.message || "Unknown error";

    await failJob(jobId, errorMessage);
    
    // Dispatch deployment failed webhook for deploy jobs
    if (job.projectId && job.type === "repo_deploy") {
      // Get project details for notifications
      const project = await db.projects.findOne({ _id: new ObjectId(job.projectId) });
      
      await outgoingWebhookDispatcher.dispatch(
        job.projectId,
        'deployment.failed',
        {
          projectId: job.projectId,
          jobId: jobId,
          status: 'failed',
          error: errorMessage,
          failedAt: new Date(),
          metadata: job.data || {}
        }
      );
      
      // Find existing deployment by jobId
      const existingDeployment = await db.deploys.findOne({ jobId });
      
      if (existingDeployment) {
        // Update existing deployment with failure
        await deploymentNotifier.notifyDeploymentFailed(existingDeployment._id, errorMessage);
      } else {
        // Fallback: create new deployment record if not found
        const deploymentData = {
          projectId: new ObjectId(job.projectId),
          jobId: jobId,
          status: 'failed',
          startedAt: job.createdAt,
          completedAt: new Date(),
          branch: job.data?.branch || 'main',
          commitId: job.data?.commitId,
          triggeredBy: job.createdBy,
          error: errorMessage
        };
        
        const deploymentResult = await db.deploys.insertOne({
          ...deploymentData,
          createdAt: new Date()
        });
        
        // Send notification
        if (project && project.orgId) {
          await deploymentNotifier.notifyDeploymentFailed(deploymentResult.insertedId, errorMessage);
        }
      }
    }
  } else {
    await updateJob(jobId, { status });
  }

  // Return success response
  return res.json({
    success: true,
    message: `Job ${jobId} updated with status: ${status}`,
  });
}));

// Get job status (for testing)
router.get("/job/:jobId", asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  // Get job
  const job = await getJob(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      message: `Job ${jobId} not found`,
    });
  }

  return res.json({
    success: true,
    job,
  });
}));

export default router;
