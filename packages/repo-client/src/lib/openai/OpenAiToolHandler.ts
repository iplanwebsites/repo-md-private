/**
 * OpenAI Tool Handler for RepoMD
 * This file defines the handler that connects OpenAI tool calls to the RepoMD API client
 *
 * ## Usage Guide
 *
 * This handler processes OpenAI function calls with the official JSON Schema format
 * and automatically maps them to RepoMD instance methods using schema validation.
 *
 * ### OpenAI Function Call Format (Official JSON Schema)
 * ```json
 * {
 *   "name": "getAllPosts",
 *   "description": "Retrieve all blog posts from the repository",
 *   "parameters": {
 *     "type": "object",
 *     "properties": {
 *       "useCache": {
 *         "type": "boolean",
 *         "description": "Use cached data if available",
 *         "default": true
 *       },
 *       "forceRefresh": {
 *         "type": "boolean",
 *         "description": "Force refresh from storage",
 *         "default": false
 *       }
 *     },
 *     "required": []
 *   }
 * }
 * ```
 *
 * ### OpenAI API Response Example
 * ```json
 * {
 *   "choices": [{
 *     "message": {
 *       "tool_calls": [{
 *         "id": "call_123",
 *         "type": "function",
 *         "function": {
 *           "name": "getAllPosts",
 *           "arguments": "{\"useCache\": false, \"forceRefresh\": true}"
 *         }
 *       }]
 *     }
 *   }]
 * }
 * ```
 *
 * ### Handler Usage
 * ```javascript
 * import { createOpenAiToolHandler } from './OpenAiToolHandler.js';
 * import RepoMD from './RepoMD.js';
 *
 * const repoMD = new RepoMD({ projectId: 'your-project' });
 * const handler = createOpenAiToolHandler(repoMD);
 *
 * // Process OpenAI tool call
 * const toolCall = {
 *   name: 'getAllPosts',
 *   arguments: { useCache: false, forceRefresh: true }
 * };
 *
 * const result = await handler(toolCall);
 * // Calls: repoMD.getAllPosts(false, true)
 * ```
 *
 * ### Key Features
 * - **Schema-Based**: Uses Zod schemas as single source of truth for parameter mapping
 * - **Auto-Validation**: Parameters are validated and defaults applied automatically
 * - **Dynamic Routing**: Supports all 51+ RepoMD methods without hardcoding
 * - **Type Safety**: Invalid parameters are caught before method execution
 * - **OpenAI Compatible**: Works with OpenAI's function calling API format
 */

import { schemas, type SchemaWithMeta } from "../schemas/schemas.js";
import { type ZodTypeAny } from "zod";

/** RepoMD instance with dynamic method access */
export interface RepoMDInstance {
  [methodName: string]: ((...args: unknown[]) => Promise<unknown>) | unknown;
}

/** OpenAI tool call format */
export interface ToolCall {
  id?: string;
  name: string;
  arguments: string | Record<string, unknown>;
}

/** OpenAI API request format */
export interface OpenAiRequest {
  messages?: Array<{
    tool_calls?: ToolCall[];
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/** OpenAI tool call result */
export interface ToolCallResult {
  tool_call_id: string | undefined;
  output: string;
}

/** OpenAI response format */
export interface OpenAiResponse {
  tool_outputs: ToolCallResult[];
}

/** OpenAI tool handler function type */
export type OpenAiToolHandler = (toolCall: ToolCall) => Promise<unknown>;

/** Schema shape type */
interface SchemaShape {
  [key: string]: ZodTypeAny;
}

/** Schema definition type */
interface SchemaDef {
  shape?: SchemaShape | (() => SchemaShape);
  [key: string]: unknown;
}

/**
 * Convert OpenAI parameters object to method arguments array using schema definitions
 * @param methodName - The method name being called
 * @param parameters - The parameters object from OpenAI
 * @returns Array of arguments to pass to the method
 */
function convertParametersToArgs(methodName: string, parameters: Record<string, unknown> | null): unknown[] {
  const schema = schemas[methodName] as SchemaWithMeta | undefined;

  if (!schema) {
    throw new Error(`No schema found for method: ${methodName}`);
  }

  // Handle methods with no parameters
  if (!parameters || Object.keys(parameters).length === 0) {
    return [];
  }

  // Parse and validate parameters using the schema
  const zodSchema = schema as unknown as { parse: (data: unknown) => unknown };
  const parsedParams = zodSchema.parse(parameters) as Record<string, unknown>;

  // Extract the parameter names from the schema shape
  const schemaDef = (schema as unknown as { _def: SchemaDef })._def;
  const shapeRaw = schemaDef.shape;
  const shape: SchemaShape | undefined = typeof shapeRaw === "function" ? shapeRaw() : shapeRaw;

  if (!shape || typeof shape !== "object") {
    return [];
  }

  // Convert parameters to ordered arguments based on schema definition
  const args: unknown[] = [];
  const paramKeys = Object.keys(shape);

  for (const key of paramKeys) {
    if (Object.prototype.hasOwnProperty.call(parsedParams, key)) {
      args.push(parsedParams[key]);
    }
  }

  return args;
}

/**
 * Creates a handler for OpenAI tool calls that connects to the RepoMD client
 * @param repoMD - An instance of the RepoMD client
 * @returns Handler function for OpenAI tool calls
 */
export const createOpenAiToolHandler = (repoMD: RepoMDInstance): OpenAiToolHandler => {
  if (!repoMD) {
    throw new Error('RepoMD instance is required for OpenAiToolHandler');
  }

  /**
   * Handler for OpenAI tool calls
   * @param toolCall - The tool call from OpenAI
   * @returns Result of the tool call
   */
  return async function OpenAiToolHandler(toolCall: ToolCall): Promise<unknown> {
    const { name, arguments: args } = toolCall;
    const parsedArgs = typeof args === "string" ? JSON.parse(args) as Record<string, unknown> : args;

    try {
      // Check if the method exists on the RepoMD instance
      if (typeof repoMD[name] !== 'function') {
        throw new Error(`Method ${name} not found on RepoMD instance`);
      }

      // Convert parameters object to array of arguments
      const methodArgs = convertParametersToArgs(name, parsedArgs);

      // Call the method dynamically with spread arguments
      const method = repoMD[name] as (...args: unknown[]) => Promise<unknown>;
      return await method.apply(repoMD, methodArgs);
    } catch (error) {
      console.error(`[OpenAiToolHandler] Error executing tool ${name}:`, error);
      throw error;
    }
  };
};

/**
 * Integrated function to handle OpenAI API requests with the RepoMD tools
 * @param request - The OpenAI API request
 * @param repoMD - An instance of RepoMD
 * @returns The response to send back to OpenAI
 */
export const handleOpenAiRequest = async (request: OpenAiRequest, repoMD: RepoMDInstance): Promise<OpenAiResponse> => {
  if (!repoMD) {
    throw new Error('RepoMD instance is required for handleOpenAiRequest');
  }

  const toolHandler = createOpenAiToolHandler(repoMD);

  // Extract tool calls from the request
  const messages = request.messages || [];
  const lastMessage = messages[messages.length - 1];
  const toolCalls: ToolCall[] = lastMessage?.tool_calls || [];

  // Process all tool calls in parallel
  const toolCallResults = await Promise.all(
    toolCalls.map(async (toolCall): Promise<ToolCallResult> => {
      try {
        const result = await toolHandler(toolCall);
        return {
          tool_call_id: toolCall.id,
          output: JSON.stringify(result),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          tool_call_id: toolCall.id,
          output: JSON.stringify({ error: errorMessage }),
        };
      }
    })
  );

  // Return the results in the format expected by OpenAI
  return {
    tool_outputs: toolCallResults,
  };
};

// Export the createOpenAiToolHandler as the default export
export default createOpenAiToolHandler;
