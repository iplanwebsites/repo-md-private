/**
 * Constants and configuration for the scheduling system
 */

// Task limits
export const TASK_LIMITS = {
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_PAYLOAD_SIZE: 10 * 1024, // 10KB
  MAX_METADATA_SIZE: 5 * 1024,  // 5KB
  MAX_TASKS_PER_QUERY: 1000,
  MAX_RECURRENCE_YEARS: 5,
  MAX_FUTURE_SCHEDULE_DAYS: 365,
  MIN_SCHEDULE_INTERVAL_MINUTES: 5
};

// Queue configuration
export const QUEUE_CONFIG = {
  DEFAULT_POLL_INTERVAL: 60000,     // 1 minute
  MIN_POLL_INTERVAL: 10000,         // 10 seconds
  MAX_POLL_INTERVAL: 300000,        // 5 minutes
  DEFAULT_BATCH_SIZE: 10,
  MAX_BATCH_SIZE: 50,
  DEFAULT_TASK_TIMEOUT: 300000,     // 5 minutes
  MAX_TASK_TIMEOUT: 3600000,        // 1 hour
  RETRY_ATTEMPTS: 3,
  RETRY_INITIAL_DELAY: 1000,        // 1 second
  RETRY_MAX_DELAY: 30000,           // 30 seconds
  STALE_TASK_THRESHOLD: 3600000     // 1 hour
};

// Natural language patterns
export const NLP_PATTERNS = {
  TIME_PREPOSITIONS: ["at", "on", "in", "by", "before", "after", "during"],
  RECURRENCE_KEYWORDS: ["every", "daily", "weekly", "monthly", "yearly"],
  CANCEL_KEYWORDS: ["cancel", "delete", "remove", "abort", "stop"],
  RESCHEDULE_KEYWORDS: ["reschedule", "move", "postpone", "defer", "change"],
  LIST_KEYWORDS: ["list", "show", "get", "display", "upcoming", "scheduled"]
};

// Calendar feed settings
export const FEED_CONFIG = {
  DEFAULT_DAYS_AHEAD: 90,
  MAX_DAYS_AHEAD: 365,
  MAX_EVENTS_PER_FEED: 1000,
  CACHE_DURATION: 300000,           // 5 minutes
  TOKEN_EXPIRY_DAYS: 365,
  DEFAULT_EVENT_DURATION: 60        // minutes
};

// Error messages
export const ERROR_MESSAGES = {
  INVALID_DATE: "The provided date could not be parsed",
  PAST_DATE: "Cannot schedule tasks in the past",
  TASK_NOT_FOUND: "The requested task was not found",
  UNAUTHORIZED: "You do not have permission to perform this action",
  RATE_LIMITED: "Too many requests. Please try again later",
  INVALID_RECURRENCE: "Invalid recurrence pattern",
  EXECUTOR_NOT_FOUND: "No executor registered for this agent",
  QUEUE_NOT_RUNNING: "Task queue is not running",
  INVALID_FEED_TYPE: "Invalid calendar feed type"
};

// Success messages
export const SUCCESS_MESSAGES = {
  TASK_SCHEDULED: "Task scheduled successfully",
  TASK_CANCELLED: "Task cancelled successfully",
  TASK_RESCHEDULED: "Task rescheduled successfully",
  TASK_UPDATED: "Task updated successfully",
  QUEUE_STARTED: "Task queue started",
  QUEUE_STOPPED: "Task queue stopped",
  EXECUTOR_REGISTERED: "Task executor registered"
};

// Default values
export const DEFAULTS = {
  TASK_TYPE: "manual",
  TASK_STATUS: "scheduled",
  RECURRENCE_INTERVAL: 1,
  RECURRENCE_PATTERN: "daily",
  TIMEZONE: "UTC",
  DATE_FORMAT: "YYYY-MM-DD HH:mm:ss"
};

// Regex patterns
export const REGEX_PATTERNS = {
  AGENT_ID: /^[a-zA-Z0-9\-_]+$/,
  CRON_EXPRESSION: /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
  ISO_DATE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
};

// Task priorities (for future use)
export const TASK_PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4
};

// Agent types (for categorization)
export const AGENT_TYPES = {
  SYSTEM: "system",
  USER: "user",
  AUTOMATED: "automated",
  INTEGRATION: "integration"
};

// Webhook event types
export const WEBHOOK_EVENTS = {
  TASK_CREATED: "task.created",
  TASK_SCHEDULED: "task.scheduled",
  TASK_STARTED: "task.started",
  TASK_COMPLETED: "task.completed",
  TASK_FAILED: "task.failed",
  TASK_CANCELLED: "task.cancelled",
  TASK_RESCHEDULED: "task.rescheduled"
};

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 1000,
  SLOW_TASK_MS: 10000,
  MEMORY_WARNING_MB: 500,
  MEMORY_CRITICAL_MB: 1000
};

// Feature flags
export const FEATURES = {
  ENABLE_RECURRING_TASKS: true,
  ENABLE_TRIGGER_TASKS: true,
  ENABLE_TASK_DEPENDENCIES: true,
  ENABLE_NATURAL_LANGUAGE: true,
  ENABLE_CALENDAR_FEEDS: true,
  ENABLE_WEBHOOKS: false,
  ENABLE_RATE_LIMITING: true,
  ENABLE_TASK_PRIORITIES: false
};