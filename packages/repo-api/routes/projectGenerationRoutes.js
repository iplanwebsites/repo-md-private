import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../lib/trpc/trpc.js";
import { protectedProcedure, projectAdminProcedure } from "../lib/trpc/procedures.js";
import { ProjectGenerationService } from "../lib/project-generation/projectGenerationServiceVolt.js";
import { db } from "../db.js";
import { ObjectId } from "mongodb";

// Initialize service
const projectGenService = new ProjectGenerationService(
  process.env.OPENAI_API_KEY,
  process.env.GITHUB_ACCESS_TOKEN
);

// Input validation schemas
const startConversationSchema = z.object({
  orgId: z.string(),
  sessionId: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional()
});

const continueConversationSchema = z.object({
  conversationId: z.string(),
  message: z.string().min(1).max(4000)
});

const generateProjectSchema = z.object({
  conversationId: z.string(),
  owner: z.string(),
  repo: z.string(),
  repoOptions: z.object({
    private: z.boolean().optional(),
    description: z.string().optional()
  }).optional()
});

const directGenerationSchema = z.object({
  brief: z.string().min(10).max(10000),
  owner: z.string(),
  repo: z.string(),
  orgId: z.string(),
  orgSlug: z.string(),
  simulate: z.boolean().optional(),
  repoOptions: z.object({
    private: z.boolean().optional(),
    description: z.string().optional()
  }).optional()
});

export const projectGenerationRouter = router({
  // Start a new project generation conversation
  startConversation: protectedProcedure
    .input(startConversationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user belongs to the organization
        const org = await db.orgs.findOne({
          _id: new ObjectId(input.orgId),
          $or: [
            { ownerId: ctx.user.id },
            { members: { $elemMatch: { userId: ctx.user.id } } }
          ]
        });

        if (!org) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this organization"
          });
        }

        const result = await projectGenService.startProjectConversation({
          userId: ctx.user.id,
          orgId: input.orgId,
          sessionId: input.sessionId || `session_${Date.now()}`,
          userAgent: input.userAgent || ctx.req?.headers["user-agent"],
          ipAddress: input.ipAddress || ctx.req?.ip
        });

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error
          });
        }

        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message
        });
      }
    }),

  // Continue an existing conversation
  continueConversation: protectedProcedure
    .input(continueConversationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns the conversation
        const convo = await db.convos.findOne({
          _id: new ObjectId(input.conversationId),
          userId: new ObjectId(ctx.user.id)
        });

        if (!convo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation not found"
          });
        }

        const result = await projectGenService.continueConversation(
          input.conversationId,
          input.message
        );

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error
          });
        }

        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message
        });
      }
    }),

  // Generate project from completed conversation
  generateProject: protectedProcedure
    .input(generateProjectSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns the conversation
        const convo = await db.convos.findOne({
          _id: new ObjectId(input.conversationId),
          userId: new ObjectId(ctx.user.id)
        });

        if (!convo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation not found"
          });
        }

        // Get organization slug
        const org = await db.orgs.findOne({ _id: convo.orgId });
        if (!org) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found"
          });
        }

        const result = await projectGenService.generateProjectFromConversation(
          input.conversationId,
          {
            owner: input.owner,
            repo: input.repo,
            repoOptions: input.repoOptions,
            orgSlug: org.slug
          }
        );

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error
          });
        }

        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message
        });
      }
    }),

  // Direct generation from brief (bypasses conversation)
  generateFromBrief: protectedProcedure
    .input(directGenerationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user belongs to the organization
        const org = await db.orgs.findOne({
          _id: new ObjectId(input.orgId),
          $or: [
            { ownerId: ctx.user.id },
            { members: { $elemMatch: { userId: ctx.user.id } } }
          ]
        });

        if (!org) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this organization"
          });
        }

        const result = await projectGenService.generateProjectFromBrief(
          input.brief,
          input.owner,
          input.repo,
          {
            projectBrief: null,
            orgId: new ObjectId(input.orgId),
            userId: new ObjectId(ctx.user.id),
            orgSlug: input.orgSlug,
            simulate: input.simulate,
            ...input.repoOptions
          }
        );

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error
          });
        }

        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message
        });
      }
    }),

  // Get conversation details
  getConversation: protectedProcedure
    .input(z.object({
      conversationId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const convo = await db.convos.findOne({
        _id: new ObjectId(input.conversationId),
        userId: new ObjectId(ctx.user.id)
      });

      if (!convo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found"
        });
      }

      return {
        id: convo._id.toString(),
        status: convo.status,
        type: convo.type,
        title: convo.title,
        createdAt: convo.createdAt,
        updatedAt: convo.updatedAt,
        messageCount: convo.messages.length,
        projectBrief: convo.projectBrief,
        generationResult: convo.generationResult,
        metrics: convo.metrics
      };
    }),

  // Get user's conversations
  listConversations: protectedProcedure
    .input(z.object({
      orgId: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      const query = {
        userId: new ObjectId(ctx.user.id)
      };

      if (input.orgId) {
        query.orgId = new ObjectId(input.orgId);
      }

      if (input.status) {
        query.status = input.status;
      }

      const conversations = await db.convos
        .find(query)
        .sort({ createdAt: -1 })
        .limit(input.limit)
        .skip(input.offset)
        .toArray();

      const total = await db.convos.countDocuments(query);

      return {
        conversations: conversations.map(convo => ({
          id: convo._id.toString(),
          status: convo.status,
          type: convo.type,
          title: convo.title,
          createdAt: convo.createdAt,
          updatedAt: convo.updatedAt,
          messageCount: convo.messages.length,
          hasProjectBrief: !!convo.projectBrief,
          generationSuccess: convo.generationResult?.success
        })),
        total,
        hasMore: input.offset + input.limit < total
      };
    }),

  // Delete a conversation
  deleteConversation: protectedProcedure
    .input(z.object({
      conversationId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.convos.deleteOne({
        _id: new ObjectId(input.conversationId),
        userId: new ObjectId(ctx.user.id)
      });

      if (result.deletedCount === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found"
        });
      }

      return { success: true };
    }),

  // Get conversation messages (for replay/review)
  getConversationMessages: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      const convo = await db.convos.findOne({
        _id: new ObjectId(input.conversationId),
        userId: new ObjectId(ctx.user.id)
      });

      if (!convo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found"
        });
      }

      const messages = convo.messages
        .slice(input.offset, input.offset + input.limit)
        .map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          functionCall: msg.functionCall
        }));

      return {
        messages,
        total: convo.messages.length,
        hasMore: input.offset + input.limit < convo.messages.length
      };
    })
});