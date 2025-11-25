import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ObjectId } from "mongodb";
import { router } from "../../lib/trpc/trpc.js";
import {
  protectedProcedure,
  projectProcedure,
} from "../../lib/trpc/procedures.js";
import { db } from "../../db.js";
import editorChatDb from "../../lib/db/editorChat.js";
import { getProjectById } from "../../lib/project.js";
import { EditorChatHandler } from "../../lib/llm/editorChat.js";

// Enable dummy data for UI testing
const DUMMY_DATA = true;

const editorChatRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        projectId: z.string().optional(),
        title: z.string().optional(),
        model: z.string().default("gpt-4.1-mini"),
        temperature: z.number().min(0).max(2).default(0.7),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { orgId } = input;

      let project = null;
      // Verify org access
      const org = await db.orgs.findOne({
        handle: orgId,
        $or: [
          { owner: user.id },
          { members: { $elemMatch: { userId: user.id } } },
        ],
      });

      if (!org) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Organization not found or access denied",
        });
      }

      if (input.projectId) {
        project = await getProjectById(input.projectId);

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Verify project belongs to the organization
        // Skip org validation for now - projects might use orgId string instead of ObjectId
        // TODO: Standardize how projects store organization references
      }

      const chat = await editorChatDb.create({
        user: user._id,
        org: org._id,
        project: project?._id,
        title: input.title,
        model: input.model,
        temperature: input.temperature,
      });

      return {
        id: chat._id.toString(),
        title: chat.title,
        createdAt: chat.createdAt,
        model: chat.model,
        temperature: chat.temperature,
        source: chat.source || "web",
        project: project
          ? {
              id: project._id.toString(),
              name: project.name,
            }
          : null,
      };
    }),

  list: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        projectId: z.string().optional(),
        status: z.enum(["active", "completed", "archived"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        skip: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { orgId } = input;

      // Verify org access
      const org = await db.orgs.findOne({
        handle: orgId,
        $or: [
          { owner: user.id },
          { members: { $elemMatch: { userId: user.id } } },
        ],
      });

      if (!org) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Organization not found or access denied",
        });
      }

      const { chats, total } = await editorChatDb.list({
        // Don't filter by user - show all chats in the org
        org: org._id,
        project: input.projectId ? new ObjectId(input.projectId) : undefined,
        status: input.status,
        limit: input.limit,
        skip: input.skip,
      });

      return {
        chats: chats.map((chat) => ({
          id: chat._id.toString(),
          title: chat.title,
          summary: chat.summary,
          status: chat.status,
          source: chat.source || "web",
          lastActivity: chat.metadata.lastActivity,
          createdAt: chat.createdAt,
          messageCount: chat.messages.length,
          taskCount: chat.tasks.length,
          tokensUsed: chat.tokensUsed.total,
          project: chat.project
            ? {
                id: chat.project._id.toString(),
                name: chat.project.name,
              }
            : null,
        })),
        total,
        hasMore: input.skip + input.limit < total,
      };
    }),

  get: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const chat = await editorChatDb.findById(input.chatId);

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      // Verify user has access to this chat
      // Handle case where chat.user might be an ObjectId directly
      const chatUserId = chat.user?._id || chat.user;
      if (!chatUserId || chatUserId.toString() !== user._id.toString()) {
        // Also check if user has access to the org
        const chatOrgId = chat.org?._id || chat.org;
        const org = await db.orgs.findOne({
          _id: chatOrgId,
          $or: [
            { owner: user.id },
            { members: { $elemMatch: { userId: user.id } } },
          ],
        });

        if (!org) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied",
          });
        }
      }

      // Add sample messages if DUMMY_DATA is enabled
      if (DUMMY_DATA && chat.messages.length === 0) {
        chat.messages = [
          {
            id: "msg_1",
            role: "user",
            content:
              "Write a comprehensive blog article about the migration patterns of loggerhead sea turtles in the Pacific Ocean, including recent research findings and conservation efforts.",
            timestamp: new Date(Date.now() - 3600000),
            attachments: [
              {
                type: "file",
                url: "/api/files/research-notes.md",
                name: "research-notes.md",
                size: 2048,
                mimeType: "text/markdown"
              },
              {
                type: "image",
                url: "/api/files/turtle-migration-map.png",
                name: "turtle-migration-map.png",
                size: 152400,
                mimeType: "image/png"
              }
            ],
          },
          {
            id: "msg_2",
            role: "assistant",
            content:
              "I'll help you create a comprehensive blog article about loggerhead sea turtle migration patterns. Let me research and write this content for you.",
            timestamp: new Date(Date.now() - 3590000),
            tool_calls: [
              {
                id: "tool_1",
                type: "function",
                function: {
                  name: "search_project_files",
                  arguments: '{"query":"turtle migration"}',
                },
              },
              {
                id: "tool_2",
                type: "function",
                function: {
                  name: "create_file",
                  arguments:
                    '{"path":"content/blog/turtle-migration.md","content":"..."}',
                },
              },
            ],
          },
          {
            id: "msg_3",
            role: "tool",
            tool_call_id: "tool_1",
            content: JSON.stringify({
              results: [],
              message: "No existing files found about turtle migration",
            }),
          },
          {
            id: "msg_4",
            role: "tool",
            tool_call_id: "tool_2",
            content: JSON.stringify({
              type: "created",
              path: "content/blog/turtle-migration.md",
              branch: "editorChat-sample-branch",
              message: "File created successfully",
            }),
          },
          {
            id: "msg_5",
            role: "assistant",
            content:
              "I've created a comprehensive blog article about loggerhead sea turtle migration patterns. The file has been created at `content/blog/turtle-migration.md`.\n\nWould you like me to add any specific sections or modify the content?",
          },
          {
            id: "msg_6",
            role: "user",
            content: "Can you update the existing turtle conservation page with the latest 2024 data? Here's the current version and the new research data.",
            timestamp: new Date(Date.now() - 1800000),
            attachments: [
              {
                type: "file",
                url: "/api/files/conservation-2024-data.csv",
                name: "conservation-2024-data.csv",
                size: 8192,
                mimeType: "text/csv"
              },
              {
                type: "file",
                url: "/api/files/current-conservation-page.md",
                name: "current-conservation-page.md",
                size: 4096,
                mimeType: "text/markdown"
              }
            ],
          },
          {
            id: "msg_7",
            role: "assistant",
            content: "I'll update the conservation page with the 2024 data. Let me first read the existing page and analyze the new data.",
            timestamp: new Date(Date.now() - 1790000),
            tool_calls: [
              {
                id: "tool_3",
                type: "function",
                function: {
                  name: "read_file",
                  arguments: '{"path":"content/pages/turtle-conservation.md"}',
                },
              },
              {
                id: "tool_4",
                type: "function",
                function: {
                  name: "edit_file",
                  arguments: '{"path":"content/pages/turtle-conservation.md","content":"Updated content with 2024 data..."}',
                },
              },
            ],
          },
          {
            id: "msg_8",
            role: "tool",
            tool_call_id: "tool_3",
            content: JSON.stringify({
              content: "# Sea Turtle Conservation\n\nLast updated: 2023...",
              path: "content/pages/turtle-conservation.md",
            }),
          },
          {
            id: "msg_9",
            role: "tool",
            tool_call_id: "tool_4",
            content: JSON.stringify({
              type: "updated",
              path: "content/pages/turtle-conservation.md",
              branch: "editorChat-sample-branch",
              message: "File updated successfully with 2024 conservation data",
            }),
          },
          {
            id: "msg_10",
            role: "assistant",
            content: "I've successfully updated the turtle conservation page with the latest 2024 data. The changes include:\n\n- Updated population statistics from the CSV data\n- Added new conservation success stories from 2024\n- Revised the protection measures section\n\nThe file has been updated at `content/pages/turtle-conservation.md`.",
            toolsUsed: ["read_file", "edit_file"],
          },
          {
            id: "msg_11",
            role: "user",
            content: "Can you show me all the turtle-related content files we have?",
            timestamp: new Date(Date.now() - 900000),
          },
          {
            id: "msg_12",
            role: "assistant",
            content: "I'll search for all turtle-related content files in the project.",
            timestamp: new Date(Date.now() - 890000),
            tool_calls: [
              {
                id: "tool_5",
                type: "function",
                function: {
                  name: "list_files",
                  arguments: '{"path":"content","recursive":true}',
                },
              },
            ],
          },
          {
            id: "msg_13",
            role: "tool",
            tool_call_id: "tool_5",
            content: JSON.stringify({
              files: [
                { path: "content/blog/turtle-migration.md", size: 4532, type: "file" },
                { path: "content/pages/turtle-conservation.md", size: 3841, type: "file" },
                { path: "content/research/turtle-nesting-sites.md", size: 2156, type: "file" },
                { path: "content/images/turtle-migration-map.png", size: 152400, type: "file" },
                { path: "content/data/conservation-2024-data.csv", size: 8192, type: "file" }
              ]
            }),
          },
          {
            id: "msg_14",
            role: "assistant",
            content: "Here are all the turtle-related content files in the project:\n\n**Blog Posts:**\n- `content/blog/turtle-migration.md` (4.5 KB) - Our comprehensive article on migration patterns\n\n**Pages:**\n- `content/pages/turtle-conservation.md` (3.8 KB) - Conservation efforts page (just updated with 2024 data)\n\n**Research:**\n- `content/research/turtle-nesting-sites.md` (2.1 KB) - Research on nesting locations\n\n**Media:**\n- `content/images/turtle-migration-map.png` (149 KB) - Migration route visualization\n\n**Data:**\n- `content/data/conservation-2024-data.csv` (8 KB) - Latest conservation statistics\n\nWould you like me to read or update any of these files?",
            toolsUsed: ["list_files"],
          },
        ];

        // Add sample tasks
        chat.tasks = [
          {
            id: "task_1",
            type: "search_project_files",
            status: "completed",
            input: { query: "turtle migration" },
            output: { results: [], message: "No existing files found" },
            createdAt: new Date(Date.now() - 3590000),
            completedAt: new Date(Date.now() - 3580000),
          },
          {
            id: "task_2",
            type: "create_file",
            status: "completed",
            input: { path: "content/blog/turtle-migration.md" },
            output: {
              type: "created",
              path: "content/blog/turtle-migration.md",
            },
            createdAt: new Date(Date.now() - 3580000),
            completedAt: new Date(Date.now() - 3570000),
          },
          {
            id: "task_3",
            type: "read_file",
            status: "completed",
            input: { path: "content/pages/turtle-conservation.md" },
            output: {
              content: "# Sea Turtle Conservation\n\nLast updated: 2023...",
              path: "content/pages/turtle-conservation.md",
            },
            createdAt: new Date(Date.now() - 1790000),
            completedAt: new Date(Date.now() - 1785000),
          },
          {
            id: "task_4",
            type: "edit_file",
            status: "completed",
            input: { 
              path: "content/pages/turtle-conservation.md",
              content: "Updated content with 2024 data..."
            },
            output: {
              type: "updated",
              path: "content/pages/turtle-conservation.md",
              branch: "editorChat-sample-branch",
              message: "File updated successfully with 2024 conservation data",
            },
            createdAt: new Date(Date.now() - 1785000),
            completedAt: new Date(Date.now() - 1780000),
          },
          {
            id: "task_5",
            type: "list_files",
            status: "completed",
            input: { path: "content", recursive: true },
            output: {
              files: [
                { path: "content/blog/turtle-migration.md", size: 4532, type: "file" },
                { path: "content/pages/turtle-conservation.md", size: 3841, type: "file" },
                { path: "content/research/turtle-nesting-sites.md", size: 2156, type: "file" },
                { path: "content/images/turtle-migration-map.png", size: 152400, type: "file" },
                { path: "content/data/conservation-2024-data.csv", size: 8192, type: "file" }
              ]
            },
            createdAt: new Date(Date.now() - 890000),
            completedAt: new Date(Date.now() - 885000),
          },
        ];

        // Add sample metadata
        chat.metadata.sessionBranch = "editorChat-sample-branch";
      }

      return {
        id: chat._id.toString(),
        title: chat.title,
        summary: chat.summary,
        status: chat.status,
        model: chat.model,
        temperature: chat.temperature,
        source: chat.source || "web",
        messages: chat.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          name: msg.name,
          tool_calls: msg.tool_calls,
          tool_call_id: msg.tool_call_id,
          attachments: msg.attachments,
          timestamp: msg.timestamp,
          toolsUsed: msg.toolsUsed, // Include toolsUsed if present
        })),
        tasks: chat.tasks.map((task) => ({
          id: task.id,
          type: task.type,
          status: task.status,
          input: task.input,
          output: task.output,
          error: task.error,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          createdAt: task.createdAt,
        })),
        tokensUsed: chat.tokensUsed,
        metadata: chat.metadata,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        project: chat.project
          ? {
              id: chat.project._id.toString(),
              name: chat.project.name,
            }
          : null,
      };
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        content: z.string(),
        attachments: z
          .array(
            z.object({
              type: z.enum(["image", "file"]),
              url: z.string(),
              name: z.string().optional(),
              size: z.number().optional(),
              mimeType: z.string().optional(),
            })
          )
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, org } = ctx;

      const chat = await editorChatDb.findById(input.chatId);

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      // Verify user has access to this chat
      if (chat.user._id.toString() !== user.id) {
        // Also check if user has access to the org
        const org = await db.orgs.findOne({
          _id: chat.org._id,
          $or: [
            { owner: user.id },
            { members: { $elemMatch: { userId: user.id } } },
          ],
        });

        if (!org) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied",
          });
        }
      }

      const handler = new EditorChatHandler({
        user,
        org,
        project: chat.project,
        chatId: chat._id,
        model: chat.model,
        temperature: chat.temperature,
        stream: false,
      });

      await handler.initialize();

      try {
        const response = await handler.sendMessage(
          input.content,
          input.attachments
        );

        if (!chat.title || chat.title === "New Chat") {
          await handler.generateTitle();
        }

        // Handle both old format (string) and new format (object with toolsUsed)
        if (typeof response === 'string') {
          return {
            success: true,
            message: response,
          };
        } else {
          return {
            success: true,
            message: response.content || response.message || '',
            toolsUsed: response.toolsUsed || [],
          };
        }
      } catch (error) {
        console.error("Error sending message:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send message",
        });
      }
    }),

  streamMessage: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        content: z.string(),
        attachments: z
          .array(
            z.object({
              type: z.enum(["image", "file"]),
              url: z.string(),
              name: z.string().optional(),
              size: z.number().optional(),
              mimeType: z.string().optional(),
            })
          )
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, org } = ctx;

      const chat = await editorChatDb.findById(input.chatId);

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      // Verify user has access to this chat
      if (chat.user._id.toString() !== user.id) {
        // Also check if user has access to the org
        const org = await db.orgs.findOne({
          _id: chat.org._id,
          $or: [
            { owner: user.id },
            { members: { $elemMatch: { userId: user.id } } },
          ],
        });

        if (!org) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied",
          });
        }
      }

      const handler = new EditorChatHandler({
        user,
        org,
        project: chat.project,
        chatId: chat._id,
        model: chat.model,
        temperature: chat.temperature,
        stream: true,
      });

      await handler.initialize();

      try {
        // Return the SSE endpoint URL - the client will make a separate request
        const streamUrl = `/api/editorChat/stream/${chat._id}`;

        if (!chat.title || chat.title === "New Chat") {
          handler.generateTitle().catch((err) => {
            console.error("Error generating title:", err);
          });
        }

        return {
          success: true,
          streamUrl,
          chatId: chat._id.toString(),
        };
      } catch (error) {
        console.error("Error streaming message:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to stream message",
        });
      }
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        status: z.enum(["active", "completed", "archived"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, org } = ctx;

      const chat = await editorChatDb.findById(input.chatId);

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      // Verify user has access to this chat
      if (chat.user._id.toString() !== user.id) {
        // Also check if user has access to the org
        const org = await db.orgs.findOne({
          _id: chat.org._id,
          $or: [
            { owner: user.id },
            { members: { $elemMatch: { userId: user.id } } },
          ],
        });

        if (!org) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied",
          });
        }
      }

      await editorChatDb.updateStatus(input.chatId, input.status);

      if (
        input.status === "completed" &&
        (!chat.summary || chat.messages.length > 10)
      ) {
        const handler = new EditorChatHandler({
          user,
          org,
          project: chat.project,
          chatId: chat._id,
        });

        await handler.initialize();
        handler.generateSummary().catch((err) => {
          console.error("Error generating summary:", err);
        });
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, org } = ctx;

      const chat = await editorChatDb.findById(input.chatId);

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      // Verify user has access to this chat
      if (chat.user._id.toString() !== user.id) {
        // Also check if user has access to the org
        const org = await db.orgs.findOne({
          _id: chat.org._id,
          $or: [
            { owner: user.id },
            { members: { $elemMatch: { userId: user.id } } },
          ],
        });

        if (!org) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied",
          });
        }
      }

      await editorChatDb.delete(input.chatId);

      return { success: true };
    }),

  stats: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        projectId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { orgId } = input;

      // Verify org access
      const org = await db.orgs.findOne({
        handle: orgId,
        $or: [
          { owner: user.id },
          { members: { $elemMatch: { userId: user.id } } },
        ],
      });

      if (!org) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Organization not found or access denied",
        });
      }

      const stats = await editorChatDb.getStats({
        user: user.id,
        org: org._id,
        project: input.projectId ? new ObjectId(input.projectId) : undefined,
      });

      return stats;
    }),
});

export default editorChatRouter;
