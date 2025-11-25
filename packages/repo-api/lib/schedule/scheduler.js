import { ObjectId } from "mongodb";
import { db } from "../../db.js";
import * as chrono from "chrono-node";
import pkg from "rrule";
const { RRule } = pkg;
import { 
  validateScheduleTask, 
  validateUpdateTask, 
  validateGetUpcomingTasks,
  TaskStatusEnum,
  TaskTypeEnum,
  RecurrencePatternEnum
} from "./schemas.js";
import {
  ValidationError,
  TaskNotFoundError,
  InvalidDateError,
  RecurrenceError,
  logError,
  retryWithBackoff
} from "./errors.js";

export const TaskStatus = {
  SCHEDULED: "scheduled",
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed"
};

export const TaskType = {
  MANUAL: "manual",
  TRIGGER: "trigger",
  RECURRING: "recurring"
};

export const RecurrencePattern = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  CUSTOM: "custom"
};

/**
 * Schedule a new task
 */
export async function scheduleTask(input) {
  // Validate input
  let validatedInput;
  try {
    validatedInput = validateScheduleTask(input);
  } catch (error) {
    throw new ValidationError("Invalid task data", error.errors);
  }

  const {
    date,
    title,
    message,
    parentTask,
    projectId,
    orgId,
    agentId,
    type = TaskType.MANUAL,
    recurrence,
    trigger,
    payload = {},
    metadata = {},
    createdBy
  } = validatedInput;

  // Parse date if string
  let scheduledAt;
  if (typeof date === "string") {
    const parsed = chrono.parseDate(date);
    if (!parsed) {
      throw new InvalidDateError(date);
    }
    scheduledAt = parsed;
  } else if (date instanceof Date) {
    scheduledAt = date;
  } else {
    throw new InvalidDateError("date must be a string or Date object");
  }

  // Validate future date for scheduled tasks
  if (type === TaskType.MANUAL && scheduledAt < new Date()) {
    throw new ValidationError("Scheduled date must be in the future for manual tasks");
  }

  // Prepare task document
  const task = {
    agentId,
    title,
    description: message || "",
    type,
    status: TaskStatus.SCHEDULED,
    scheduledAt,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: createdBy || agentId,
    payload,
    metadata
  };

  // Add optional fields
  if (projectId) {
    task.projectId = new ObjectId(projectId);
  }
  
  if (orgId) {
    task.orgId = new ObjectId(orgId);
  }
  
  if (parentTask) {
    task.parentTaskId = new ObjectId(parentTask);
  }

  // Handle recurrence
  if (recurrence) {
    task.recurrence = validateRecurrence(recurrence);
    if (type !== TaskType.RECURRING) {
      task.type = TaskType.RECURRING;
    }
  }

  // Handle triggers
  if (trigger) {
    task.trigger = validateTrigger(trigger);
    if (type !== TaskType.TRIGGER) {
      task.type = TaskType.TRIGGER;
    }
  }

  // Insert task with retry
  try {
    const result = await retryWithBackoff(
      async () => db.scheduledTasks.insertOne(task),
      3,
      1000,
      5000,
      (attempt, delay) => {
        console.log(`Retrying task insertion (attempt ${attempt}) after ${delay}ms`);
      }
    );
    
    task._id = result.insertedId;

    // Log task creation
    await logTaskHistory(task._id, "created", {
      initialData: task
    }, createdBy || agentId);

    return task;
  } catch (error) {
    logError(error, { operation: "scheduleTask", agentId, title });
    throw new Error(`Failed to create task: ${error.message}`);
  }
}

/**
 * Get upcoming tasks with various filters
 */
export async function getUpcomingTasks(input = {}) {
  // Validate input
  let validatedInput;
  try {
    validatedInput = validateGetUpcomingTasks(input);
  } catch (error) {
    throw new ValidationError("Invalid query parameters", error.errors);
  }

  const {
    agentId,
    projectId,
    orgId,
    from = new Date(),
    to,
    limit = 100,
    includeCompleted = false,
    includeRecurring = true,
    status
  } = validatedInput;
  const query = {};
  const now = new Date();

  // Add filters
  if (agentId) {
    query.agentId = agentId;
  }
  
  if (projectId) {
    query.projectId = new ObjectId(projectId);
  }
  
  if (orgId) {
    query.orgId = new ObjectId(orgId);
  }

  // Status filter
  if (status) {
    query.status = status;
  } else if (!includeCompleted) {
    query.status = { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] };
  }

  // Date range filter
  if (from || to) {
    query.scheduledAt = {};
    if (from) {
      query.scheduledAt.$gte = from;
    }
    if (to) {
      query.scheduledAt.$lte = to;
    }
  }

  // Execute query
  let tasks = await db.scheduledTasks
    .find(query)
    .sort({ scheduledAt: 1 })
    .limit(limit)
    .toArray();

  // Handle recurring tasks
  if (includeRecurring && to) {
    const recurringTasks = await expandRecurringTasks(tasks, from, to);
    tasks = [...tasks.filter(t => t.type !== TaskType.RECURRING), ...recurringTasks];
    tasks.sort((a, b) => a.scheduledAt - b.scheduledAt);
  }

  return tasks;
}

/**
 * Update a scheduled task
 */
export async function updateTask(taskId, updates, updatedBy) {
  if (!ObjectId.isValid(taskId)) {
    throw new ValidationError("Invalid task ID");
  }

  // Validate updates
  let validatedUpdates;
  try {
    validatedUpdates = validateUpdateTask(updates);
  } catch (error) {
    throw new ValidationError("Invalid update data", error.errors);
  }

  const filteredUpdates = { ...validatedUpdates };

  // Parse date if needed
  if (filteredUpdates.scheduledAt && typeof filteredUpdates.scheduledAt === "string") {
    const parsed = chrono.parseDate(filteredUpdates.scheduledAt);
    if (!parsed) {
      throw new Error(`Unable to parse date: ${filteredUpdates.scheduledAt}`);
    }
    filteredUpdates.scheduledAt = parsed;
  }

  // Validate recurrence if updating
  if (filteredUpdates.recurrence) {
    filteredUpdates.recurrence = validateRecurrence(filteredUpdates.recurrence);
  }

  // Update timestamp
  filteredUpdates.updatedAt = new Date();

  // Perform update with retry
  try {
    const result = await retryWithBackoff(
      async () => db.scheduledTasks.updateOne(
        { _id: new ObjectId(taskId) },
        { $set: filteredUpdates }
      ),
      3,
      1000,
      5000
    );

    if (result.matchedCount === 0) {
      throw new TaskNotFoundError(taskId);
    }

    // Log update
    await logTaskHistory(taskId, "updated", {
      updates: filteredUpdates
    }, updatedBy);

    // Return updated task
    return await db.scheduledTasks.findOne({ _id: new ObjectId(taskId) });
  } catch (error) {
    logError(error, { operation: "updateTask", taskId });
    throw error;
  }
}

/**
 * Cancel a scheduled task
 */
export async function cancelTask(taskId, reason, cancelledBy) {
  if (!ObjectId.isValid(taskId)) {
    throw new ValidationError("Invalid task ID");
  }

  try {
    const result = await db.scheduledTasks.updateOne(
      { 
        _id: new ObjectId(taskId),
        status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] }
      },
      { 
        $set: { 
          status: TaskStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason || "Cancelled by user",
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      const task = await db.scheduledTasks.findOne({ _id: new ObjectId(taskId) });
      if (!task) {
        throw new TaskNotFoundError(taskId);
      }
      throw new ValidationError("Task is already completed or cancelled");
    }

    // Log cancellation
    await logTaskHistory(taskId, "cancelled", {
      reason
    }, cancelledBy);
  } catch (error) {
    logError(error, { operation: "cancelTask", taskId });
    throw error;
  }
}

/**
 * Reschedule a task to a new date
 */
export async function rescheduleTask(taskId, newDate, rescheduledBy) {
  if (!ObjectId.isValid(taskId)) {
    throw new ValidationError("Invalid task ID");
  }

  let scheduledAt;
  if (typeof newDate === "string") {
    const parsed = chrono.parseDate(newDate);
    if (!parsed) {
      throw new InvalidDateError(newDate);
    }
    scheduledAt = parsed;
  } else if (newDate instanceof Date) {
    scheduledAt = newDate;
  } else {
    throw new InvalidDateError("newDate must be a string or Date object");
  }

  // Ensure new date is in the future
  if (scheduledAt <= new Date()) {
    throw new ValidationError("Rescheduled date must be in the future");
  }

  return await updateTask(taskId, { scheduledAt }, rescheduledBy);
}

/**
 * Mark a task as running
 */
export async function startTask(taskId, startedBy) {
  const result = await db.scheduledTasks.updateOne(
    { 
      _id: new ObjectId(taskId),
      status: { $in: [TaskStatus.SCHEDULED, TaskStatus.PENDING] }
    },
    { 
      $set: { 
        status: TaskStatus.RUNNING,
        executedAt: new Date(),
        updatedAt: new Date()
      }
    }
  );

  if (result.matchedCount === 0) {
    throw new Error("Task not found or not in scheduled/pending state");
  }

  await logTaskHistory(taskId, "started", {}, startedBy);
}

/**
 * Mark a task as completed
 */
export async function completeTask(taskId, result, completedBy) {
  const updateData = { 
    status: TaskStatus.COMPLETED,
    completedAt: new Date(),
    updatedAt: new Date()
  };

  if (result) {
    updateData.result = result;
  }

  const dbResult = await db.scheduledTasks.updateOne(
    { 
      _id: new ObjectId(taskId),
      status: TaskStatus.RUNNING
    },
    { $set: updateData }
  );

  if (dbResult.matchedCount === 0) {
    throw new Error("Task not found or not in running state");
  }

  await logTaskHistory(taskId, "completed", { result }, completedBy);

  // Handle recurring tasks
  const task = await db.scheduledTasks.findOne({ _id: new ObjectId(taskId) });
  if (task.type === TaskType.RECURRING && task.recurrence) {
    await scheduleNextRecurrence(task);
  }
}

/**
 * Mark a task as failed
 */
export async function failTask(taskId, error, failedBy) {
  const result = await db.scheduledTasks.updateOne(
    { 
      _id: new ObjectId(taskId),
      status: TaskStatus.RUNNING
    },
    { 
      $set: { 
        status: TaskStatus.FAILED,
        failedAt: new Date(),
        error: error.message || error,
        updatedAt: new Date()
      }
    }
  );

  if (result.matchedCount === 0) {
    throw new Error("Task not found or not in running state");
  }

  await logTaskHistory(taskId, "failed", { error: error.message || error }, failedBy);
}

/**
 * Get tasks ready for execution
 */
export async function getTasksReadyForExecution(limit = 10) {
  const now = new Date();
  
  return await db.scheduledTasks
    .find({
      status: TaskStatus.SCHEDULED,
      scheduledAt: { $lte: now },
      type: { $ne: TaskType.TRIGGER } // Exclude trigger-based tasks
    })
    .sort({ scheduledAt: 1 })
    .limit(limit)
    .toArray();
}

/**
 * Delete a task and its history
 */
export async function deleteTask(taskId, deletedBy) {
  const task = await db.scheduledTasks.findOne({ _id: new ObjectId(taskId) });
  
  if (!task) {
    throw new Error("Task not found");
  }

  // Don't allow deletion of running tasks
  if (task.status === TaskStatus.RUNNING) {
    throw new Error("Cannot delete a running task");
  }

  // Delete task history
  await db.taskHistory.deleteMany({ taskId: new ObjectId(taskId) });

  // Delete the task
  await db.scheduledTasks.deleteOne({ _id: new ObjectId(taskId) });

  // Log deletion (in a separate collection if needed)
  console.log(`Task ${taskId} deleted by ${deletedBy}`);
}

// Helper functions

function validateRecurrence(recurrence) {
  if (!recurrence) return null;
  
  const validated = {
    pattern: recurrence.pattern || RecurrencePattern.DAILY,
    interval: Math.max(1, recurrence.interval || 1)
  };

  if (recurrence.endDate) {
    validated.endDate = new Date(recurrence.endDate);
    if (isNaN(validated.endDate.getTime())) {
      throw new RecurrenceError("Invalid end date for recurrence");
    }
  }

  if (recurrence.daysOfWeek) {
    if (!Array.isArray(recurrence.daysOfWeek) || 
        recurrence.daysOfWeek.some(d => d < 0 || d > 6)) {
      throw new RecurrenceError("daysOfWeek must be an array of numbers 0-6");
    }
    validated.daysOfWeek = recurrence.daysOfWeek;
  }

  if (recurrence.dayOfMonth) {
    if (recurrence.dayOfMonth < 1 || recurrence.dayOfMonth > 31) {
      throw new RecurrenceError("dayOfMonth must be between 1 and 31");
    }
    validated.dayOfMonth = recurrence.dayOfMonth;
  }

  if (recurrence.customRule) {
    try {
      RRule.fromString(recurrence.customRule);
      validated.customRule = recurrence.customRule;
    } catch (error) {
      throw new RecurrenceError(`Invalid RRULE format: ${error.message}`);
    }
  }

  return validated;
}

function validateTrigger(trigger) {
  if (!trigger.type) {
    throw new Error("Trigger type is required");
  }

  const validated = {
    type: trigger.type,
    config: trigger.config || {}
  };

  // Validate specific trigger types
  switch (trigger.type) {
    case "webhook":
      if (!trigger.config.url) {
        throw new Error("Webhook URL is required");
      }
      break;
    case "event":
      if (!trigger.config.eventName) {
        throw new Error("Event name is required");
      }
      break;
    case "condition":
      if (!trigger.config.expression) {
        throw new Error("Condition expression is required");
      }
      break;
  }

  return validated;
}

async function logTaskHistory(taskId, action, details = {}, performedBy) {
  try {
    await db.taskHistory.insertOne({
      taskId: new ObjectId(taskId),
      action,
      timestamp: new Date(),
      details,
      performedBy: performedBy || "system"
    });
  } catch (error) {
    // Log history errors but don't fail the main operation
    logError(error, { 
      operation: "logTaskHistory", 
      taskId: taskId.toString(), 
      action 
    });
  }
}

async function expandRecurringTasks(tasks, from, to) {
  const expanded = [];

  for (const task of tasks) {
    if (task.type !== TaskType.RECURRING || !task.recurrence) {
      continue;
    }

    const occurrences = getRecurrenceOccurrences(task, from, to);
    
    for (const occurrence of occurrences) {
      expanded.push({
        ...task,
        _id: `${task._id}_${occurrence.getTime()}`, // Virtual ID for UI
        scheduledAt: occurrence,
        isRecurrenceInstance: true,
        originalTaskId: task._id
      });
    }
  }

  return expanded;
}

function getRecurrenceOccurrences(task, from, to) {
  const { recurrence } = task;
  let rrule;

  if (recurrence.customRule) {
    rrule = RRule.fromString(recurrence.customRule);
  } else {
    const options = {
      freq: getRRuleFrequency(recurrence.pattern),
      interval: recurrence.interval || 1,
      dtstart: task.scheduledAt
    };

    if (recurrence.endDate) {
      options.until = recurrence.endDate;
    }

    if (recurrence.daysOfWeek && recurrence.pattern === RecurrencePattern.WEEKLY) {
      options.byweekday = recurrence.daysOfWeek.map(d => d % 7);
    }

    if (recurrence.dayOfMonth && recurrence.pattern === RecurrencePattern.MONTHLY) {
      options.bymonthday = recurrence.dayOfMonth;
    }

    rrule = new RRule(options);
  }

  return rrule.between(from, to, true);
}

function getRRuleFrequency(pattern) {
  const map = {
    [RecurrencePattern.DAILY]: RRule.DAILY,
    [RecurrencePattern.WEEKLY]: RRule.WEEKLY,
    [RecurrencePattern.MONTHLY]: RRule.MONTHLY
  };
  
  return map[pattern] || RRule.DAILY;
}

async function scheduleNextRecurrence(task) {
  if (!task.recurrence) return;

  const nextOccurrences = getRecurrenceOccurrences(
    task,
    new Date(),
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Look ahead 1 year
  );

  if (nextOccurrences.length > 0) {
    const nextDate = nextOccurrences[0];
    
    // Create new task for next occurrence
    await scheduleTask({
      date: nextDate,
      title: task.title,
      message: task.description,
      parentTask: task.parentTaskId,
      projectId: task.projectId,
      orgId: task.orgId,
      agentId: task.agentId,
      type: task.type,
      recurrence: task.recurrence,
      trigger: task.trigger,
      payload: task.payload,
      metadata: {
        ...task.metadata,
        previousTaskId: task._id
      },
      createdBy: "system"
    });
  }
}