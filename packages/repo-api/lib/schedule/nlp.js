import * as chrono from "chrono-node";
import { 
  scheduleTask, 
  getUpcomingTasks, 
  cancelTask, 
  rescheduleTask,
  updateTask 
} from "./scheduler.js";
import { NaturalLanguageError } from "./errors.js";

// Intent types
export const Intent = {
  SCHEDULE: "schedule",
  CANCEL: "cancel",
  RESCHEDULE: "reschedule",
  UPDATE: "update",
  LIST: "list",
  VIEW: "view"
};

// Import constants
import { NLP_PATTERNS } from "./constants.js";

// Helper functions
function validateNLPInputs(command, context) {
  if (!command || typeof command !== "string") {
    return { valid: false, error: "Command must be a non-empty string" };
  }
  
  if (!context || !context.agentId) {
    return { valid: false, error: "Context with agentId is required" };
  }
  
  return { valid: true };
}

function createSuccessResponse(intent, data) {
  return {
    success: true,
    intent,
    ...data
  };
}

function createErrorResponse(intent, message, data = {}) {
  return {
    success: false,
    intent,
    message,
    ...data
  };
}

async function handleTaskOperation(command, context, intent, operation, excludeText = '') {
  const criteria = extractSearchCriteria(command, excludeText);
  const tasks = await findMatchingTasks(criteria, context);
  
  if (tasks.length === 0) {
    return createErrorResponse(intent, `No matching tasks found to ${intent}`);
  }
  
  if (tasks.length > 1) {
    return createErrorResponse(intent, 
      `Found ${tasks.length} matching tasks. Please be more specific.`,
      { tasks: tasks.map(t => ({ id: t._id, title: t.title, scheduledAt: t.scheduledAt })) }
    );
  }
  
  const task = tasks[0];
  const message = await operation(task);
  
  return createSuccessResponse(intent, { message, task });
}

function extractScheduleData(command) {
  const dateInfo = extractDateTime(command);
  if (!dateInfo.date) {
    throw new NaturalLanguageError(command, "Could not extract a valid date");
  }
  
  const title = extractTaskTitle(command, dateInfo.matchedText);
  if (!title) {
    throw new NaturalLanguageError(command, "Could not extract a task title");
  }
  
  const recurrence = extractRecurrence(command);
  
  return { date: dateInfo.date, title, recurrence };
}

// Common action words mapping
const ACTION_WORDS = {
  schedule: ["schedule", "create", "add", "set", "plan", "book"],
  cancel: ["cancel", "delete", "remove", "abort", "stop"],
  reschedule: ["reschedule", "move", "postpone", "defer", "change time", "change date"],
  update: ["update", "modify", "edit", "change"],
  list: ["list", "show", "get", "display", "what are", "upcoming"],
  view: ["view", "check", "see", "details", "info", "information"]
};

/**
 * Process a natural language command for task management
 */
export async function processNaturalCommand(command, context) {
  // Validate inputs
  const validation = validateNLPInputs(command, context);
  if (!validation.valid) {
    throw new NaturalLanguageError(command, validation.error);
  }

  // Normalize command
  const normalizedCommand = command.toLowerCase().trim();

  // Extract intent
  const intent = extractIntent(normalizedCommand);
  if (!intent) {
    throw new NaturalLanguageError(command, "Could not determine intent");
  }

  // Map intent to handler
  const handlers = {
    [Intent.SCHEDULE]: handleScheduleIntent,
    [Intent.CANCEL]: handleCancelIntent,
    [Intent.RESCHEDULE]: handleRescheduleIntent,
    [Intent.UPDATE]: handleUpdateIntent,
    [Intent.LIST]: handleListIntent,
    [Intent.VIEW]: handleViewIntent
  };

  const handler = handlers[intent];
  if (!handler) {
    throw new NaturalLanguageError(command, `No handler for intent: ${intent}`);
  }

  return await handler(normalizedCommand, context);
}

/**
 * Extract the primary intent from a command
 */
function extractIntent(command) {
  for (const [intent, words] of Object.entries(ACTION_WORDS)) {
    for (const word of words) {
      if (command.includes(word)) {
        return intent;
      }
    }
  }
  
  // Default to list if asking a question
  if (command.includes("?") || command.startsWith("what")) {
    return Intent.LIST;
  }
  
  return null;
}

/**
 * Handle scheduling a new task
 */
async function handleScheduleIntent(command, context) {
  const { date, title, recurrence } = extractScheduleData(command);
  
  const task = await scheduleTask({
    date,
    title,
    agentId: context.agentId,
    projectId: context.projectId,
    orgId: context.orgId,
    type: recurrence ? "recurring" : "manual",
    recurrence,
    metadata: {
      source: "natural_language",
      originalCommand: command
    },
    createdBy: context.userId || context.agentId
  });

  return createSuccessResponse(Intent.SCHEDULE, {
    message: `Scheduled task "${task.title}" for ${formatDate(task.scheduledAt)}`,
    task
  });
}

/**
 * Handle cancelling a task
 */
async function handleCancelIntent(command, context) {
  const result = await handleTaskOperation(
    command, 
    context, 
    Intent.CANCEL,
    async (task) => {
      await cancelTask(
        task._id.toString(), 
        `Cancelled via natural language: "${command}"`,
        context.userId || context.agentId
      );
      return `Cancelled task "${task.title}" scheduled for ${formatDate(task.scheduledAt)}`;
    }
  );
  
  return result;
}

/**
 * Handle rescheduling a task
 */
async function handleRescheduleIntent(command, context) {
  const dateInfo = extractDateTime(command);
  if (!dateInfo.date) {
    throw new NaturalLanguageError(command, "Could not extract a new date");
  }

  const result = await handleTaskOperation(
    command, 
    context, 
    Intent.RESCHEDULE,
    async (task) => {
      const updated = await rescheduleTask(
        task._id.toString(),
        dateInfo.date,
        context.userId || context.agentId
      );
      return `Rescheduled "${task.title}" from ${formatDate(task.scheduledAt)} to ${formatDate(updated.scheduledAt)}`;
    },
    dateInfo.matchedText
  );
  
  return result;
}

/**
 * Handle updating a task
 */
async function handleUpdateIntent(command, context) {
  // Extract what to update
  const updates = extractTaskUpdates(command);
  if (Object.keys(updates).length === 0) {
    throw new Error("Could not determine what to update");
  }

  // Extract search criteria
  const criteria = extractSearchCriteria(command);
  
  // Find matching tasks
  const tasks = await findMatchingTasks(criteria, context);
  
  if (tasks.length === 0) {
    return {
      success: false,
      intent: Intent.UPDATE,
      message: "No matching tasks found to update"
    };
  }

  if (tasks.length > 1) {
    return {
      success: false,
      intent: Intent.UPDATE,
      message: `Found ${tasks.length} matching tasks. Please be more specific.`,
      tasks: tasks.map(t => ({ id: t._id, title: t.title, scheduledAt: t.scheduledAt }))
    };
  }

  // Update the task
  const task = tasks[0];
  const updated = await updateTask(
    task._id.toString(),
    updates,
    context.userId || context.agentId
  );

  return {
    success: true,
    intent: Intent.UPDATE,
    message: `Updated task "${updated.title}"`,
    task: updated,
    updates
  };
}

/**
 * Handle listing tasks
 */
async function handleListIntent(command, context) {
  // Extract time range
  const timeRange = extractTimeRange(command);
  
  // Get tasks
  const tasks = await getUpcomingTasks({
    agentId: context.agentId,
    projectId: context.projectId,
    orgId: context.orgId,
    from: timeRange.from,
    to: timeRange.to,
    limit: 20
  });

  if (tasks.length === 0) {
    return {
      success: true,
      intent: Intent.LIST,
      message: "No upcoming tasks found",
      tasks: []
    };
  }

  return {
    success: true,
    intent: Intent.LIST,
    message: `Found ${tasks.length} upcoming task${tasks.length > 1 ? 's' : ''}`,
    tasks: tasks.map(t => ({
      id: t._id,
      title: t.title,
      scheduledAt: t.scheduledAt,
      status: t.status,
      type: t.type
    })),
    timeRange
  };
}

/**
 * Handle viewing task details
 */
async function handleViewIntent(command, context) {
  // Extract search criteria
  const criteria = extractSearchCriteria(command);
  
  // Find matching tasks
  const tasks = await findMatchingTasks(criteria, context, true);
  
  if (tasks.length === 0) {
    return {
      success: false,
      intent: Intent.VIEW,
      message: "No matching tasks found"
    };
  }

  if (tasks.length > 1) {
    return {
      success: false,
      intent: Intent.VIEW,
      message: `Found ${tasks.length} matching tasks. Please be more specific.`,
      tasks: tasks.map(t => ({ id: t._id, title: t.title, scheduledAt: t.scheduledAt }))
    };
  }

  return {
    success: true,
    intent: Intent.VIEW,
    message: `Task details for "${tasks[0].title}"`,
    task: tasks[0]
  };
}

// Helper functions

function extractDateTime(text) {
  // Use chrono to parse natural language dates
  const results = chrono.parse(text);
  
  if (results.length > 0) {
    const result = results[0];
    return {
      date: result.start.date(),
      matchedText: result.text,
      index: result.index
    };
  }
  
  return { date: null, matchedText: null };
}

function extractTaskTitle(command, dateText = '') {
  let title = command;
  
  // Remove all non-title elements
  const elementsToRemove = [
    ...Object.values(ACTION_WORDS).flat(),
    ...['a', 'an', 'the', 'to', 'for', 'with', 'task'],
    dateText
  ].filter(Boolean);
  
  elementsToRemove.forEach(element => {
    title = title.replace(new RegExp(`\\b${element}\\b`, 'gi'), '');
  });
  
  // Clean and capitalize
  title = title.trim().replace(/\s+/g, ' ');
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : null;
}

function extractRecurrence(command) {
  const patterns = {
    daily: /\b(daily|every day|each day)\b/i,
    weekly: /\b(weekly|every week|each week)\b/i,
    monthly: /\b(monthly|every month|each month)\b/i,
    weekdays: /\b(weekdays|every weekday|business days)\b/i
  };
  
  for (const [pattern, regex] of Object.entries(patterns)) {
    if (regex.test(command)) {
      if (pattern === 'weekdays') {
        return {
          pattern: 'weekly',
          daysOfWeek: [1, 2, 3, 4, 5] // Mon-Fri
        };
      }
      return { pattern };
    }
  }
  
  // Check for specific day recurrence
  const dayMatch = command.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (dayMatch) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = days.indexOf(dayMatch[1].toLowerCase());
    return {
      pattern: 'weekly',
      daysOfWeek: [dayIndex]
    };
  }
  
  return null;
}

function extractSearchCriteria(command, excludeText = '') {
  let searchText = excludeText ? command.replace(excludeText, '') : command;
  const criteria = {};
  
  // Extract date
  const dateInfo = extractDateTime(searchText);
  if (dateInfo.date) {
    criteria.date = dateInfo.date;
    searchText = searchText.replace(dateInfo.matchedText, '');
  }
  
  // Extract meaningful keywords
  const stopWords = new Set([
    'the', 'a', 'an', 'to', 'for', 'with', 'task',
    ...Object.values(ACTION_WORDS).flat()
  ]);
  
  criteria.keywords = searchText
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word.toLowerCase()));
  
  return criteria.keywords.length > 0 ? criteria : {};
}

function extractTaskUpdates(command) {
  const updates = {};
  
  // Check for title update
  const titleMatch = command.match(/\b(?:title|name)\s+(?:to|as)\s+"([^"]+)"/i);
  if (titleMatch) {
    updates.title = titleMatch[1];
  }
  
  // Check for description update
  const descMatch = command.match(/\b(?:description|message)\s+(?:to|as)\s+"([^"]+)"/i);
  if (descMatch) {
    updates.description = descMatch[1];
  }
  
  return updates;
}

function extractTimeRange(command) {
  const now = new Date();
  const range = { from: now };
  
  // Common time range patterns
  if (/\btoday\b/i.test(command)) {
    range.to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (/\btomorrow\b/i.test(command)) {
    range.from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    range.to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  } else if (/\bthis week\b/i.test(command)) {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    range.from = startOfWeek;
    range.to = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (/\bnext week\b/i.test(command)) {
    const startOfNextWeek = new Date(now);
    startOfNextWeek.setDate(now.getDate() - now.getDay() + 7);
    range.from = startOfNextWeek;
    range.to = new Date(startOfNextWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (/\bthis month\b/i.test(command)) {
    range.from = new Date(now.getFullYear(), now.getMonth(), 1);
    range.to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else {
    // Default to next 7 days
    range.to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  
  return range;
}

async function findMatchingTasks(criteria, context, includeCompleted = false) {
  const query = buildTaskQuery(context, criteria, includeCompleted);
  let tasks = await getUpcomingTasks(query);
  
  // Apply keyword filter if needed
  if (criteria.keywords?.length > 0) {
    const keywordSet = new Set(criteria.keywords.map(k => k.toLowerCase()));
    tasks = tasks.filter(task => {
      const taskText = `${task.title} ${task.description || ''}`.toLowerCase();
      return Array.from(keywordSet).some(keyword => taskText.includes(keyword));
    });
  }
  
  return tasks;
}

function buildTaskQuery(context, criteria, includeCompleted) {
  const query = {
    agentId: context.agentId,
    includeCompleted,
    limit: 100
  };
  
  if (context.projectId) query.projectId = context.projectId;
  if (context.orgId) query.orgId = context.orgId;
  
  if (criteria.date) {
    const dayStart = new Date(criteria.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(criteria.date);
    dayEnd.setHours(23, 59, 59, 999);
    
    query.from = dayStart;
    query.to = dayEnd;
  }
  
  return query;
}

const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

/**
 * Parse a cron-like expression into recurrence rules
 */
export function parseCronExpression(expression) {
  // Simple cron parser for common patterns
  const patterns = {
    "0 9 * * 1-5": { pattern: "weekly", daysOfWeek: [1, 2, 3, 4, 5] }, // Weekdays at 9am
    "0 9 * * 1": { pattern: "weekly", daysOfWeek: [1] }, // Mondays at 9am
    "0 9 1 * *": { pattern: "monthly", dayOfMonth: 1 }, // First of month at 9am
    "0 9,17 * * *": { pattern: "custom", customRule: "FREQ=DAILY;BYHOUR=9,17" } // Twice daily
  };
  
  return patterns[expression] || null;
}