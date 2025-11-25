import { db } from "../../db.js";
import { WebClient } from "@slack/web-api";
import { getTemplate, selectTemplate } from "./responseTemplates.js";
import { parseCommand, isFollowUpRequest } from "./commandParser.js";
import agentManager from "./agentManager.js";
import { createAgentConfig, AGENT_ARCHETYPES } from "../chat/aiPromptConfigs.js";
import ToolExecutor from "../llm/toolExecutor.js";
import { 
	getToolsForArchetype, 
	exportToolDefinitions, 
	createToolMapping 
} from "../llm/tools/catalogue.js";

/**
 * Main handler for Slack messages
 */
export class SlackMessageHandler {
	constructor() {
		this.client = null;
		this.installation = null;
		this.org = null;
	}

	/**
	 * Initialize the handler with team context
	 */
	async initialize(teamId) {
		// Get org and installation
		this.org = await db.orgs.findOne({
			"slackIntegration.teamId": teamId
		});

		if (!this.org) {
			throw new Error(`No organization found for team: ${teamId}`);
		}

		this.installation = await db.slackInstallations.findOne({ teamId });

		if (!this.installation) {
			throw new Error(`No Slack installation found for team: ${teamId}`);
		}

		// Initialize Slack client
		this.client = new WebClient(this.installation.botToken);
		
		return true;
	}

	/**
	 * Handle app mention events
	 */
	async handleAppMention(event, teamId) {
		await this.initialize(teamId);

		// Store the mention
		const conversation = await this.storeMessage({
			teamId,
			channelId: event.channel,
			userId: event.user,
			orgId: this.org._id,
			messageTs: event.ts,
			threadTs: event.thread_ts || event.ts,
			text: event.text,
			type: "mention",
		});

		// Get thread context with channel ID to fetch full history if needed
		const threadContext = await this.getThreadContext(event.thread_ts || event.ts, event.channel);
		
		// First check if this is a simple response (ping, help without agent context, etc)
		const templateKey = selectTemplate(event.text, threadContext);
		
		// Handle simple responses that don't need command parsing
		if (templateKey === 'ping' || templateKey === 'help' || templateKey === 'debug') {
			const response = await this.generateResponse(event, threadContext);
			const slackResponse = await this.client.chat.postMessage({
				channel: event.channel,
				text: response.text,
				thread_ts: event.thread_ts || event.ts,
				blocks: response.blocks
			});
			await this.updateConversationWithResponse(conversation._id, slackResponse);
			return slackResponse;
		}
		
		// Handle projects commands
		if (templateKey === 'projects' || templateKey === 'projectsList') {
			// Both 'projects' and 'projectsList' now show the actual project list
			return await this.sendProjectsListResponse(event, threadContext);
		}
		
		// Parse command from message
		const parsedCommand = parseCommand(event.text, this.installation.botUserId);
		
		// Handle special agent commands
		if (parsedCommand.type === 'help') {
			return await this.sendHelpResponse(event, threadContext);
		}
		
		if (parsedCommand.type === 'settings') {
			return await this.sendSettingsResponse(event, threadContext);
		}
		
		if (parsedCommand.type === 'listAgents') {
			return await this.sendListAgentsResponse(event, threadContext);
		}
		
		if (parsedCommand.type === 'deploy') {
			return await this.handleDeployCommand(event, threadContext, parsedCommand);
		}
		
		if (parsedCommand.type === 'task') {
			return await this.handleTaskCommand(event, threadContext, parsedCommand);
		}
		
		// Check if user wants deployment status (but not a deploy command)
		if (templateKey === 'deploymentStatus') {
			const response = await this.generateResponse(event, threadContext);
			const slackResponse = await this.client.chat.postMessage({
				channel: event.channel,
				text: response.text,
				thread_ts: event.thread_ts || event.ts,
				blocks: response.blocks
			});
			await this.updateConversationWithResponse(conversation._id, slackResponse);
			return slackResponse;
		}
		
		// Check for existing agents in thread
		const threadAgents = await agentManager.getThreadAgents(event.thread_ts || event.ts, event.channel);
		const userOwnedAgent = await agentManager.userOwnsThreadAgent(
			event.thread_ts || event.ts,
			event.channel,
			event.user
		);
		
		// Handle agent commands
		if (parsedCommand.type === 'agent' || parsedCommand.type === 'newAgent') {
			// Check if this should be a follow-up
			if (!parsedCommand.forceNew && userOwnedAgent && isFollowUpRequest(event.text, true)) {
				return await this.handleFollowUp(event, threadContext, userOwnedAgent, parsedCommand);
			}
			
			// Create new agent
			return await this.createNewAgent(event, threadContext, parsedCommand);
		}
		
		// For any other message, decide if it should create an agent or just respond
		if (templateKey === 'implementationTask' || templateKey === 'continuation') {
			// These templates suggest the user wants something done
			return await this.createNewAgent(event, threadContext, parsedCommand);
		}
		
		// Generate regular response
		const response = await this.generateResponse(event, threadContext);

		// Send response
		const slackResponse = await this.client.chat.postMessage({
			channel: event.channel,
			text: response.text,
			thread_ts: event.thread_ts || event.ts,
			blocks: response.blocks
		});

		// Update conversation with response
		await this.updateConversationWithResponse(conversation._id, slackResponse);

		return slackResponse;
	}

	/**
	 * Handle thread reply events
	 */
	async handleThreadReply(event, teamId) {
		// Check if we're tracking this thread
		const existingConversation = await db.slackConversations.findOne({
			$or: [
				{ threadTs: event.thread_ts },
				{ messageTs: event.thread_ts }
			]
		});

		if (!existingConversation) {
			return null; // Not our thread
		}

		await this.initialize(teamId);

		// Store the reply
		await this.storeMessage({
			teamId,
			channelId: event.channel,
			userId: event.user,
			orgId: this.org._id,
			messageTs: event.ts,
			threadTs: event.thread_ts,
			text: event.text,
			type: "thread_reply",
		});

		// Get full thread context with channel ID
		const threadContext = await this.getThreadContext(event.thread_ts, event.channel);

		// Generate response
		const response = await this.generateResponse(event, threadContext);

		// Send response
		const slackResponse = await this.client.chat.postMessage({
			channel: event.channel,
			text: response.text,
			thread_ts: event.thread_ts,
			blocks: response.blocks
		});

		return slackResponse;
	}

	/**
	 * Store a message in the database
	 */
	async storeMessage(messageData) {
		const message = {
			...messageData,
			createdAt: new Date(),
			processed: false
		};

		const result = await db.slackConversations.insertOne(message);
		return { ...message, _id: result.insertedId };
	}

	/**
	 * Update conversation with bot response
	 */
	async updateConversationWithResponse(conversationId, slackResponse) {
		await db.slackConversations.updateOne(
			{ _id: conversationId },
			{
				$set: {
					processed: true,
					responseTs: slackResponse.ts,
					respondedAt: new Date()
				}
			}
		);
	}

	/**
	 * Get thread context including message count and history
	 */
	async getThreadContext(threadTs, channelId = null) {
		// First, try to get messages from our database
		let messages = await db.slackConversations
			.find({ threadTs })
			.sort({ messageTs: 1 })
			.toArray();

		// If we have a channel ID and client, fetch full thread history from Slack
		if (channelId && this.client && messages.length === 0) {
			try {
				// Fetch thread replies from Slack (up to 100 messages)
				const slackHistory = await this.client.conversations.replies({
					channel: channelId,
					ts: threadTs,
					limit: 100
				});

				if (slackHistory.messages && slackHistory.messages.length > 0) {
					// Convert Slack messages to our format
					messages = await this.processSlackThreadHistory(slackHistory.messages, channelId);
				}
			} catch (error) {
				console.error("Error fetching thread history from Slack:", error);
				// Fall back to database messages only
			}
		}

		// Build conversation history
		const history = messages.map(msg => ({
			type: msg.type,
			user: msg.userId,
			text: msg.text,
			timestamp: msg.createdAt,
			isBot: msg.userId === 'bot' || msg.bot_id !== undefined,
			username: msg.username
		}));

		// Generate conversation summary
		const summary = this.generateConversationSummary(messages);

		return {
			messageCount: messages.length,
			messages,
			history,
			summary,
			firstMessage: messages[0],
			lastMessage: messages[messages.length - 1],
			fetchedFromSlack: messages.some(m => m.fetchedFromSlack)
		};
	}

	/**
	 * Generate a summary of the conversation
	 */
	generateConversationSummary(messages) {
		if (messages.length === 0) return "New conversation";

		const topics = [];
		const keywords = ['project', 'deploy', 'help', 'error', 'build', 'test'];
		
		// Extract topics from messages
		messages.forEach(msg => {
			const text = msg.text.toLowerCase();
			keywords.forEach(keyword => {
				if (text.includes(keyword) && !topics.includes(keyword)) {
					topics.push(keyword);
				}
			});
		});

		// Count message types
		const userMessages = messages.filter(m => m.type !== 'bot_message').length;
		const botMessages = messages.filter(m => m.type === 'bot_message').length;

		return {
			topics: topics.length > 0 ? topics : ['general'],
			messageStats: {
				total: messages.length,
				userMessages,
				botMessages
			},
			duration: this.getConversationDuration(messages),
			lastTopic: this.extractLastTopic(messages)
		};
	}

	/**
	 * Get conversation duration
	 */
	getConversationDuration(messages) {
		if (messages.length < 2) return "Just started";
		
		const first = new Date(messages[0].createdAt);
		const last = new Date(messages[messages.length - 1].createdAt);
		const duration = last - first;
		
		const minutes = Math.floor(duration / 60000);
		const hours = Math.floor(minutes / 60);
		
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		return `${minutes}m`;
	}

	/**
	 * Extract the last discussed topic
	 */
	extractLastTopic(messages) {
		// Get last few user messages
		const recentUserMessages = messages
			.filter(m => m.type !== 'bot_message')
			.slice(-3);
		
		if (recentUserMessages.length === 0) return "No specific topic";
		
		// Simple topic extraction - can be enhanced with NLP
		const lastMessage = recentUserMessages[recentUserMessages.length - 1];
		if (lastMessage.text.toLowerCase().includes('deploy')) return "Deployment inquiry";
		if (lastMessage.text.toLowerCase().includes('project')) return "Project information";
		if (lastMessage.text.toLowerCase().includes('help')) return "Help request";
		if (lastMessage.text.toLowerCase().includes('error')) return "Error troubleshooting";
		
		return "General conversation";
	}

	/**
	 * Generate appropriate response based on message and context
	 */
	async generateResponse(event, threadContext) {
		const userName = await this.getUserName(event.user);
		const messageNumber = threadContext.messageCount + 1;
		
		// Select appropriate template
		const templateKey = selectTemplate(event.text, threadContext);
		
		// Build context for template
		const context = {
			userName,
			messageNumber,
			threadContext,
			relativeTime: this.getRelativeTime(threadContext.firstMessage?.createdAt || new Date()),
			lastActivityTime: this.getRelativeTime(threadContext.lastMessage?.createdAt || new Date()),
			event
		};
		
		// Get and return the template
		return getTemplate(templateKey, context);
	}

	/**
	 * Get user's display name
	 */
	async getUserName(userId) {
		try {
			const userInfo = await this.client.users.info({ user: userId });
			return userInfo.user?.real_name || userInfo.user?.name || "there";
		} catch (error) {
			console.error("Error fetching user info:", error);
			return "there";
		}
	}

	/**
	 * Get relative time string
	 */
	getRelativeTime(date) {
		const now = new Date();
		const diff = now - date;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
		if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
		if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
		return 'just now';
	}
	
	/**
	 * Create a new agent
	 */
	async createNewAgent(event, threadContext, parsedCommand) {
		const userName = await this.getUserName(event.user);
		
		// Merge options with defaults
		const options = await agentManager.mergeWithDefaults(
			parsedCommand.options,
			event.channel,
			this.installation.teamId,
			this.org._id
		);
		
		// Resolve project from repo if specified
		const projectId = await agentManager.resolveProject(options.repo, this.org._id);
		const project = projectId ? await db.projects.findOne({ _id: projectId }) : null;
		
		// Determine agent archetype based on command
		const archetype = this.determineArchetype(parsedCommand, threadContext);
		
		// Get user information for permissions
		const user = await db.users.findOne({ slackId: event.user });
		
		// Create context for agent configuration
		const context = {
			user: user || { _id: event.user, name: userName },
			org: this.org,
			project,
			auth: !!user,
			permissions: this.getUserPermissions(user, project),
			conversation: {
				threadId: event.thread_ts || event.ts,
				messageCount: threadContext.messageCount,
				topics: threadContext.summary?.topics || []
			}
		};
		
		// Get available tools based on archetype
		const agentArchetype = AGENT_ARCHETYPES[archetype];
		const availableTools = agentArchetype ? 
			getToolsForArchetype(archetype, agentArchetype.capabilities) : [];
		
		// Create agent configuration
		const agentConfig = createAgentConfig({
			interface: 'slack',
			archetype,
			context,
			availableTools
		});
		
		// Initialize tool executor
		const toolExecutor = new ToolExecutor({
			context: {
				...context,
				agentArchetype: archetype,
				agentId: `slack_${event.ts}`,
				slack: this.client,
				db
			}
		});
		
		// Create agent with enhanced configuration
		const agent = await agentManager.createAgent({
			orgId: this.org._id,
			channelId: event.channel,
			threadTs: event.thread_ts || event.ts,
			userId: event.user,
			userName,
			command: parsedCommand.prompt || 'No prompt provided',
			options: {
				...options,
				archetype,
				model: agentConfig.modelConfig.model,
				temperature: agentConfig.modelConfig.temperature
			},
			projectId,
			teamId: this.installation.teamId,
			metadata: {
				archetype,
				capabilities: agentConfig.capabilities.map(c => c.name),
				canSpawnAgents: agentConfig.canSpawnAgents
			}
		});
		
		// Start agent execution with tool support
		await this.executeAgentWithTools(agent, agentConfig, toolExecutor);
		
		// Send agent started response with archetype info
		const response = getTemplate('agentStarted', {
			agent: {
				...agent,
				archetypeDescription: agentArchetype?.name || 'General Assistant'
			},
			userName,
			threadContext,
			org: this.org
		});
		
		return await this.client.chat.postMessage({
			channel: event.channel,
			text: response.text,
			thread_ts: event.thread_ts || event.ts,
			blocks: response.blocks
		});
	}
	
	/**
	 * Determine agent archetype based on command and context
	 */
	determineArchetype(parsedCommand, threadContext) {
		const prompt = (parsedCommand.prompt || '').toLowerCase();
		
		// Check for explicit archetype in command
		if (parsedCommand.options?.archetype) {
			return parsedCommand.options.archetype;
		}
		
		// Check for content-related queries
		if (prompt.includes('article') || prompt.includes('post') || 
		    prompt.includes('content') || prompt.includes('blog') ||
		    prompt.includes('search') || prompt.includes('find') ||
		    prompt.includes('about') || prompt.includes('documentation')) {
			return 'PROJECT_CONTENT';
		}
		
		// Analyze prompt for intent
		if (prompt.includes('deploy') || prompt.includes('release')) {
			return 'DEPLOYMENT_MANAGER';
		}
		
		if (prompt.includes('review') || prompt.includes('analyze') || prompt.includes('check')) {
			return 'CODE_REVIEWER';
		}
		
		if (prompt.includes('generate') || prompt.includes('create') || 
		    prompt.includes('implement') || prompt.includes('build')) {
			return 'CODE_GENERATOR';
		}
		
		// Check thread context for clues
		if (threadContext.summary?.topics?.includes('deploy')) {
			return 'DEPLOYMENT_MANAGER';
		}
		
		// Default to generalist for complex or unclear tasks
		return 'GENERALIST';
	}
	
	/**
	 * Get user permissions for tool access
	 */
	getUserPermissions(user, project) {
		const permissions = ['read'];
		
		if (!user) return permissions;
		
		permissions.push('write');
		
		if (project && project.members) {
			const member = project.members.find(m => 
				m.userId.toString() === user._id.toString()
			);
			
			if (member) {
				if (member.role === 'owner' || member.role === 'admin') {
					permissions.push('admin', 'deploy');
				} else if (member.role === 'editor') {
					permissions.push('deploy');
				}
			}
		}
		
		return permissions;
	}
	
	/**
	 * Execute agent with tool support
	 */
	async executeAgentWithTools(agent, agentConfig, toolExecutor) {
		try {
			// Update agent status
			await agentManager.updateAgentStatus(agent._id, 'running');
			
			// Mock execution - in real implementation, this would:
			// 1. Create conversation with LLM using agentConfig.prompts
			// 2. Process tool calls through toolExecutor
			// 3. Send updates to Slack thread
			// 4. Handle sub-agent spawning if needed
			
			setTimeout(async () => {
				// Simulate completion
				await agentManager.updateAgentStatus(agent._id, 'completed', {
					executionTime: 5000,
					toolsUsed: agentConfig.tools.slice(0, 3).map(t => t.definition.name)
				});
				
				// Send completion message
				const response = getTemplate('agentCompleted', {
					agent,
					result: 'Task completed successfully'
				});
				
				await this.client.chat.postMessage({
					channel: agent.channelId,
					text: response.text,
					thread_ts: agent.threadTs,
					blocks: response.blocks
				});
			}, 5000);
			
		} catch (error) {
			await agentManager.updateAgentStatus(agent._id, 'failed', {
				error: error.message
			});
			
			throw error;
		}
	}
	
	/**
	 * Handle follow-up instructions
	 */
	async handleFollowUp(event, threadContext, agent, parsedCommand) {
		try {
			// Add follow-up to agent
			await agentManager.addFollowUp(agent._id, parsedCommand.prompt, event.user);
			
			// Send confirmation
			const response = getTemplate('followUpAdded', {
				agent,
				threadContext
			});
			
			return await this.client.chat.postMessage({
				channel: event.channel,
				text: response.text,
				thread_ts: event.thread_ts || event.ts,
				blocks: response.blocks
			});
		} catch (error) {
			const response = getTemplate('error', {
				error: error.message,
				messageNumber: threadContext.messageCount + 1
			});
			
			return await this.client.chat.postMessage({
				channel: event.channel,
				text: response.text,
				thread_ts: event.thread_ts || event.ts,
				blocks: response.blocks
			});
		}
	}
	
	/**
	 * Send help response
	 */
	async sendHelpResponse(event, threadContext) {
		const userName = await this.getUserName(event.user);
		const response = getTemplate('agentHelp', {
			userName,
			threadContext,
			messageNumber: threadContext.messageCount + 1
		});
		
		return await this.client.chat.postMessage({
			channel: event.channel,
			text: response.text,
			thread_ts: event.thread_ts || event.ts,
			blocks: response.blocks
		});
	}
	
	/**
	 * Send settings response
	 */
	async sendSettingsResponse(event, threadContext) {
		const currentSettings = await agentManager.getChannelSettings(
			event.channel,
			this.installation.teamId
		);
		
		const response = getTemplate('settingsCommand', {
			currentSettings,
			channelId: event.channel,
			threadContext
		});
		
		return await this.client.chat.postMessage({
			channel: event.channel,
			text: response.text,
			thread_ts: event.thread_ts || event.ts,
			blocks: response.blocks
		});
	}
	
	/**
	 * Send list agents response
	 */
	async sendListAgentsResponse(event, threadContext) {
		const agents = await agentManager.getUserAgents(
			event.user,
			this.installation.teamId
		);
		
		const response = getTemplate('listAgents', {
			agents,
			org: this.org,
			threadContext
		});
		
		return await this.client.chat.postMessage({
			channel: event.channel,
			text: response.text,
			thread_ts: event.thread_ts || event.ts,
			blocks: response.blocks
		});
	}
	
	/**
	 * Send projects list response
	 */
	async sendProjectsListResponse(event, threadContext) {
		// Get projects for the organization - try multiple orgId formats
		const projects = await db.projects
			.find({ 
				$or: [
					{ orgId: this.org._id },
					{ orgId: this.org._id.toString() },
					{ orgId: this.org.handle }
				]
			})
			.sort({ updatedAt: -1 })
			.limit(20)
			.toArray();
		
		// Determine which template to use based on the original command
		const templateKey = selectTemplate(event.text, threadContext);
		const useProjectsList = templateKey === 'projectsList' || event.text.toLowerCase() === 'list projects';
		
		if (useProjectsList) {
			// Get current channel settings for projectsList template
			const channelSettings = await agentManager.getChannelSettings(
				event.channel,
				this.installation.teamId
			);
			
			const response = getTemplate('projectsList', {
				projects,
				org: this.org,
				channelSettings,
				channelId: event.channel,
				threadContext
			});
			
			return await this.client.chat.postMessage({
				channel: event.channel,
				text: response.text,
				thread_ts: event.thread_ts || event.ts,
				blocks: response.blocks
			});
		} else {
			// Use the simpler 'projects' template
			const response = getTemplate('projects', {
				projects,
				org: this.org,
				threadContext
			});
			
			const slackResponse = await this.client.chat.postMessage({
				channel: event.channel,
				text: response.text,
				thread_ts: event.thread_ts || event.ts,
				blocks: response.blocks
			});
			
			// Store the conversation
			await this.updateConversationWithResponse(
				await db.slackConversations.findOne({ messageTs: event.ts })?._id,
				slackResponse
			);
			
			return slackResponse;
		}
	}

	/**
	 * Handle deploy command
	 */
	async handleDeployCommand(event, threadContext, parsedCommand) {
		const { projectSlug, branch } = parsedCommand;
		
		try {
			console.log(`🔍 Looking for project with slug/name: "${projectSlug}" in org: ${this.org._id} (${this.org.handle})`);
			
			// Find the project by slug, name, or case-insensitive match
			// Try multiple variations of orgId since it might be stored differently
			const project = await db.projects.findOne({
				$and: [
					{
						$or: [
							{ slug: projectSlug },
							{ name: projectSlug },
							{ slug: { $regex: new RegExp(`^${projectSlug}$`, 'i') } },
							{ name: { $regex: new RegExp(`^${projectSlug}$`, 'i') } }
						]
					},
					{
						$or: [
							{ orgId: this.org._id },
							{ orgId: this.org._id.toString() },
							{ orgId: this.org.handle }
						]
					}
				]
			});
			
			if (!project) {
				// Let's see what projects exist for debugging
				const allProjects = await db.projects.find({ 
					$or: [
						{ orgId: this.org._id },
						{ orgId: this.org._id.toString() },
						{ orgId: this.org.handle }
					]
				}).limit(5).toArray();
				console.log(`❌ Project not found. Found ${allProjects.length} projects in org:`, 
					allProjects.map(p => ({ name: p.name, slug: p.slug, orgId: p.orgId })));
				
				// Send helpful error message with project list
				const blocks = [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `❌ I couldn't find a project with slug "${projectSlug}" in this organization.`
						}
					}
				];
				
				if (allProjects.length > 0) {
					blocks.push({
						type: "section",
						text: {
							type: "mrkdwn",
							text: "*Here are your recently modified projects:*"
						}
					});
					
					blocks.push({ type: "divider" });
					
					// Show up to 5 most recent projects
					allProjects.slice(0, 5).forEach((project, index) => {
						const updatedDate = new Date(project.updatedAt).toLocaleDateString();
						blocks.push({
							type: "section",
							text: {
								type: "mrkdwn",
								text: `*${project.name}*${project.description ? `\n${project.description}` : ''}\n_Last updated: ${updatedDate}_`
							},
							accessory: {
								type: "button",
								text: {
									type: "plain_text",
									text: "Deploy"
								},
								value: `deploy_${project.name}`,
								action_id: `quick_deploy_${index}`
							}
						});
					});
					
					blocks.push({ type: "divider" });
					blocks.push({
						type: "context",
						elements: [{
							type: "mrkdwn",
							text: `💡 Try: \`@bot deploy ${allProjects[0].name}\``
						}]
					});
				}
				
				blocks.push({
					type: "actions",
					elements: [{
						type: "button",
						text: {
							type: "plain_text",
							text: "View All Projects"
						},
						url: `https://repo.md/${this.org.handle}`,
						action_id: "view_all_projects_error"
					}]
				});
				
				await this.client.chat.postMessage({
					channel: event.channel,
					text: `❌ I couldn't find a project with slug "${projectSlug}" in this organization.`,
					thread_ts: event.thread_ts || event.ts,
					blocks
				});
				return;
			}
			
			// Get user info for the deployment
			const userInfo = await this.client.users.info({ user: event.user });
			const userEmail = userInfo.user?.profile?.email || event.user;
			
			// Import cloudRun service dynamically
			const cloudRunService = await import("../../lib/cloudRun.js");
			
			// Get project owner's information for deployment
			const projectOwner = await db.users.findOne({ id: project.ownerId });
			if (!projectOwner) {
				throw new Error("Project owner not found");
			}
			
			// Create deployment context using project owner's credentials
			// This ensures the deployment has proper access permissions
			const deployContext = {
				user: {
					id: projectOwner.id, // Use project owner's ID for access check
					email: projectOwner.email || userEmail,
					githubToken: projectOwner.githubSupaToken || projectOwner.githubToken
				}
			};
			
			// Trigger the deployment
			const result = await cloudRunService.default.createRepoDeployJob(
				project._id.toString(),
				deployContext,
				"latest", // Always deploy latest for Slack commands
				branch
			);
			
			// Get deployment channels configuration
			const deployChannels = this.org.slackIntegration?.channels?.filter(ch => 
				ch.types?.includes('deployments')
			) || [];
			
			const updateChannelName = deployChannels.length > 0 ? 
				`#${deployChannels[0].name}` : 
				'the deployment channel';
			
			// Send success response
			const deploymentUrl = `https://repo.md/${this.org.handle}/${project.name}/deployments`;
			
			await this.client.chat.postMessage({
				channel: event.channel,
				text: `🚀 Sure, let me redeploy *${project.name}*! You should see the update soon in ${updateChannelName} and you can track your deployments here: ${deploymentUrl}`,
				thread_ts: event.thread_ts || event.ts,
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `🚀 Sure, let me redeploy *${project.name}*!`
						}
					},
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `You should see the update soon in ${updateChannelName} and you can track your deployments here:`
						}
					},
					{
						type: "actions",
						elements: [
							{
								type: "button",
								text: {
									type: "plain_text",
									text: "View Deployments"
								},
								url: deploymentUrl,
								action_id: "view_deployments"
							}
						]
					},
					{
						type: "context",
						elements: [
							{
								type: "mrkdwn",
								text: `Deployment job: \`${result.job.jobId}\` • Branch: \`${branch}\` • Triggered by: <@${event.user}>`
							}
						]
					}
				]
			});
			
		} catch (error) {
			console.error("Error handling deploy command:", error);
			
			// Send error message
			await this.client.chat.postMessage({
				channel: event.channel,
				text: `❌ Sorry, I encountered an error while trying to deploy: ${error.message}`,
				thread_ts: event.thread_ts || event.ts
			});
		}
	}

	/**
	 * Handle task command
	 */
	async handleTaskCommand(event, threadContext, parsedCommand) {
		const { taskType, taskParams } = parsedCommand;
		
		try {
			// Handle demo task
			if (taskType.toLowerCase() === 'demo') {
				// Get task channels configuration
				const taskChannels = this.org.slackIntegration?.channels?.filter(ch => 
					ch.types?.includes('tasks')
				) || [];
				
				const updateChannelName = taskChannels.length > 0 ? 
					`#${taskChannels[0].name}` : 
					'your selected channel';
				
				// Send immediate response
				await this.client.chat.postMessage({
					channel: event.channel,
					text: `🎯 Alright, let me start a demo editor task! Updates should show in ${updateChannelName}, and once completed its status will update there.`,
					thread_ts: event.thread_ts || event.ts,
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: `🎯 Alright, let me start a demo editor task!`
							}
						},
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: `Updates should show in ${updateChannelName}, and once completed its status will update there.`
							}
						},
						{
							type: "context",
							elements: [
								{
									type: "mrkdwn",
									text: `Task type: \`demo\` • Duration: ~5 seconds`
								}
							]
						}
					]
				});
				
				// Import task notifier
				const taskNotifier = await import("./taskNotifier.js");
				
				// Create a demo job ID
				const demoJobId = `demo-${Date.now()}`;
				
				// Send task started notification
				const taskId = await taskNotifier.default.notifyTaskStarted({
					jobId: demoJobId,
					taskType: 'demo',
					projectId: null,
					userId: event.user,
					description: 'Demo editor task for testing notifications',
					orgId: this.org._id.toString() // Pass organization ID
				});
				
				console.log(`📝 Demo task created with ID: ${taskId}`);
				
				// Simulate task execution with timeout
				setTimeout(async () => {
					try {
						console.log(`⏰ Completing demo task with ID: ${taskId}`);
						// Update task to completed
						await taskNotifier.default.notifyTaskCompleted(taskId, {
							message: 'Demo editor task completed successfully! 🎉',
							details: 'This was a simulated editor task to test the notification system.'
						});
						console.log(`✅ Demo task ${taskId} marked as completed`);
					} catch (error) {
						console.error('Error completing demo task:', error);
					}
				}, 5000); // 5 seconds
				
			} else {
				// Unknown task type
				await this.client.chat.postMessage({
					channel: event.channel,
					text: `❌ Unknown task type: "${taskType}". Currently only "demo" is supported.`,
					thread_ts: event.thread_ts || event.ts
				});
			}
			
		} catch (error) {
			console.error("Error handling task command:", error);
			
			// Send error message
			await this.client.chat.postMessage({
				channel: event.channel,
				text: `❌ Sorry, I encountered an error while trying to run the task: ${error.message}`,
				thread_ts: event.thread_ts || event.ts
			});
		}
	}

	/**
	 * Process Slack thread history and convert to our format
	 */
	async processSlackThreadHistory(slackMessages, channelId) {
		const processedMessages = [];
		
		for (const msg of slackMessages) {
			// Skip bot messages that are already in our DB
			if (msg.bot_id && msg.bot_id === this.installation?.botUserId) {
				const existing = await db.slackConversations.findOne({ messageTs: msg.ts });
				if (existing) {
					processedMessages.push(existing);
					continue;
				}
			}

			// Get username if possible
			let username = "Unknown User";
			try {
				if (msg.user && !msg.bot_id) {
					const userInfo = await this.client.users.info({ user: msg.user });
					username = userInfo.user?.real_name || userInfo.user?.name || msg.user;
				} else if (msg.username) {
					username = msg.username;
				} else if (msg.bot_id) {
					username = "Bot";
				}
			} catch (e) {
				// Fallback to user ID if we can't get info
				username = msg.user || "Unknown";
			}

			// Create message object
			const messageObj = {
				teamId: this.installation.teamId,
				channelId: channelId,
				userId: msg.user || msg.bot_id || 'unknown',
				orgId: this.org._id,
				messageTs: msg.ts,
				threadTs: msg.thread_ts || msg.ts,
				text: msg.text || '',
				type: msg.bot_id ? 'bot_message' : 'thread_message',
				createdAt: new Date(parseFloat(msg.ts) * 1000),
				processed: true,
				fetchedFromSlack: true,
				username: username,
				bot_id: msg.bot_id
			};

			processedMessages.push(messageObj);
		}

		return processedMessages;
	}
}

// Export singleton instance
export default new SlackMessageHandler();