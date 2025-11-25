import express from 'express';
import { ObjectId } from 'mongodb';
import { db } from '../../db.js';
import { requireAuth } from '../../lib/authMiddleware.js';
import {
  StreamingProjectGenerationService,
  getSSEHeaders,
  createSSEMessage,
  handleStreamError
} from '../../lib/project-generation/streamingServiceVolt.js';

const router = express.Router();

// Initialize streaming service
const streamingService = new StreamingProjectGenerationService(process.env.OPENAI_API_KEY);

/**
 * POST /api/project-generation/stream/continue
 * Continue conversation with streaming response
 */
router.post('/continue', requireAuth, async (req, res) => {
  try {
    const { conversationId, message } = req.body;

    if (!conversationId || !message) {
      return res.status(400).json({ 
        error: 'conversationId and message are required' 
      });
    }

    // Verify user owns the conversation
    const convo = await db.convos.findOne({
      _id: new ObjectId(conversationId),
      userId: new ObjectId(req.user.id)
    });

    if (!convo) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Set SSE headers
    res.writeHead(200, getSSEHeaders());

    // Send initial connection message
    res.write(createSSEMessage({
      type: 'connected',
      conversationId,
      timestamp: new Date().toISOString()
    }));

    try {
      // Get streaming response
      const { response, sseTransform, convoId } = await streamingService.streamConversation(
        conversationId,
        message
      );

      // Process the Volt stream and pipe it through SSE transform
      await sseTransform.processVoltStream(response);
      
      // Write the SSE transform output to response
      const output = sseTransform.read();
      if (output) {
        res.write(output);
      }

      // Extract data from the final complete event
      let fullContent = sseTransform.fullContent;
      let toolCalls = sseTransform.toolCalls;
      let usage = sseTransform.usage;

      // Process the complete response
      const result = await streamingService.processStreamingResponse(
        convoId,
        fullContent,
        toolCalls,
        usage
      );

      // Send completion message
      res.write(createSSEMessage({
        type: 'complete',
        result,
        usage
      }));

      // End stream
      res.write('data: [DONE]\n\n');
      res.end();

    } catch (streamError) {
      handleStreamError(streamError, res);
    }

  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      handleStreamError(error, res);
    }
  }
});

/**
 * GET /api/project-generation/stream/test
 * Test SSE endpoint
 */
router.get('/test', requireAuth, async (req, res) => {
  res.writeHead(200, getSSEHeaders());

  // Send test messages
  res.write(createSSEMessage({ type: 'test', message: 'SSE connection established' }));
  
  let counter = 0;
  const interval = setInterval(() => {
    counter++;
    res.write(createSSEMessage({ 
      type: 'ping', 
      counter, 
      timestamp: new Date().toISOString() 
    }));
    
    if (counter >= 5) {
      clearInterval(interval);
      res.write(createSSEMessage({ type: 'complete', message: 'Test complete' }));
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }, 1000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
});

export default router;