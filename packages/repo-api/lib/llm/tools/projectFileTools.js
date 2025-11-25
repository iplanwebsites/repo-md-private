import { db } from '../../../db.js';
import GitFileService from '../../gitFileService.js';
import path from 'path';
import crypto from 'crypto';
import { diffLines } from 'diff';

export const readFile = {
	name: 'read_file',
	description: 'Read a file from the project repository',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: 'File path relative to repository root'
			}
		},
		required: ['path']
	},
	async execute({ path: filePath }, context) {
		const { project, user } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			throw new Error('GitHub authentication required');
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		const fileContent = await gitService.getFileContent(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			filePath,
			'main'
		);
		
		return {
			path: filePath,
			content: fileContent.content,
			encoding: fileContent.encoding,
			size: fileContent.size,
			sha: fileContent.sha
		};
	}
};

export const createFile = {
	name: 'create_file',
	description: 'Create a new file in the project repository',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: 'File path relative to repository root'
			},
			content: {
				type: 'string',
				description: 'File content'
			},
			message: {
				type: 'string',
				description: 'Commit message (if not provided, will use default)'
			}
		},
		required: ['path', 'content']
	},
	async execute({ path: filePath, content, message }, context) {
		const { project, user, chatId, sessionBranch } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			throw new Error('GitHub authentication required');
		}
		
		const gitService = new GitFileService('github', githubToken);
		const branch = sessionBranch || `editorChat-${chatId}-${Date.now()}`;
		
		// Ensure branch exists
		if (!sessionBranch) {
			await gitService.createBranch(
				project.githubRepo.owner,
				project.githubRepo.repoName,
				branch,
				'main'
			);
			
			// Store branch in chat context
			if (chatId) {
				await db.editorChats.updateOne(
					{ _id: chatId },
					{ 
						$set: { 
							'metadata.sessionBranch': branch,
							updatedAt: new Date()
						}
					}
				);
			}
		}
		
		// Create file in branch
		const commitResult = await gitService.createOrUpdateFile(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			filePath,
			content,
			message || `Create ${filePath}`,
			branch
		);
		
		return {
			type: 'created',
			path: filePath,
			content: content,
			originalContent: null,
			branch,
			commitSha: commitResult.commit.sha,
			size: Buffer.byteLength(content, 'utf8'),
			language: path.extname(filePath).slice(1) || 'text',
			message: `File created successfully in branch ${branch}`,
			success: true
		};
	}
};

export const editFile = {
	name: 'edit_file',
	description: 'Edit a file using find and replace operations',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: 'File path relative to repository root'
			},
			operations: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						find: { type: 'string', description: 'Text to find' },
						replace: { type: 'string', description: 'Text to replace with' },
						all: { type: 'boolean', default: false, description: 'Replace all occurrences' }
					},
					required: ['find', 'replace']
				},
				description: 'Array of find/replace operations to perform'
			},
			message: {
				type: 'string',
				description: 'Commit message'
			}
		},
		required: ['path', 'operations']
	},
	async execute({ path: filePath, operations, message }, context) {
		const { project, user, chatId, sessionBranch } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			throw new Error('GitHub authentication required');
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		// Get current branch from context or create new one
		let branch = sessionBranch;
		if (!branch) {
			// Get from chat metadata
			const chat = await db.editorChats.findOne({ _id: chatId });
			branch = chat?.metadata?.sessionBranch;
			
			if (!branch) {
				branch = `editorChat-${chatId}-${Date.now()}`;
				await gitService.createBranch(
					project.githubRepo.owner,
					project.githubRepo.repoName,
					branch,
					'main'
				);
				
				if (chatId) {
					await db.editorChats.updateOne(
						{ _id: chatId },
						{ $set: { 'metadata.sessionBranch': branch } }
					);
				}
			}
		}
		
		// Get current file content
		const fileData = await gitService.getFileContent(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			filePath,
			branch
		);
		
		let content = fileData.content;
		const originalContent = content;
		
		// Apply operations
		const appliedOps = [];
		for (const op of operations) {
			if (op.all) {
				const regex = new RegExp(op.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
				const matches = content.match(regex);
				if (matches) {
					content = content.replace(regex, op.replace);
					appliedOps.push({
						...op,
						occurrences: matches.length
					});
				}
			} else {
				const index = content.indexOf(op.find);
				if (index !== -1) {
					content = content.substring(0, index) + op.replace + content.substring(index + op.find.length);
					appliedOps.push({
						...op,
						occurrences: 1
					});
				}
			}
		}
		
		// Calculate diff
		const diff = diffLines(originalContent, content);
		const changes = diff.filter(part => part.added || part.removed).length;
		
		if (changes === 0) {
			return {
				type: 'no-changes',
				path: filePath,
				message: 'No changes were made to the file'
			};
		}
		
		// Update file in branch
		const commitResult = await gitService.createOrUpdateFile(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			filePath,
			content,
			message || `Edit ${filePath}: ${appliedOps.length} operations`,
			branch,
			fileData.sha
		);
		
		return {
			type: 'modified',
			path: filePath,
			content: content,
			originalContent: originalContent,
			branch,
			commitSha: commitResult.commit.sha,
			operations: appliedOps,
			changes,
			diff: diff.slice(0, 10), // First 10 diff chunks
			message: `File edited successfully in branch ${branch}`,
			success: true
		};
	}
};

export const replaceFileContent = {
	name: 'replace_file_content',
	description: 'Replace entire file content',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: 'File path relative to repository root'
			},
			content: {
				type: 'string',
				description: 'New file content'
			},
			message: {
				type: 'string',
				description: 'Commit message'
			}
		},
		required: ['path', 'content']
	},
	async execute({ path: filePath, content, message }, context) {
		const { project, user, chatId, sessionBranch } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			throw new Error('GitHub authentication required');
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		// Get or create branch
		let branch = sessionBranch;
		if (!branch) {
			const chat = await db.editorChats.findOne({ _id: chatId });
			branch = chat?.metadata?.sessionBranch || `editorChat-${chatId}-${Date.now()}`;
			
			if (!chat?.metadata?.sessionBranch) {
				await gitService.createBranch(
					project.githubRepo.owner,
					project.githubRepo.repoName,
					branch,
					'main'
				);
				
				if (chatId) {
					await db.editorChats.updateOne(
						{ _id: chatId },
						{ $set: { 'metadata.sessionBranch': branch } }
					);
				}
			}
		}
		
		// Get current file SHA if it exists
		let sha;
		try {
			const existing = await gitService.getFileContent(
				project.githubRepo.owner,
				project.githubRepo.repoName,
				filePath,
				branch
			);
			sha = existing.sha;
		} catch (error) {
			// File doesn't exist, that's ok
		}
		
		// Update or create file
		const commitResult = await gitService.createOrUpdateFile(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			filePath,
			content,
			message || `Update ${filePath}`,
			branch,
			sha
		);
		
		return {
			type: sha ? 'modified' : 'created',
			path: filePath,
			branch,
			commitSha: commitResult.commit.sha,
			size: Buffer.byteLength(content, 'utf8'),
			message: `File ${sha ? 'updated' : 'created'} successfully in branch ${branch}`
		};
	}
};

export const listFiles = {
	name: 'list_files',
	description: 'List files in a directory',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				default: '/',
				description: 'Directory path relative to repository root'
			}
		}
	},
	async execute({ path: dirPath = '/' }, context) {
		const { project, user } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			throw new Error('GitHub authentication required');
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		const files = await gitService.listDirectory(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			dirPath,
			'main'
		);
		
		return {
			path: dirPath,
			files: files.map(f => ({
				name: f.name,
				path: f.path,
				type: f.type,
				size: f.size
			})),
			total: files.length
		};
	}
};

export const deleteFile = {
	name: 'delete_file',
	description: 'Delete a file from the project',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: 'File path relative to repository root'
			},
			message: {
				type: 'string',
				description: 'Commit message'
			}
		},
		required: ['path']
	},
	async execute({ path: filePath, message }, context) {
		const { project, user, chatId, sessionBranch } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			throw new Error('GitHub authentication required');
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		// Get or create branch
		let branch = sessionBranch;
		if (!branch) {
			const chat = await db.editorChats.findOne({ _id: chatId });
			branch = chat?.metadata?.sessionBranch || `editorChat-${chatId}-${Date.now()}`;
			
			if (!chat?.metadata?.sessionBranch) {
				await gitService.createBranch(
					project.githubRepo.owner,
					project.githubRepo.repoName,
					branch,
					'main'
				);
				
				if (chatId) {
					await db.editorChats.updateOne(
						{ _id: chatId },
						{ $set: { 'metadata.sessionBranch': branch } }
					);
				}
			}
		}
		
		// Delete file
		const commitResult = await gitService.deleteFile(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			filePath,
			message || `Delete ${filePath}`,
			branch
		);
		
		return {
			type: 'deleted',
			path: filePath,
			branch,
			commitSha: commitResult.commit.sha,
			message: `File deleted successfully in branch ${branch}`
		};
	}
};

export const getBranchChanges = {
	name: 'get_branch_changes',
	description: 'Get all changes made in the current editorChat session branch',
	parameters: {
		type: 'object',
		properties: {}
	},
	async execute({}, context) {
		const { project, user, chatId } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		// Get branch from chat metadata
		const chat = await db.editorChats.findOne({ _id: chatId });
		const branch = chat?.metadata?.sessionBranch;
		
		if (!branch) {
			return {
				changes: [],
				message: 'No changes yet - no branch created'
			};
		}
		
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			throw new Error('GitHub authentication required');
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		// Get comparison between branch and main
		const comparison = await gitService.compareBranches(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			'main',
			branch
		);
		
		return {
			branch,
			files: comparison.files.map(f => ({
				path: f.filename,
				status: f.status,
				additions: f.additions,
				deletions: f.deletions,
				changes: f.changes
			})),
			totalFiles: comparison.files.length,
			commits: comparison.commits,
			ahead_by: comparison.ahead_by,
			message: `${comparison.files.length} files changed in branch ${branch}`
		};
	}
};

export const allProjectFileTools = [readFile, createFile, editFile, replaceFileContent, listFiles, deleteFile, getBranchChanges];
export default allProjectFileTools;