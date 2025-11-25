import { z } from "zod";
import { protectedProcedure, projectProcedure, projectAdminProcedure } from "../lib/trpc/procedures.js";
import { db } from "../db.js";
import { ObjectId } from "mongodb";
import { TRPCError } from "@trpc/server";
import WebhookTokenGenerator from "../lib/webhooks/WebhookTokenGenerator.js";
import WebhookSigner from "../lib/webhooks/WebhookSigner.js";
import outgoingWebhookDispatcher from "../lib/webhooks/OutgoingWebhookDispatcher.js";

// Event type enum
const eventTypeEnum = z.enum([
  'deployment.started',
  'deployment.completed',
  'deployment.failed',
  'content.updated',
  'project.updated',
  'user.invited',
  'user.removed'
]);

import { router } from "../lib/trpc/trpc.js";

const projectWebhookProcedures = {
  // ===== INCOMING WEBHOOKS =====
  
  incoming: {
    // Create incoming webhook
    create: projectAdminProcedure
      .input(z.object({
        projectId: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        provider: z.enum(['slack', 'github', 'discord', 'email', 'calendar', 'api', 'custom']).optional(),
        agentInstructions: z.string().optional(),
        permissions: z.object({
          content_management: z.object({
            create_content: z.boolean(),
            update_content: z.boolean(),
            delete_content: z.boolean()
          }).optional(),
          media_management: z.object({
            upload_media: z.boolean(),
            generate_images: z.boolean(),
            optimize_media: z.boolean()
          }).optional(),
          deployment: z.object({
            trigger_build: z.boolean(),
            deploy_preview: z.boolean(),
            rollback: z.boolean()
          }).optional(),
          external_services: z.object({
            call_apis: z.boolean(),
            send_emails: z.boolean(),
            trigger_webhooks: z.boolean()
          }).optional(),
          data_access: z.object({
            read_analytics: z.boolean(),
            access_database: z.boolean(),
            modify_settings: z.boolean()
          }).optional(),
          ai_agents: z.object({
            execute_agents: z.boolean(),
            train_models: z.boolean()
          }).optional()
        }).optional(),
        allowedIps: z.array(z.string().ip()).optional(),
        allowedMethods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])).optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const { projectId, ...webhookData } = input;
        
        // Generate token and URL
        const token = WebhookTokenGenerator.generate();
        const webhookUrl = WebhookTokenGenerator.generateUrl(token);
        
        // Create webhook
        const webhook = {
          _id: new ObjectId(),
          projectId: new ObjectId(projectId),
          token,
          webhookUrl,
          isActive: true,
          totalCalls: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: ctx.user.id,
          ...webhookData
        };
        
        await db.projectWebhooks.insertOne(webhook);
        
        return {
          webhook: {
            ...webhook,
            token: undefined // Don't return token in response
          },
          webhookUrl
        };
      }),
    
    // List incoming webhooks
    list: projectProcedure
      .input(z.object({
        projectId: z.string(),
        includeInactive: z.boolean().default(false)
      }))
      .query(async ({ input }) => {
        const filter = {
          projectId: new ObjectId(input.projectId)
        };
        
        if (!input.includeInactive) {
          filter.isActive = true;
        }
        
        const webhooks = await db.projectWebhooks
          .find(filter)
          .project({ token: 0 }) // Don't include token
          .sort({ createdAt: -1 })
          .toArray();
          
        return webhooks;
      }),
    
    // Get webhook details
    get: projectProcedure
      .input(z.object({
        webhookId: z.string()
      }))
      .query(async ({ input }) => {
        const webhook = await db.projectWebhooks.findOne(
          { _id: new ObjectId(input.webhookId) },
          { projection: { token: 0 } }
        );
        
        if (!webhook) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Webhook not found'
          });
        }
        
        return webhook;
      }),
    
    // Update webhook
    update: projectAdminProcedure
      .input(z.object({
        webhookId: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        isActive: z.boolean().optional(),
        provider: z.enum(['slack', 'github', 'discord', 'email', 'calendar', 'api', 'custom']).optional(),
        agentInstructions: z.string().optional(),
        permissions: z.object({
          content_management: z.object({
            create_content: z.boolean(),
            update_content: z.boolean(),
            delete_content: z.boolean()
          }).optional(),
          media_management: z.object({
            upload_media: z.boolean(),
            generate_images: z.boolean(),
            optimize_media: z.boolean()
          }).optional(),
          deployment: z.object({
            trigger_build: z.boolean(),
            deploy_preview: z.boolean(),
            rollback: z.boolean()
          }).optional(),
          external_services: z.object({
            call_apis: z.boolean(),
            send_emails: z.boolean(),
            trigger_webhooks: z.boolean()
          }).optional(),
          data_access: z.object({
            read_analytics: z.boolean(),
            access_database: z.boolean(),
            modify_settings: z.boolean()
          }).optional(),
          ai_agents: z.object({
            execute_agents: z.boolean(),
            train_models: z.boolean()
          }).optional()
        }).optional(),
        allowedIps: z.array(z.string().ip()).optional(),
        allowedMethods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])).optional()
      }))
      .mutation(async ({ input }) => {
        const { webhookId, ...updates } = input;
        
        const result = await db.projectWebhooks.updateOne(
          { _id: new ObjectId(webhookId) },
          { 
            $set: {
              ...updates,
              updatedAt: new Date()
            }
          }
        );
        
        if (result.matchedCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Webhook not found'
          });
        }
        
        return { success: true };
      }),
    
    // Delete webhook
    delete: projectAdminProcedure
      .input(z.object({
        webhookId: z.string()
      }))
      .mutation(async ({ input }) => {
        const result = await db.projectWebhooks.deleteOne({
          _id: new ObjectId(input.webhookId)
        });
        
        if (result.deletedCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Webhook not found'
          });
        }
        
        // Also delete related events
        await db.projectWebhookEvents.deleteMany({
          webhookId: new ObjectId(input.webhookId)
        });
        
        return { success: true };
      }),
    
    // Regenerate webhook token
    regenerateToken: projectAdminProcedure
      .input(z.object({
        webhookId: z.string()
      }))
      .mutation(async ({ input }) => {
        const token = WebhookTokenGenerator.generate();
        const webhookUrl = WebhookTokenGenerator.generateUrl(token);
        
        const result = await db.projectWebhooks.updateOne(
          { _id: new ObjectId(input.webhookId) },
          { 
            $set: {
              token,
              webhookUrl,
              updatedAt: new Date()
            }
          }
        );
        
        if (result.matchedCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Webhook not found'
          });
        }
        
        return { webhookUrl };
      }),
    
    // List webhook executions
    listExecutions: projectProcedure
      .input(z.object({
        webhookId: z.string().nullable().optional(),
        projectId: z.string().nullable().optional(),
        status: z.enum(['success', 'failed', 'rejected', 'processing']).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        startDate: z.date().optional(),
        endDate: z.date().optional()
      }))
      .query(async ({ input }) => {
        const filter = {};
        
        if (input.webhookId && input.webhookId !== null) {
          filter.webhookId = new ObjectId(input.webhookId);
        }
        
        if (input.projectId && input.projectId !== null) {
          filter.projectId = new ObjectId(input.projectId);
        }
        
        if (input.status) {
          filter.status = input.status;
        }
        
        if (input.startDate || input.endDate) {
          filter.createdAt = {};
          if (input.startDate) filter.createdAt.$gte = input.startDate;
          if (input.endDate) filter.createdAt.$lte = input.endDate;
        }
        
        const [executions, total] = await Promise.all([
          db.projectWebhookEvents
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(input.limit)
            .skip(input.offset)
            .toArray(),
          db.projectWebhookEvents.countDocuments(filter)
        ]);
        
        return { executions, total };
      }),
    
    // Get execution details
    getExecution: projectProcedure
      .input(z.object({
        executionId: z.string()
      }))
      .query(async ({ input }) => {
        const execution = await db.projectWebhookEvents.findOne({
          _id: new ObjectId(input.executionId)
        });
        
        if (!execution) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Execution not found'
          });
        }
        
        return execution;
      })
  },
  
  // ===== OUTGOING WEBHOOKS =====
  
  outgoing: {
    // Create outgoing webhook
    create: projectAdminProcedure
      .input(z.object({
        projectId: z.string(),
        name: z.string().min(1).max(100),
        targetUrl: z.string().url(),
        events: z.array(eventTypeEnum).min(1),
        headers: z.record(z.string()).optional(),
        secret: z.string().optional(),
        retryPolicy: z.object({
          enabled: z.boolean().default(true),
          maxAttempts: z.number().min(0).max(10).default(3),
          backoffRate: z.number().min(1).max(5).default(2),
          timeoutMs: z.number().min(1000).max(60000).default(30000)
        }).optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const { projectId, secret, ...webhookData } = input;
        
        // Generate secret if not provided
        const webhookSecret = secret || WebhookSigner.generateSecret();
        
        const webhook = {
          _id: new ObjectId(),
          projectId: new ObjectId(projectId),
          secret: webhookSecret,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: ctx.user.id,
          ...webhookData
        };
        
        await db.projectOutgoingWebhooks.insertOne(webhook);
        
        return {
          ...webhook,
          secret: undefined // Don't return secret
        };
      }),
    
    // List outgoing webhooks
    list: projectProcedure
      .input(z.object({
        projectId: z.string(),
        includeInactive: z.boolean().default(false)
      }))
      .query(async ({ input }) => {
        const filter = {
          projectId: new ObjectId(input.projectId)
        };
        
        if (!input.includeInactive) {
          filter.isActive = true;
        }
        
        const webhooks = await db.projectOutgoingWebhooks
          .find(filter)
          .project({ secret: 0 }) // Don't include secret
          .sort({ createdAt: -1 })
          .toArray();
          
        return webhooks;
      }),
    
    // Update outgoing webhook
    update: projectAdminProcedure
      .input(z.object({
        webhookId: z.string(),
        name: z.string().min(1).max(100).optional(),
        targetUrl: z.string().url().optional(),
        events: z.array(eventTypeEnum).min(1).optional(),
        headers: z.record(z.string()).optional(),
        secret: z.string().optional(),
        isActive: z.boolean().optional(),
        retryPolicy: z.object({
          enabled: z.boolean(),
          maxAttempts: z.number().min(0).max(10),
          backoffRate: z.number().min(1).max(5),
          timeoutMs: z.number().min(1000).max(60000)
        }).optional()
      }))
      .mutation(async ({ input }) => {
        const { webhookId, ...updates } = input;
        
        const result = await db.projectOutgoingWebhooks.updateOne(
          { _id: new ObjectId(webhookId) },
          { 
            $set: {
              ...updates,
              updatedAt: new Date()
            }
          }
        );
        
        if (result.matchedCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Webhook not found'
          });
        }
        
        return { success: true };
      }),
    
    // Delete outgoing webhook
    delete: projectAdminProcedure
      .input(z.object({
        webhookId: z.string()
      }))
      .mutation(async ({ input }) => {
        const result = await db.projectOutgoingWebhooks.deleteOne({
          _id: new ObjectId(input.webhookId)
        });
        
        if (result.deletedCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Webhook not found'
          });
        }
        
        // Also delete related events
        await db.projectOutgoingWebhookEvents.deleteMany({
          webhookId: new ObjectId(input.webhookId)
        });
        
        return { success: true };
      }),
    
    // Test webhook
    test: projectAdminProcedure
      .input(z.object({
        webhookId: z.string(),
        eventType: eventTypeEnum
      }))
      .mutation(async ({ input }) => {
        await outgoingWebhookDispatcher.testWebhook(
          input.webhookId,
          input.eventType
        );
        
        return { success: true, message: 'Test webhook dispatched' };
      }),
    
    // List webhook executions
    listExecutions: projectProcedure
      .input(z.object({
        webhookId: z.string().optional(),
        projectId: z.string().optional(),
        status: z.enum(['pending', 'success', 'failed', 'retrying']).optional(),
        eventType: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        startDate: z.date().optional(),
        endDate: z.date().optional()
      }))
      .query(async ({ input }) => {
        const filter = {};
        
        if (input.webhookId) {
          filter.webhookId = new ObjectId(input.webhookId);
        }
        
        if (input.projectId) {
          filter.projectId = new ObjectId(input.projectId);
        }
        
        if (input.status) {
          filter.status = input.status;
        }
        
        if (input.eventType) {
          filter.triggerEvent = input.eventType;
        }
        
        if (input.startDate || input.endDate) {
          filter.createdAt = {};
          if (input.startDate) filter.createdAt.$gte = input.startDate;
          if (input.endDate) filter.createdAt.$lte = input.endDate;
        }
        
        const [executions, total] = await Promise.all([
          db.projectOutgoingWebhookEvents
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(input.limit)
            .skip(input.offset)
            .toArray(),
          db.projectOutgoingWebhookEvents.countDocuments(filter)
        ]);
        
        return { executions, total };
      }),
    
    // Retry failed execution
    retryExecution: projectAdminProcedure
      .input(z.object({
        executionId: z.string()
      }))
      .mutation(async ({ input }) => {
        await outgoingWebhookDispatcher.retryFailedWebhook(input.executionId);
        return { success: true, message: 'Webhook retry initiated' };
      })
  },
  
  // ===== ANALYTICS =====
  
  // Get webhook statistics
  getStats: projectProcedure
    .input(z.object({
      projectId: z.string(),
      type: z.enum(['incoming', 'outgoing']),
      period: z.enum(['24h', '7d', '30d']).default('7d')
    }))
    .query(async ({ input }) => {
      const projectId = new ObjectId(input.projectId);
      const now = new Date();
      const periodMs = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      const startDate = new Date(now.getTime() - periodMs[input.period]);
      
      const eventsCollection = input.type === 'incoming' 
        ? db.projectWebhookEvents 
        : db.projectOutgoingWebhookEvents;
        
      const webhooksCollection = input.type === 'incoming'
        ? db.projectWebhooks
        : db.projectOutgoingWebhooks;
      
      // Get basic stats
      const [totalWebhooks, activeWebhooks, events] = await Promise.all([
        webhooksCollection.countDocuments({ projectId }),
        webhooksCollection.countDocuments({ projectId, isActive: true }),
        eventsCollection.find({
          projectId,
          createdAt: { $gte: startDate }
        }).toArray()
      ]);
      
      // Calculate metrics
      const totalExecutions = events.length;
      const successfulExecutions = events.filter(e => 
        e.status === 'success' || e.finalStatus === 'delivered'
      ).length;
      const failedExecutions = events.filter(e => 
        e.status === 'failed' || e.finalStatus === 'failed_permanently'
      ).length;
      
      const successRate = totalExecutions > 0 
        ? (successfulExecutions / totalExecutions) * 100 
        : 0;
      
      // Calculate average response time for outgoing webhooks
      let averageResponseTime = 0;
      if (input.type === 'outgoing') {
        const responseTimes = events
          .filter(e => e.response?.responseTime)
          .map(e => e.response.responseTime);
        
        if (responseTimes.length > 0) {
          averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        }
      }
      
      // Event type breakdown for outgoing webhooks
      const eventTypeBreakdown = {};
      if (input.type === 'outgoing') {
        events.forEach(e => {
          if (e.triggerEvent) {
            eventTypeBreakdown[e.triggerEvent] = (eventTypeBreakdown[e.triggerEvent] || 0) + 1;
          }
        });
      }
      
      // Time series data for charts
      const timeSeriesData = [];
      const bucketSize = input.period === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 1 hour or 1 day
      
      for (let time = startDate.getTime(); time < now.getTime(); time += bucketSize) {
        const bucketStart = new Date(time);
        const bucketEnd = new Date(time + bucketSize);
        const bucketEvents = events.filter(e => 
          e.createdAt >= bucketStart && e.createdAt < bucketEnd
        );
        
        timeSeriesData.push({
          timestamp: bucketStart,
          total: bucketEvents.length,
          successful: bucketEvents.filter(e => 
            e.status === 'success' || e.finalStatus === 'delivered'
          ).length,
          failed: bucketEvents.filter(e => 
            e.status === 'failed' || e.finalStatus === 'failed_permanently'
          ).length
        });
      }
      
      return {
        totalWebhooks,
        activeWebhooks,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate,
        averageResponseTime,
        eventTypeBreakdown,
        timeSeriesData
      };
    })
};

// Create nested routers for incoming and outgoing webhooks
const incomingRouter = router({
  create: projectWebhookProcedures.incoming.create,
  list: projectWebhookProcedures.incoming.list,
  get: projectWebhookProcedures.incoming.get,
  update: projectWebhookProcedures.incoming.update,
  delete: projectWebhookProcedures.incoming.delete,
  regenerateToken: projectWebhookProcedures.incoming.regenerateToken,
  listExecutions: projectWebhookProcedures.incoming.listExecutions,
  getExecution: projectWebhookProcedures.incoming.getExecution
});

const outgoingRouter = router({
  create: projectWebhookProcedures.outgoing.create,
  list: projectWebhookProcedures.outgoing.list,
  update: projectWebhookProcedures.outgoing.update,
  delete: projectWebhookProcedures.outgoing.delete,
  test: projectWebhookProcedures.outgoing.test,
  listExecutions: projectWebhookProcedures.outgoing.listExecutions,
  retryExecution: projectWebhookProcedures.outgoing.retryExecution
});

export const projectWebhookRouter = router({
  incoming: incomingRouter,
  outgoing: outgoingRouter,
  getStats: projectWebhookProcedures.getStats
});