import { z } from "zod";
import {
  scheduleTask,
  getUpcomingTasks,
  updateTask,
  cancelTask,
  rescheduleTask,
  deleteTask,
  processNaturalCommand,
  generateCalendarFeed,
  generateFeedToken,
  getQueueStatus,
  executeTaskManually,
  getTodayAgenda,
  scheduleRecurringTask
} from "./index.js";
import {
  ScheduleTaskSchema,
  UpdateTaskSchema,
  GetUpcomingTasksSchema,
  NLPContextSchema,
  CalendarFeedSchema
} from "./schemas.js";
import { TRPCError } from "@trpc/server";
import { createErrorResponse } from "./errors.js";

/**
 * Create tRPC procedures for the scheduling system
 */
export function createScheduleProcedures(t, protectedProcedure) {
  return {
    // Schedule a new task
    scheduleTask: protectedProcedure
      .input(ScheduleTaskSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const task = await scheduleTask({
            ...input,
            createdBy: ctx.user.id
          });
          
          return {
            success: true,
            task
          };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: error
          });
        }
      }),

    // Get upcoming tasks
    getUpcomingTasks: protectedProcedure
      .input(GetUpcomingTasksSchema.optional())
      .query(async ({ ctx, input = {} }) => {
        try {
          const tasks = await getUpcomingTasks(input);
          
          return {
            success: true,
            count: tasks.length,
            tasks
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            cause: error
          });
        }
      }),

    // Get a specific task
    getTask: protectedProcedure
      .input(z.object({
        taskId: z.string()
      }))
      .query(async ({ ctx, input }) => {
        const { db } = await import("../../db.js");
        const { ObjectId } = await import("mongodb");
        
        const task = await db.scheduledTasks.findOne({
          _id: new ObjectId(input.taskId)
        });
        
        if (!task) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found"
          });
        }
        
        return {
          success: true,
          task
        };
      }),

    // Update a task
    updateTask: protectedProcedure
      .input(z.object({
        taskId: z.string(),
        updates: UpdateTaskSchema
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const task = await updateTask(
            input.taskId,
            input.updates,
            ctx.user.id
          );
          
          return {
            success: true,
            task
          };
        } catch (error) {
          throw new TRPCError({
            code: error.statusCode === 404 ? "NOT_FOUND" : "BAD_REQUEST",
            message: error.message,
            cause: error
          });
        }
      }),

    // Cancel a task
    cancelTask: protectedProcedure
      .input(z.object({
        taskId: z.string(),
        reason: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          await cancelTask(
            input.taskId,
            input.reason,
            ctx.user.id
          );
          
          return {
            success: true,
            message: "Task cancelled successfully"
          };
        } catch (error) {
          throw new TRPCError({
            code: error.statusCode === 404 ? "NOT_FOUND" : "BAD_REQUEST",
            message: error.message,
            cause: error
          });
        }
      }),

    // Reschedule a task
    rescheduleTask: protectedProcedure
      .input(z.object({
        taskId: z.string(),
        newDate: z.union([z.string(), z.date()])
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const task = await rescheduleTask(
            input.taskId,
            input.newDate,
            ctx.user.id
          );
          
          return {
            success: true,
            task
          };
        } catch (error) {
          throw new TRPCError({
            code: error.statusCode === 404 ? "NOT_FOUND" : "BAD_REQUEST",
            message: error.message,
            cause: error
          });
        }
      }),

    // Delete a task
    deleteTask: protectedProcedure
      .input(z.object({
        taskId: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          await deleteTask(input.taskId, ctx.user.id);
          
          return {
            success: true,
            message: "Task deleted successfully"
          };
        } catch (error) {
          throw new TRPCError({
            code: error.statusCode === 404 ? "NOT_FOUND" : "BAD_REQUEST",
            message: error.message,
            cause: error
          });
        }
      }),

    // Process natural language command
    processNaturalCommand: protectedProcedure
      .input(z.object({
        command: z.string(),
        context: NLPContextSchema.optional()
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await processNaturalCommand(
            input.command,
            {
              ...input.context,
              userId: ctx.user.id
            }
          );
          
          return result;
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: error
          });
        }
      }),

    // Generate calendar feed
    generateCalendarFeed: protectedProcedure
      .input(CalendarFeedSchema)
      .query(async ({ ctx, input }) => {
        try {
          const feed = await generateCalendarFeed({
            ...input,
            includePrivate: true // Authenticated users can see private tasks
          });
          
          return {
            success: true,
            feed,
            format: input.format
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            cause: error
          });
        }
      }),

    // Generate feed token
    generateFeedToken: protectedProcedure
      .input(z.object({
        feedType: z.enum(["agent", "project", "org", "user"]),
        feedId: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const token = await generateFeedToken(
            ctx.user.id,
            input.feedType,
            input.feedId
          );
          
          const { getCalendarSubscriptionUrl } = await import("./feeds.js");
          const url = getCalendarSubscriptionUrl(
            input.feedType,
            input.feedId,
            token
          );
          
          return {
            success: true,
            token,
            url,
            expiresIn: "365 days"
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            cause: error
          });
        }
      }),

    // Get queue status
    getQueueStatus: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const status = await getQueueStatus();
          
          return {
            success: true,
            status
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            cause: error
          });
        }
      }),

    // Execute task manually
    executeTaskManually: protectedProcedure
      .input(z.object({
        taskId: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await executeTaskManually(
            input.taskId,
            ctx.user.id
          );
          
          return {
            success: true,
            message: "Task execution started",
            result
          };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: error
          });
        }
      }),

    // Get today's agenda
    getTodayAgenda: protectedProcedure
      .input(z.object({
        agentId: z.string()
      }))
      .query(async ({ ctx, input }) => {
        try {
          const tasks = await getTodayAgenda(input.agentId);
          
          return {
            success: true,
            agentId: input.agentId,
            date: new Date().toDateString(),
            count: tasks.length,
            tasks
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            cause: error
          });
        }
      }),

    // Schedule recurring task helper
    scheduleRecurringTask: protectedProcedure
      .input(z.object({
        title: z.string(),
        agentId: z.string(),
        projectId: z.string().optional(),
        orgId: z.string().optional(),
        pattern: z.enum(["daily", "weekly", "monthly"]),
        time: z.string().default("9:00 AM"),
        payload: z.record(z.any()).optional(),
        metadata: z.record(z.any()).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const task = await scheduleRecurringTask({
            ...input,
            createdBy: ctx.user.id
          });
          
          return {
            success: true,
            task
          };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: error
          });
        }
      }),

    // Get task history
    getTaskHistory: protectedProcedure
      .input(z.object({
        taskId: z.string(),
        limit: z.number().min(1).max(500).default(100)
      }))
      .query(async ({ ctx, input }) => {
        const { db } = await import("../../db.js");
        const { ObjectId } = await import("mongodb");
        
        const history = await db.taskHistory
          .find({ taskId: new ObjectId(input.taskId) })
          .sort({ timestamp: -1 })
          .limit(input.limit)
          .toArray();
        
        return {
          success: true,
          taskId: input.taskId,
          count: history.length,
          history
        };
      }),

    // Bulk operations
    bulkCancelTasks: protectedProcedure
      .input(z.object({
        taskIds: z.array(z.string()),
        reason: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const results = await Promise.allSettled(
          input.taskIds.map(taskId => 
            cancelTask(taskId, input.reason, ctx.user.id)
          )
        );
        
        const succeeded = results.filter(r => r.status === "fulfilled").length;
        const failed = results.filter(r => r.status === "rejected").length;
        
        return {
          success: true,
          total: input.taskIds.length,
          succeeded,
          failed,
          results: results.map((r, i) => ({
            taskId: input.taskIds[i],
            success: r.status === "fulfilled",
            error: r.status === "rejected" ? r.reason.message : null
          }))
        };
      })
  };
}