import { ObjectId } from 'mongodb';
import { db } from '../../../db.js';

/**
 * File tools for managing in-memory project files during generation
 */

// Tool definitions (with toolDef suffix to avoid naming conflicts)
export const createFileToolDef = {
  type: 'function',
  function: {
    name: 'create_file',
    description: 'Create a new file in the project',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to project root'
        },
        content: {
          type: 'string',
          description: 'File content'
        }
      },
      required: ['path', 'content']
    }
  }
};

export const editFileToolDef = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: 'Update an existing file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to update'
        },
        content: {
          type: 'string',
          description: 'New file content'
        }
      },
      required: ['path', 'content']
    }
  }
};

export const deleteFileToolDef = {
  type: 'function',
  function: {
    name: 'delete_file',
    description: 'Delete a file from the project',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to delete'
        }
      },
      required: ['path']
    }
  }
};

export const readFileToolDef = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read the content of a file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to read'
        }
      },
      required: ['path']
    }
  }
};

export const moveFileToolDef = {
  type: 'function',
  function: {
    name: 'move_file',
    description: 'Move or rename a file',
    parameters: {
      type: 'object',
      properties: {
        fromPath: {
          type: 'string',
          description: 'Source file path'
        },
        toPath: {
          type: 'string',
          description: 'Destination file path'
        }
      },
      required: ['fromPath', 'toPath']
    }
  }
};

export const listFilesToolDef = {
  type: 'function',
  function: {
    name: 'list_files',
    description: 'List all files in the project',
    parameters: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory path to list (optional, defaults to root)'
        }
      },
      required: []
    }
  }
};

// Tool implementations (camelCase names for catalogue.js compatibility)
export async function createFile({ path, content }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.context.files) {
    conversation.context.files = {};
  }
  
  if (conversation.context.files[path]) {
    return { success: false, error: `File ${path} already exists` };
  }
  
  conversation.context.files[path] = content;
  
  await db.convos.updateOne(
    { _id: new ObjectId(conversationId) },
    { $set: { 'context.files': conversation.context.files } }
  );
  
  return { success: true, message: `Created ${path}` };
}

export async function editFile({ path, content }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.context.files?.[path]) {
    return { success: false, error: `File ${path} not found` };
  }
  
  conversation.context.files[path] = content;
  
  await db.convos.updateOne(
    { _id: new ObjectId(conversationId) },
    { $set: { 'context.files': conversation.context.files } }
  );
  
  return { success: true, message: `Updated ${path}` };
}

export async function deleteFile({ path }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.context.files?.[path]) {
    return { success: false, error: `File ${path} not found` };
  }
  
  delete conversation.context.files[path];
  
  await db.convos.updateOne(
    { _id: new ObjectId(conversationId) },
    { $set: { 'context.files': conversation.context.files } }
  );
  
  return { success: true, message: `Deleted ${path}` };
}

export async function readFile({ path }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.context.files?.[path]) {
    return { success: false, error: `File ${path} not found` };
  }
  
  return { 
    success: true, 
    content: conversation.context.files[path],
    path 
  };
}

export async function moveFile({ fromPath, toPath }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.context.files?.[fromPath]) {
    return { success: false, error: `File ${fromPath} not found` };
  }
  
  if (conversation.context.files[toPath]) {
    return { success: false, error: `File ${toPath} already exists` };
  }
  
  // Move the file content
  conversation.context.files[toPath] = conversation.context.files[fromPath];
  delete conversation.context.files[fromPath];
  
  await db.convos.updateOne(
    { _id: new ObjectId(conversationId) },
    { $set: { 'context.files': conversation.context.files } }
  );
  
  return { success: true, message: `Moved ${fromPath} to ${toPath}` };
}

export async function listFiles({ directory = '' }, { conversationId }) {
  const conversation = await db.convos.findOne({ 
    _id: new ObjectId(conversationId) 
  });
  
  if (!conversation.context.files) {
    return { success: true, files: [] };
  }
  
  let files = Object.keys(conversation.context.files);
  
  // Filter by directory if specified
  if (directory) {
    const dirPrefix = directory.endsWith('/') ? directory : `${directory}/`;
    files = files.filter(path => path.startsWith(dirPrefix));
  }
  
  return { 
    success: true, 
    files: files.map(path => ({
      path,
      size: conversation.context.files[path].length
    }))
  };
}

// Export all tool definitions as an array for easy use
export const allFileTools = [
  createFileToolDef, 
  editFileToolDef, 
  deleteFileToolDef, 
  readFileToolDef, 
  moveFileToolDef, 
  listFilesToolDef
];

// Backward compatibility aliases (snake_case names for existing code)
export const create_file = createFileToolDef;
export const update_file = editFileToolDef;
export const delete_file = deleteFileToolDef;
export const read_file = readFileToolDef;

// Aliases for catalogue.js (note: createFile is a function, so use createFileTool)
export const createFileTool = createFileToolDef;
export const editFileTool = editFileToolDef;
export const deleteFileTool = deleteFileToolDef;
export const readFileTool = readFileToolDef;
export const moveFileTool = moveFileToolDef;
export const listFilesTool = listFilesToolDef;