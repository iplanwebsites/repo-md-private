/**
 * AI Agent Scheduling System
 * 
 * This module provides temporal task scheduling capabilities for AI agents,
 * including natural language processing, calendar feed generation, and
 * integration with the existing job queue system.
 */

// Core scheduling functions
export {
  scheduleTask,
  getUpcomingTasks,
  updateTask,
  cancelTask,
  rescheduleTask,
  startTask,
  completeTask,
  failTask,
  deleteTask,
  getTasksReadyForExecution,
  TaskStatus,
  TaskType,
  RecurrencePattern
} from "./scheduler.js";

// Natural language processing
export {
  processNaturalCommand,
  Intent,
  parseCronExpression
} from "./nlp.js";

// Calendar feed generation
export {
  generateCalendarFeed,
  generateFeedToken,
  validateFeedToken,
  getCalendarSubscriptionUrl,
  generateAgendaView
} from "./feeds.js";

// Queue integration
export {
  registerTaskExecutor,
  unregisterTaskExecutor,
  startTaskQueue,
  stopTaskQueue,
  executeTaskManually,
  processTriggerTasks,
  handleScheduledTaskJobCompletion,
  getQueueStatus
} from "./queue.js";

/**
 * Quick start example:
 * 
 * ```javascript
 * import { scheduleTask, processNaturalCommand, startTaskQueue } from './lib/schedule/index.js';
 * 
 * // Schedule a task programmatically
 * const task = await scheduleTask({
 *   date: 'tomorrow at 2pm',
 *   title: 'Review SEO metrics',
 *   agentId: 'seo-agent',
 *   projectId: 'project123'
 * });
 * 
 * // Or use natural language
 * const result = await processNaturalCommand(
 *   'schedule weekly team review every monday at 10am',
 *   { agentId: 'team-agent', projectId: 'project123' }
 * );
 * 
 * // Start the task queue processor
 * startTaskQueue();
 * ```
 */

// Convenience functions for common operations

/**
 * Schedule a recurring task
 */
export async function scheduleRecurringTask({
  title,
  agentId,
  projectId,
  orgId,
  pattern = "daily",
  time = "9:00 AM",
  payload = {},
  metadata = {}
}) {
  const { scheduleTask } = await import("./scheduler.js");
  
  return scheduleTask({
    date: `today at ${time}`,
    title,
    agentId,
    projectId,
    orgId,
    type: "recurring",
    recurrence: { pattern },
    payload,
    metadata
  });
}

/**
 * Get today's agenda for an agent
 */
export async function getTodayAgenda(agentId) {
  const { getUpcomingTasks } = await import("./scheduler.js");
  
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  
  return getUpcomingTasks({
    agentId,
    from: now,
    to: endOfDay,
    includeCompleted: false
  });
}

/**
 * Cancel all tasks matching criteria
 */
export async function cancelTasksByCriteria({
  agentId,
  projectId,
  orgId,
  titlePattern,
  beforeDate,
  reason = "Bulk cancellation"
}) {
  const { getUpcomingTasks, cancelTask } = await import("./scheduler.js");
  
  const tasks = await getUpcomingTasks({
    agentId,
    projectId,
    orgId,
    to: beforeDate,
    includeCompleted: false,
    limit: 1000
  });
  
  const filtered = tasks.filter(task => {
    if (titlePattern && !task.title.match(titlePattern)) {
      return false;
    }
    return true;
  });
  
  const results = await Promise.allSettled(
    filtered.map(task => cancelTask(task._id, reason, "system"))
  );
  
  return {
    total: filtered.length,
    cancelled: results.filter(r => r.status === "fulfilled").length,
    failed: results.filter(r => r.status === "rejected").length
  };
}

/**
 * Register a simple task executor
 */
export function registerSimpleExecutor(agentId, handler) {
  const { registerTaskExecutor } = require("./queue.js");
  
  registerTaskExecutor(agentId, async (task) => {
    try {
      console.log(`Executing task ${task._id} for agent ${agentId}`);
      const result = await handler(task);
      return result;
    } catch (error) {
      console.error(`Task execution failed:`, error);
      throw error;
    }
  });
}

/**
 * Initialize the scheduling system
 */
export async function initializeScheduler(options = {}) {
  const {
    autoStart = true,
    pollInterval = 60000,
    batchSize = 10
  } = options;
  
  // Set environment variables if not already set
  if (!process.env.SCHEDULER_POLL_INTERVAL) {
    process.env.SCHEDULER_POLL_INTERVAL = pollInterval;
  }
  
  if (!process.env.SCHEDULER_BATCH_SIZE) {
    process.env.SCHEDULER_BATCH_SIZE = batchSize;
  }
  
  // Import and start queue if requested
  if (autoStart) {
    const { startTaskQueue } = await import("./queue.js");
    startTaskQueue();
  }
  
  console.log("Scheduling system initialized");
}

// Export types for TypeScript support (JSDoc style)

/**
 * @typedef {Object} ScheduledTask
 * @property {string} _id - Task ID
 * @property {string} agentId - Agent that owns this task
 * @property {string} title - Task title
 * @property {string} [description] - Task description
 * @property {Date} scheduledAt - When to execute
 * @property {string} status - Current status
 * @property {Object} [payload] - Task-specific data
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} CommandResult
 * @property {boolean} success - Whether command succeeded
 * @property {string} intent - Detected intent
 * @property {string} message - Human-readable message
 * @property {ScheduledTask} [task] - Related task if applicable
 */

/**
 * @typedef {Object} RecurrenceOptions
 * @property {string} pattern - Recurrence pattern (daily, weekly, monthly, custom)
 * @property {number} [interval] - Interval for recurrence
 * @property {Date} [endDate] - When recurrence ends
 * @property {number[]} [daysOfWeek] - Days for weekly recurrence (0-6)
 * @property {number} [dayOfMonth] - Day for monthly recurrence
 * @property {string} [customRule] - RRULE string for custom patterns
 */