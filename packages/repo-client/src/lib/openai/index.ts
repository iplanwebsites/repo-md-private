/**
 * OpenAI module barrel export for RepoMD
 */

import {
  createOpenAiToolHandler,
  handleOpenAiRequest,
} from "./OpenAiToolHandler.js";
import { createOpenAiSpecs } from "./OpenAiToolSpec.js";

export {
  createOpenAiToolHandler,
  handleOpenAiRequest,
  createOpenAiSpecs,
};

// Re-export types
export type {
  RepoMDInstance,
  ToolCall,
  OpenAiRequest,
  ToolCallResult,
  OpenAiResponse,
  OpenAiToolHandler,
} from "./OpenAiToolHandler.js";

export type {
  OpenAiProperty,
  OpenAiFunctionParameters,
  OpenAiFunction,
  OpenAiSpecs,
  CreateOpenAiSpecsOptions,
} from "./OpenAiToolSpec.js";

export type {
  ToolSpecWrapper,
  ToolSpecsMap,
} from "./OpenAiToolSpec_staticexample.js";
