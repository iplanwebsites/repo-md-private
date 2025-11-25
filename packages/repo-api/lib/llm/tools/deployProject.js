/**
 * Tool for deploying projects through natural language commands
 */

import { z } from "zod";
import { db } from "../../../db.js";
import { ObjectId } from "mongodb";
import cloudRunService from "../../cloudRun.js";

export const deployProjectTool = {
  definition: {
    name: "deploy_project",
    description: "Deploy a project to production. Use this when the user asks to deploy, publish, or push a project live.",
    parameters: {
      type: "object",
      properties: {
        projectIdentifier: {
          type: "string",
          description: "The project name, slug, or ID to deploy"
        },
        branch: {
          type: "string",
          description: "Git branch to deploy (optional, defaults to main)"
        }
      },
      required: ["projectIdentifier"]
    }
  },
  
  schema: z.object({
    projectIdentifier: z.string().describe("The project name, slug, or ID to deploy"),
    branch: z.string().optional().describe("Git branch to deploy")
  }),
  
  implementation: async (args, context) => {
    try {
      const { projectIdentifier, branch = "main" } = args;
      const { user, org } = context;
      
      if (!user || !org) {
        return {
          success: false,
          error: "Missing user or organization context"
        };
      }
      
      // Find the project by name, slug, or ID
      let project = null;
      
      // Try as ObjectId first
      if (ObjectId.isValid(projectIdentifier)) {
        project = await db.projects.findOne({
          _id: new ObjectId(projectIdentifier),
          orgId: org._id
        });
      }
      
      // Try by slug
      if (!project) {
        project = await db.projects.findOne({
          slug: projectIdentifier,
          orgId: org._id
        });
      }
      
      // Try by name (case insensitive)
      if (!project) {
        project = await db.projects.findOne({
          name: { $regex: new RegExp(`^${projectIdentifier}$`, 'i') },
          orgId: org._id
        });
      }
      
      if (!project) {
        // List available projects to help the user
        const projects = await db.projects.find({ orgId: org._id })
          .limit(10)
          .toArray();
          
        const projectList = projects.map(p => `- ${p.name} (${p.slug})`).join('\n');
        
        return {
          success: false,
          error: `Project "${projectIdentifier}" not found. Available projects:\n${projectList}`
        };
      }
      
      // Check if user has permission to deploy
      const isOwner = project.ownerId === user._id.toString();
      const isCollaborator = project.collaborators?.some(
        c => c.userId === user._id.toString() && ['admin', 'editor'].includes(c.role)
      );
      
      if (!isOwner && !isCollaborator && !user.systemRole) {
        return {
          success: false,
          error: "You don't have permission to deploy this project"
        };
      }
      
      // Check if project has a GitHub repo
      if (!project.githubRepo) {
        return {
          success: false,
          error: `Project "${project.name}" doesn't have a GitHub repository connected. Please connect a repository first.`
        };
      }
      
      // Create the deployment job
      console.log(`🚀 Creating deployment job for project ${project.name} (${project._id})`);
      
      const jobResult = await cloudRunService.createRepoDeployJob({
        projectId: project._id.toString(),
        branch,
        triggeredBy: user.email || user.name || 'Slack User',
        commitId: null, // Will use latest commit
        commitMessage: `Deploy ${branch} branch via Slack`
      });
      
      if (!jobResult.success) {
        return {
          success: false,
          error: jobResult.error || "Failed to create deployment job"
        };
      }
      
      return {
        success: true,
        message: `🚀 Deployment started for project **${project.name}**\n\n` +
                 `- Branch: ${branch}\n` +
                 `- Job ID: ${jobResult.jobId}\n` +
                 `- Repository: ${project.githubRepo}\n\n` +
                 `Check the #bot-updates channel for deployment progress.`,
        data: {
          projectId: project._id.toString(),
          projectName: project.name,
          jobId: jobResult.jobId,
          branch
        }
      };
      
    } catch (error) {
      console.error('Error in deploy_project tool:', error);
      return {
        success: false,
        error: `Deployment failed: ${error.message}`
      };
    }
  },
  
  category: "project_management",
  requiredContext: ["user", "org"]
};

export default deployProjectTool;