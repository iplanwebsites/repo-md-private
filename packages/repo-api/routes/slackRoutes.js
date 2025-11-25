import { router } from "../lib/trpc/trpc.js";
import { protectedProcedure, adminProcedure, projectAdminProcedure } from "../lib/trpc/procedures.js";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "../db.js";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import agentManager from "../lib/slack/agentManager.js";

export const slackRouter = router({
	// Get Slack installation status for an organization
	getInstallationStatus: protectedProcedure
		.input(z.object({
			orgHandle: z.string()
		}))
		.query(async ({ ctx, input }) => {
			// Check if user has access to this org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id }
				]
			});
			
			if (!org) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Organization not found"
				});
			}
			
			// Check if Slack is installed
			const hasSlackIntegration = org.slackIntegration && org.slackIntegration.teamId;
			
			return {
				isInstalled: hasSlackIntegration,
				teamName: hasSlackIntegration ? org.slackIntegration.teamName : null,
				installedAt: hasSlackIntegration ? org.slackIntegration.installedAt : null,
				channels: hasSlackIntegration ? org.slackIntegration.channels || [] : []
			};
		}),
	
	// Generate Slack installation URL
	generateInstallUrl: protectedProcedure
		.input(z.object({
			orgHandle: z.string()
		}))
		.mutation(async ({ ctx, input }) => {
			// Verify user has admin access to org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id, "members.role": { $in: ["admin", "owner"] } }
				]
			});
			
			if (!org) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have permission to install Slack for this organization"
				});
			}
			
			// Generate installation URL
			// Use helper function to get base URL
			const getBaseUrl = () => {
				if (process.env.USE_SLACK_DEV === 'true' && process.env.API_BASE_URL_DEV_TUNEL) {
					return process.env.API_BASE_URL_DEV_TUNEL;
				} else if (process.env.USE_SLACK_DEV === 'true' && process.env.API_BASE_URL_DEV) {
					return process.env.API_BASE_URL_DEV;
				} else if (process.env.USE_SLACK_DEV === 'true') {
					return `http://localhost:${process.env.PORT || 3001}`;
				}
				return process.env.API_BASE_URL || 'http://localhost:3001';
			};
			const baseUrl = getBaseUrl();
			const installUrl = `${baseUrl}/api/slack/install?orgId=${org.handle}&userId=${ctx.user.id}`;
			
			return {
				installUrl,
				orgName: org.name
			};
		}),
	
	// Uninstall Slack integration
	uninstall: protectedProcedure
		.input(z.object({
			orgHandle: z.string()
		}))
		.mutation(async ({ ctx, input }) => {
			// Verify user has admin access to org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id, "members.role": { $in: ["admin", "owner"] } }
				]
			});
			
			if (!org) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have permission to manage Slack for this organization"
				});
			}
			
			if (!org.slackIntegration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No Slack integration found"
				});
			}
			
			// Remove Slack installation from database
			await db.slackInstallations.deleteOne({
				teamId: org.slackIntegration.teamId
			});
			
			// Remove Slack integration from org
			await db.orgs.updateOne(
				{ _id: org._id },
				{ $unset: { slackIntegration: 1 } }
			);
			
			return { success: true };
		}),
	
	// Configure Slack channels for notifications
	configureChannels: protectedProcedure
		.input(z.object({
			orgHandle: z.string(),
			channels: z.array(z.object({
				id: z.string(),
				name: z.string(),
				types: z.array(z.enum(["deployments", "errors", "general", "tasks"]))
			}))
		}))
		.mutation(async ({ ctx, input }) => {
			// Verify user has admin access to org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id, "members.role": { $in: ["admin", "owner"] } }
				]
			});
			
			if (!org) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have permission to configure Slack for this organization"
				});
			}
			
			if (!org.slackIntegration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No Slack integration found"
				});
			}
			
			// Update channel configuration
			await db.orgs.updateOne(
				{ _id: org._id },
				{
					$set: {
						"slackIntegration.channels": input.channels,
						"slackIntegration.updatedAt": new Date()
					}
				}
			);
			
			return { success: true };
		}),
	
	// Test Slack notification
	testNotification: protectedProcedure
		.input(z.object({
			orgHandle: z.string(),
			channelId: z.string().optional(),
			message: z.string().default("This is a test notification from Repo.md!")
		}))
		.mutation(async ({ ctx, input }) => {
			// Verify user has access to org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id }
				]
			});
			
			if (!org) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Organization not found"
				});
			}
			
			if (!org.slackIntegration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No Slack integration found"
				});
			}
			
			// Get Slack installation
			const installation = await db.slackInstallations.findOne({
				teamId: org.slackIntegration.teamId
			});
			
			if (!installation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Slack installation not found"
				});
			}
			
			// Send test message using Slack Web API
			const { WebClient } = await import("@slack/web-api");
			const client = new WebClient(installation.botToken);
			
			try {
				// Find channel to send to
				let channelId = input.channelId;
				if (!channelId && org.slackIntegration.channels?.length > 0) {
					channelId = org.slackIntegration.channels[0].id;
				}
				
				if (!channelId) {
					// Get general channel as fallback
					const result = await client.conversations.list({
						types: "public_channel",
						limit: 1
					});
					channelId = result.channels?.[0]?.id;
				}
				
				if (!channelId) {
					throw new Error("No channel available to send message");
				}
				
				await client.chat.postMessage({
					channel: channelId,
					text: input.message,
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: `🧪 *Test Notification*\n${input.message}`
							}
						},
						{
							type: "context",
							elements: [
								{
									type: "mrkdwn",
									text: `Sent from *${org.name}* by ${ctx.user.email}`
								}
							]
						}
					]
				});
				
				return { success: true, channelId };
			} catch (error) {
				console.error("Error sending test notification:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to send test notification: ${error.message}`
				});
			}
		}),
	
	// Get list of available Slack channels
	getChannels: protectedProcedure
		.input(z.object({
			orgHandle: z.string()
		}))
		.query(async ({ ctx, input }) => {
			// Verify user has access to org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id }
				]
			});
			
			if (!org || !org.slackIntegration) {
				return { channels: [] };
			}
			
			// Get Slack installation
			const installation = await db.slackInstallations.findOne({
				teamId: org.slackIntegration.teamId
			});
			
			if (!installation) {
				return { channels: [] };
			}
			
			// Get channels using Slack Web API
			const { WebClient } = await import("@slack/web-api");
			const client = new WebClient(installation.botToken);
			
			try {
				const result = await client.conversations.list({
					types: "public_channel",
					exclude_archived: true,
					limit: 100
				});
				
				return {
					channels: result.channels.map(channel => ({
						id: channel.id,
						name: channel.name,
						isMember: channel.is_member
					}))
				};
			} catch (error) {
				console.error("Error fetching channels:", error);
				return { channels: [] };
			}
		}),
	
	// Get Slack conversation history
	getConversations: protectedProcedure
		.input(z.object({
			orgHandle: z.string(),
			limit: z.number().optional().default(50),
			skip: z.number().optional().default(0)
		}))
		.query(async ({ ctx, input }) => {
			// Verify user has access to org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id }
				]
			});
			
			if (!org) {
				return { conversations: [], total: 0 };
			}
			
			// Get conversations for this org
			const conversations = await db.slackConversations
				.find({ orgId: org._id })
				.sort({ createdAt: -1 })
				.limit(input.limit)
				.skip(input.skip)
				.toArray();
			
			const total = await db.slackConversations.countDocuments({ orgId: org._id });
			
			return { conversations, total };
		}),
	
	// Send a message to Slack
	sendMessage: protectedProcedure
		.input(z.object({
			orgHandle: z.string(),
			channelId: z.string(),
			message: z.string(),
			threadTs: z.string().optional()
		}))
		.mutation(async ({ ctx, input }) => {
			// Verify user has access to org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id }
				]
			});
			
			if (!org || !org.slackIntegration) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Slack integration not found"
				});
			}
			
			// Get Slack installation
			const installation = await db.slackInstallations.findOne({
				teamId: org.slackIntegration.teamId
			});
			
			if (!installation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Slack installation not found"
				});
			}
			
			// Send message using Slack Web API
			const { WebClient } = await import("@slack/web-api");
			const client = new WebClient(installation.botToken);
			
			try {
				const result = await client.chat.postMessage({
					channel: input.channelId,
					text: input.message,
					thread_ts: input.threadTs
				});
				
				// Store the sent message
				await db.slackConversations.insertOne({
					teamId: org.slackIntegration.teamId,
					channelId: input.channelId,
					userId: "bot", // Mark as bot message
					orgId: org._id,
					messageTs: result.ts,
					threadTs: input.threadTs || result.ts,
					text: input.message,
					type: "bot_message",
					createdAt: new Date(),
					sentBy: ctx.user.id
				});
				
				return { 
					success: true, 
					messageTs: result.ts,
					channelId: result.channel 
				};
			} catch (error) {
				console.error("Error sending message:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to send message: ${error.message}`
				});
			}
		}),
	
	// Get agents for the current user
	getUserAgents: protectedProcedure
		.input(z.object({
			orgHandle: z.string(),
			includeCompleted: z.boolean().optional().default(false)
		}))
		.query(async ({ ctx, input }) => {
			// Verify user has access to org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id }
				]
			});
			
			if (!org || !org.slackIntegration) {
				return { agents: [] };
			}
			
			// Get agents
			const agents = await agentManager.getUserAgents(
				ctx.user.id,
				org.slackIntegration.teamId,
				input.includeCompleted
			);
			
			return { agents };
		}),
	
	// Get agent details
	getAgent: protectedProcedure
		.input(z.object({
			orgHandle: z.string(),
			agentId: z.string()
		}))
		.query(async ({ ctx, input }) => {
			// Verify user has access to org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id }
				]
			});
			
			if (!org) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Organization not found"
				});
			}
			
			// Get agent
			const agent = await db.slackAgents.findOne({
				_id: new ObjectId(input.agentId),
				orgId: org._id
			});
			
			if (!agent) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Agent not found"
				});
			}
			
			return { agent };
		}),
	
	// Get channel settings
	getChannelSettings: protectedProcedure
		.input(z.object({
			orgHandle: z.string(),
			channelId: z.string()
		}))
		.query(async ({ ctx, input }) => {
			// Verify user has access to org
			const org = await db.orgs.findOne({
				handle: input.orgHandle,
				$or: [
					{ owner: ctx.user.id },
					{ "members.userId": ctx.user.id, "members.role": { $in: ["admin", "owner"] } }
				]
			});
			
			if (!org || !org.slackIntegration) {
				return { settings: {} };
			}
			
			// Get settings
			const settings = await agentManager.getChannelSettings(
				input.channelId,
				org.slackIntegration.teamId
			);
			
			return { settings };
		})
});

// Helper function to send Slack notifications
export async function sendSlackNotification(orgId, notification) {
	try {
		const org = await db.orgs.findOne({ _id: new ObjectId(orgId) });
		if (!org?.slackIntegration) return;
		
		const installation = await db.slackInstallations.findOne({
			teamId: org.slackIntegration.teamId
		});
		
		if (!installation) return;
		
		const { WebClient } = await import("@slack/web-api");
		const client = new WebClient(installation.botToken);
		
		// Find appropriate channel based on notification type
		let channelId;
		if (org.slackIntegration.channels) {
			const channel = org.slackIntegration.channels.find(
				ch => ch.types.includes(notification.type)
			);
			channelId = channel?.id;
		}
		
		// Fallback to first channel or general
		if (!channelId && org.slackIntegration.channels?.length > 0) {
			channelId = org.slackIntegration.channels[0].id;
		}
		
		if (channelId) {
			await client.chat.postMessage({
				channel: channelId,
				...notification.message
			});
		}
	} catch (error) {
		console.error("Error sending Slack notification:", error);
	}
}