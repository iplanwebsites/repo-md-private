import { z } from "zod";
import { router, procedure } from "../lib/trpc/trpc.js";
import {
  protectedProcedure,
  adminProcedure,
  projectProcedure,
} from "../lib/trpc/procedures.js";
import * as conversation from "../lib/llm/conversationVolt.js";
import {
  getOrgConversations,
  getProjectConversations,
  getPublicProjectConversations,
  getUserConversations,
  getConversationStats,
  checkConversationAccess,
} from "../lib/llm/conversationHelpers.js";
import { AGENT_TYPES, getAgentTools } from "../lib/llm/agents/index.js";

/**
 * Unified conversation filter schema
 */
const conversationFilterSchema = z.object({
  // Context filters
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  userId: z.string().optional(),

  // Type filters
  agentType: z.enum(["editor", "project", "public_project"]).optional(),
  isPublic: z.boolean().optional(),

  // Session filter for public convos
  sessionId: z.string().optional(),

  // Pagination
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),

  // Time range
  since: z.date().optional(),
  until: z.date().optional(),
});

/**
 * Conversation schema matching OpenAI Response structure
 */
const conversationSchema = z.object({
  id: z.string(),
  object: z.literal("conversation"),
  created_at: z.number(),
  status: z.enum(["active", "completed", "failed"]),
  model: z.string(),
  agentType: z.string(),

  // Context
  userId: z.string().nullable(),
  orgId: z.string().nullable(),
  projectId: z.string().nullable(),
  sessionId: z.string().nullable(),

  // Messages following OpenAI format
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant", "function"]),
      content: z.string(),
      timestamp: z.date(),
      tool_calls: z.array(z.any()).optional(),
    })
  ),

  // Metadata
  metadata: z.record(z.any()).optional(),
  usage: z
    .object({
      total_tokens: z.number(),
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
    })
    .optional(),
});

export const llmRouter = router({
  /**
   * Create a new conversation (OpenAI-style)
   */
  create: protectedProcedure
    .input(
      z.object({
        model: z.string().optional(),
        agentType: z
          .enum(["editor", "project", "public_project"])
          .default("editor"),

        // Context
        projectId: z.string().optional(),
        orgId: z.string().optional(),

        // Initial input
        input: z
          .union([
            z.string(),
            z.array(
              z.object({
                type: z.enum(["text", "image"]),
                text: z.string().optional(),
                image_url: z.string().optional(),
              })
            ),
          ])
          .optional(),

        // System instructions
        instructions: z.string().optional(),

        // Metadata
        metadata: z.record(z.any()).optional(),

        // Settings
        temperature: z.number().min(0).max(2).optional(),
        max_tokens: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conversationId = await conversation.startConversation({
        userId: ctx.user.id,
        orgId: input.orgId || ctx.user.orgId,
        projectId: input.projectId,
        agentType: input.agentType,
        initialContext: {
          model: input.model,
          instructions: input.instructions,
          metadata: input.metadata,
          temperature: input.temperature,
          maxTokens: input.max_tokens,
        },
      });

      // If initial input provided, send first message
      let response = null;
      if (input.input) {
        const message =
          typeof input.input === "string"
            ? input.input
            : input.input.map((i) => i.text || "").join("\n");

        const tools = await getAgentTools(input.agentType);
        response = await conversation.sendMessage(
          conversationId,
          message,
          tools
        );
      }

      // Return OpenAI-style response
      return {
        id: conversationId,
        object: "conversation",
        created_at: Date.now() / 1000,
        status: "active",
        model: input.model || "gpt-4.1-mini",
        output: response
          ? [
              {
                type: "message",
                role: "assistant",
                content: response.content,
              },
            ]
          : null,
        usage: response?.usage,
      };
    }),

  /**
   * Unified conversation selector
   */
  list: protectedProcedure
    .input(conversationFilterSchema)
    .query(async ({ ctx, input }) => {
      const { db } = await import("../db.js");
      const { ObjectId } = await import("mongodb");

      // Build query based on filters
      const query = {};

      // User context - always filter by user unless admin
      if (!ctx.user.isAdmin) {
        query.$or = [{ userId: new ObjectId(ctx.user.id) }, { isPublic: true }];
      } else if (input.userId) {
        query.userId = new ObjectId(input.userId);
      }

      // Context filters
      if (input.orgId) query.orgId = new ObjectId(input.orgId);
      if (input.projectId) query.projectId = new ObjectId(input.projectId);
      if (input.sessionId) query.sessionId = input.sessionId;

      // Type filters
      if (input.agentType) query.agentType = input.agentType;
      if (input.isPublic !== undefined) query.isPublic = input.isPublic;

      // Time range
      if (input.since || input.until) {
        query.createdAt = {};
        if (input.since) query.createdAt.$gte = input.since;
        if (input.until) query.createdAt.$lte = input.until;
      }

      // Execute query
      const conversations = await db.convos
        .find(query)
        .sort({ updatedAt: -1 })
        .skip(input.offset)
        .limit(input.limit)
        .toArray();

      const total = await db.convos.countDocuments(query);

      // Transform to OpenAI-style format
      const data = conversations.map((conv) => ({
        id: conv._id.toString(),
        object: "conversation",
        created_at: conv.createdAt.getTime() / 1000,
        status: conv.status || "active",
        model: conv.agentConfig?.model || "gpt-4.1-mini",
        agentType: conv.agentType,
        userId: conv.userId?.toString(),
        orgId: conv.orgId?.toString(),
        projectId: conv.projectId?.toString(),
        sessionId: conv.sessionId,
        message_count: conv.messages?.length || 0,
        last_message_at: conv.updatedAt.getTime() / 1000,
        metadata: conv.metadata || {},
      }));

      return {
        object: "list",
        data,
        has_more: input.offset + input.limit < total,
        total,
      };
    }),

  /**
   * Get single conversation
   */
  get: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { hasAccess, conversation: conv } = await checkConversationAccess(
        input.conversationId,
        ctx.user.id
      );

      if (!hasAccess) {
        throw new Error("Conversation not found or access denied");
      }

      // Transform to OpenAI-style
      return {
        id: conv._id.toString(),
        object: "conversation",
        created_at: conv.createdAt.getTime() / 1000,
        status: conv.status || "active",
        model: conv.agentConfig?.model || "gpt-4.1-mini",
        agentType: conv.agentType,
        messages: conv.messages,
        usage: conv.usage,
        metadata: conv.metadata || {},
      };
    }),

  /**
   * Switch conversation context (e.g., from general to project)
   */
  switchContext: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        newAgentType: z.enum(["editor", "project", "public_project"]),
        projectId: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = await import("../db.js");
      const { ObjectId } = await import("mongodb");

      // Verify ownership
      const conv = await db.convos.findOne({
        _id: new ObjectId(input.conversationId),
        userId: new ObjectId(ctx.user.id),
      });

      if (!conv) {
        throw new Error("Conversation not found");
      }

      // Update conversation
      const updates = {
        agentType: input.newAgentType,
        "context.switched": true,
        "context.switchedAt": new Date(),
        "context.previousType": conv.agentType,
      };

      if (input.projectId) {
        updates.projectId = new ObjectId(input.projectId);
      }

      if (input.metadata) {
        updates.metadata = { ...conv.metadata, ...input.metadata };
      }

      await db.convos.updateOne(
        { _id: new ObjectId(input.conversationId) },
        { $set: updates }
      );

      return {
        success: true,
        previousType: conv.agentType,
        newType: input.newAgentType,
      };
    }),

  /**
   * Delete conversation
   */
  delete: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const deleted = await conversation.deleteConversation(
        input.conversationId,
        ctx.user.id
      );

      if (!deleted) {
        throw new Error("Conversation not found");
      }

      return { success: true };
    }),

  /**
   * Get conversation statistics
   */
  stats: protectedProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        agentType: z.string().optional(),
        timeRange: z
          .object({
            start: z.date().optional(),
            end: z.date().optional(),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await getConversationStats({
        userId: ctx.user.id,
        ...input,
      });
    }),

  /**
   * Convenience methods matching the helper functions
   */
  byOrg: protectedProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
        agentType: z.string().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = input.orgId || ctx.user.orgId;
      if (!orgId) throw new Error("No organization context");

      return await getOrgConversations(orgId, {
        agentType: input.agentType,
        limit: input.limit,
      });
    }),

  byProject: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        agentType: z.string().optional(),
        includePublic: z.boolean().default(true),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      return await getProjectConversations(input.projectId, {
        agentType: input.agentType,
        includePublic: input.includePublic,
        limit: input.limit,
      });
    }),

  byUser: protectedProcedure
    .input(
      z.object({
        agentType: z.string().optional(),
        projectId: z.string().optional(),
        orgId: z.string().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return await getUserConversations(ctx.user.id, input);
    }),
});
