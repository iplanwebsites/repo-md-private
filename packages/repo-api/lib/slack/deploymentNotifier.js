/**
 * Handle deployment notifications to Slack
 */

import { db } from "../../db.js";
import { getTemplate } from "./responseTemplates.js";
import { ObjectId } from "mongodb";
import slackMessageUpdater from "./SlackMessageUpdater.js";

export class SlackDeploymentNotifier {
	/**
	 * Send deployment started notification and store message timestamps
	 */
	async notifyDeploymentStarted(deploymentData) {
		try {
			const { projectId, jobId, branch, triggeredBy, commitId, commitMessage } = deploymentData;
			
			// Get project
			const project = await db.projects.findOne({ _id: new ObjectId(projectId) });
			if (!project) {
				console.error('Project not found:', projectId);
				return null;
			}
			
			// Create deployment record
			const deployment = {
				projectId: new ObjectId(projectId),
				jobId,
				status: 'started',
				startedAt: new Date(),
				branch: branch || 'main',
				commitId,
				commitMessage,
				triggeredBy,
				createdAt: new Date(),
				slackMessages: [] // Will store message timestamps
			};
			
			const deploymentResult = await db.deploys.insertOne(deployment);
			const deploymentId = deploymentResult.insertedId;
			
			// Get organization for template
			const org = await db.orgs.findOne({ handle: project.orgId });
			
			// Generate "started" notification
			const message = getTemplate('deploymentNotification', {
				deployment: {
					...deployment,
					_id: deploymentId,
					status: 'started'
				},
				project,
				org,
				duration: '0s',
				stats: null
			});
			
			// Send initial message using the modular updater
			await slackMessageUpdater.sendInitialMessage({
				orgId: project.orgId, // This is the org handle
				entityType: 'deployment',
				entityId: deploymentId.toString(),
				notificationTypes: ['deployments'],
				message
			});
			
			return deploymentId;
			
		} catch (error) {
			console.error('Error sending deployment started notification:', error);
			return null;
		}
	}
	
	/**
	 * Update deployment notification with completion status
	 */
	async updateDeploymentNotification(deploymentId, status = 'completed', stats = null) {
		try {
			// Get deployment details
			const deployment = await db.deploys.findOne({ _id: new ObjectId(deploymentId) });
			if (!deployment) {
				console.error('Deployment not found:', deploymentId);
				return;
			}
			
			// Update deployment status
			await db.deploys.updateOne(
				{ _id: new ObjectId(deploymentId) },
				{ 
					$set: { 
						status,
						completedAt: new Date(),
						...(stats && { stats })
					} 
				}
			);
			
			// Get project
			const project = await db.projects.findOne({ _id: deployment.projectId });
			if (!project) {
				console.error('Project not found:', deployment.projectId);
				return;
			}
			
			// Get organization for template
			const org = await db.orgs.findOne({ handle: project.orgId });
			
			// Calculate deployment duration
			const duration = this.calculateDuration(
				deployment.startedAt || deployment.createdAt, 
				new Date()
			);
			
			// Get deployment stats or use provided ones
			const deploymentStats = stats || await this.getDeploymentStats(deployment);
			
			// Generate updated notification
			const message = getTemplate('deploymentNotification', {
				deployment: {
					...deployment,
					status
				},
				project,
				org,
				duration,
				stats: deploymentStats
			});
			
			// Update message using the modular updater
			await slackMessageUpdater.updateMessage({
				orgId: project.orgId, // This is the org handle
				entityType: 'deployment',
				entityId: deploymentId.toString(),
				message,
				notificationTypes: ['deployments'] // Fallback if no existing messages
			});
			
		} catch (error) {
			console.error('Error updating deployment notification:', error);
		}
	}
	
	/**
	 * Get deployment statistics
	 */
	async getDeploymentStats(deployment) {
		// Mock stats - in production these would come from the deployment system
		return deployment.stats || {
			pageCount: deployment.pageCount || Math.floor(Math.random() * 100) + 10,
			fileCount: deployment.fileCount || Math.floor(Math.random() * 500) + 50,
			totalSize: deployment.totalSize || Math.floor(Math.random() * 50000000) + 1000000,
			buildTime: deployment.buildTime || Math.floor(Math.random() * 120) + 10
		};
	}
	
	/**
	 * Calculate duration between two dates
	 */
	calculateDuration(startDate, endDate) {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const diff = end - start;
		
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		
		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		}
		return `${seconds}s`;
	}
	
	/**
	 * Convenience method for completed deployments
	 */
	async notifyDeploymentCompleted(deploymentId, stats) {
		return this.updateDeploymentNotification(deploymentId, 'completed', stats);
	}
	
	/**
	 * Convenience method for failed deployments
	 */
	async notifyDeploymentFailed(deploymentId, error) {
		try {
			// Update deployment with error
			await db.deploys.updateOne(
				{ _id: new ObjectId(deploymentId) },
				{ $set: { error: error.message || error } }
			);
			
			return this.updateDeploymentNotification(deploymentId, 'failed');
		} catch (err) {
			console.error('Error notifying deployment failure:', err);
		}
	}
}

// Export singleton instance
export default new SlackDeploymentNotifier();