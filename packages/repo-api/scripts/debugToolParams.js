#!/usr/bin/env node

/**
 * Debug tool parameter issues
 */

import { config } from 'dotenv';
import { createTool } from "@voltagent/core";
import { z } from "zod";

config();

// Test creating a simple tool with Volt
async function debugToolParams() {
  console.log('🔍 Debugging Tool Parameters\n');
  
  try {
    // Test 1: Simple tool with basic parameters
    console.log('1️⃣ Testing simple tool creation...');
    
    const simpleTool = createTool({
      name: 'test_tool',
      description: 'A simple test tool',
      parameters: z.object({
        message: z.string().describe('The message to process'),
        count: z.number().optional().describe('Optional count')
      }),
      execute: async (args) => {
        return { success: true, message: args.message };
      }
    });
    
    console.log('✅ Simple tool created successfully');
    console.log('Tool:', simpleTool);
    
    // Test 2: Tool with nested object parameters
    console.log('\n2️⃣ Testing tool with nested objects...');
    
    const complexTool = createTool({
      name: 'complex_tool',
      description: 'A tool with nested parameters',
      parameters: z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email()
        }),
        options: z.object({
          verbose: z.boolean().optional()
        }).optional()
      }),
      execute: async (args) => {
        return { success: true };
      }
    });
    
    console.log('✅ Complex tool created successfully');
    
    // Test 3: Tool with array parameters
    console.log('\n3️⃣ Testing tool with array parameters...');
    
    const arrayTool = createTool({
      name: 'array_tool',
      description: 'A tool with array parameters',
      parameters: z.object({
        items: z.array(z.string()),
        numbers: z.array(z.number()).optional()
      }),
      execute: async (args) => {
        return { success: true };
      }
    });
    
    console.log('✅ Array tool created successfully');
    
    // Test 4: Weather tool format (from our codebase)
    console.log('\n4️⃣ Testing weather tool format...');
    
    const weatherParams = {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state/country for weather lookup'
        }
      },
      required: ['location']
    };
    
    // Parse to Zod
    function parseParametersToZod(parameters) {
      if (!parameters || !parameters.properties) {
        return z.object({});
      }

      const zodSchema = {};
      for (const [key, prop] of Object.entries(parameters.properties)) {
        let schema;
        switch (prop.type) {
          case "string":
            schema = z.string();
            break;
          case "number":
            schema = z.number();
            break;
          case "boolean":
            schema = z.boolean();
            break;
          default:
            schema = z.any();
        }

        if (prop.description) {
          schema = schema.describe(prop.description);
        }

        // Handle required fields
        if (parameters.required && parameters.required.includes(key)) {
          zodSchema[key] = schema;
        } else {
          zodSchema[key] = schema.optional();
        }
      }

      return z.object(zodSchema);
    }
    
    const zodParams = parseParametersToZod(weatherParams);
    console.log('Parsed Zod schema:', zodParams);
    
    const weatherTool = createTool({
      name: 'getWeather',
      description: 'Get weather information for a location',
      parameters: zodParams,
      execute: async (args) => {
        return { success: true };
      }
    });
    
    console.log('✅ Weather tool created successfully');
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run the debug
debugToolParams().catch(console.error);