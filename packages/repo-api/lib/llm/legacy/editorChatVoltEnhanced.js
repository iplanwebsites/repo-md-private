import { EditorChatHandlerVolt } from "./editorChatVolt.js";
import { db } from "../../db.js";
import editorChatDb from "../db/editorChat.js";
import { createToolMapping, exportToolDefinitions } from "./tools/catalogue.js";

/**
 * Enhanced EditorChatHandler that automatically uses PROJECT_NAVIGATOR
 * when no project context is provided
 */
export class EditorChatHandlerVoltEnhanced extends EditorChatHandlerVolt {
  constructor(options) {
    // If no project, switch to PROJECT_NAVIGATOR archetype
    if (!options.project && options.agentArchetype === "GENERALIST") {
      options.agentArchetype = "PROJECT_NAVIGATOR";
    }
    
    super(options);
    this.isProjectNavigator = !this.project;
    this.navigatorContext = null;
  }

  async initialize() {
    // If we're in PROJECT_NAVIGATOR mode, build navigator context first
    if (this.isProjectNavigator) {
      this.navigatorContext = await this.buildProjectNavigatorContext();
    }
    
    // Call parent initialize
    await super.initialize();
  }

  /**
   * Build context for PROJECT_NAVIGATOR with user's projects and activity
   */
  async buildProjectNavigatorContext() {
    const { user, org } = this;
    
    // Get user's projects
    const projects = await db.projects.find({
      $or: [
        { "members.userId": user._id },
        { orgId: org._id },
        { orgId: org._id.toString() },
        { orgId: org.handle }
      ],
      deleted: { $ne: true }
    }).sort({ updatedAt: -1 }).limit(20).toArray();

    // Get user's recent activity (last 30 days)
    const recentActivity = await db.editorChats.aggregate([
      {
        $match: { 
          user: user._id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: "$project",
          lastUsed: { $max: "$createdAt" },
          chatCount: { $sum: 1 }
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
      { $unwind: { path: "$project", preserveNullAndEmptyArrays: true } },
      { $sort: { lastUsed: -1 } },
      { $limit: 5 }
    ]).toArray();

    // Get deployment statistics
    const deploymentStats = await db.deploys.aggregate([
      {
        $match: {
          userId: user._id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: "$projectId",
          deployCount: { $sum: 1 },
          lastDeploy: { $max: "$createdAt" },
          successCount: { 
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
          }
        }
      }
    ]).toArray();

    return {
      projects: projects.map(p => ({
        id: p._id.toString(),
        name: p.name,
        slug: p.slug,
        description: p.description,
        visibility: p.visibility,
        lastUpdated: p.updatedAt,
        role: this.getUserProjectRole(user, p),
        hasRepo: !!p.repoMdProjectId,
        framework: p.framework,
        deploymentEnabled: !!p.deploymentConfig,
      })),
      recentActivity: recentActivity.filter(a => a.project).map(a => ({
        projectId: a._id?.toString(),
        projectName: a.project.name,
        lastUsed: a.lastUsed,
        chatCount: a.chatCount,
      })),
      userStats: {
        totalProjects: projects.length,
        recentlyActiveProjects: recentActivity.filter(a => a.project).length,
        deploymentsLast30Days: deploymentStats.reduce((sum, s) => sum + s.deployCount, 0),
      },
      suggestions: this.generateProjectSuggestions(projects, recentActivity, deploymentStats),
    };
  }

  /**
   * Get user's role in a project
   */
  getUserProjectRole(user, project) {
    const member = project.members?.find(m => 
      m.userId?.toString() === user._id.toString()
    );
    return member?.role || "viewer";
  }

  /**
   * Generate suggestions based on user activity
   */
  generateProjectSuggestions(projects, recentActivity, deploymentStats) {
    const suggestions = [];
    
    // Most recently used project
    if (recentActivity.length > 0 && recentActivity[0].project) {
      suggestions.push(`Your most active project is "${recentActivity[0].project.name}" with ${recentActivity[0].chatCount} recent chats`);
    }
    
    // Projects with recent deployments
    const recentDeploys = deploymentStats.filter(d => 
      d.lastDeploy > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (recentDeploys.length > 0) {
      suggestions.push(`You have ${recentDeploys.length} project(s) with deployments in the last week`);
    }
    
    // Inactive projects
    const inactiveProjects = projects.filter(p => 
      !recentActivity.find(a => a._id?.toString() === p._id.toString())
    );
    if (inactiveProjects.length > 0) {
      suggestions.push(`You have ${inactiveProjects.length} project(s) you haven't worked on recently`);
    }
    
    return suggestions;
  }

  /**
   * Override createAgent to add PROJECT_NAVIGATOR context
   */
  async createAgent() {
    await super.createAgent();
    
    // If we're in PROJECT_NAVIGATOR mode, enhance the agent with context
    if (this.isProjectNavigator && this.navigatorContext) {
      const originalInstructions = this.agent.instructions;
      
      // Add project navigation context to instructions
      const navigatorInstructions = this.generateProjectNavigatorInstructions(this.navigatorContext);
      this.agent.instructions = originalInstructions + "\n\n" + navigatorInstructions;
      
      // Add tool result handler for project switching
      this.agent.hooks = {
        ...this.agent.hooks,
        onToolEnd: async ({ tool, result }) => {
          if (tool.name === "switch_to_project" && result.action === "switch_context") {
            await this.handleProjectSwitch(result);
          }
        }
      };
    }
  }

  /**
   * Generate PROJECT_NAVIGATOR specific instructions with context
   */
  generateProjectNavigatorInstructions(context) {
    const { projects, recentActivity, userStats, suggestions } = context;
    
    return `## Current User Context

**Account Overview:**
- Total Projects: ${userStats.totalProjects}
- Recently Active: ${userStats.recentlyActiveProjects} projects
- Deployments (30 days): ${userStats.deploymentsLast30Days}

**Available Projects:**
${projects.slice(0, 10).map(p => `- **${p.name}** (${p.visibility}): ${p.description || 'No description'}
  - Slug: ${p.slug}
  - Role: ${p.role}
  - Framework: ${p.framework || 'Not specified'}
  - Last Updated: ${this.formatRelativeTime(p.lastUpdated)}
  - Deployment: ${p.deploymentEnabled ? 'Enabled' : 'Not configured'}`).join('\n')}
${projects.length > 10 ? `\n... and ${projects.length - 10} more projects` : ''}

**Recent Activity:**
${recentActivity.length > 0 ? recentActivity.map(a => 
  `- ${a.projectName}: Used ${this.formatRelativeTime(a.lastUsed)} (${a.chatCount} chats)`
).join('\n') : 'No recent activity in the last 30 days'}

**Suggestions:**
${suggestions.map(s => `- ${s}`).join('\n')}

Remember: When a user selects a project to work on, use the 'switch_to_project' tool to transition to that project's context.`;
  }

  /**
   * Format date as relative time
   */
  formatRelativeTime(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
      }
    }
    
    return 'just now';
  }

  /**
   * Handle project switching from PROJECT_NAVIGATOR
   */
  async handleProjectSwitch(switchResult) {
    // Update the chat with the switch information
    await editorChatDb.updateOne(
      { _id: this.chatId },
      {
        $set: {
          "metadata.switchedToProject": switchResult.project.id,
          "metadata.switchIntent": switchResult.intent,
          "metadata.switchedAt": new Date(),
          "metadata.wasProjectNavigator": true
        }
      }
    );
    
    // The response should signal the client to reload with the new project
    return {
      action: "project_switch",
      project: switchResult.project,
      intent: switchResult.intent,
      requiresReload: true
    };
  }
}

// Export the enhanced handler as the default
export default EditorChatHandlerVoltEnhanced;