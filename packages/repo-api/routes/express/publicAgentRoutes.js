// Public Agent Routes
// Provides public-facing AI agents for project information without authentication

import express from 'express';
import { createAgentConfig, AGENT_ARCHETYPES } from '../../lib/chat/aiPromptConfigs.js';
import ToolExecutor from '../../lib/llm/toolExecutor.js';
import { 
	getToolsForArchetype, 
	exportToolDefinitions, 
	createToolMapping,
	SEARCH_TOOLS
} from '../../lib/llm/tools/catalogue.js';
import { startConversation, sendMessage } from '../../lib/llm/conversationVolt.js';
import { db } from '../../db.js';

const router = express.Router();

// Simple in-memory rate limiting (replace with Redis in production)
const rateLimitStore = new Map();

const createRateLimiter = (windowMs, maxRequests) => {
	return (req, res, next) => {
		const key = `${req.ip}:${req.path}`;
		const now = Date.now();
		const windowStart = now - windowMs;
		
		// Get or create rate limit entry
		let entry = rateLimitStore.get(key);
		if (!entry) {
			entry = { requests: [] };
			rateLimitStore.set(key, entry);
		}
		
		// Clean old requests
		entry.requests = entry.requests.filter(time => time > windowStart);
		
		// Check rate limit
		if (entry.requests.length >= maxRequests) {
			return res.status(429).json({
				error: 'Too many requests, please try again later.',
				retryAfter: Math.ceil((entry.requests[0] + windowMs - now) / 1000)
			});
		}
		
		// Add current request
		entry.requests.push(now);
		next();
	};
};

// Rate limiting middleware
const publicRateLimit = createRateLimiter(15 * 60 * 1000, 50); // 50 requests per 15 minutes
const conversationRateLimit = createRateLimiter(5 * 60 * 1000, 20); // 20 requests per 5 minutes

/**
 * GET /api/public/agent/projects/:projectId
 * Get public project information via AI agent
 */
router.get('/projects/:projectId', publicRateLimit, async (req, res) => {
	try {
		const { projectId } = req.params;
		
		// Find project
		const project = await db.collection('projects').findOne({
			_id: projectId,
			isPublic: true
		});
		
		if (!project) {
			return res.status(404).json({
				error: 'Project not found or not public'
			});
		}
		
		// Get read-only tools for public assistant
		const archetype = AGENT_ARCHETYPES.PUBLIC_ASSISTANT;
		const availableTools = getToolsForArchetype('PUBLIC_ASSISTANT', archetype.capabilities);
		
		// Create public context
		const context = {
			project,
			auth: false,
			permissions: ['read'],
			interface: 'publicApi'
		};
		
		// Create agent configuration
		const agentConfig = createAgentConfig({
			interface: 'publicApi',
			archetype: 'PUBLIC_ASSISTANT',
			context,
			availableTools
		});
		
		// Generate project overview
		const prompt = agentConfig.templates.projectOverview(project);
		
		res.json({
			success: true,
			project: {
				id: project._id,
				name: project.name,
				description: project.description,
				techStack: project.techStack,
				lastUpdated: project.updatedAt
			},
			agent: {
				type: 'PUBLIC_ASSISTANT',
				capabilities: archetype.capabilities.map(c => c.name),
				message: prompt
			}
		});
		
	} catch (error) {
		console.error('Error in public agent project endpoint:', error);
		res.status(500).json({
			error: 'Internal server error'
		});
	}
});

/**
 * POST /api/public/agent/chat
 * Public chat endpoint for project questions
 */
router.post('/chat', conversationRateLimit, async (req, res) => {
	try {
		const { projectId, message, sessionId } = req.body;
		
		if (!projectId || !message) {
			return res.status(400).json({
				error: 'projectId and message are required'
			});
		}
		
		// Find project
		const project = await db.collection('projects').findOne({
			_id: projectId,
			isPublic: true
		});
		
		if (!project) {
			return res.status(404).json({
				error: 'Project not found or not public'
			});
		}
		
		// Create or retrieve session
		let session = null;
		if (sessionId) {
			session = await db.collection('publicAgentSessions').findOne({
				_id: sessionId,
				projectId,
				expiresAt: { $gt: new Date() }
			});
		}
		
		if (!session) {
			// Create new session
			session = {
				_id: `public_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				projectId,
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
				messageCount: 0,
				metadata: {
					ip: req.ip,
					userAgent: req.get('user-agent')
				}
			};
			
			await db.collection('publicAgentSessions').insertOne(session);
		}
		
		// Check message limit
		if (session.messageCount >= 10) {
			return res.status(429).json({
				error: 'Session message limit reached. Please start a new session.'
			});
		}
		
		// Initialize tool executor
		const toolExecutor = new ToolExecutor({
			context: {
				project,
				auth: false,
				permissions: ['read'],
				agentArchetype: 'PUBLIC_ASSISTANT',
				agentId: `public_${session._id}`,
				session: {
					id: session._id,
					type: 'publicChat'
				},
				db
			}
		});
		
		// Get available tools
		const archetype = AGENT_ARCHETYPES.PUBLIC_ASSISTANT;
		const availableTools = getToolsForArchetype('PUBLIC_ASSISTANT', archetype.capabilities);
		
		// Create agent configuration
		const agentConfig = createAgentConfig({
			interface: 'publicApi',
			archetype: 'PUBLIC_ASSISTANT',
			context: {
				project,
				auth: false,
				permissions: ['read']
			},
			availableTools
		});
		
		// Start conversation using functional approach
		const conversation = await startConversation({
			agentType: 'PUBLIC_ASSISTANT',
			projectId: project?._id?.toString(),
			sessionId: session._id.toString(),
			initialContext: {
				project,
				toolExecutor,
				agentConfig
			}
		});
		
		// Process message
		const response = await sendMessage(conversation._id, message, exportToolDefinitions(agentConfig.tools));
		
		// Update session
		await db.collection('publicAgentSessions').updateOne(
			{ _id: session._id },
			{ 
				$inc: { messageCount: 1 },
				$set: { lastMessageAt: new Date() }
			}
		);
		
		// Return response
		res.json({
			success: true,
			response: response.content,
			sessionId: session._id,
			remainingMessages: 10 - session.messageCount - 1,
			expiresIn: Math.floor((session.expiresAt - new Date()) / 1000) // seconds
		});
		
	} catch (error) {
		console.error('Error in public chat endpoint:', error);
		res.status(500).json({
			error: 'Internal server error'
		});
	}
});

/**
 * GET /api/public/agent/capabilities
 * List available capabilities for public agents
 */
router.get('/capabilities', publicRateLimit, async (req, res) => {
	try {
		const archetype = AGENT_ARCHETYPES.PUBLIC_ASSISTANT;
		
		res.json({
			success: true,
			agent: {
				type: 'PUBLIC_ASSISTANT',
				description: archetype.name,
				capabilities: archetype.capabilities.map(cap => ({
					name: cap.name,
					description: cap.description
				})),
				limitations: [
					'Read-only access to public project information',
					'Cannot modify any data',
					'Limited to 10 messages per session',
					'Sessions expire after 30 minutes of inactivity'
				],
				availableEndpoints: [
					{
						method: 'GET',
						path: '/api/public/agent/projects/:projectId',
						description: 'Get public project information'
					},
					{
						method: 'POST',
						path: '/api/public/agent/chat',
						description: 'Chat about a public project'
					}
				]
			}
		});
		
	} catch (error) {
		console.error('Error in capabilities endpoint:', error);
		res.status(500).json({
			error: 'Internal server error'
		});
	}
});

/**
 * POST /api/public/agent/search
 * Search public projects using AI
 */
router.post('/search', publicRateLimit, async (req, res) => {
	try {
		const { query, limit = 10 } = req.body;
		
		if (!query) {
			return res.status(400).json({
				error: 'Query is required'
			});
		}
		
		// Search public projects
		const projects = await db.collection('projects')
			.find({
				isPublic: true,
				$or: [
					{ name: { $regex: query, $options: 'i' } },
					{ description: { $regex: query, $options: 'i' } },
					{ techStack: { $in: [new RegExp(query, 'i')] } }
				]
			})
			.limit(limit)
			.toArray();
		
		// Use AI to rank and describe results
		if (projects.length > 0) {
			// This would use the AI to provide intelligent summaries
			// For now, return basic results
			const results = projects.map(project => ({
				id: project._id,
				name: project.name,
				description: project.description,
				techStack: project.techStack,
				relevance: 'high' // AI would determine this
			}));
			
			res.json({
				success: true,
				query,
				results,
				count: results.length,
				aiSummary: `Found ${results.length} public projects matching "${query}"`
			});
		} else {
			res.json({
				success: true,
				query,
				results: [],
				count: 0,
				aiSummary: `No public projects found matching "${query}"`
			});
		}
		
	} catch (error) {
		console.error('Error in search endpoint:', error);
		res.status(500).json({
			error: 'Internal server error'
		});
	}
});

// Health check endpoint
router.get('/health', (req, res) => {
	res.json({
		success: true,
		service: 'public-agent',
		status: 'operational',
		timestamp: new Date().toISOString()
	});
});

export default router;