import OpenAI from 'openai';
import { Transform } from 'stream';
import { ObjectId } from 'mongodb';
import { db } from '../../db.js';
import {
  NEW_PROJECT_SYSTEM_PROMPT,
  projectBriefTools,
  getConversationContext
} from './newProjectSystem.js';
import {
  MESSAGE_ROLES,
  addMessageToConvo
} from './convoSchema.js';

/**
 * Service for handling streaming AI responses in project generation
 */
export class StreamingProjectGenerationService {
  constructor(openaiApiKey) {
    this.openaiApiKey = openaiApiKey;
    
    if (openaiApiKey && openaiApiKey !== 'fake-key') {
      this.openai = new OpenAI({ 
        apiKey: openaiApiKey,
        baseURL: "https://oai.helicone.ai/v1",
        defaultHeaders: {
          "Helicone-User-Id": "repo-md-project-gen-stream",
          "Helicone-Auth": "Bearer sk-helicone-wetdwuy-gjnethy-vxstiti-me3vmxy"
        }
      });
    } else {
      this.openai = null;
      console.log('⚠️ OpenAI API key not provided - streaming disabled');
    }
  }

  /**
   * Continue conversation with streaming response
   */
  async streamConversation(conversationId, userMessage) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    // Fetch conversation
    const convo = await db.convos.findOne({ 
      _id: new ObjectId(conversationId),
      status: 'active'
    });

    if (!convo) {
      throw new Error('Conversation not found or inactive');
    }

    // Add user message
    const userMsg = {
      role: MESSAGE_ROLES.USER,
      content: userMessage
    };
    addMessageToConvo(convo, userMsg);

    // Prepare messages for OpenAI
    const messages = convo.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.functionCall && { function_call: msg.functionCall })
    }));

    // Add conversation context
    messages.push({
      role: MESSAGE_ROLES.SYSTEM,
      content: getConversationContext(convo.messages)
    });

    // Create streaming completion
    const stream = await this.openai.chat.completions.create({
      model: convo.settings.model,
      messages,
      tools: projectBriefTools,
      temperature: convo.settings.temperature,
      max_tokens: convo.settings.maxTokens,
      stream: true
    });

    // Create transform stream for SSE format
    const sseTransform = new StreamingSSETransform(convo._id);

    return {
      stream,
      sseTransform,
      convoId: convo._id
    };
  }

  /**
   * Process streaming response and update conversation
   */
  async processStreamingResponse(convoId, fullContent, toolCalls, tokens) {
    try {
      const convo = await db.convos.findOne({ _id: convoId });
      if (!convo) return;

      // Add assistant message
      const assistantMsg = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: fullContent,
        tokens
      };

      // Handle tool calls
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          assistantMsg.functionCall = {
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments)
          };

          // Handle create_project_brief specifically
          if (toolCall.function.name === 'create_project_brief') {
            const functionArgs = JSON.parse(toolCall.function.arguments);
            convo.projectBrief = functionArgs;
            convo.status = 'completed';
            convo.completedAt = new Date();
          }
        }
      }

      addMessageToConvo(convo, assistantMsg);

      // Update conversation duration
      const duration = (new Date() - new Date(convo.createdAt)) / 1000;
      convo.metrics.duration = duration;

      // Save updated conversation
      await db.convos.updateOne(
        { _id: convo._id },
        { $set: convo }
      );

      return {
        success: true,
        conversationComplete: convo.status === 'completed',
        projectBrief: convo.projectBrief
      };
    } catch (error) {
      console.error('Error processing streaming response:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Transform stream to Server-Sent Events format
 */
export class StreamingSSETransform extends Transform {
  constructor(convoId) {
    super({ objectMode: true });
    this.convoId = convoId;
    this.fullContent = '';
    this.toolCalls = [];
    this.currentToolCall = null;
  }

  _transform(chunk, encoding, callback) {
    try {
      const delta = chunk.choices[0]?.delta;
      
      if (!delta) {
        callback();
        return;
      }

      // Handle content
      if (delta.content) {
        this.fullContent += delta.content;
        this.push(`data: ${JSON.stringify({
          type: 'content',
          content: delta.content
        })}\n\n`);
      }

      // Handle tool calls
      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.index !== undefined) {
            // Initialize or update tool call
            if (!this.toolCalls[toolCall.index]) {
              this.toolCalls[toolCall.index] = {
                id: toolCall.id,
                type: 'function',
                function: {
                  name: toolCall.function?.name || '',
                  arguments: ''
                }
              };
              this.currentToolCall = this.toolCalls[toolCall.index];
            }

            // Accumulate function arguments
            if (toolCall.function?.arguments) {
              this.toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
            }

            // Send tool call update
            this.push(`data: ${JSON.stringify({
              type: 'tool_call',
              toolCall: {
                name: this.toolCalls[toolCall.index].function.name,
                arguments: toolCall.function?.arguments || ''
              }
            })}\n\n`);
          }
        }
      }

      // Handle finish reason
      if (chunk.choices[0]?.finish_reason) {
        this.push(`data: ${JSON.stringify({
          type: 'finish',
          finish_reason: chunk.choices[0].finish_reason,
          usage: chunk.usage
        })}\n\n`);
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    // Send final data
    this.push(`data: ${JSON.stringify({
      type: 'complete',
      fullContent: this.fullContent,
      toolCalls: this.toolCalls,
      convoId: this.convoId.toString()
    })}\n\n`);
    
    // Send SSE termination
    this.push('data: [DONE]\n\n');
    callback();
  }
}

/**
 * Helper to create SSE response headers
 */
export function getSSEHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable Nginx buffering
  };
}

/**
 * Helper to create initial SSE message
 */
export function createSSEMessage(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Error handler for streaming
 */
export function handleStreamError(error, res) {
  console.error('Stream error:', error);
  
  if (!res.headersSent) {
    res.status(500).json({ error: error.message });
  } else {
    // If headers already sent, send error as SSE
    res.write(createSSEMessage({
      type: 'error',
      error: error.message
    }));
    res.write('data: [DONE]\n\n');
    res.end();
  }
}