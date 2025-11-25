import { SlackMessageHandler } from "./messageHandler.js";
import { SharedChatService } from "../llm/sharedChatService.js";
import { ObjectId } from "mongodb";
import { db } from "../../db.js";
import { getProjectById } from "../project.js";
import agentManager from "./agentManager.js";

/**
 * Integrated Slack message handler that uses SharedChatService
 * to bridge Slack conversations with EditorChat
 */
export class SlackMessageHandlerIntegrated extends SlackMessageHandler {
  constructor(client) {
    super(client);
    // Store the injected client
    this._injectedClient = client;
  }

  /**
   * Override initialize to use injected client if available
   */
  async initialize(teamId) {
    try {
      // Try to call parent's initialize first
      await super.initialize(teamId);
    } catch (error) {
      // If parent initialization fails, try to handle gracefully
      console.warn(`Parent initialization failed: ${error.message}`);

      // Still try to get installation for basic operations
      this.installation = await db.slackInstallations.findOne({ teamId });

      if (!this.installation) {
        throw new Error(`No Slack installation found for team: ${teamId}`);
      }

      // Use injected client if available, otherwise create new one
      if (this._injectedClient) {
        this.client = this._injectedClient;
      } else {
        const { WebClient } = await import("@slack/web-api");
        this.client = new WebClient(this.installation.botToken);
      }
    }

    // If we have an injected client, make sure to use it
    if (this._injectedClient && this.client !== this._injectedClient) {
      this.client = this._injectedClient;
    }
  }

  /**
   * Handle app mention events with EditorChat integration
   * @param {Object} event - Slack event
   * @param {string} teamId - Slack team ID
   */
  async handleAppMention(event, teamId) {
    // Extract message text early to check for special commands
    // Remove bot mention using a simple regex that matches any mention
    const messageText = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
    const lowerText = messageText.toLowerCase();

    // Handle ping/pong and deploy commands without full initialization
    if (
      lowerText === "ping" ||
      lowerText === "pong" ||
      lowerText.startsWith("deploy") ||
      lowerText.includes(" deploy ") ||
      lowerText.includes(" deploy project ")
    ) {
      // Use parent class method for these commands
      return await super.handleAppMention(event, teamId);
    }

    // For other commands, we need full initialization
    await this.initialize(teamId);

    try {
      // Check if we have an org (required for LLM operations)
      if (!this.org) {
        await this.client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts || event.ts,
          text: "This workspace is not connected to an organization. Please complete the setup first.",
        });
        return;
      }

      // Get user info from Slack
      const slackUser = await this.client.users.info({ user: event.user });
      const email = slackUser.user?.profile?.email;

      // Find or create user in our system
      let user = email ? await db.users.findOne({ email }) : null;

      if (!user) {
        // Create a temporary user reference or handle guest access
        console.warn(`No user found for Slack user ${event.user} (${email})`);

        // For now, we'll use the org's first admin user as a fallback
        const orgAdmins = await db.users
          .find({
            orgs: this.org._id,
            systemRole: { $in: ["admin", "editor"] },
          })
          .toArray();

        if (orgAdmins.length === 0) {
          await this.sendErrorResponse(
            event.channel,
            event.ts,
            "No authorized users found for this organization. Please contact an admin."
          );
          return;
        }

        user = orgAdmins[0];
      }

      // For all other messages, use EditorChat integration
      // Detect project from message or channel context
      const project = await this.detectProjectFromMessage(
        messageText,
        event.channel
      );

      // Get thread context if this is a reply
      let threadContext = null;
      if (event.thread_ts && event.thread_ts !== event.ts) {
        threadContext = await this.getThreadContext(
          event.channel,
          event.thread_ts
        );
      }

      // Get or create chat linked to this thread
      const chat = await SharedChatService.getOrCreateChat({
        user,
        org: this.org,
        project,
        slackThread: {
          channelId: event.channel,
          threadTs: event.thread_ts || event.ts,
          teamId,
        },
      });

      // Add thread context to message if available
      let enhancedMessage = messageText;
      if (threadContext && threadContext.messages.length > 0) {
        enhancedMessage = `[Thread Context: ${threadContext.messages.length} previous messages]\n\n${messageText}`;
      }

      // Process message
      const response = await SharedChatService.processMessage(
        chat,
        enhancedMessage,
        {
          slackMetadata: {
            channelId: event.channel,
            threadTs: event.thread_ts || event.ts,
            messageTs: event.ts,
            userId: event.user,
          },
          archetype: project ? "PROJECT_NAVIGATOR" : "GENERALIST",
        }
      );

      // Format and send response to Slack
      const blocks = SharedChatService.formatSlackResponse(response);

      // Add chat link to web UI
      const baseUrl = process.env.APP_BASE_URL || "https://repo.md";
      const chatUrl = `${baseUrl}/${this.org.handle}/~/chat/${chat._id}`;
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${chatUrl}|View in Web> | Chat ID: ${chat._id}`,
          },
        ],
      });

      const slackResponse = await this.client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts || event.ts,
        blocks,
        text: response.content || response.text || "I processed your request.", // Fallback text
      });

      // Update the assistant message with Slack metadata
      await SharedChatService.updateLastMessage(chat._id, {
        slackMetadata: {
          channelId: event.channel,
          threadTs: event.thread_ts || event.ts,
          messageTs: slackResponse.ts,
        },
      });

      // Generate title if this is a new chat
      if (!chat.title || chat.title === "New Chat") {
        // Use EditorChatHandler to generate title
        const { EditorChatHandler } = await import("../llm/editorChat.js");
        const handler = new EditorChatHandler({
          user,
          org: this.org,
          project,
          chatId: chat._id.toString(),
        });

        // Generate title asynchronously
        handler.generateTitle().catch((err) => {
          console.error("Error generating title for Slack chat:", err);
        });
      }
    } catch (error) {
      console.error("Error handling app mention:", error);
      await this.sendErrorResponse(
        event.channel,
        event.ts,
        "I encountered an error processing your request. Please try again."
      );
    }
  }

  /**
   * Detect project from message content or channel context
   * @param {string} text - Message text
   * @param {string} channelId - Slack channel ID
   * @returns {Promise<Object|null>} Project object or null
   */
  async detectProjectFromMessage(text, channelId) {
    // Check if message mentions a project by slug
    const projectMatch = text.match(/project[:\s]+(\S+)/i);
    if (projectMatch) {
      const project = await db.projects.findOne({
        slug: projectMatch[1],
        orgId: this.org._id,
      });
      if (project) return project;
    }

    // Check if message contains a project ID
    const idMatch = text.match(/\b([a-f0-9]{24})\b/);
    if (idMatch) {
      try {
        const project = await getProjectById(idMatch[1]);
        if (project && project.orgId.toString() === this.org._id.toString()) {
          return project;
        }
      } catch (e) {
        // Not a valid ObjectId, continue
      }
    }

    // Check channel default project
    const channelSettings = await agentManager.getChannelSettings(
      channelId,
      this.installation.teamId
    );

    if (channelSettings?.defaultProjectId) {
      const project = await getProjectById(channelSettings.defaultProjectId);
      if (project && project.orgId.toString() === this.org._id.toString()) {
        return project;
      }
    }

    // Try to find project by name in the message
    const projects = await db.projects.find({ orgId: this.org._id }).toArray();
    for (const project of projects) {
      if (text.toLowerCase().includes(project.name.toLowerCase())) {
        return project;
      }
    }

    return null;
  }

  /**
   * Handle slash commands with EditorChat integration
   * @param {Object} payload - Slack command payload
   */
  async handleSlashCommand(payload) {
    const { command, text, channel_id, user_id, team_id, response_url } =
      payload;

    try {
      switch (command) {
        case "/continue":
          return await this.handleContinueCommand(
            text,
            channel_id,
            team_id,
            user_id
          );

        case "/chats":
          return await this.handleChatsCommand(user_id, team_id);

        default:
          // Fall back to parent handler
          return await super.handleSlashCommand(payload);
      }
    } catch (error) {
      console.error(`Error handling slash command ${command}:`, error);
      return {
        response_type: "ephemeral",
        text: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Handle /continue command to link web chat to Slack
   * @param {string} text - Command text (chat ID)
   * @param {string} channelId - Slack channel ID
   * @param {string} teamId - Slack team ID
   * @param {string} userId - Slack user ID
   */
  async handleContinueCommand(text, channelId, teamId, userId) {
    const chatId = text.trim();

    if (!chatId) {
      return {
        response_type: "ephemeral",
        text: "Please provide a chat ID: `/continue <chat-id>`",
      };
    }

    try {
      // Get Slack user's email
      const slackUser = await this.client.users.info({ user: userId });
      const email = slackUser.user?.profile?.email;
      const user = email ? await db.users.findOne({ email }) : null;

      if (!user) {
        return {
          response_type: "ephemeral",
          text: "Could not find your user account. Please ensure your Slack email matches your Repo.md account.",
        };
      }

      // Get the chat with permission check
      const chat = await SharedChatService.getChatById(chatId, user._id);

      // Create a new thread timestamp
      const threadTs = (Date.now() / 1000).toString();

      // Link to current thread
      await SharedChatService.linkToSlackThread(chatId, {
        channelId,
        threadTs,
        teamId,
      });

      // Get recent messages for summary
      const recentMessages = chat.messages.slice(-5);

      const blocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Continuing conversation from web*`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Chat ID: \`${chatId}\`\nProject: ${
              chat.project ? "Linked" : "None"
            }`,
          },
        },
      ];

      // Add recent message summary
      if (recentMessages.length > 0) {
        blocks.push({
          type: "divider",
        });

        recentMessages.forEach((msg) => {
          const content = msg.content.substring(0, 150);
          const suffix = msg.content.length > 150 ? "..." : "";

          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${
                msg.role === "user" ? "User" : "Assistant"
              }*: ${content}${suffix}`,
            },
          });
        });
      }

      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_Reply in thread to continue the conversation_`,
          },
        ],
      });

      // Post as a new message (not ephemeral) to create a thread
      await this.client.chat.postMessage({
        channel: channelId,
        blocks,
        text: `Continuing chat ${chatId}`, // Fallback text
      });

      return {
        response_type: "ephemeral",
        text: "Chat linked! Check the channel for the continuation message.",
      };
    } catch (error) {
      return {
        response_type: "ephemeral",
        text: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Handle /chats command to list user's recent chats
   * @param {string} userId - Slack user ID
   * @param {string} teamId - Slack team ID
   */
  async handleChatsCommand(userId, teamId) {
    try {
      await this.initialize(teamId);

      // Get user
      const slackUser = await this.client.users.info({ user: userId });
      const email = slackUser.user?.profile?.email;
      const user = email ? await db.users.findOne({ email }) : null;

      if (!user) {
        return {
          response_type: "ephemeral",
          text: "Could not find your user account.",
        };
      }

      // Get recent chats
      const chats = await SharedChatService.getUserChats(user._id, {
        orgId: this.org._id,
        limit: 10,
      });

      if (chats.length === 0) {
        return {
          response_type: "ephemeral",
          text: "You have no recent chats.",
        };
      }

      const blocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Your Recent Chats*",
          },
        },
        {
          type: "divider",
        },
      ];

      for (const chat of chats) {
        const lastMessage = chat.messages[chat.messages.length - 1];
        const preview = lastMessage
          ? lastMessage.content.substring(0, 60) + "..."
          : "No messages";

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Chat ${chat._id}*\n${preview}`,
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Continue",
            },
            value: chat._id.toString(),
            action_id: `continue_chat_${chat._id}`,
          },
        });
      }

      return {
        response_type: "ephemeral",
        blocks,
      };
    } catch (error) {
      return {
        response_type: "ephemeral",
        text: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Send error response to Slack
   * @param {string} channel - Channel ID
   * @param {string} threadTs - Thread timestamp
   * @param {string} errorMessage - Error message
   */
  async sendErrorResponse(channel, threadTs, errorMessage) {
    await this.client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: errorMessage,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `❌ ${errorMessage}`,
          },
        },
      ],
    });
  }
}

export default SlackMessageHandlerIntegrated;
