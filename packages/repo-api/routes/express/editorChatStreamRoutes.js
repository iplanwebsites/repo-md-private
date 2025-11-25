import express from 'express';
import { ObjectId } from 'mongodb';
import editorChatDb from '../../lib/db/editorChat.js';
import { EditorChatHandler } from '../../lib/llm/editorChat.js';
import { requireAuth as auth } from '../../lib/authMiddleware.js';
import { db } from '../../db.js';

const router = express.Router();

// Test endpoint for SSE streaming
router.get('/test-sse', (req, res) => {
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');
	
	let counter = 0;
	const interval = setInterval(() => {
		res.write(`data: ${JSON.stringify({ count: counter++, time: new Date().toISOString() })}\n\n`);
		if (res.flush) res.flush();
		
		if (counter >= 10) {
			clearInterval(interval);
			res.write('data: [DONE]\n\n');
			res.end();
		}
	}, 100);
	
	req.on('close', () => {
		clearInterval(interval);
	});
});

router.post('/stream/:chatId', auth, async (req, res) => {
	try {
		const { chatId } = req.params;
		const { content, message, attachments = [], enableStreaming = true, debug = false } = req.body;
		const { user } = req;
		
		// Support both 'content' and 'message' fields for compatibility
		const messageContent = content || message;
		
		// Verify chat ownership
		const chat = await editorChatDb.findById(chatId);
		
		if (!chat) {
			return res.status(404).json({ error: 'Chat not found' });
		}
		
		const chatUserId = chat.user?._id || chat.user;
		const chatOrgId = chat.org?._id || chat.org;
		
		if (!chatUserId || !chatOrgId) {
			return res.status(500).json({ error: 'Invalid chat data' });
		}
		
		// Verify user has access to this chat
		const userIdString = user._id ? user._id.toString() : user.id;
		if (chatUserId.toString() !== userIdString) {
			return res.status(403).json({ error: 'Access denied' });
		}
		
		// Verify user has access to the organization
		const orgId = chat.org?._id || chat.org;
		const org = await db.orgs.findOne({ 
			_id: orgId,
			$or: [
				{ owner: user.id },
				{ members: { $elemMatch: { userId: user.id } } }
			]
		});
		
		if (!org) {
			return res.status(403).json({ error: 'Organization access denied' });
		}
		
		// Set SSE headers
		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
		
		// Disable compression for SSE
		res.removeHeader('Content-Encoding');
		
		// Write initial data to establish connection
		res.write(':ok\n\n');
		
		// Create handler
		const handler = new EditorChatHandler({
			user,
			org,
			project: chat.project,
			chatId: chat._id,
			model: chat.model,
			temperature: chat.temperature,
			stream: true,
			enableStreaming,
			debug: debug || process.env.DEBUG_OPENAI === 'true'
		});
		
		await handler.initialize();
		
		// Send the message with direct response writing
		const stream = await handler.sendMessage(messageContent, attachments, res);
		
		// When using direct response mode, stream will be null
		if (!stream) {
			// Response is handled directly in the handler
			return;
		}
		
		// Instead of using pipe, manually handle the stream for better control
		stream.on('data', (chunk) => {
			res.write(chunk);
			// Force flush if available
			if (res.flush) res.flush();
		});
		
		stream.on('end', () => {
			res.end();
		});
		
		stream.on('error', (error) => {
			console.error('Stream error:', error);
			if (!res.headersSent) {
				res.status(500).json({ error: error.message });
			} else {
				res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
				res.end();
			}
		});
		
		// Generate title if needed
		if (!chat.title || chat.title === 'New Chat') {
			handler.generateTitle().catch(err => {
				console.error('Error generating title:', err);
			});
		}
		
		// Handle client disconnect
		req.on('close', () => {
			if (debug || process.env.DEBUG_OPENAI === 'true') {
				console.log('[DEBUG Route] Client disconnected');
			}
			stream.destroy();
		});
		
	} catch (error) {
		console.error('Error in editorChat stream:', error);
		console.error('Stack trace:', error.stack);
		
		// If headers haven't been sent yet, send error as JSON
		if (!res.headersSent) {
			return res.status(500).json({ error: error.message });
		}
		
		// Otherwise send as SSE
		res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
		res.end();
	}
});

export default router;