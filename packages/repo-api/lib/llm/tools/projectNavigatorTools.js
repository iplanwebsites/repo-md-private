import { createTool } from "@voltagent/core";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { db } from "../../../db.js";
import { deployProjectTool } from "./deployProject.js";

/**
 * Tools for the PROJECT_NAVIGATOR archetype
 * Used when users are in editorChat without a project context
 */

/**
 * List projects for the user/organization
 */
export const listProjectsTool = createTool({
  name: "list_projects",
  description: "List all projects the user has access to in their organization",
  parameters: z.object({
    filter: z.enum(["all", "recent", "owned", "public", "private", "deployable"]).optional()
      .describe("Filter projects by criteria"),
    sortBy: z.enum(["name", "updated", "created"]).optional().default("updated")
      .describe("Sort projects by field"),
    limit: z.number().optional().default(20)
      .describe("Maximum number of projects to return"),
  }),
  execute: async ({ filter, sortBy, limit }, context) => {
    const { user, org } = context;
    
    if (!org || !org._id) {
      return {
        success: false,
        error: "No organization context available",
      };
    }

    try {
      // Build query - handle multiple orgId formats like Slack does
      let query = {
        $or: [
          { orgId: org._id },
          { orgId: org._id.toString() },
          { orgId: org.handle }
        ],
        deleted: { $ne: true }
      };

      // Apply filters
      switch (filter) {
        case "owned":
          query["members.userId"] = user._id;
          query["members.role"] = "owner";
          break;
        case "public":
          query.visibility = "public";
          break;
        case "private":
          query.visibility = "private";
          break;
        case "deployable":
          query.deploymentConfig = { $exists: true };
          break;
        case "recent":
          // Will be handled by sort and limit
          break;
      }

      // Build sort
      let sort = {};
      switch (sortBy) {
        case "name":
          sort = { name: 1 };
          break;
        case "created":
          sort = { createdAt: -1 };
          break;
        case "updated":
        default:
          sort = { updatedAt: -1 };
          break;
      }

      // Query projects
      const projects = await db.projects
        .find(query)
        .sort(sort)
        .limit(limit)
        .toArray();

      // Get user's recent activity for these projects (last 30 days)
      const projectIds = projects.map(p => p._id);
      const recentActivity = await db.editorChats.aggregate([
        {
          $match: { 
            user: user._id,
            project: { $in: projectIds },
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: "$project",
            lastUsed: { $max: "$createdAt" },
            chatCount: { $sum: 1 }
          }
        }
      ]).toArray();

      // Create activity map
      const activityMap = new Map(
        recentActivity.map(a => [a._id.toString(), a])
      );

      // Format projects with activity data
      const formattedProjects = projects.map(project => {
        const activity = activityMap.get(project._id.toString());
        const memberRecord = project.members?.find(m => 
          m.userId?.toString() === user._id.toString()
        );
        
        return {
          id: project._id.toString(),
          name: project.name,
          slug: project.slug,
          description: project.description,
          visibility: project.visibility || "private",
          framework: project.framework,
          language: project.language,
          techStack: project.techStack || [],
          
          // URLs
          adminUrl: `https://repo.md/${org.handle}/${project.slug}`,
          liveUrl: project.customDomain || `https://${project.slug}.repo.md`,
          
          // Status
          hasRepository: !!project.repoMdProjectId,
          deploymentEnabled: !!project.deploymentConfig,
          lastDeployed: project.lastDeployedAt,
          
          // Activity
          lastUpdated: project.updatedAt,
          lastUsedByYou: activity?.lastUsed,
          recentChatCount: activity?.chatCount || 0,
          
          // User's role
          userRole: memberRecord?.role || "viewer",
          
          // Metadata
          createdAt: project.createdAt,
          memberCount: project.members?.length || 1,
        };
      });

      // Sort by recent activity if filter is "recent"
      if (filter === "recent") {
        formattedProjects.sort((a, b) => {
          const aTime = a.lastUsedByYou?.getTime() || 0;
          const bTime = b.lastUsedByYou?.getTime() || 0;
          return bTime - aTime;
        });
      }

      return {
        success: true,
        projects: formattedProjects,
        totalCount: formattedProjects.length,
        organization: {
          name: org.name,
          handle: org.handle,
        },
        summary: generateProjectSummary(formattedProjects, filter),
      };
    } catch (error) {
      console.error("Error listing projects:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Get detailed information about a specific project
 */
export const getProjectDetailsTool = createTool({
  name: "get_project_details",
  description: "Get detailed information about a specific project",
  parameters: z.object({
    projectId: z.string().optional().describe("Project ID"),
    projectSlug: z.string().optional().describe("Project slug"),
  }),
  execute: async ({ projectId, projectSlug }, context) => {
    const { user, org } = context;
    
    if (!projectId && !projectSlug) {
      return {
        success: false,
        error: "Either projectId or projectSlug must be provided",
      };
    }

    try {
      // Build query
      let query = {
        $or: [
          { orgId: org._id },
          { orgId: org._id.toString() },
          { orgId: org.handle }
        ],
        deleted: { $ne: true }
      };

      if (projectId) {
        query._id = new ObjectId(projectId);
      } else if (projectSlug) {
        query.slug = projectSlug;
      }

      const project = await db.projects.findOne(query);

      if (!project) {
        return {
          success: false,
          error: "Project not found",
        };
      }

      // Get recent deployment info
      const recentDeploy = await db.deploys.findOne(
        { projectId: project._id },
        { sort: { createdAt: -1 } }
      );

      // Get user's recent activity
      const recentActivity = await db.editorChats.countDocuments({
        user: user._id,
        project: project._id,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      const memberRecord = project.members?.find(m => 
        m.userId?.toString() === user._id.toString()
      );

      return {
        success: true,
        project: {
          id: project._id.toString(),
          name: project.name,
          slug: project.slug,
          description: project.description || "No description provided",
          visibility: project.visibility || "private",
          
          // Technical details
          framework: project.framework,
          language: project.language,
          techStack: project.techStack || [],
          packageManager: project.packageManager,
          
          // Repository info
          repository: project.repository ? {
            url: project.repository.url,
            branch: project.repository.branch || "main",
            provider: project.repository.provider || "github",
          } : null,
          
          // URLs
          adminUrl: `https://repo.md/${org.handle}/${project.slug}`,
          liveUrl: project.customDomain || `https://${project.slug}.repo.md`,
          
          // Deployment
          deploymentEnabled: !!project.deploymentConfig,
          lastDeployment: recentDeploy ? {
            status: recentDeploy.status,
            createdAt: recentDeploy.createdAt,
            completedAt: recentDeploy.completedAt,
            url: recentDeploy.url,
          } : null,
          
          // Activity
          yourRecentActivity: {
            chatCount: recentActivity,
            lastUsed: await db.editorChats.findOne(
              { user: user._id, project: project._id },
              { sort: { createdAt: -1 } }
            )?.createdAt,
          },
          
          // Access
          userRole: memberRecord?.role || "viewer",
          members: project.members?.map(m => ({
            role: m.role,
            joinedAt: m.joinedAt,
          })),
          
          // Timestamps
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      };
    } catch (error) {
      console.error("Error getting project details:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Switch to a specific project context
 */
export const switchToProjectTool = createTool({
  name: "switch_to_project",
  description: "Switch the editor context to a specific project",
  parameters: z.object({
    projectId: z.string().optional().describe("Project ID to switch to"),
    projectSlug: z.string().optional().describe("Project slug to switch to"),
    intent: z.enum(["edit", "deploy", "browse", "settings", "general"]).optional()
      .describe("What the user intends to do with the project"),
  }),
  execute: async ({ projectId, projectSlug, intent }, context) => {
    const { user, org, sessionId } = context;
    
    if (!projectId && !projectSlug) {
      return {
        success: false,
        error: "Either projectId or projectSlug must be provided",
      };
    }

    try {
      // Find the project
      let query = {
        $or: [
          { orgId: org._id },
          { orgId: org._id.toString() },
          { orgId: org.handle }
        ],
        deleted: { $ne: true }
      };

      if (projectId) {
        query._id = new ObjectId(projectId);
      } else if (projectSlug) {
        query.slug = projectSlug;
      }

      const project = await db.projects.findOne(query);

      if (!project) {
        return {
          success: false,
          error: "Project not found or you don't have access",
        };
      }

      // Update the chat session with the new project context
      if (sessionId) {
        await db.editorChats.updateOne(
          { _id: new ObjectId(sessionId) },
          {
            $set: {
              project: project._id,
              "metadata.switchedFromNavigator": true,
              "metadata.switchedAt": new Date(),
              "metadata.switchIntent": intent,
            }
          }
        );
      }

      return {
        success: true,
        action: "switch_context",
        project: {
          id: project._id.toString(),
          name: project.name,
          slug: project.slug,
        },
        intent: intent || "general",
        message: `Switching to ${project.name}${intent ? ` for ${intent}` : ''}...`,
        // This signals the client to reload with the new project context
        requiresReload: true,
      };
    } catch (error) {
      console.error("Error switching project:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Analyze user's project activity
 */
export const analyzeProjectActivityTool = createTool({
  name: "analyze_project_activity",
  description: "Analyze the user's activity patterns across projects",
  parameters: z.object({
    timeframe: z.enum(["today", "week", "month", "all"]).optional().default("month")
      .describe("Timeframe for analysis"),
  }),
  execute: async ({ timeframe }, context) => {
    const { user, org } = context;
    
    // Calculate date range
    let startDate;
    const now = new Date();
    switch (timeframe) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // Beginning of time
    }

    try {
      // Get activity data
      const activity = await db.editorChats.aggregate([
        {
          $match: {
            user: user._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: "$project",
            chatCount: { $sum: 1 },
            firstChat: { $min: "$createdAt" },
            lastChat: { $max: "$createdAt" },
            models: { $addToSet: "$model" },
          }
        },
        {
          $lookup: {
            from: "projects",
            localField: "_id",
            foreignField: "_id",
            as: "project"
          }
        },
        { $unwind: "$project" },
        { $sort: { chatCount: -1 } }
      ]).toArray();

      // Get deployment activity
      const deployments = await db.deploys.aggregate([
        {
          $match: {
            userId: user._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: "$projectId",
            deployCount: { $sum: 1 },
            successCount: { 
              $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
            },
            lastDeploy: { $max: "$createdAt" }
          }
        }
      ]).toArray();

      // Create deployment map
      const deployMap = new Map(
        deployments.map(d => [d._id.toString(), d])
      );

      // Format activity data
      const projectActivity = activity.map(a => {
        const deploys = deployMap.get(a._id.toString());
        return {
          project: {
            id: a._id.toString(),
            name: a.project.name,
            slug: a.project.slug,
          },
          chats: {
            count: a.chatCount,
            firstChat: a.firstChat,
            lastChat: a.lastChat,
            modelsUsed: a.models,
          },
          deployments: deploys ? {
            count: deploys.deployCount,
            successCount: deploys.successCount,
            successRate: (deploys.successCount / deploys.deployCount * 100).toFixed(1),
            lastDeploy: deploys.lastDeploy,
          } : null,
        };
      });

      // Calculate summary statistics
      const totalChats = projectActivity.reduce((sum, p) => sum + p.chats.count, 0);
      const totalDeploys = deployments.reduce((sum, d) => sum + d.deployCount, 0);
      const activeProjects = projectActivity.length;

      return {
        success: true,
        timeframe,
        startDate,
        summary: {
          totalChats,
          totalDeploys,
          activeProjects,
          averageChatsPerProject: activeProjects > 0 ? (totalChats / activeProjects).toFixed(1) : 0,
        },
        projects: projectActivity,
        insights: generateActivityInsights(projectActivity, timeframe),
      };
    } catch (error) {
      console.error("Error analyzing activity:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

// Helper functions

function generateProjectSummary(projects, filter) {
  const summary = {
    total: projects.length,
    byVisibility: {
      public: projects.filter(p => p.visibility === "public").length,
      private: projects.filter(p => p.visibility === "private").length,
    },
    byRole: {
      owner: projects.filter(p => p.userRole === "owner").length,
      admin: projects.filter(p => p.userRole === "admin").length,
      editor: projects.filter(p => p.userRole === "editor").length,
      viewer: projects.filter(p => p.userRole === "viewer").length,
    },
    recentlyActive: projects.filter(p => p.recentChatCount > 0).length,
    deployable: projects.filter(p => p.deploymentEnabled).length,
  };

  let description = `Found ${summary.total} project${summary.total !== 1 ? 's' : ''}`;
  
  if (filter === "recent") {
    description += ` (${summary.recentlyActive} with recent activity)`;
  } else if (filter === "deployable") {
    description += ` (${summary.deployable} with deployment enabled)`;
  }

  return {
    ...summary,
    description,
  };
}

function generateActivityInsights(projectActivity, timeframe) {
  const insights = [];
  
  if (projectActivity.length === 0) {
    insights.push(`No activity found ${timeframe === 'all' ? 'in your history' : `in the last ${timeframe}`}.`);
    return insights;
  }

  // Most active project
  const mostActive = projectActivity[0];
  insights.push(`Most active project: ${mostActive.project.name} (${mostActive.chats.count} chats)`);

  // Projects with deployments
  const projectsWithDeploys = projectActivity.filter(p => p.deployments);
  if (projectsWithDeploys.length > 0) {
    insights.push(`Deployed ${projectsWithDeploys.length} project${projectsWithDeploys.length !== 1 ? 's' : ''} during this period`);
  }

  // Model usage
  const allModels = new Set();
  projectActivity.forEach(p => p.chats.modelsUsed.forEach(m => allModels.add(m)));
  if (allModels.size > 1) {
    insights.push(`Used ${allModels.size} different AI models across projects`);
  }

  return insights;
}

// Export individual tools
export const list_projects = listProjectsTool;
export const get_project_details = getProjectDetailsTool;
export const switch_to_project = switchToProjectTool;
export const analyze_project_activity = analyzeProjectActivityTool;
export const deploy_project = deployProjectTool;

// Export all tools as a collection
export const projectNavigatorTools = {
  list_projects: listProjectsTool,
  get_project_details: getProjectDetailsTool,
  switch_to_project: switchToProjectTool,
  analyze_project_activity: analyzeProjectActivityTool,
  deploy_project: deployProjectTool,
};