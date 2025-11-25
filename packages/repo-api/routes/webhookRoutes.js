import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, procedure } from "../lib/trpc/trpc.js";
import { protectedProcedure, adminProcedure } from "../lib/trpc/procedures.js";
import { db } from "../db.js";
import { ObjectId } from "mongodb";

// Webhook route implementations
const webhookRoutes = {
  // List webhook events for a specific project
  listProjectWebhookEvents: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        eventType: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { projectId, limit, offset, eventType } = input;
        const userId = ctx.user.id;

        // Verify user has access to this project
        const project = await db.projects.findOne({
          _id: new ObjectId(projectId),
          $or: [
            { ownerId: userId },
            { "collaborators.userId": userId }
          ]
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found or access denied",
          });
        }

        // Build query filter
        const filter = { projectId: projectId };
        if (eventType) {
          filter.event = eventType;
        }

        // Get webhook events for this project
        const events = await db.gitEvents
          .find(filter)
          .sort({ timestamp: -1 })
          .skip(offset)
          .limit(limit)
          .toArray();

        // Get total count for pagination
        const total = await db.gitEvents.countDocuments(filter);

        return {
          success: true,
          events: events.map(event => ({
            _id: event._id.toString(),
            event: event.event,
            delivery: event.delivery,
            repository: event.repository,
            timestamp: event.timestamp,
            processed: event.processed,
            ignored: event.ignored,
            failed: event.failed,
            error: event.error,
            ignoredReason: event.ignoredReason,
            processingResult: event.processingResult,
            processedAt: event.processedAt
          })),
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total
          }
        };
      } catch (error) {
        console.error("Error listing webhook events:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to list webhook events",
        });
      }
    }),

  // Get detailed webhook event information
  getWebhookEvent: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { eventId } = input;
        const userId = ctx.user.id;

        // Get the webhook event
        const event = await db.gitEvents.findOne({ _id: new ObjectId(eventId) });

        if (!event) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Webhook event not found",
          });
        }

        // If the event has a projectId, verify user has access to that project
        if (event.projectId) {
          const project = await db.projects.findOne({
            _id: new ObjectId(event.projectId),
            $or: [
              { ownerId: userId },
              { "collaborators.userId": userId }
            ]
          });

          if (!project) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Access denied to this webhook event",
            });
          }
        }

        return {
          success: true,
          event: {
            _id: event._id.toString(),
            event: event.event,
            delivery: event.delivery,
            repository: event.repository,
            payload: event.payload,
            signature: event.signature,
            timestamp: event.timestamp,
            processed: event.processed,
            ignored: event.ignored,
            failed: event.failed,
            error: event.error,
            ignoredReason: event.ignoredReason,
            processingResult: event.processingResult,
            processedAt: event.processedAt,
            projectId: event.projectId,
            orgSlug: event.orgSlug
          }
        };
      } catch (error) {
        console.error("Error getting webhook event:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get webhook event",
        });
      }
    }),

  // List all webhook events (admin only)
  listAllWebhookEvents: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        eventType: z.string().optional(),
        processed: z.boolean().optional(),
        failed: z.boolean().optional(),
        repository: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const { limit, offset, eventType, processed, failed, repository } = input;

        // Build query filter
        const filter = {};
        if (eventType) filter.event = eventType;
        if (typeof processed === 'boolean') filter.processed = processed;
        if (typeof failed === 'boolean') filter.failed = failed;
        if (repository) filter["repository.fullName"] = { $regex: repository, $options: 'i' };

        // Get webhook events
        const events = await db.gitEvents
          .find(filter)
          .sort({ timestamp: -1 })
          .skip(offset)
          .limit(limit)
          .toArray();

        // Get total count for pagination
        const total = await db.gitEvents.countDocuments(filter);

        return {
          success: true,
          events: events.map(event => ({
            _id: event._id.toString(),
            event: event.event,
            delivery: event.delivery,
            repository: event.repository,
            timestamp: event.timestamp,
            processed: event.processed,
            ignored: event.ignored,
            failed: event.failed,
            error: event.error,
            ignoredReason: event.ignoredReason,
            processingResult: event.processingResult,
            processedAt: event.processedAt,
            projectId: event.projectId,
            orgSlug: event.orgSlug
          })),
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total
          }
        };
      } catch (error) {
        console.error("Error listing all webhook events:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list webhook events",
        });
      }
    }),

  // Get webhook statistics (admin only)
  getWebhookStats: adminProcedure
    .query(async () => {
      try {
        // Get basic counts
        const totalEvents = await db.gitEvents.countDocuments({});
        const processedEvents = await db.gitEvents.countDocuments({ processed: true });
        const failedEvents = await db.gitEvents.countDocuments({ failed: true });
        const ignoredEvents = await db.gitEvents.countDocuments({ ignored: true });

        // Get events by type
        const eventTypeStats = await db.gitEvents.aggregate([
          {
            $group: {
              _id: "$event",
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ]).toArray();

        // Get recent activity (last 24 hours)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentEvents = await db.gitEvents.countDocuments({
          timestamp: { $gte: yesterday }
        });

        // Get events by repository
        const repositoryStats = await db.gitEvents.aggregate([
          {
            $group: {
              _id: "$repository.fullName",
              count: { $sum: 1 },
              lastEvent: { $max: "$timestamp" }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]).toArray();

        return {
          success: true,
          stats: {
            totals: {
              total: totalEvents,
              processed: processedEvents,
              failed: failedEvents,
              ignored: ignoredEvents,
              pending: totalEvents - processedEvents,
              recent24h: recentEvents
            },
            eventTypes: eventTypeStats,
            topRepositories: repositoryStats
          }
        };
      } catch (error) {
        console.error("Error getting webhook stats:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get webhook statistics",
        });
      }
    }),

  // Retry a failed webhook event (admin only)
  retryWebhookEvent: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { eventId } = input;

        // Get the webhook event
        const event = await db.gitEvents.findOne({ _id: new ObjectId(eventId) });

        if (!event) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Webhook event not found",
          });
        }

        // Only allow retry of failed events
        if (!event.failed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only retry failed webhook events",
          });
        }

        // Reset the event status for retry
        await db.gitEvents.updateOne(
          { _id: new ObjectId(eventId) },
          {
            $unset: {
              failed: "",
              error: "",
              processedAt: "",
              processingResult: ""
            },
            $set: {
              processed: false,
              retryCount: (event.retryCount || 0) + 1,
              lastRetryAt: new Date()
            }
          }
        );

        // TODO: Add logic to re-process the webhook event
        // This would involve re-running the webhook processing logic

        return {
          success: true,
          message: "Webhook event marked for retry",
          eventId: eventId
        };
      } catch (error) {
        console.error("Error retrying webhook event:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to retry webhook event",
        });
      }
    }),
};

// Export the router with all webhook routes
export const webhookRouter = router({
  listProjectEvents: webhookRoutes.listProjectWebhookEvents,
  getEvent: webhookRoutes.getWebhookEvent,
  listAllEvents: webhookRoutes.listAllWebhookEvents,
  getStats: webhookRoutes.getWebhookStats,
  retryEvent: webhookRoutes.retryWebhookEvent,
});