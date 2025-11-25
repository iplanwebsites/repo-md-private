/**
 * Handle task notifications to Slack
 */

import { db } from "../../db.js";
import { getTemplate } from "./responseTemplates.js";
import { ObjectId } from "mongodb";
import slackMessageUpdater from "./SlackMessageUpdater.js";

export class SlackTaskNotifier {
	/**
	 * Send task started notification and store message timestamps
	 */
	async notifyTaskStarted(taskData) {
		try {
			const { jobId, taskType, projectId, userId, description, orgId } = taskData;
			
			// Get project if available
			let project = null;
			let org = null;
			
			if (projectId) {
				project = await db.projects.findOne({ _id: new ObjectId(projectId) });
			}
			
			// Get organization - try multiple methods
			if (orgId) {
				// Direct orgId provided
				if (ObjectId.isValid(orgId)) {
					org = await db.orgs.findOne({ _id: new ObjectId(orgId) });
				}
				if (!org) {
					// Try as handle
					org = await db.orgs.findOne({ handle: orgId });
				}
			} else if (project) {
				// Get from project
				org = await db.orgs.findOne({ handle: project.orgId });
			} else if (userId) {
				// Get from user's default org
				const user = await db.users.findOne({ id: userId });
				if (user && user.defaultOrgId) {
					org = await db.orgs.findOne({ _id: new ObjectId(user.defaultOrgId) });
				}
			}
			
			if (!org) {
				console.log('No organization found for task notification');
				return null;
			}
			
			// Create task record in jobs collection
			const task = {
				type: 'editorTask', // Job type for editor tasks
				subType: taskType, // Task subtype (e.g., 'demo')
				jobId,
				projectId: projectId ? new ObjectId(projectId) : null,
				userId,
				orgId: org._id, // Store the organization ID for later updates
				status: 'running', // Use standard job status
				startedAt: new Date(),
				description: description || `${taskType} editor task`,
				createdAt: new Date(),
				updatedAt: new Date(),
				input: { taskType, description },
				slackMessages: [] // Will store message timestamps
			};
			
			const taskResult = await db.jobs.insertOne(task);
			const taskId = taskResult.insertedId;
			
			// Generate "started" notification
			const message = getTemplate('taskNotification', {
				task: {
					...task,
					_id: taskId,
					status: 'started'
				},
				project,
				org,
				duration: '0s',
				result: null
			});
			
			// Send initial message using the modular updater
			const sentMessages = await slackMessageUpdater.sendInitialMessage({
				orgId: org.handle || org._id.toString(),
				entityType: 'task',
				entityId: taskId.toString(),
				notificationTypes: ['tasks'], // Use 'tasks' notification type
				message
			});
			
			console.log(`📨 Task notification sent to ${sentMessages.length} channels for task ${taskId}`);
			
			return taskId;
			
		} catch (error) {
			console.error('Error sending task started notification:', error);
			return null;
		}
	}
	
	/**
	 * Update task notification with completion status
	 */
	async updateTaskNotification(taskId, status = 'completed', result = null) {
		try {
			console.log(`🔄 Updating task ${taskId} to status: ${status}`);
			
			// Get task details
			const task = await db.jobs.findOne({ _id: new ObjectId(taskId) });
			if (!task) {
				console.error('Task not found:', taskId);
				return;
			}
			
			console.log(`📋 Found task:`, { id: task._id, type: task.type, subType: task.subType, status: task.status });
			
			// Update task status
			const jobStatus = status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'running';
			await db.jobs.updateOne(
				{ _id: new ObjectId(taskId) },
				{ 
					$set: { 
						status: jobStatus,
						completedAt: new Date(),
						updatedAt: new Date(),
						...(result && { output: result })
					} 
				}
			);
			
			// Get project if available
			let project = null;
			let org = null;
			
			// First try to get org from the task's stored orgId
			if (task.orgId) {
				org = await db.orgs.findOne({ _id: task.orgId });
			}
			
			// If no org yet, try from project
			if (!org && task.projectId) {
				project = await db.projects.findOne({ _id: task.projectId });
				if (project) {
					org = await db.orgs.findOne({ handle: project.orgId });
				}
			}
			
			// If still no org, try from userId
			if (!org && task.userId) {
				const user = await db.users.findOne({ id: task.userId });
				if (user && user.defaultOrgId) {
					org = await db.orgs.findOne({ _id: new ObjectId(user.defaultOrgId) });
				}
			}
			
			if (!org) {
				console.log('No organization found for task update');
				return;
			}
			
			// Calculate task duration
			const duration = this.calculateDuration(
				task.startedAt || task.createdAt, 
				new Date()
			);
			
			// Generate updated notification
			const message = getTemplate('taskNotification', {
				task: {
					...task,
					status,
					result
				},
				project,
				org,
				duration,
				result
			});
			
			// Update message using the modular updater
			console.log(`📤 Sending task update notification for ${taskId} to org ${org.handle || org._id}`);
			const updateResult = await slackMessageUpdater.updateMessage({
				orgId: org.handle || org._id.toString(),
				entityType: 'task',
				entityId: taskId.toString(),
				message,
				notificationTypes: ['tasks'] // Fallback if no existing messages
			});
			console.log(`📬 Task update result:`, updateResult);
			
		} catch (error) {
			console.error('Error updating task notification:', error);
		}
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
	 * Convenience method for completed tasks
	 */
	async notifyTaskCompleted(taskId, result) {
		return this.updateTaskNotification(taskId, 'completed', result);
	}
	
	/**
	 * Convenience method for failed tasks
	 */
	async notifyTaskFailed(taskId, error) {
		try {
			// Update task with error
			await db.jobs.updateOne(
				{ _id: new ObjectId(taskId) },
				{ 
					$set: { 
						error: error.message || error,
						updatedAt: new Date()
					} 
				}
			);
			
			return this.updateTaskNotification(taskId, 'failed', { error: error.message || error });
		} catch (err) {
			console.error('Error notifying task failure:', err);
		}
	}
}

// Export singleton instance
export default new SlackTaskNotifier();