import { z } from "zod";
import { ObjectId } from "mongodb";

// Custom validators
const objectIdSchema = z.string().refine(
  (val) => ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

const dateOrStringSchema = z.union([
  z.date(),
  z.string().min(1, "Date string cannot be empty")
]);

// Enums
export const TaskStatusEnum = z.enum([
  "scheduled",
  "pending", 
  "running",
  "completed",
  "cancelled",
  "failed"
]);

export const TaskTypeEnum = z.enum([
  "manual",
  "trigger",
  "recurring"
]);

export const RecurrencePatternEnum = z.enum([
  "daily",
  "weekly", 
  "monthly",
  "custom"
]);

export const TriggerTypeEnum = z.enum([
  "webhook",
  "event",
  "condition"
]);

export const IntentEnum = z.enum([
  "schedule",
  "cancel",
  "reschedule",
  "update",
  "list",
  "view"
]);

// Recurrence schema
export const RecurrenceSchema = z.object({
  pattern: RecurrencePatternEnum,
  interval: z.number().min(1).default(1),
  endDate: z.date().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  customRule: z.string().optional()
}).refine(
  (data) => {
    // Validate daysOfWeek is only used with weekly pattern
    if (data.daysOfWeek && data.pattern !== "weekly") {
      return false;
    }
    // Validate dayOfMonth is only used with monthly pattern
    if (data.dayOfMonth && data.pattern !== "monthly") {
      return false;
    }
    return true;
  },
  { 
    message: "Invalid recurrence configuration for pattern" 
  }
);

// Trigger schema
export const TriggerSchema = z.object({
  type: TriggerTypeEnum,
  config: z.object({
    url: z.string().url().optional(),
    eventName: z.string().optional(),
    expression: z.string().optional()
  }).passthrough()
}).refine(
  (data) => {
    switch (data.type) {
      case "webhook":
        return !!data.config.url;
      case "event":
        return !!data.config.eventName;
      case "condition":
        return !!data.config.expression;
      default:
        return false;
    }
  },
  { 
    message: "Invalid trigger configuration for type" 
  }
);

// Schedule task input schema
export const ScheduleTaskSchema = z.object({
  date: dateOrStringSchema,
  title: z.string().min(1).max(200),
  message: z.string().max(1000).optional(),
  parentTask: objectIdSchema.optional(),
  projectId: objectIdSchema.optional(),
  orgId: objectIdSchema.optional(),
  agentId: z.string().min(1).max(100),
  type: TaskTypeEnum.default("manual"),
  recurrence: RecurrenceSchema.optional(),
  trigger: TriggerSchema.optional(),
  payload: z.record(z.any()).default({}),
  metadata: z.record(z.any()).default({}),
  createdBy: z.string().optional()
}).refine(
  (data) => {
    // Ensure recurring tasks have recurrence config
    if (data.type === "recurring" && !data.recurrence) {
      return false;
    }
    // Ensure trigger tasks have trigger config
    if (data.type === "trigger" && !data.trigger) {
      return false;
    }
    return true;
  },
  {
    message: "Task type requires corresponding configuration"
  }
);

// Update task schema
export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  scheduledAt: dateOrStringSchema.optional(),
  status: TaskStatusEnum.optional(),
  payload: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  recurrence: RecurrenceSchema.optional(),
  trigger: TriggerSchema.optional()
});

// Get upcoming tasks schema
export const GetUpcomingTasksSchema = z.object({
  agentId: z.string().optional(),
  projectId: objectIdSchema.optional(),
  orgId: objectIdSchema.optional(),
  from: z.date().optional(),
  to: z.date().optional(),
  limit: z.number().min(1).max(1000).default(100),
  includeCompleted: z.boolean().default(false),
  includeRecurring: z.boolean().default(true),
  status: TaskStatusEnum.optional()
});

// Natural language command context schema
export const NLPContextSchema = z.object({
  agentId: z.string().min(1),
  projectId: objectIdSchema.optional(),
  orgId: objectIdSchema.optional(),
  userId: z.string().optional()
});

// Calendar feed options schema
export const CalendarFeedSchema = z.object({
  type: z.enum(["agent", "project", "org", "user"]),
  id: z.string().min(1),
  format: z.enum(["ical", "json"]).default("ical"),
  includePrivate: z.boolean().default(false),
  from: z.date().optional(),
  to: z.date().optional(),
  title: z.string().optional(),
  description: z.string().optional()
});

// Task executor registration schema
export const TaskExecutorSchema = z.object({
  agentId: z.string().min(1),
  executor: z.function()
});

// Queue status schema
export const QueueStatusSchema = z.object({
  isRunning: z.boolean(),
  pollInterval: z.number(),
  batchSize: z.number(),
  taskTimeout: z.number(),
  registeredExecutors: z.array(z.string()),
  queue: z.object({
    ready: z.number(),
    running: z.number(),
    scheduled: z.number(),
    failed24h: z.number(),
    completed24h: z.number()
  })
});

// Task result schema
export const TaskResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  duration: z.number().optional()
});

// Command result schema
export const CommandResultSchema = z.object({
  success: z.boolean(),
  intent: IntentEnum,
  message: z.string(),
  task: z.any().optional(),
  tasks: z.array(z.any()).optional(),
  updates: z.record(z.any()).optional(),
  timeRange: z.object({
    from: z.date(),
    to: z.date().optional()
  }).optional()
});

// Job callback schema
export const JobCallbackSchema = z.object({
  jobId: objectIdSchema,
  status: z.enum(["completed", "failed"]),
  result: z.any().optional(),
  error: z.string().optional(),
  processedAt: z.date().optional(),
  duration: z.number().optional()
});

// Scheduled task database schema (for reference)
export const ScheduledTaskDBSchema = z.object({
  _id: z.instanceof(ObjectId),
  agentId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  type: TaskTypeEnum,
  status: TaskStatusEnum,
  scheduledAt: z.date(),
  executedAt: z.date().optional(),
  completedAt: z.date().optional(),
  cancelledAt: z.date().optional(),
  failedAt: z.date().optional(),
  projectId: z.instanceof(ObjectId).optional(),
  orgId: z.instanceof(ObjectId).optional(),
  parentTaskId: z.instanceof(ObjectId).optional(),
  jobId: z.instanceof(ObjectId).optional(),
  recurrence: RecurrenceSchema.optional(),
  trigger: TriggerSchema.optional(),
  payload: z.record(z.any()).default({}),
  metadata: z.record(z.any()).default({}),
  result: z.any().optional(),
  error: z.string().optional(),
  cancelReason: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string()
});

// Validation helpers
export function validateScheduleTask(data) {
  return ScheduleTaskSchema.parse(data);
}

export function validateUpdateTask(data) {
  return UpdateTaskSchema.parse(data);
}

export function validateGetUpcomingTasks(data) {
  return GetUpcomingTasksSchema.parse(data);
}

export function validateNLPContext(data) {
  return NLPContextSchema.parse(data);
}

export function validateCalendarFeed(data) {
  return CalendarFeedSchema.parse(data);
}

// Safe parse helpers (return { success, data, error })
export function safeParseScheduleTask(data) {
  return ScheduleTaskSchema.safeParse(data);
}

export function safeParseUpdateTask(data) {
  return UpdateTaskSchema.safeParse(data);
}

export function safeParseNLPContext(data) {
  return NLPContextSchema.safeParse(data);
}