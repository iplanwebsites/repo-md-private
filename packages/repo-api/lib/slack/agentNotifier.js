/**
 * Handle agent status notifications to Slack
 */

import { db } from "../../db.js";
import { WebClient } from "@slack/web-api";
import { getTemplate } from "./responseTemplates.js";

export class SlackAgentNotifier {
	/**
	 * Send agent completion notification
	 */
	async notifyAgentCompleted(agentId, prUrl, completionMessage) {
		try {
			// Get agent details
			const agent = await db.slackAgents.findOne({ _id: agentId });
			if (!agent) return;
			
			// Get Slack installation
			const installation = await db.slackInstallations.findOne({ teamId: agent.teamId });
			if (!installation) return;
			
			// Get org
			const org = await db.orgs.findOne({ _id: agent.orgId });
			if (!org) return;
			
			// Calculate duration
			const duration = this.calculateDuration(agent.createdAt, new Date());
			
			// Create Slack client
			const client = new WebClient(installation.botToken);
			
			// Generate response
			const response = getTemplate('agentCompleted', {
				agent: {
					...agent,
					prUrl,
					completionMessage
				},
				org,
				duration
			});
			
			// Send notification
			await client.chat.postMessage({
				channel: agent.channelId,
				thread_ts: agent.threadTs,
				text: response.text,
				blocks: response.blocks
			});
			
			console.log(`✅ Notified Slack about completed agent: ${agent.requestId}`);
		} catch (error) {
			console.error('Error notifying Slack about agent completion:', error);
		}
	}
	
	/**
	 * Send agent failure notification
	 */
	async notifyAgentFailed(agentId, error) {
		try {
			// Get agent details
			const agent = await db.slackAgents.findOne({ _id: agentId });
			if (!agent) return;
			
			// Get Slack installation
			const installation = await db.slackInstallations.findOne({ teamId: agent.teamId });
			if (!installation) return;
			
			// Get org
			const org = await db.orgs.findOne({ _id: agent.orgId });
			if (!org) return;
			
			// Create Slack client
			const client = new WebClient(installation.botToken);
			
			// Generate response
			const response = getTemplate('agentFailed', {
				agent: {
					...agent,
					error
				},
				org
			});
			
			// Send notification
			await client.chat.postMessage({
				channel: agent.channelId,
				thread_ts: agent.threadTs,
				text: response.text,
				blocks: response.blocks
			});
			
			console.log(`❌ Notified Slack about failed agent: ${agent.requestId}`);
		} catch (error) {
			console.error('Error notifying Slack about agent failure:', error);
		}
	}
	
	/**
	 * Calculate duration between two dates
	 */
	calculateDuration(startDate, endDate) {
		const diff = endDate - startDate;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		
		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}
}

// Export singleton instance
export default new SlackAgentNotifier();