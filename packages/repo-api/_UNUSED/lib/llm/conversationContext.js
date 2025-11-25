import { ObjectId } from 'mongodb';
import { db } from '../../db.js';

/**
 * Switch conversation context/type
 * Useful when creating a project within a general conversation
 */
export async function switchConversationType({
  conversationId,
  newAgentType,
  projectId = null,
  metadata = {}
}) {
  const conversation = await db.convos.findOne({
    _id: new ObjectId(conversationId)
  });
  
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  // Build new context based on new agent type
  const { buildAgentContext, getAgent } = await import('./agents/index.js');
  
  const newContext = await buildAgentContext(newAgentType, {
    userId: conversation.userId,
    projectId: projectId || conversation.projectId,
    orgId: conversation.orgId,
    sessionId: conversation.sessionId,
    ...metadata
  });
  
  // Get new agent config
  const agent = getAgent(newAgentType);
  
  // Update conversation
  const updates = {
    agentType: newAgentType,
    agentConfig: {
      model: agent.modelConfig.model,
      temperature: agent.modelConfig.temperature,
      maxTokens: agent.modelConfig.maxTokens
    },
    context: {
      ...conversation.context,
      ...newContext,
      previousType: conversation.agentType,
      switchedAt: new Date()
    },
    updatedAt: new Date()
  };
  
  if (projectId) {
    updates.projectId = new ObjectId(projectId);
  }
  
  await db.convos.updateOne(
    { _id: new ObjectId(conversationId) },
    { $set: updates }
  );
  
  // Add a system message about the context switch
  await db.convos.updateOne(
    { _id: new ObjectId(conversationId) },
    {
      $push: {
        messages: {
          role: 'system',
          content: `Context switched from ${conversation.agentType} to ${newAgentType}`,
          timestamp: new Date(),
          metadata: { type: 'context_switch' }
        }
      }
    }
  );
  
  return {
    success: true,
    previousType: conversation.agentType,
    newType: newAgentType,
    projectId
  };
}

/**
 * Link a conversation to a project after creation
 */
export async function linkConversationToProject(conversationId, projectId) {
  const result = await db.convos.updateOne(
    { _id: new ObjectId(conversationId) },
    {
      $set: {
        projectId: new ObjectId(projectId),
        'context.linkedToProject': true,
        'context.linkedAt': new Date()
      }
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Get conversation context info
 */
export async function getConversationContext(conversationId) {
  const conversation = await db.convos.findOne(
    { _id: new ObjectId(conversationId) },
    {
      projection: {
        agentType: 1,
        projectId: 1,
        orgId: 1,
        context: 1,
        agentConfig: 1
      }
    }
  );
  
  return conversation;
}