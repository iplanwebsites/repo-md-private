import { createTool, responses } from "./baseTool.js";
import { RepoMD } from "repo-md";
import { db } from "../../../db.js";
import { ObjectId } from "mongodb";

// Cache for RepoMD instances to avoid repeated initialization
const repoMdCache = new Map();

/**
 * Get or create a RepoMD instance for a project
 */
async function getRepoMdInstance(projectId) {
  const cacheKey = projectId.toString();

  if (repoMdCache.has(cacheKey)) {
    return repoMdCache.get(cacheKey);
  }

  try {
    // Load project from database
    const project = await db.projects.findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Initialize RepoMD using the project ID
    const repoMd = new RepoMD({ projectId: project._id.toString() });

    // Cache the instance
    repoMdCache.set(cacheKey, repoMd);

    return repoMd;
  } catch (error) {
    console.error(
      `Failed to initialize RepoMD for project ${projectId}:`,
      error
    );
    throw error;
  }
}

/**
 * Get native RepoMD tools with OpenAI specifications
 * This loads the tools directly from the RepoMD library
 */
export async function getRepoMdNativeTools(projectId, options = {}) {
  const { blacklistedTools = [], permissions = ["read"] } = options;

  try {
    // Get RepoMD instance
    const repoMd = await getRepoMdInstance(projectId);

    // Get OpenAI tool specifications from RepoMD
    const toolSpec = repoMd.getOpenAiToolSpec({
      blacklistedTools,
    });

    // Convert RepoMD's OpenAI specs to our tool format
    const tools = toolSpec.functions.map((func) => {
      return createTool({
        definition: func,
        implementation: async (args, context) => {
          try {
            // Use RepoMD's native handler
            const result = await repoMd.handleOpenAiRequest({
              function: func.name,
              arguments: args,
            });

            // RepoMD returns results directly, wrap in our response format
            return responses.success(
              result,
              `Executed ${func.name} successfully`
            );
          } catch (error) {
            console.error(`Error executing RepoMD tool ${func.name}:`, error);
            return responses.error(error.message);
          }
        },
        category: "repomd",
        requiredPermissions: permissions,
        requiredContext: ["project"],
      });
    });

    return tools;
  } catch (error) {
    console.error("Failed to get RepoMD native tools:", error);
    return [];
  }
}

/**
 * Create a dynamic tool handler that loads RepoMD tools on demand
 * This is useful for the tool catalogue system
 */
export const createRepoMdToolProvider = () => {
  let cachedTools = null;
  let lastProjectId = null;

  return {
    async getTools(context) {
      if (!context.project) {
        return [];
      }

      const projectId = context.project._id;

      // Return cached tools if same project
      if (cachedTools && lastProjectId === projectId.toString()) {
        return cachedTools;
      }

      // Load tools for new project
      cachedTools = await getRepoMdNativeTools(projectId, {
        permissions: context.permissions || ["read"],
      });
      lastProjectId = projectId.toString();

      return cachedTools;
    },

    // Reset cache when project changes
    clearCache() {
      cachedTools = null;
      lastProjectId = null;
    },
  };
};

/**
 * Get RepoMD tool handler for direct execution
 * This bypasses our tool system and uses RepoMD directly
 */
export async function getRepoMdDirectHandler(projectId) {
  const repoMd = await getRepoMdInstance(projectId);

  return {
    // Get available tools
    getToolSpec: (options = {}) => {
      return repoMd.getOpenAiToolSpec(options);
    },

    // Execute a tool directly
    execute: async (toolName, args) => {
      return await repoMd.handleOpenAiRequest({
        function: toolName,
        arguments: args,
      });
    },

    // Get the RepoMD instance for advanced usage
    getInstance: () => repoMd,
  };
}

// Export a static list of known RepoMD tool names for reference
// This helps with tool discovery without needing a project context
export const KNOWN_REPOMD_TOOLS = [
  "search",
  "getArticle",
  "getArticles",
  "getNavigation",
  "getMetadata",
  "getMedia",
  "getSourceFile",
  "getFileTree",
  "getStatistics",
];

// Export default provider
export default createRepoMdToolProvider();
