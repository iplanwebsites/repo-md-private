import { ObjectId } from 'mongodb';
import { db } from '../../../db.js';

/**
 * Read-only search tools for public agents
 */

export const searchProjectFilesTool = {
  type: 'function',
  function: {
    name: 'search_project_files',
    description: 'Search for files in the project by name or content',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (file names or content keywords)'
        },
        fileType: {
          type: 'string',
          description: 'Optional file extension filter (e.g., "js", "md")'
        }
      },
      required: ['query']
    }
  }
};

export const readProjectFileTool = {
  type: 'function',
  function: {
    name: 'read_project_file',
    description: 'Read the content of a specific project file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to project root'
        }
      },
      required: ['path']
    }
  }
};

export const searchDocumentationTool = {
  type: 'function',
  function: {
    name: 'search_documentation',
    description: 'Search project documentation',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Documentation search query'
        }
      },
      required: ['query']
    }
  }
};

// Tool implementations
export async function search_project_files({ query, fileType }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.projectId) {
    return { success: false, error: 'No project associated with conversation' };
  }
  
  // Get project data
  const project = await db.projects.findOne({ 
    _id: conversation.projectId 
  });
  
  if (!project?.processedData?.files) {
    return { 
      success: false, 
      error: 'Project files not available for search' 
    };
  }
  
  // Simple search implementation
  const results = [];
  const searchLower = query.toLowerCase();
  
  for (const [path, file] of Object.entries(project.processedData.files)) {
    // Filter by file type if specified
    if (fileType && !path.endsWith(`.${fileType}`)) {
      continue;
    }
    
    // Search in file path
    if (path.toLowerCase().includes(searchLower)) {
      results.push({
        path,
        type: 'filename_match',
        preview: path
      });
      continue;
    }
    
    // Search in file content (limit to first match)
    if (file.content && file.content.toLowerCase().includes(searchLower)) {
      const contentIndex = file.content.toLowerCase().indexOf(searchLower);
      const start = Math.max(0, contentIndex - 50);
      const end = Math.min(file.content.length, contentIndex + searchLower.length + 50);
      
      results.push({
        path,
        type: 'content_match',
        preview: '...' + file.content.substring(start, end) + '...'
      });
    }
    
    if (results.length >= 10) break; // Limit results
  }
  
  return {
    success: true,
    query,
    resultsCount: results.length,
    results
  };
}

export async function read_project_file({ path }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.projectId) {
    return { success: false, error: 'No project associated with conversation' };
  }
  
  const project = await db.projects.findOne({ 
    _id: conversation.projectId 
  });
  
  const file = project?.processedData?.files?.[path];
  
  if (!file) {
    return { 
      success: false, 
      error: `File not found: ${path}` 
    };
  }
  
  return {
    success: true,
    path,
    content: file.content,
    size: file.content?.length || 0
  };
}

export async function search_documentation({ query }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.projectId) {
    return { success: false, error: 'No project associated with conversation' };
  }
  
  const project = await db.projects.findOne({ 
    _id: conversation.projectId 
  });
  
  // Search in README and documentation files
  const docFiles = ['README.md', 'readme.md', 'CONTRIBUTING.md', 'docs'];
  const results = [];
  
  if (project?.processedData?.files) {
    for (const [path, file] of Object.entries(project.processedData.files)) {
      // Check if it's a documentation file
      const isDoc = docFiles.some(doc => path.includes(doc)) || 
                   path.includes('/docs/') || 
                   path.endsWith('.md');
      
      if (isDoc && file.content?.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          path,
          preview: file.content.substring(0, 200) + '...'
        });
      }
    }
  }
  
  return {
    success: true,
    query,
    resultsCount: results.length,
    results
  };
}

// Export all tools
// Aliases for catalogue.js
export const searchProjectReadOnly = searchProjectFilesTool;
export const getProjectStructure = null; // Not yet implemented

export const allReadOnlySearchTools = [
  searchProjectFilesTool,
  readProjectFileTool,
  searchDocumentationTool
];