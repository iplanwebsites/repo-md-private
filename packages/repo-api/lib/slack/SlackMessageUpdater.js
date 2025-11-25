/**
 * Modular Slack message updater for deployments, tasks, and other updatable messages
 */

import { WebClient } from "@slack/web-api";
import { db } from "../../db.js";
import { ObjectId } from "mongodb";

export class SlackMessageUpdater {
	constructor() {
		this.messageCache = new Map(); // Cache client instances
	}

	/**
	 * Send an initial message to Slack channels and store message timestamps
	 * @param {Object} options
	 * @param {string} options.orgId - Organization ID or handle
	 * @param {string} options.entityType - Type of entity (deployment, task, etc.)
	 * @param {string} options.entityId - ID of the entity
	 * @param {Array<string>} options.notificationTypes - Notification types to filter channels
	 * @param {Object} options.message - Slack message object with text and blocks
	 * @param {boolean} options.skipIfTriggeredFromSlack - Skip sending if entity was triggered from Slack
	 * @returns {Promise<Array>} Array of sent message info
	 */
	async sendInitialMessage(options) {
		const {
			orgId,
			entityType,
			entityId,
			notificationTypes,
			message,
			skipIfTriggeredFromSlack = false
		} = options;

		try {
			// Get organization
			const org = await this.getOrganization(orgId);
			if (!org?.slackIntegration) {
				console.log(`No Slack integration for org: ${orgId}`);
				return [];
			}

			// Check if we should skip (for tasks triggered from Slack)
			if (skipIfTriggeredFromSlack) {
				const entity = await this.getEntity(entityType, entityId);
				if (entity?.triggeredFrom === 'slack') {
					console.log(`Skipping Slack notification for ${entityType} triggered from Slack`);
					return [];
				}
			}

			// Get Slack client
			const client = await this.getSlackClient(org.slackIntegration.teamId);
			if (!client) return [];

			// Get channels configured for these notification types
			const channels = this.getChannelsForNotificationTypes(
				org.slackIntegration.channels,
				notificationTypes
			);

			if (channels.length === 0) {
				console.log(`No channels configured for notification types: ${notificationTypes.join(', ')}`);
				return [];
			}

			// Send to each channel and collect message info
			const sentMessages = [];
			for (const channel of channels) {
				try {
					const result = await client.chat.postMessage({
						channel: channel.id,
						text: message.text,
						blocks: message.blocks,
						...(message.attachments && { attachments: message.attachments })
					});

					sentMessages.push({
						channelId: channel.id,
						channelName: channel.name,
						messageTs: result.ts,
						threadTs: result.thread_ts
					});

					console.log(`📨 Sent ${entityType} notification to channel: ${channel.name}`);
				} catch (error) {
					console.error(`Failed to send to channel ${channel.name}:`, error);
				}
			}

			// Store message timestamps in entity
			await this.storeMessageTimestamps(entityType, entityId, sentMessages);

			return sentMessages;
		} catch (error) {
			console.error(`Error sending initial ${entityType} message:`, error);
			return [];
		}
	}

	/**
	 * Update existing Slack messages
	 * @param {Object} options
	 * @param {string} options.orgId - Organization ID or handle
	 * @param {string} options.entityType - Type of entity (deployment, task, etc.)
	 * @param {string} options.entityId - ID of the entity
	 * @param {Object} options.message - Updated Slack message object
	 * @param {Array<string>} options.notificationTypes - Notification types (used as fallback)
	 * @returns {Promise<boolean>} Success status
	 */
	async updateMessage(options) {
		const {
			orgId,
			entityType,
			entityId,
			message,
			notificationTypes = []
		} = options;

		try {
			// Get organization
			const org = await this.getOrganization(orgId);
			if (!org?.slackIntegration) {
				console.log(`No Slack integration for org: ${orgId}`);
				return false;
			}

			// Get entity with stored message timestamps
			const entity = await this.getEntity(entityType, entityId);
			if (!entity) {
				console.error(`${entityType} not found:`, entityId);
				return false;
			}

			// Get Slack client
			const client = await this.getSlackClient(org.slackIntegration.teamId);
			if (!client) return false;

			// Update existing messages if we have them
			console.log(`🔍 Entity has ${entity.slackMessages?.length || 0} slack messages`);
			if (entity.slackMessages && entity.slackMessages.length > 0) {
				console.log(`📨 Updating ${entity.slackMessages.length} existing messages`);
				for (const msg of entity.slackMessages) {
					try {
						console.log(`🔄 Updating message in channel ${msg.channelName} (${msg.channelId}), ts: ${msg.messageTs}`);
						await client.chat.update({
							channel: msg.channelId,
							ts: msg.messageTs,
							text: message.text,
							blocks: message.blocks,
							...(message.attachments && { attachments: message.attachments })
						});
						console.log(`✅ Updated ${entityType} message in channel: ${msg.channelName}`);
					} catch (error) {
						console.error(`Failed to update message in channel ${msg.channelName}:`, error);
					}
				}
				return true;
			} else {
				// No existing messages, send new ones as fallback
				console.log(`No existing messages found for ${entityType}, sending new ones`);
				const sentMessages = await this.sendInitialMessage({
					orgId,
					entityType,
					entityId,
					notificationTypes,
					message
				});
				return sentMessages.length > 0;
			}
		} catch (error) {
			console.error(`Error updating ${entityType} message:`, error);
			return false;
		}
	}

	/**
	 * Get organization by ID or handle
	 */
	async getOrganization(orgId) {
		// Try to find by ObjectId first
		if (ObjectId.isValid(orgId)) {
			const org = await db.orgs.findOne({ _id: new ObjectId(orgId) });
			if (org) return org;
		}
		
		// Fall back to handle lookup
		return await db.orgs.findOne({ handle: orgId });
	}

	/**
	 * Get Slack client for a team
	 */
	async getSlackClient(teamId) {
		// Check cache first
		if (this.messageCache.has(teamId)) {
			return this.messageCache.get(teamId);
		}

		// Get installation
		const installation = await db.slackInstallations.findOne({ teamId });
		if (!installation) {
			console.error('Slack installation not found for team:', teamId);
			return null;
		}

		// Create and cache client
		const client = new WebClient(installation.botToken);
		this.messageCache.set(teamId, client);
		return client;
	}

	/**
	 * Get channels configured for specific notification types
	 */
	getChannelsForNotificationTypes(channels, notificationTypes) {
		if (!channels || !Array.isArray(channels)) return [];
		
		return channels.filter(channel => 
			channel.types && notificationTypes.some(type => channel.types.includes(type))
		);
	}

	/**
	 * Get entity from database
	 */
	async getEntity(entityType, entityId) {
		const collections = {
			deployment: 'deploys',
			task: 'jobs',
			project: 'projects'
		};

		const collectionName = collections[entityType];
		if (!collectionName) {
			console.error(`Unknown entity type: ${entityType}`);
			return null;
		}

		console.log(`🔍 Getting ${entityType} entity ${entityId} from collection ${collectionName}`);
		const entity = await db[collectionName].findOne({ _id: new ObjectId(entityId) });
		console.log(`📄 Found entity:`, { 
			found: !!entity, 
			hasSlackMessages: !!(entity?.slackMessages), 
			messageCount: entity?.slackMessages?.length || 0 
		});
		return entity;
	}

	/**
	 * Store message timestamps in entity
	 */
	async storeMessageTimestamps(entityType, entityId, messages) {
		const collections = {
			deployment: 'deploys',
			task: 'jobs',
			project: 'projects'
		};

		const collectionName = collections[entityType];
		if (!collectionName) {
			console.error(`❌ No collection mapping for entity type: ${entityType}`);
			return;
		}

		console.log(`💾 Storing ${messages.length} message timestamps for ${entityType} ${entityId} in collection ${collectionName}`);
		const result = await db[collectionName].updateOne(
			{ _id: new ObjectId(entityId) },
			{ $set: { slackMessages: messages } }
		);
		console.log(`✅ Update result:`, { matched: result.matchedCount, modified: result.modifiedCount });
	}

	/**
	 * Send a reply to a thread
	 */
	async sendThreadReply(options) {
		const { orgId, channelId, threadTs, message } = options;

		try {
			const org = await this.getOrganization(orgId);
			if (!org?.slackIntegration) return null;

			const client = await this.getSlackClient(org.slackIntegration.teamId);
			if (!client) return null;

			const result = await client.chat.postMessage({
				channel: channelId,
				thread_ts: threadTs,
				text: message.text,
				blocks: message.blocks,
				...(message.attachments && { attachments: message.attachments })
			});

			return {
				channelId,
				messageTs: result.ts,
				threadTs: result.thread_ts || threadTs
			};
		} catch (error) {
			console.error('Error sending thread reply:', error);
			return null;
		}
	}
}

// Export singleton instance
export default new SlackMessageUpdater();