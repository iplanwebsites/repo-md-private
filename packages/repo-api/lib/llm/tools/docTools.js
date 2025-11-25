/**
 * Documentation tools for public agents
 */

export const get_project_info = {
  type: 'function',
  function: {
    name: 'get_project_info',
    description: 'Get general information about the project',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
};

export const list_available_commands = {
  type: 'function', 
  function: {
    name: 'list_available_commands',
    description: 'List available commands and scripts in the project',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
};

// Tool implementations
export async function get_project_info(args, { conversationId }) {
  const { ObjectId } = await import('mongodb');
  const { db } = await import('../../../db.js');
  
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.projectId) {
    return { success: false, error: 'No project associated with conversation' };
  }
  
  const project = await db.projects.findOne({ 
    _id: conversation.projectId 
  });
  
  if (!project) {
    return { success: false, error: 'Project not found' };
  }
  
  return {
    success: true,
    project: {
      name: project.name,
      description: project.description,
      techStack: project.techStack || [],
      framework: project.framework,
      lastUpdated: project.updatedAt,
      publicDocs: project.publicDocs || {}
    }
  };
}

export async function list_available_commands(args, { conversationId }) {
  const { ObjectId } = await import('mongodb');
  const { db } = await import('../../../db.js');
  
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.projectId) {
    return { success: false, error: 'No project associated with conversation' };
  }
  
  const project = await db.projects.findOne({ 
    _id: conversation.projectId 
  });
  
  // Try to find package.json
  const packageJson = project?.processedData?.files?.['package.json'];
  
  if (packageJson) {
    try {
      const parsed = JSON.parse(packageJson.content);
      return {
        success: true,
        scripts: parsed.scripts || {},
        dependencies: Object.keys(parsed.dependencies || {}),
        devDependencies: Object.keys(parsed.devDependencies || {})
      };
    } catch (e) {
      // Fall through
    }
  }
  
  return {
    success: true,
    message: 'No package.json found or unable to parse scripts',
    hint: 'Try searching for setup instructions in README or documentation files'
  };
}

// Export all tools
export const allDocTools = [
  get_project_info,
  list_available_commands
];