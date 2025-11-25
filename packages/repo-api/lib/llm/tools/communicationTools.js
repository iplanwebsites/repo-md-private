// Communication Tools
// Tools for sending messages and notifications

const sendSlackMessage = {
  definition: {
    name: 'sendSlackMessage',
    description: 'Send a message to a Slack channel',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'The Slack channel ID or name'
        },
        message: {
          type: 'string',
          description: 'The message content'
        },
        blocks: {
          type: 'array',
          description: 'Slack block elements for rich formatting'
        },
        threadTs: {
          type: 'string',
          description: 'Thread timestamp to reply in a thread'
        }
      },
      required: ['message']
    }
  },
  implementation: async (args, context) => {
    const { channel, message, blocks, threadTs } = args;
    const { slack, org, project } = context;
    
    try {
      if (!slack || !org?.slackInstallation) {
        throw new Error('Slack is not configured for this organization');
      }
      
      // Determine channel if not specified
      const targetChannel = channel || org.slackInstallation.channels?.general || 
                          org.slackInstallation.defaultChannel;
      
      if (!targetChannel) {
        throw new Error('No Slack channel configured');
      }
      
      // Prepare message payload
      const payload = {
        channel: targetChannel,
        text: message,
        ...(blocks && { blocks }),
        ...(threadTs && { thread_ts: threadTs })
      };
      
      // Add context footer
      if (!blocks) {
        payload.blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Sent by AI Agent${project ? ` for ${project.name}` : ''}`
              }
            ]
          }
        ];
      }
      
      // Send message
      const result = await slack.chat.postMessage(payload);
      
      return {
        success: true,
        messageTs: result.ts,
        channel: result.channel,
        message: 'Message sent successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  requiredContext: ['slack', 'org'],
  rateLimit: { requests: 60, window: '1m' },
  costEstimate: 'low'
};

const createNotification = {
  definition: {
    name: 'createNotification',
    description: 'Create an in-app notification for users',
    parameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Target user ID (optional, defaults to current user)'
        },
        title: {
          type: 'string',
          description: 'Notification title'
        },
        message: {
          type: 'string',
          description: 'Notification message'
        },
        type: {
          type: 'string',
          description: 'Notification type',
          enum: ['info', 'success', 'warning', 'error']
        },
        link: {
          type: 'string',
          description: 'Optional link for the notification'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata'
        }
      },
      required: ['title', 'message']
    }
  },
  implementation: async (args, context) => {
    const { userId, title, message, type = 'info', link, metadata } = args;
    const { db, user } = context;
    
    try {
      const targetUserId = userId || user._id;
      
      // Create notification
      const notification = {
        userId: targetUserId,
        title,
        message,
        type,
        link,
        metadata: {
          ...metadata,
          createdByAgent: context.agentId,
          createdAt: new Date()
        },
        read: false,
        createdAt: new Date()
      };
      
      const result = await db.collection('notifications').insertOne(notification);
      
      // TODO: Trigger real-time notification if user is online
      
      return {
        success: true,
        notificationId: result.insertedId,
        message: 'Notification created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  requiredContext: ['db', 'user'],
  costEstimate: 'low'
};

const scheduleMessage = {
  definition: {
    name: 'scheduleMessage',
    description: 'Schedule a message to be sent later',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Target channel (slack, email, notification)',
          enum: ['slack', 'email', 'notification']
        },
        scheduledTime: {
          type: 'string',
          description: 'ISO 8601 datetime when to send the message'
        },
        message: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            recipient: { type: 'string' }
          },
          required: ['content']
        },
        metadata: {
          type: 'object',
          description: 'Additional scheduling metadata'
        }
      },
      required: ['channel', 'scheduledTime', 'message']
    }
  },
  implementation: async (args, context) => {
    const { channel, scheduledTime, message, metadata } = args;
    const { db, user, project } = context;
    
    try {
      const scheduledDate = new Date(scheduledTime);
      
      if (scheduledDate <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }
      
      // Create scheduled message
      const scheduledMsg = {
        channel,
        scheduledTime: scheduledDate,
        message,
        metadata: {
          ...metadata,
          createdByAgent: context.agentId,
          projectId: project?._id,
          userId: user._id
        },
        status: 'scheduled',
        createdAt: new Date()
      };
      
      const result = await db.collection('scheduledMessages').insertOne(scheduledMsg);
      
      return {
        success: true,
        scheduledMessageId: result.insertedId,
        scheduledFor: scheduledDate.toISOString(),
        message: `Message scheduled for ${scheduledDate.toLocaleString()}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  requiredContext: ['db', 'user'],
  costEstimate: 'low'
};

export {
  sendSlackMessage,
  createNotification,
  scheduleMessage
};