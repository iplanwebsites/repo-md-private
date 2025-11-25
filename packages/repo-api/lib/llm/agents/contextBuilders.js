import { ObjectId } from 'mongodb';
import { db } from '../../../db.js';

/**
 * Build context for Editor Agent (org/user level)
 */
export async function editorContextBuilder({ userId, orgId }) {
  const context = {
    userId,
    orgId,
    files: {} // In-memory file storage for project generation
  };
  
  // Add user preferences if available
  const user = await db.users.findOne({ _id: new ObjectId(userId) });
  if (user?.preferences?.editorAgent) {
    context.additionalInstructions = user.preferences.editorAgent.additionalInstructions;
  }
  
  // Add org context if available
  if (orgId) {
    const org = await db.orgs.findOne({ _id: new ObjectId(orgId) });
    if (org) {
      context.orgName = org.name;
      context.orgDescription = org.description;
    }
  }
  
  return context;
}

/**
 * Build context for Project Agent (project-specific)
 */
export async function projectContextBuilder({ projectId, userId }) {
  const project = await db.projects.findOne({ _id: new ObjectId(projectId) });
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  const context = {
    projectId,
    userId,
    projectInfo: {
      name: project.name,
      description: project.description,
      techStack: project.techStack || [],
      repoUrl: project.repoUrl,
      framework: project.framework
    }
  };
  
  // Add recent project activity if useful
  const recentJobs = await db.jobs
    .find({ projectId: new ObjectId(projectId) })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
    
  context.recentActivity = recentJobs.map(job => ({
    type: job.type,
    status: job.status,
    date: job.createdAt
  }));
  
  // Add project-specific instructions if configured
  if (project.agentConfig?.additionalInstructions) {
    context.additionalInstructions = project.agentConfig.additionalInstructions;
  }
  
  return context;
}

/**
 * Build context for Public Project Agent
 */
export async function publicProjectContextBuilder({ projectId, sessionId }) {
  const project = await db.projects.findOne({ _id: new ObjectId(projectId) });
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  if (!project.publicAgentEnabled) {
    throw new Error('Public agent not enabled for this project');
  }
  
  const context = {
    projectId,
    sessionId, // For tracking anonymous users
    projectInfo: {
      name: project.name,
      description: project.description,
      techStack: project.techStack || [],
      publicDocs: project.publicDocs || {}
    }
  };
  
  // Use custom prompt if configured
  if (project.publicAgentConfig?.systemPrompt) {
    context.customPrompt = project.publicAgentConfig.systemPrompt;
  }
  
  // Add welcome context
  if (project.publicAgentConfig?.welcomeMessage) {
    context.welcomeMessage = project.publicAgentConfig.welcomeMessage;
  }
  
  // Add suggested questions
  if (project.publicAgentConfig?.suggestedQuestions) {
    context.suggestedQuestions = project.publicAgentConfig.suggestedQuestions;
  }
  
  return context;
}

/**
 * Get appropriate context builder for agent type
 */
export async function buildAgentContext(agentType, params) {
  switch (agentType) {
    case 'editor':
      return editorContextBuilder(params);
      
    case 'project':
      return projectContextBuilder(params);
      
    case 'public_project':
      return publicProjectContextBuilder(params);
      
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}