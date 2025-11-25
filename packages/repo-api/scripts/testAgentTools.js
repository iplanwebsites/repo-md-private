#!/usr/bin/env node

/**
 * Test if tools are properly attached to Volt agent
 */

import { config } from 'dotenv';
import { Agent, createTool } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { voltOpsClient } from '../lib/volt/voltAgentConfig.js';

config();

async function testAgentTools() {
  console.log('🔍 Testing Volt Agent Tool Attachment\n');
  
  try {
    // Create test tools
    const testTool1 = createTool({
      name: 'test_tool_1',
      description: 'First test tool',
      parameters: z.object({
        message: z.string()
      }),
      execute: async (args) => ({ success: true, message: args.message })
    });
    
    const testTool2 = createTool({
      name: 'test_tool_2',
      description: 'Second test tool',
      parameters: z.object({
        count: z.number()
      }),
      execute: async (args) => ({ success: true, count: args.count })
    });
    
    console.log('✅ Created 2 test tools');
    
    // Create agent with tools
    const agent = new Agent({
      voltOpsClient,
      name: "TestAgent",
      instructions: "You are a test agent with tools.",
      llm: new VercelAIProvider({
        providerOptions: {
          openai: {
            baseURL: "https://oai.helicone.ai/v1",
            apiKey: process.env.OPENAI_API_KEY,
          },
        },
      }),
      model: openai("gpt-4o-mini"),
      tools: [testTool1, testTool2],
      markdown: true,
      memory: false,
    });
    
    console.log('\n📊 Agent created:');
    console.log(`  - Name: ${agent.name}`);
    console.log(`  - Tools property: ${agent.tools}`);
    console.log(`  - Tools count: ${agent.tools?.length || 'N/A'}`);
    
    // Try to inspect the agent more deeply
    console.log('\n🔎 Deep inspection:');
    const agentKeys = Object.keys(agent);
    console.log(`  - Agent keys: ${agentKeys.join(', ')}`);
    
    // Check if tools are stored elsewhere
    if (agent._tools) {
      console.log(`  - _tools count: ${agent._tools?.length}`);
    }
    
    // Try to use the agent
    console.log('\n🤖 Testing agent response:');
    
    try {
      const response = await agent.streamText("Hello, can you list your available tools?", {
        conversationId: 'test-conv-1'
      });
      
      const chunks = [];
      for await (const chunk of response.textStream) {
        chunks.push(chunk);
      }
      
      const fullResponse = chunks.join('');
      console.log('Agent response:', fullResponse);
      
      // Check if tools were used
      console.log('\nTool calls:', response.toolCalls || 'None');
      
    } catch (error) {
      console.log('Error calling agent:', error.message);
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testAgentTools().catch(console.error);