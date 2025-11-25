/**
 * Factory to create the appropriate Slack message handler
 * based on whether the organization has proper Slack integration
 */

import defaultSlackMessageHandler from "./messageHandler.js";
import { SlackMessageHandlerIntegrated } from "./messageHandlerIntegrated.js";
import { WebClient } from "@slack/web-api";
import { db } from "../../db.js";

class MessageHandlerFactory {
	constructor() {
		// Cache handlers by team ID to avoid recreating them
		this.handlers = new Map();
		this.defaultHandler = defaultSlackMessageHandler;
	}

	/**
	 * Get the appropriate handler for a team
	 * @param {string} teamId - Slack team ID
	 * @returns {Promise<SlackMessageHandler>} The appropriate handler
	 */
	async getHandler(teamId) {
		// Check cache first
		if (this.handlers.has(teamId)) {
			return this.handlers.get(teamId);
		}

		try {
			// Check if this team has a properly configured org
			const org = await db.orgs.findOne({
				"slackIntegration.teamId": teamId
			});

			if (!org) {
				console.log(`Using default handler for team ${teamId} (no org found)`);
				return this.defaultHandler;
			}

			// Check if the org has the necessary configuration for LLM
			const installation = await db.slackInstallations.findOne({ teamId });
			
			if (!installation || !installation.botToken) {
				console.log(`Using default handler for team ${teamId} (no valid installation)`);
				return this.defaultHandler;
			}

			// Check if LLM integration is enabled (you can add an org setting for this)
			const llmEnabled = org.settings?.slackLLMEnabled !== false; // Default to true
			
			if (!llmEnabled) {
				console.log(`Using default handler for team ${teamId} (LLM disabled)`);
				return this.defaultHandler;
			}

			// Create and cache the integrated handler
			console.log(`Creating integrated LLM handler for team ${teamId}`);
			const client = new WebClient(installation.botToken);
			const integratedHandler = new SlackMessageHandlerIntegrated(client);
			
			// Cache it
			this.handlers.set(teamId, integratedHandler);
			
			return integratedHandler;

		} catch (error) {
			console.error(`Error determining handler for team ${teamId}:`, error);
			return this.defaultHandler;
		}
	}

	/**
	 * Handle an app mention event
	 * @param {Object} event - Slack event
	 * @param {string} teamId - Slack team ID
	 */
	async handleAppMention(event, teamId) {
		const handler = await this.getHandler(teamId);
		return handler.handleAppMention(event, teamId);
	}

	/**
	 * Handle a thread reply event
	 * @param {Object} event - Slack event
	 * @param {string} teamId - Slack team ID
	 */
	async handleThreadReply(event, teamId) {
		const handler = await this.getHandler(teamId);
		return handler.handleThreadReply(event, teamId);
	}

	/**
	 * Handle a slash command
	 * @param {Object} payload - Slack command payload
	 */
	async handleSlashCommand(payload) {
		const handler = await this.getHandler(payload.team_id);
		
		// Check if handler supports slash commands
		if (typeof handler.handleSlashCommand === 'function') {
			return handler.handleSlashCommand(payload);
		}
		
		// Default response
		return {
			response_type: "ephemeral",
			text: "This command is not supported yet."
		};
	}

	/**
	 * Clear handler cache (useful for testing or when settings change)
	 * @param {string} teamId - Optional team ID to clear specific handler
	 */
	clearCache(teamId = null) {
		if (teamId) {
			this.handlers.delete(teamId);
		} else {
			this.handlers.clear();
		}
	}
}

// Export singleton instance
export default new MessageHandlerFactory();