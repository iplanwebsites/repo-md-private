import { EditorChatHandler } from "./editorChat.js";
import editorChatDb from "../db/editorChat.js";
import { ObjectId } from "mongodb";
import { getProjectById } from "../project.js";
import { db } from "../../db.js";

/**
 * Shared chat service that bridges web EditorChat and Slack conversations
 * Provides a unified interface for managing chats across both platforms
 */
export class SharedChatService {
	/**
	 * Get or create a chat, optionally linking to Slack thread
	 * @param {Object} params
	 * @param {Object} params.user - User object or ID
	 * @param {Object} params.org - Organization object or ID
	 * @param {Object} params.project - Project object or ID (optional)
	 * @param {Object} params.slackThread - Slack thread info (optional)
	 * @returns {Promise<Object>} Chat document
	 */
	static async getOrCreateChat({ user, org, project, slackThread }) {
		// Normalize IDs
		const userId = user._id || user;
		const orgId = org._id || org;
		const projectId = project?._id || project;

		// Validate user has access to org
		const userDoc = await db.users.findOne({ _id: new ObjectId(userId) });
		const orgDoc = await db.orgs.findOne({ _id: new ObjectId(orgId) });
		
		if (!userDoc || !orgDoc) {
			throw new Error("Invalid user or organization");
		}

		// Check if user belongs to org
		const isMember = userDoc.orgs?.some(o => o.toString() === orgId.toString()) ||
						userDoc.orgId?.toString() === orgId.toString();
		// TODO: Re-enable this check after fixing user-org relationships
		// if (!isMember && !userDoc.systemRole) {
		// 	throw new Error("User does not have access to this organization");
		// }

		// Validate project access if provided
		if (projectId) {
			const projectDoc = await getProjectById(projectId);
			if (!projectDoc || projectDoc.orgId.toString() !== orgId.toString()) {
				throw new Error("Invalid project or project does not belong to organization");
			}
		}

		// Check if we already have a chat for this Slack thread
		if (slackThread) {
			const existingChat = await editorChatDb.findOne({
				"slackThreads.threadTs": slackThread.threadTs,
				"slackThreads.channelId": slackThread.channelId,
			});

			if (existingChat) {
				// Verify user has access to this chat
				if (existingChat.user.toString() !== userId.toString() && 
					existingChat.org.toString() !== orgId.toString()) {
					throw new Error("Access denied to existing chat");
				}
				return existingChat;
			}
		}

		// Create new chat
		const chatData = {
			user: new ObjectId(userId),
			org: new ObjectId(orgId),
			project: projectId ? new ObjectId(projectId) : null,
			messages: [],
			tasks: [],
			status: "active",
			model: "gpt-4.1-mini",
			temperature: 0.7,
			metadata: {},
			source: slackThread ? "slack" : "web",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		if (slackThread) {
			chatData.slackThreads = [{
				...slackThread,
				lastSynced: new Date(),
			}];
		}

		const chat = await editorChatDb.create(chatData);
		return chat;
	}

	/**
	 * Add a message to chat (from either web or Slack)
	 * @param {string} chatId - Chat ID
	 * @param {Object} message - Message object
	 * @param {Object} slackMetadata - Optional Slack metadata
	 * @returns {Promise<Object>} Message document
	 */
	static async addMessage(chatId, message, slackMetadata = null) {
		const messageDoc = {
			...message,
			timestamp: new Date(),
		};

		if (slackMetadata) {
			messageDoc.slackMetadata = slackMetadata;
		}

		await editorChatDb.updateOne(
			{ _id: new ObjectId(chatId) },
			{
				$push: { messages: messageDoc },
				$set: { updatedAt: new Date() },
			}
		);

		return messageDoc;
	}

	/**
	 * Update the last message in a chat (e.g., to add Slack metadata)
	 * @param {string} chatId - Chat ID
	 * @param {Object} updates - Updates to apply
	 */
	static async updateLastMessage(chatId, updates) {
		const chat = await editorChatDb.findById(chatId);
		if (!chat || !chat.messages.length) {
			return;
		}

		const lastIndex = chat.messages.length - 1;
		const updatePath = `messages.${lastIndex}`;
		
		const updateObj = {};
		Object.keys(updates).forEach(key => {
			updateObj[`${updatePath}.${key}`] = updates[key];
		});

		await editorChatDb.updateOne(
			{ _id: new ObjectId(chatId) },
			{
				$set: {
					...updateObj,
					updatedAt: new Date(),
				},
			}
		);
	}

	/**
	 * Link an existing chat to a Slack thread
	 * @param {string} chatId - Chat ID
	 * @param {Object} slackThread - Slack thread info
	 */
	static async linkToSlackThread(chatId, slackThread) {
		await editorChatDb.updateOne(
			{ _id: new ObjectId(chatId) },
			{
				$addToSet: { 
					slackThreads: {
						...slackThread,
						lastSynced: new Date(),
					}
				},
				$set: { updatedAt: new Date() },
			}
		);
	}

	/**
	 * Process a message using the EditorChat handler
	 * @param {Object} chat - Chat document
	 * @param {string} userMessage - User message content
	 * @param {Object} options - Processing options
	 * @returns {Promise<Object>} AI response
	 */
	static async processMessage(chat, userMessage, options = {}) {
		console.log("SharedChatService.processMessage called with:", {
			chatId: chat._id,
			userType: typeof chat.user,
			userValue: chat.user,
			orgType: typeof chat.org,
			orgValue: chat.org,
			projectValue: chat.project,
			options
		});

		// Get full documents if needed
		// Handle both ObjectId and string formats safely
		let userId, orgId;
		let user, org, project;
		
		try {
			// Handle user ID - could be ObjectId, string, or already populated
			if (chat.user instanceof ObjectId) {
				userId = chat.user;
				user = await db.users.findOne({ _id: userId });
			} else if (typeof chat.user === 'string' && ObjectId.isValid(chat.user)) {
				userId = new ObjectId(chat.user);
				user = await db.users.findOne({ _id: userId });
			} else if (chat.user && typeof chat.user === 'object' && chat.user._id) {
				// Already populated user document
				user = chat.user;
				userId = user._id;
			} else {
				console.error("Invalid user format:", chat.user);
				throw new Error("Invalid user format");
			}
			
			// Handle org ID - could be ObjectId, string, or already populated
			if (chat.org instanceof ObjectId) {
				orgId = chat.org;
				org = await db.orgs.findOne({ _id: orgId });
			} else if (typeof chat.org === 'string' && ObjectId.isValid(chat.org)) {
				orgId = new ObjectId(chat.org);
				org = await db.orgs.findOne({ _id: orgId });
			} else if (chat.org && typeof chat.org === 'object' && chat.org._id) {
				// Already populated org document
				org = chat.org;
				orgId = org._id;
			} else {
				console.error("Invalid org format:", chat.org);
				throw new Error("Invalid org format");
			}
			
			// Handle project - could be null, ObjectId, string, or already populated
			if (chat.project) {
				if (chat.project instanceof ObjectId) {
					project = await getProjectById(chat.project.toString());
				} else if (typeof chat.project === 'string' && ObjectId.isValid(chat.project)) {
					project = await getProjectById(chat.project);
				} else if (chat.project && typeof chat.project === 'object' && chat.project._id) {
					// Already populated project document
					project = chat.project;
				} else {
					console.error("Invalid project format:", chat.project);
					project = null;
				}
			} else {
				project = null;
			}
		} catch (error) {
			console.error("Error processing chat document IDs:", error);
			throw error;
		}
		
		console.log("Found documents:", {
			user: user ? user.email : null,
			org: org ? org.name : null,
			project: project ? project.name : null
		});

		// Create handler with proper context
		const handler = new EditorChatHandler({
			user,
			org,
			project,
			chatId: chat._id.toString(),
			model: chat.model || "gpt-4.1-mini",
			temperature: chat.temperature || 0.7,
			stream: false, // For Slack integration, we don't stream
			archetype: options.archetype || "GENERALIST",
		});

		await handler.initialize();

		// The EditorChatHandler manages its own message storage,
		// so we don't need to add messages here
		const response = await handler.sendMessage(userMessage);

		// Update the messages with Slack metadata if provided
		if (options.slackMetadata || options.responseSlackMetadata) {
			const updatedChat = await editorChatDb.findById(chat._id);
			const messages = updatedChat.messages;
			
			// Find the last user message and add Slack metadata
			if (options.slackMetadata && messages.length >= 2) {
				const lastUserMsgIndex = messages.length - 2;
				if (messages[lastUserMsgIndex].role === "user") {
					await editorChatDb.updateOne(
						{ _id: new ObjectId(chat._id) },
						{ $set: { [`messages.${lastUserMsgIndex}.slackMetadata`]: options.slackMetadata } }
					);
				}
			}
			
			// Find the last assistant message and add Slack metadata
			if (options.responseSlackMetadata && messages.length >= 1) {
				const lastAssistantMsgIndex = messages.length - 1;
				if (messages[lastAssistantMsgIndex].role === "assistant") {
					await editorChatDb.updateOne(
						{ _id: new ObjectId(chat._id) },
						{ $set: { [`messages.${lastAssistantMsgIndex}.slackMetadata`]: options.responseSlackMetadata } }
					);
				}
			}
		}

		return response;
	}

	/**
	 * Get chat by ID with permission check
	 * @param {string} chatId - Chat ID
	 * @param {string} userId - User ID requesting access
	 * @returns {Promise<Object>} Chat document
	 */
	static async getChatById(chatId, userId) {
		const chat = await editorChatDb.findById(chatId);
		if (!chat) {
			throw new Error("Chat not found");
		}

		// Check if user has access
		const user = await db.users.findOne({ _id: new ObjectId(userId) });
		const hasAccess = 
			chat.user.toString() === userId.toString() ||
			user.systemRole === "admin" ||
			(user.orgs && user.orgs.some(o => o.toString() === chat.org.toString()));

		if (!hasAccess) {
			throw new Error("Access denied");
		}

		return chat;
	}

	/**
	 * Find chat by Slack thread
	 * @param {string} channelId - Slack channel ID
	 * @param {string} threadTs - Slack thread timestamp
	 * @returns {Promise<Object|null>} Chat document or null
	 */
	static async findChatBySlackThread(channelId, threadTs) {
		return await editorChatDb.findOne({
			"slackThreads.channelId": channelId,
			"slackThreads.threadTs": threadTs,
		});
	}

	/**
	 * Get recent chats for a user
	 * @param {string} userId - User ID
	 * @param {Object} options - Query options
	 * @returns {Promise<Array>} Array of chat documents
	 */
	static async getUserChats(userId, options = {}) {
		const { limit = 20, skip = 0, projectId, orgId } = options;

		const query = { user: new ObjectId(userId) };
		if (projectId) query.project = new ObjectId(projectId);
		if (orgId) query.org = new ObjectId(orgId);

		const result = await editorChatDb.list({
			user: new ObjectId(userId),
			org: orgId ? new ObjectId(orgId) : undefined,
			project: projectId ? new ObjectId(projectId) : undefined,
			limit,
			skip,
		});
		
		return result.chats;
	}

	/**
	 * Format response for Slack with proper blocks
	 * @param {Object} response - AI response
	 * @returns {Array} Slack blocks
	 */
	static formatSlackResponse(response) {
		const blocks = [];

		// Main content
		if (response.content || response.text) {
			const content = response.content || response.text;
			
			// Split content by code blocks
			const parts = content.split(/```/);
			
			parts.forEach((part, index) => {
				if (index % 2 === 0) {
					// Regular text
					if (part.trim()) {
						blocks.push({
							type: "section",
							text: {
								type: "mrkdwn",
								text: part.trim(),
							},
						});
					}
				} else {
					// Code block
					const [language, ...codeLines] = part.split('\n');
					blocks.push({
						type: "section",
						text: {
							type: "mrkdwn",
							text: `\`\`\`${codeLines.join('\n')}\`\`\``,
						},
					});
				}
			});
		}

		// Tool calls
		const tools = response.toolCalls || response.toolsUsed;
		if (tools && tools.length > 0) {
			blocks.push({
				type: "context",
				elements: [{
					type: "mrkdwn",
					text: `_Used ${tools.length} tool${tools.length > 1 ? 's' : ''}_`,
				}],
			});
		}

		return blocks;
	}
}

export default SharedChatService;