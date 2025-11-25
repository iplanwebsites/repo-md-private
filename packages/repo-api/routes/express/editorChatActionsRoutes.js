import express from 'express';
import { db } from '../../db.js';
import GitFileService from '../../lib/gitFileService.js';
import { requireAuth } from '../../lib/authMiddleware.js';

const router = express.Router();

/**
 * Create a pull request from the editorChat session branch
 */
router.post('/create-pr/:chatId', requireAuth, async (req, res) => {
	try {
		const { chatId } = req.params;
		const { title, body, base = 'main' } = req.body;
		const { user } = req;
		
		// Get chat and verify ownership
		const chat = await db.editorChats.findOne({ 
			_id: chatId,
			user: user._id
		});
		
		if (!chat) {
			return res.status(404).json({ error: 'Chat not found' });
		}
		
		if (!chat.project) {
			return res.status(400).json({ error: 'No project associated with chat' });
		}
		
		const branch = chat.metadata?.sessionBranch;
		if (!branch) {
			return res.status(400).json({ error: 'No changes to create PR from' });
		}
		
		// Get project details
		const project = await db.projects.findOne({ _id: chat.project });
		if (!project) {
			return res.status(404).json({ error: 'Project not found' });
		}
		
		// Get GitHub token
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			return res.status(401).json({ error: 'GitHub authentication required' });
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		// Get changes summary
		const comparison = await gitService.compareBranches(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			base,
			branch
		);
		
		// Generate PR body with changes summary
		const prBody = `${body || 'Changes from editorChat session'}

## Changes Summary
- ${comparison.files.length} files changed
- ${comparison.commits} commits
- +${comparison.files.reduce((sum, f) => sum + f.additions, 0)} -${comparison.files.reduce((sum, f) => sum + f.deletions, 0)}

### Files Changed:
${comparison.files.map(f => `- \`${f.filename}\` (${f.status})`).join('\n')}

---
Created via editorChat session: ${chatId}`;
		
		// Create pull request
		const pr = await gitService.createPullRequest(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			title || `EditorChat changes: ${chat.title}`,
			prBody,
			branch,
			base
		);
		
		// Update chat metadata
		await db.editorChats.updateOne(
			{ _id: chatId },
			{ 
				$set: { 
					'metadata.pullRequest': {
						number: pr.number,
						url: pr.html_url,
						createdAt: new Date()
					}
				}
			}
		);
		
		res.json({
			success: true,
			pullRequest: {
				number: pr.number,
				url: pr.html_url,
				title: pr.title,
				state: pr.state
			}
		});
		
	} catch (error) {
		console.error('Error creating PR:', error);
		res.status(500).json({ 
			error: 'Failed to create pull request',
			details: error.message 
		});
	}
});

/**
 * Get diff for current session changes
 */
router.get('/diff/:chatId', requireAuth, async (req, res) => {
	try {
		const { chatId } = req.params;
		const { user } = req;
		
		// Get chat and verify ownership
		const chat = await db.editorChats.findOne({ 
			_id: chatId,
			user: user._id
		});
		
		if (!chat) {
			return res.status(404).json({ error: 'Chat not found' });
		}
		
		if (!chat.project) {
			return res.status(400).json({ error: 'No project associated with chat' });
		}
		
		const branch = chat.metadata?.sessionBranch;
		if (!branch) {
			return res.status(200).json({ 
				changes: [],
				message: 'No changes yet' 
			});
		}
		
		// Get project details
		const project = await db.projects.findOne({ _id: chat.project });
		if (!project) {
			return res.status(404).json({ error: 'Project not found' });
		}
		
		// Get GitHub token
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			return res.status(401).json({ error: 'GitHub authentication required' });
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		// Get comparison
		const comparison = await gitService.compareBranches(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			'main',
			branch
		);
		
		// For each file, get the actual diff
		const diffs = [];
		for (const file of comparison.files.slice(0, 100)) { // Limit to 100 files
			if (file.patch) {
				diffs.push({
					path: file.filename,
					status: file.status,
					additions: file.additions,
					deletions: file.deletions,
					changes: file.changes,
					patch: file.patch
				});
			}
		}
		
		res.json({
			branch,
			totalFiles: comparison.files.length,
			commits: comparison.commits,
			diffs,
			tooManyFiles: comparison.files.length > 100
		});
		
	} catch (error) {
		console.error('Error getting diff:', error);
		res.status(500).json({ 
			error: 'Failed to get changes',
			details: error.message 
		});
	}
});

/**
 * Commit all changes directly to main branch
 */
router.post('/commit/:chatId', requireAuth, async (req, res) => {
	try {
		const { chatId } = req.params;
		const { message } = req.body;
		const { user } = req;
		
		// Get chat and verify ownership
		const chat = await db.editorChats.findOne({ 
			_id: chatId,
			user: user._id
		});
		
		if (!chat) {
			return res.status(404).json({ error: 'Chat not found' });
		}
		
		if (!chat.project) {
			return res.status(400).json({ error: 'No project associated with chat' });
		}
		
		const branch = chat.metadata?.sessionBranch;
		if (!branch) {
			return res.status(400).json({ error: 'No changes to commit' });
		}
		
		// Get project details
		const project = await db.projects.findOne({ _id: chat.project });
		if (!project) {
			return res.status(404).json({ error: 'Project not found' });
		}
		
		// Get GitHub token
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			return res.status(401).json({ error: 'GitHub authentication required' });
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		// Create PR and merge immediately
		const pr = await gitService.createPullRequest(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			message || `EditorChat: ${chat.title}`,
			`Direct commit from editorChat session ${chatId}`,
			branch,
			'main'
		);
		
		// Merge the PR
		const mergeResult = await gitService.mergePullRequest(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			pr.number,
			message || `EditorChat: ${chat.title}`,
			'',
			'squash'
		);
		
		// Delete the branch
		await gitService.deleteBranch(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			branch
		);
		
		// Clear session branch from chat
		await db.editorChats.updateOne(
			{ _id: chatId },
			{ 
				$unset: { 'metadata.sessionBranch': '' },
				$set: { 
					'metadata.lastCommit': {
						sha: mergeResult.sha,
						message: mergeResult.message,
						committedAt: new Date()
					}
				}
			}
		);
		
		res.json({
			success: true,
			commit: {
				sha: mergeResult.sha,
				message: mergeResult.message
			}
		});
		
	} catch (error) {
		console.error('Error committing changes:', error);
		res.status(500).json({ 
			error: 'Failed to commit changes',
			details: error.message 
		});
	}
});

export default router;