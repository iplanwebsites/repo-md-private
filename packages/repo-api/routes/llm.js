import express from "express";
import { requireAuth } from "../lib/authMiddleware.js";
import * as conversation from "../lib/llm/conversationVolt.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

/**
 * Express routes for SSE streaming support
 * These complement the tRPC routes for real-time streaming
 */

/**
 * Start a new conversation (org-level editor)
 */
router.post("/conversations", requireAuth, async (req, res) => {
  try {
    const { agentType = "editor", context = {} } = req.body;
    const userId = req.user.id;
    const orgId = req.user.orgId;

    const conversationId = await conversation.startConversation({
      userId,
      orgId,
      agentType,
      initialContext: context,
    });

    res.json({
      success: true,
      conversationId,
    });
  } catch (error) {
    console.error("Error starting conversation:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Start a project-specific conversation
 */
router.post(
  "/projects/:projectId/conversations",
  requireAuth,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { agentType = "project", context = {} } = req.body;
      const userId = req.user.id;

      // Verify project access
      const { verifyProjectAccess } = await import("../lib/project.js");
      const hasAccess = await verifyProjectAccess(projectId, userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: "Access denied to project",
        });
      }

      const conversationId = await conversation.startConversation({
        userId,
        projectId,
        agentType,
        initialContext: context,
      });

      res.json({
        success: true,
        conversationId,
      });
    } catch (error) {
      console.error("Error starting project conversation:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Create a response (OpenAI Responses API compatible)
 * Supports both streaming and non-streaming responses
 */
router.post("/responses", requireAuth, async (req, res) => {
  try {
    const {
      conversationId,
      input,
      stream = false,
      tools,
      temperature,
      max_output_tokens,
      metadata,
    } = req.body;

    const userId = req.user.id;

    // Check conversation access
    const { checkConversationAccess } = await import(
      "../lib/llm/conversationHelpers.js"
    );
    const { hasAccess, conversation: convo } = await checkConversationAccess(
      conversationId,
      userId
    );

    if (!hasAccess) {
      return res.status(404).json({
        error: {
          message: "Conversation not found",
          type: "not_found_error",
          code: "conversation_not_found",
        },
      });
    }

    // Get tools based on agent type
    const { getAgentTools } = await import("../lib/llm/agents/index.js");
    const agentTools = tools || (await getAgentTools(convo.agentType));

    // Generate response ID
    const responseId = `resp_${uuidv4().replace(/-/g, "")}`;

    if (stream) {
      // Set up SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      // Send initial event
      res.write(`event: response.created\n`);
      res.write(
        `data: ${JSON.stringify({
          id: responseId,
          object: "response",
          created_at: Math.floor(Date.now() / 1000),
          model: convo.agentConfig?.model || "gpt-4.1-mini",
          status: "in_progress",
        })}\n\n`
      );

      // Stream the response
      try {
        for await (const chunk of conversation.streamResponse(
          conversationId,
          input,
          agentTools
        )) {
          if (chunk.type === "content") {
            res.write(`event: response.output_item.delta\n`);
            res.write(
              `data: ${JSON.stringify({
                type: "content",
                delta: { content: chunk.content },
              })}\n\n`
            );
          } else if (chunk.type === "tool_result") {
            res.write(`event: response.output_item.done\n`);
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call",
                tool: chunk.tool,
                result: chunk.result,
              })}\n\n`
            );
          } else if (chunk.type === "done") {
            res.write(`event: response.done\n`);
            res.write(
              `data: ${JSON.stringify({
                id: responseId,
                status: "completed",
              })}\n\n`
            );
          }
        }
        res.end();
      } catch (streamError) {
        res.write(`event: error\n`);
        res.write(
          `data: ${JSON.stringify({
            error: {
              message: streamError.message,
              type: "stream_error",
            },
          })}\n\n`
        );
        res.end();
      }
    } else {
      // Non-streaming response
      const response = await conversation.sendMessage(
        conversationId,
        input,
        agentTools
      );

      res.json({
        id: responseId,
        object: "response",
        created_at: Math.floor(Date.now() / 1000),
        status: "completed",
        model: convo.agentConfig?.model || "gpt-4.1-mini",
        output: [
          {
            type: "message",
            role: "assistant",
            content: response.content,
          },
        ],
        usage: response.usage,
        metadata,
      });
    }
  } catch (error) {
    console.error("Error creating response:", error);
    res.status(500).json({
      error: {
        message: error.message,
        type: "api_error",
      },
    });
  }
});

/**
 * Legacy endpoint - Send message with streaming response
 */
router.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { message } = req.body;
    const userId = req.user.id;

    // Check conversation access
    const { checkConversationAccess } = await import(
      "../lib/llm/conversationHelpers.js"
    );
    const { hasAccess, conversation: convo } = await checkConversationAccess(
      conversationId,
      userId
    );

    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    // Get tools based on agent type
    const { getAgentTools } = await import("../lib/llm/agents/index.js");
    const tools = await getAgentTools(convo.agentType);

    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Stream response
    try {
      for await (const chunk of conversation.streamResponse(
        conversationId,
        message,
        tools
      )) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: {"type":"end"}\n\n');
      res.end();
    } catch (streamError) {
      console.error("Stream error:", streamError);
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: streamError.message,
        })}\n\n`
      );
      res.end();
    }
  } catch (error) {
    console.error("Error in message endpoint:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
});

/**
 * Get conversation
 */
router.get("/conversations/:id", requireAuth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;

    const convo = await conversation.getConversation(conversationId, userId);
    if (!convo) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    res.json({
      success: true,
      conversation: convo,
    });
  } catch (error) {
    console.error("Error getting conversation:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * List user's conversations
 */
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { agentType, projectId, orgId } = req.query;

    const { getUserConversations } = await import(
      "../lib/llm/conversationHelpers.js"
    );
    const conversations = await getUserConversations(userId, {
      agentType,
      projectId,
      orgId,
    });

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Error listing conversations:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get org-level conversations
 */
router.get("/org/conversations", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { agentType } = req.query;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: "User not associated with an organization",
      });
    }

    const { getOrgConversations } = await import(
      "../lib/llm/conversationHelpers.js"
    );
    const conversations = await getOrgConversations(orgId, { agentType });

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Error getting org conversations:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get project conversations
 */
router.get(
  "/projects/:projectId/conversations",
  requireAuth,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;
      const { agentType, includePublic } = req.query;

      // Verify project access
      const { verifyProjectAccess } = await import("../lib/project.js");
      const hasAccess = await verifyProjectAccess(projectId, userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: "Access denied to project",
        });
      }

      const { getProjectConversations } = await import(
        "../lib/llm/conversationHelpers.js"
      );
      const conversations = await getProjectConversations(projectId, {
        agentType,
        includePublic: includePublic === "true",
      });

      res.json({
        success: true,
        conversations,
      });
    } catch (error) {
      console.error("Error getting project conversations:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Delete conversation
 */
router.delete("/conversations/:id", requireAuth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;

    const deleted = await conversation.deleteConversation(
      conversationId,
      userId
    );
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    res.json({
      success: true,
      message: "Conversation deleted",
    });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Push conversation to GitHub (for project generation)
 */
router.post("/conversations/:id/github", requireAuth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    const { repo, commitMessage } = req.body;

    const convo = await conversation.getConversation(conversationId, userId);
    if (!convo) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    if (convo.type !== "project_generation") {
      return res.status(400).json({
        success: false,
        error: "Only project generation conversations can be pushed to GitHub",
      });
    }

    // Use the push_to_github tool
    const { push_to_github } = await import("../lib/llm/tools/githubTools.js");
    const result = await push_to_github(
      { repo, commitMessage: commitMessage || "Generated project" },
      { conversationId }
    );

    res.json(result);
  } catch (error) {
    console.error("Error pushing to GitHub:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUBLIC ROUTES - No auth required
 */

/**
 * Start a public project conversation
 */
router.post("/public/projects/:projectId/chat", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { sessionId } = req.body;

    // Generate session ID if not provided
    const userSessionId =
      sessionId ||
      `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const conversationId = await conversation.startConversation({
      projectId,
      sessionId: userSessionId,
      agentType: "public_project",
    });

    res.json({
      success: true,
      conversationId,
      sessionId: userSessionId,
    });
  } catch (error) {
    console.error("Error starting public conversation:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Send message to public conversation (with rate limiting)
 */
router.post("/public/conversations/:id/messages", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { message, sessionId } = req.body;

    // Get conversation
    const convo = await conversation.getConversation(conversationId, null);
    if (!convo || !convo.isPublic) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    // Verify session
    if (convo.sessionId !== sessionId) {
      return res.status(403).json({
        success: false,
        error: "Invalid session",
      });
    }

    // TODO: Add rate limiting check here

    // Get tools for public agent
    const { getAgentTools } = await import("../lib/llm/agents/index.js");
    const tools = await getAgentTools("public_project");

    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Stream response
    try {
      for await (const chunk of conversation.streamResponse(
        conversationId,
        message,
        tools
      )) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: {"type":"end"}\n\n');
      res.end();
    } catch (streamError) {
      console.error("Stream error:", streamError);
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: streamError.message,
        })}\n\n`
      );
      res.end();
    }
  } catch (error) {
    console.error("Error in public message endpoint:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
});

/**
 * Get public conversations for a project
 */
router.get("/public/projects/:projectId/conversations", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { sessionId } = req.query;

    const { getPublicProjectConversations } = await import(
      "../lib/llm/conversationHelpers.js"
    );
    const conversations = await getPublicProjectConversations(projectId, {
      sessionId,
    });

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Error getting public conversations:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
