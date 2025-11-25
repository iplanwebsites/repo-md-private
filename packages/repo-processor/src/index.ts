// Import core functionality
import { hast, mdast } from "./lib";
import { processFolder } from "./process/processFolder";
import { processMedia } from "./process/processMedia";
import { RepoProcessor, ConfigBuilder, ProcessConfig } from "./process/process";
import { remarkObsidianMedia, RemarkObsidianMediaOptions } from "./remark/remarkObsidianMedia";
import { remarkMdImages, RemarkMdImagesOptions } from "./remark/remarkmdimages";
import { remarkMermaid, RemarkMermaidOptions } from "./remark/remarkMermaid";
import { remarkIframeEmbed, RemarkIframeEmbedOptions } from "./remark/remarkIframeEmbed";
import { toLinkBuilder } from "./remark/toLinkBuilder";

// Import utility functions
import * as utilityFunctions from "./lib/utility";
const { toSlug, getFileName, getFrontmatterAndMd, jsonStringify, writeToFileSync, calculateFileHash } = utilityFunctions;

// Import file resolver utilities
import * as fileResolverFunctions from "./lib/fileResolver";

// Export types
export * from "./types";

// Export utility functions
export * from "./lib/utility"; 

// Export file resolver utilities
export * from "./lib/fileResolver";

// Re-export the main classes, functions and types
export {
  RepoProcessor,
  ConfigBuilder,
  processFolder,
  processMedia,
  remarkObsidianMedia,
  remarkMdImages,
  remarkMermaid,
  remarkIframeEmbed,
  toLinkBuilder,
  // Type exports
  type ProcessConfig,
  type RemarkObsidianMediaOptions,
  type RemarkMdImagesOptions,
  type RemarkMermaidOptions,
  type RemarkIframeEmbedOptions
};

// Create utility namespace for backward compatibility
export const utility = {
  toSlug,
  getFileName,
  getFrontmatterAndMd,
  jsonStringify,
  writeToFileSync,
  calculateFileHash
};

// Legacy export structure for default export
const MAIN = {
  // Include utility functions
  utility,
  
  // Main functions
  processFolder,
  processMedia,
  remarkObsidianMedia,
  remarkMdImages,
  remarkMermaid,
  toLinkBuilder,
  
  // Classes
  RepoProcessor,
  ConfigBuilder,
  
  // Libs
  hast,
  mdast
};

// Default export for legacy compatibility
export default MAIN as {
  utility: typeof utility;
  processFolder: typeof processFolder;
  processMedia: typeof processMedia;
  remarkObsidianMedia: typeof remarkObsidianMedia;
  remarkMdImages: typeof remarkMdImages;
  remarkMermaid: typeof remarkMermaid;
  toLinkBuilder: typeof toLinkBuilder;
  RepoProcessor: typeof RepoProcessor;
  ConfigBuilder: typeof ConfigBuilder;
  hast: typeof hast;
  mdast: typeof mdast;
};