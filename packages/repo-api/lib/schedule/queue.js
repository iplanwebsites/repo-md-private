import { 
  getTasksReadyForExecution, 
  startTask, 
  completeTask, 
  failTask,
  TaskStatus,
  TaskType
} from "./scheduler.js";
import { createJob } from "../cloudrun/jobModel.js";
import cloudRun from "../cloudRun.js";
import { db } from "../../db.js";
import * as Sentry from "@sentry/node";

// Task executor registry
const taskExecutors = new Map();

// Polling configuration
const POLL_INTERVAL = process.env.SCHEDULER_POLL_INTERVAL || 60000; // 1 minute
const BATCH_SIZE = process.env.SCHEDULER_BATCH_SIZE || 10;
const TASK_TIMEOUT = process.env.SCHEDULER_TASK_TIMEOUT || 300000; // 5 minutes

let isRunning = false;
let pollInterval = null;

/**
 * Register a task executor function
 * @param {string} agentId - The agent ID that handles this task type
 * @param {Function} executor - Async function that executes the task
 */
export function registerTaskExecutor(agentId, executor) {
  if (typeof executor !== "function") {
    throw new Error("Executor must be a function");
  }
  
  taskExecutors.set(agentId, executor);
  console.log(`Registered task executor for agent: ${agentId}`);
}

/**
 * Unregister a task executor
 * @param {string} agentId - The agent ID to unregister
 */
export function unregisterTaskExecutor(agentId) {
  taskExecutors.delete(agentId);
  console.log(`Unregistered task executor for agent: ${agentId}`);
}

/**
 * Start the task queue processor
 */
export function startTaskQueue() {
  if (isRunning) {
    console.log("Task queue is already running");
    return;
  }

  isRunning = true;
  console.log(`Starting task queue processor (interval: ${POLL_INTERVAL}ms, batch: ${BATCH_SIZE})`);

  // Process immediately, then start interval
  processTaskBatch().catch(error => {
    console.error("Error in initial task batch processing:", error);
    Sentry.captureException(error);
  });

  pollInterval = setInterval(() => {
    if (isRunning) {
      processTaskBatch().catch(error => {
        console.error("Error in task batch processing:", error);
        Sentry.captureException(error);
      });
    }
  }, POLL_INTERVAL);
}

/**
 * Stop the task queue processor
 */
export function stopTaskQueue() {
  if (!isRunning) {
    console.log("Task queue is not running");
    return;
  }

  isRunning = false;
  
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  
  console.log("Stopped task queue processor");
}

/**
 * Process a batch of ready tasks
 */
async function processTaskBatch() {
  try {
    // Get tasks ready for execution
    const tasks = await getTasksReadyForExecution(BATCH_SIZE);
    
    if (tasks.length === 0) {
      return;
    }

    console.log(`Processing ${tasks.length} scheduled tasks`);

    // Process tasks in parallel
    const promises = tasks.map(task => 
      processTask(task).catch(error => {
        console.error(`Error processing task ${task._id}:`, error);
        return { taskId: task._id, error };
      })
    );

    const results = await Promise.all(promises);
    
    // Log summary
    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;
    
    console.log(`Task batch complete: ${successful} successful, ${failed} failed`);
    
  } catch (error) {
    console.error("Error in processTaskBatch:", error);
    Sentry.captureException(error);
  }
}

/**
 * Process a single task
 */
async function processTask(task) {
  const startTime = Date.now();
  
  try {
    // Mark task as running
    await startTask(task._id, "system");

    // Check if we have an executor for this agent
    const executor = taskExecutors.get(task.agentId);
    
    if (executor) {
      // Execute using registered executor
      const result = await executeWithTimeout(
        executor(task),
        TASK_TIMEOUT,
        `Task ${task._id} timed out after ${TASK_TIMEOUT}ms`
      );
      
      await completeTask(task._id, result, "system");
      
      console.log(`Task ${task._id} completed in ${Date.now() - startTime}ms`);
      
      return { taskId: task._id, success: true, duration: Date.now() - startTime };
      
    } else {
      // No executor registered, try to dispatch as a job
      return await dispatchAsJob(task);
    }
    
  } catch (error) {
    // Mark task as failed
    await failTask(task._id, error, "system");
    
    console.error(`Task ${task._id} failed:`, error);
    Sentry.captureException(error, {
      extra: {
        taskId: task._id.toString(),
        agentId: task.agentId,
        taskTitle: task.title
      }
    });
    
    // Trigger failure notifications if configured
    await notifyTaskFailure(task, error);
    
    return { taskId: task._id, error, duration: Date.now() - startTime };
  }
}

/**
 * Dispatch a task as a job to the worker system
 */
async function dispatchAsJob(task) {
  try {
    // Map task to job type
    const jobType = mapTaskToJobType(task);
    
    if (!jobType) {
      throw new Error(`No job type mapping for agent: ${task.agentId}`);
    }

    // Create job in database
    const job = await createJob({
      type: jobType,
      status: "pending",
      input: {
        taskId: task._id.toString(),
        agentId: task.agentId,
        ...task.payload
      },
      metadata: {
        scheduledTaskId: task._id.toString(),
        projectId: task.projectId?.toString(),
        orgId: task.orgId?.toString()
      }
    });

    // Dispatch to worker
    const dispatchedJob = await cloudRun.createJob(TaskType.AI_AGENT, job.input);
    
    // Job dispatched successfully, it will complete via callback
    console.log(`Task ${task._id} dispatched as job ${dispatchedJob._id}`);
    
    // Update task with job reference
    await db.scheduledTasks.updateOne(
      { _id: task._id },
      { $set: { jobId: dispatchedJob._id } }
    );
    
    return { taskId: task._id, jobId: dispatchedJob._id, dispatched: true };
    
  } catch (error) {
    throw new Error(`Failed to dispatch task as job: ${error.message}`);
  }
}

/**
 * Handle job completion callback for scheduled tasks
 */
export async function handleScheduledTaskJobCompletion(jobId, jobResult) {
  try {
    // Find the scheduled task associated with this job
    const task = await db.scheduledTasks.findOne({ jobId });
    
    if (!task) {
      console.warn(`No scheduled task found for job ${jobId}`);
      return;
    }

    if (jobResult.status === "completed") {
      await completeTask(task._id, jobResult.result, "system");
    } else {
      await failTask(task._id, jobResult.error || "Job failed", "system");
    }
    
  } catch (error) {
    console.error(`Error handling job completion for scheduled task:`, error);
    Sentry.captureException(error);
  }
}

/**
 * Execute a task for a specific agent manually
 */
export async function executeTaskManually(taskId, executedBy) {
  const task = await db.scheduledTasks.findOne({ _id: taskId });
  
  if (!task) {
    throw new Error("Task not found");
  }
  
  if (task.status === TaskStatus.RUNNING) {
    throw new Error("Task is already running");
  }
  
  if (task.status === TaskStatus.COMPLETED) {
    throw new Error("Task has already been completed");
  }
  
  console.log(`Manually executing task ${taskId} by ${executedBy}`);
  
  // Process the task
  return await processTask(task);
}

/**
 * Process trigger-based tasks
 */
export async function processTriggerTasks(eventType, eventData) {
  try {
    // Find trigger tasks matching this event
    const tasks = await db.scheduledTasks.find({
      type: TaskType.TRIGGER,
      status: TaskStatus.SCHEDULED,
      "trigger.type": "event",
      "trigger.config.eventName": eventType
    }).toArray();
    
    if (tasks.length === 0) {
      return;
    }
    
    console.log(`Processing ${tasks.length} trigger tasks for event: ${eventType}`);
    
    // Process each matching task
    for (const task of tasks) {
      // Add event data to task payload
      const enrichedTask = {
        ...task,
        payload: {
          ...task.payload,
          triggerEvent: {
            type: eventType,
            data: eventData,
            timestamp: new Date()
          }
        }
      };
      
      await processTask(enrichedTask).catch(error => {
        console.error(`Error processing trigger task ${task._id}:`, error);
      });
    }
    
  } catch (error) {
    console.error("Error processing trigger tasks:", error);
    Sentry.captureException(error);
  }
}

// Helper functions

function mapTaskToJobType(task) {
  // Map agent IDs to job types
  // This could be configured in a database or config file
  const mappings = {
    "deploy-agent": "repo_deploy",
    "import-agent": "repo_import",
    "clone-agent": "repo_clone",
    // Add more mappings as needed
  };
  
  return mappings[task.agentId];
}

async function executeWithTimeout(promise, timeout, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(timeoutMessage)), timeout)
    )
  ]);
}

async function notifyTaskFailure(task, error) {
  try {
    // Check if Slack notifications are configured
    if (task.orgId) {
      const org = await db.orgs.findOne({ _id: task.orgId });
      
      if (org?.slackInstallation?.channels?.errors) {
        // Send Slack notification
        const { sendSlackMessage } = await import("../slack/slackService.js");
        
        await sendSlackMessage({
          teamId: org.slackInstallation.teamId,
          channel: org.slackInstallation.channels.errors,
          text: `Scheduled task failed: ${task.title}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Scheduled Task Failed*\n*Task:* ${task.title}\n*Agent:* ${task.agentId}\n*Error:* ${error.message}`
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Task ID: ${task._id} | <${process.env.FRONTEND_URL}/tasks/${task._id}|View Details>`
                }
              ]
            }
          ]
        });
      }
    }
    
    // Could also send email notifications here
    
  } catch (notifyError) {
    console.error("Error sending task failure notification:", notifyError);
    // Don't throw - notification failures shouldn't break task processing
  }
}

/**
 * Get queue status and statistics
 */
export async function getQueueStatus() {
  const now = new Date();
  const stats = {
    isRunning,
    pollInterval: POLL_INTERVAL,
    batchSize: BATCH_SIZE,
    taskTimeout: TASK_TIMEOUT,
    registeredExecutors: Array.from(taskExecutors.keys()),
    queue: {
      ready: 0,
      running: 0,
      scheduled: 0,
      failed24h: 0,
      completed24h: 0
    }
  };
  
  try {
    // Count tasks in various states
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    stats.queue.ready = await db.scheduledTasks.countDocuments({
      status: TaskStatus.SCHEDULED,
      scheduledAt: { $lte: now }
    });
    
    stats.queue.running = await db.scheduledTasks.countDocuments({
      status: TaskStatus.RUNNING
    });
    
    stats.queue.scheduled = await db.scheduledTasks.countDocuments({
      status: TaskStatus.SCHEDULED,
      scheduledAt: { $gt: now }
    });
    
    stats.queue.failed24h = await db.scheduledTasks.countDocuments({
      status: TaskStatus.FAILED,
      failedAt: { $gte: oneDayAgo }
    });
    
    stats.queue.completed24h = await db.scheduledTasks.countDocuments({
      status: TaskStatus.COMPLETED,
      completedAt: { $gte: oneDayAgo }
    });
    
  } catch (error) {
    console.error("Error getting queue stats:", error);
  }
  
  return stats;
}

// Auto-start queue if enabled
if (process.env.SCHEDULER_AUTO_START === "true") {
  console.log("Auto-starting task queue processor");
  startTaskQueue();
}