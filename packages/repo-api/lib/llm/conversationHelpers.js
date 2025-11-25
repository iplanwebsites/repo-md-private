import { ObjectId } from 'mongodb';
import { db } from '../../db.js';

/**
 * Get conversations for an organization
 */
export async function getOrgConversations(orgId, { agentType, limit = 50 } = {}) {
  const query = {
    orgId: new ObjectId(orgId),
    projectId: null // Org-level conversations don't have projectId
  };
  
  if (agentType) {
    query.agentType = agentType;
  }
  
  return await db.convos
    .find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Get conversations for a project
 */
export async function getProjectConversations(projectId, { agentType, includePublic = true, limit = 50 } = {}) {
  const query = {
    projectId: new ObjectId(projectId)
  };
  
  if (agentType) {
    query.agentType = agentType;
  }
  
  if (!includePublic) {
    query.isPublic = { $ne: true };
  }
  
  return await db.convos
    .find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Get public conversations for a project
 */
export async function getPublicProjectConversations(projectId, { sessionId, limit = 20 } = {}) {
  const query = {
    projectId: new ObjectId(projectId),
    agentType: 'public_project',
    isPublic: true
  };
  
  if (sessionId) {
    query.sessionId = sessionId;
  }
  
  return await db.convos
    .find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Get user's conversations across all contexts
 */
export async function getUserConversations(userId, { agentType, projectId, orgId, limit = 50 } = {}) {
  const query = {
    userId: new ObjectId(userId)
  };
  
  if (agentType) {
    query.agentType = agentType;
  }
  
  if (projectId) {
    query.projectId = new ObjectId(projectId);
  }
  
  if (orgId) {
    query.orgId = new ObjectId(orgId);
  }
  
  return await db.convos
    .find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Get conversation statistics
 */
export async function getConversationStats({ userId, projectId, orgId, agentType, timeRange }) {
  const query = {};
  
  if (userId) query.userId = new ObjectId(userId);
  if (projectId) query.projectId = new ObjectId(projectId);
  if (orgId) query.orgId = new ObjectId(orgId);
  if (agentType) query.agentType = agentType;
  
  if (timeRange?.start || timeRange?.end) {
    query.createdAt = {};
    if (timeRange.start) query.createdAt.$gte = timeRange.start;
    if (timeRange.end) query.createdAt.$lte = timeRange.end;
  }
  
  const stats = await db.convos.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          agentType: '$agentType',
          isPublic: '$isPublic'
        },
        count: { $sum: 1 },
        totalMessages: { $sum: { $size: '$messages' } },
        avgMessagesPerConvo: { $avg: { $size: '$messages' } }
      }
    },
    {
      $group: {
        _id: null,
        byAgent: {
          $push: {
            agentType: '$_id.agentType',
            isPublic: '$_id.isPublic',
            count: '$count',
            totalMessages: '$totalMessages',
            avgMessagesPerConvo: '$avgMessagesPerConvo'
          }
        },
        totalConversations: { $sum: '$count' },
        totalMessages: { $sum: '$totalMessages' }
      }
    }
  ]).toArray();
  
  if (stats.length === 0) {
    return {
      totalConversations: 0,
      totalMessages: 0,
      byAgent: []
    };
  }
  
  return stats[0];
}

/**
 * Check if user has access to a conversation
 */
export async function checkConversationAccess(conversationId, userId) {
  const conversation = await db.convos.findOne({
    _id: new ObjectId(conversationId)
  });
  
  if (!conversation) {
    return { hasAccess: false, reason: 'not_found' };
  }
  
  // Public conversations are accessible to all
  if (conversation.isPublic) {
    return { hasAccess: true, conversation };
  }
  
  // User must own the conversation
  if (conversation.userId?.toString() === userId) {
    return { hasAccess: true, conversation };
  }
  
  // Check project membership for project conversations
  if (conversation.projectId && conversation.agentType === 'project') {
    const project = await db.projects.findOne({
      _id: conversation.projectId,
      $or: [
        { ownerId: new ObjectId(userId) },
        { members: new ObjectId(userId) }
      ]
    });
    
    if (project) {
      return { hasAccess: true, conversation };
    }
  }
  
  return { hasAccess: false, reason: 'unauthorized' };
}

/**
 * Clean up old public conversations
 */
export async function cleanupOldPublicConversations(daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await db.convos.deleteMany({
    isPublic: true,
    updatedAt: { $lt: cutoffDate }
  });
  
  return result.deletedCount;
}