import { TRPCError } from "@trpc/server";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec as execCb } from "child_process";
import util from "util";
import { router, procedure } from "../lib/trpc/trpc.js";
import { protectedProcedure, adminProcedure } from "../lib/trpc/procedures.js";
import { createValidator } from "../lib/supaAuth.js";
import "dotenv/config";

// Add this flag at the top of the file after imports
const USE_SUBFOLDER_CLONES = true; // Set to true for development to use a relative folder

// Promisify exec for async/await usage
const exec = util.promisify(execCb);

import GitHubService from "../lib/githubService.js";

const GITHUB_TOKEN = process.env.TEMP_GH_TOKEN_FELIX;

// Function to get the GitHub token for a user
async function getUserGithubToken(userId) {
  try {
    // Import db
    const { db } = await import("../db.js");
    
    // Find user with the given ID
    const user = await db.users.findOne({ id: userId });
    
    // Check if user has a GitHub token
    if (user && user.githubSupaToken) {
      console.log(`Found GitHub token for user ${userId}`);
      return user.githubSupaToken;
    }
  } catch (error) {
    console.log(`Failed to get GitHub token from user record for user ${userId}:`, error.message);
    // If we can't get the token from user record, fall back to hardcoded token
  }
  
  // Fallback to environment token
  return process.env.GITHUB_ACCESS_TOKEN || GITHUB_TOKEN;
}

// Username to look up (change this to any GitHub username)
const TARGET_USERNAME = "iplanwebsites";

async function runDemo() {
  try {
    console.log("Initializing GitHub Service...");
    const isAuthenticated = GITHUB_TOKEN !== "YOUR_GITHUB_TOKEN";
    const authStatus = isAuthenticated
      ? "with authentication"
      : "WITHOUT authentication (limited access)";
    console.log(`Running ${authStatus}`);

    const githubService = new GitHubService(
      isAuthenticated ? GITHUB_TOKEN : null
    );

    // Example 1: Get repositories for a specific user
    console.log(
      "\n--- Example 1: Getting repositories for a specific user ---"
    );
    console.log(`Fetching repositories for user: ${TARGET_USERNAME}`);
    try {
      const userRepos = await githubService.getUserRepositories(
        TARGET_USERNAME,
        { per_page: 10 }
      );
      console.log(`Found ${userRepos.length} repositories:`);
      userRepos.forEach((repo, index) => {
        console.log(
          `${index + 1}. ${repo.full_name} - ${
            repo.description || "No description"
          }`
        );
        console.log(
          `   Language: ${repo.language || "None"}, Stars: ${
            repo.stargazers_count
          }, Forks: ${repo.forks_count}`
        );
        console.log(`   URL: ${repo.html_url}`);
      });
    } catch (error) {
      console.error(`❌ Failed to get repositories: ${error.message}`);
    }

    // Example 2: Get organizations for a specific user
    console.log(
      "\n--- Example 2: Getting organizations for a specific user ---"
    );
    console.log(`Fetching organizations for user: ${TARGET_USERNAME}`);
    try {
      const userOrgs = await githubService.getUserOrganizations(
        TARGET_USERNAME
      );
      console.log(`Found ${userOrgs.length} organizations:`);
      if (userOrgs.length === 0) {
        console.log(
          `   User ${TARGET_USERNAME} doesn't belong to any public organizations.`
        );
      } else {
        userOrgs.forEach((org, index) => {
          console.log(
            `${index + 1}. ${org.login} - ${
              org.description || "No description"
            }`
          );
          console.log(`   URL: ${org.url}`);
        });
      }
    } catch (error) {
      console.error(`❌ Failed to get organizations: ${error.message}`);
    }

    // Skip authenticated examples if no token provided
    if (!isAuthenticated) {
      console.log("\n⚠️ Skipping authenticated examples (no token provided)");
      console.log(
        "To use authenticated features, replace GITHUB_TOKEN with your personal access token."
      );
      return;
    }

    // Example 3: Get authenticated user's repositories
    console.log("\n--- Example 3: Getting your repositories ---");
    try {
      // Note: We're not specifying both 'type' and 'visibility' to avoid the 422 error
      const myRepos = await githubService.getMyRepositories({
        per_page: 5,
        affiliation: "owner,collaborator,organization_member",
      });
      console.log(`Found ${myRepos.length} of your repositories:`);
      myRepos.forEach((repo, index) => {
        console.log(
          `${index + 1}. ${repo.full_name} - ${
            repo.description || "No description"
          }`
        );
        console.log(
          `   Language: ${repo.language || "None"}, Stars: ${
            repo.stargazers_count
          }, Forks: ${repo.forks_count}`
        );
        console.log(`   URL: ${repo.html_url}`);
      });
    } catch (error) {
      console.error(`❌ Failed to get your repositories: ${error.message}`);
      console.log(
        "   This may be due to an invalid token or insufficient permissions."
      );
    }

    // Example 4: Get authenticated user's organizations
    console.log("\n--- Example 4: Getting your organizations ---");
    try {
      const myOrgs = await githubService.getMyOrganizations();
      console.log(`Found ${myOrgs.length} of your organizations:`);
      if (myOrgs.length === 0) {
        console.log("   You don't belong to any organizations.");
      } else {
        myOrgs.forEach((org, index) => {
          console.log(
            `${index + 1}. ${org.login} - ${
              org.description || "No description"
            }`
          );
          console.log(`   URL: ${org.url}`);
        });
      }
    } catch (error) {
      console.error(`❌ Failed to get your organizations: ${error.message}`);
      console.log(
        '   This usually requires a token with the "read:org" scope.'
      );
    }
  } catch (error) {
    console.error("Demo failed:", error.message);
  }
}

// Create a Supabase Integration service
class SupabaseIntegrationService {
  constructor() {
    this.validator = createValidator({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      enableCache: true,
      cacheTTL: 300,
    });
  }

  // Get the Supabase client from the validator
  get supabase() {
    return this.validator.supabase;
  }

  // Check if a user has GitHub integration set up
  async checkGithubIntegration(userId) {
    try {
      console.log(`Checking GitHub integration for user ID: ${userId}`);

      // Get user's GitHub integration from Supabase
      const { data, error } = await this.supabase
        .from("user_integrations")
        .select("token_data")
        .eq("user_id", userId)
        .eq("provider", "github")
        .single();

      console.log(
        `GitHub integration query results - data:`,
        data,
        `error:`,
        error
      );

      if (error || !data || !data.token_data?.access_token) {
        console.log(`No GitHub integration found for user ID: ${userId}`);
        return null;
      }

      console.log(`GitHub integration found for user ID: ${userId}`);
      return data.token_data;
    } catch (error) {
      console.error(
        `Error checking GitHub integration for user ID ${userId}:`,
        error
      );
      return null;
    }
  }

  // Get GitHub token for a user
  async getGithubToken(userId) {
    const tokenData = await this.checkGithubIntegration(userId);

    if (!tokenData || !tokenData.access_token) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "GitHub integration not found for this user",
      });
    }

    return tokenData.access_token;
  }

  // Add or update GitHub integration
  async addGithubIntegration(userId, accessToken, integrationId) {
    try {
      console.log(`Adding GitHub integration for user ID: ${userId}`);

      const tokenData = {
        access_token: accessToken,
        scope: "repo,user",
        created_at: new Date().toISOString(),
      };

      // Check if integration already exists
      const { data: existingIntegration } = await this.supabase
        .from("user_integrations")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", "github")
        .single();

      let result;

      if (existingIntegration) {
        // Update existing integration
        result = await this.supabase
          .from("user_integrations")
          .update({ token_data: tokenData })
          .eq("id", existingIntegration.id)
          .select()
          .single();
      } else {
        // Create new integration
        result = await this.supabase
          .from("user_integrations")
          .insert({
            user_id: userId,
            provider: "github",
            provider_user_id: integrationId || `github_${Date.now()}`,
            token_data: tokenData,
          })
          .select()
          .single();
      }

      return {
        success: true,
        message: "GitHub integration created/updated successfully",
        integration: result.data,
      };
    } catch (error) {
      console.error("Error adding GitHub integration:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to add GitHub integration",
      });
    }
  }
}

// Create a singleton instance
const integrationService = new SupabaseIntegrationService();

// GitHub route implementations
const githubRoutes = {
  // Check if user has GitHub integration set up
  checkIntegration: protectedProcedure.query(async ({ ctx }) => {
    // return true;
    try {
      return {
        success: true,
        isIntegrated: true,
        //  setupUrl,
      };
    } catch (error) {
      console.error("Error checking GitHub integration:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to check GitHub integration status",
      });
    }
  }),

  // Get user's GitHub profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    try {
      console.log(`Getting GitHub profile for user:`, ctx.user);
      const token = await getUserGithubToken(ctx.user.id);
      console.log(`Retrieved GitHub token for user ID ${ctx.user.id}`);

      // Create a GitHub service instance and use it to get the authenticated user
      const githubService = new GitHubService(token);

      try {
        // Get the authenticated user using Octokit
        const { data: profile } = await githubService.octokit.request(
          "GET /user"
        );
        console.log(`GitHub profile retrieved successfully:`, profile.login);

        return {
          success: true,
          profile,
        };
      } catch (error) {
        console.error(`GitHub API error:`, error);
        throw new Error(`GitHub API error: ${error.message}`);
      }
    } catch (error) {
      console.error("Error getting GitHub profile:", error);
      console.log(`Full error details:`, error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to fetch GitHub profile",
      });
    }
  }),

  // List all repositories for the user
  listRepositories: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get token using the user-specific function
      const token = await getUserGithubToken(ctx.user.id);
      const githubService = new GitHubService(token);

      // Use GitHubService to list repositories
      const repositories = await githubService.getMyRepositories({
        sort: "updated",
        per_page: 300,
      });

      return {
        success: true,
        repositories,
      };
    } catch (error) {
      console.error("Error listing GitHub repositories:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to list GitHub repositories",
      });
    }
  }),

  // Clone a repository to a temporary directory using CloudRun service
  cloneRepository: protectedProcedure
    .input(
      z.object({
        repoName: z.string(),
        owner: z.string(),
        orgId: z.string(),
        projectName: z.string().optional(),
        projectSlug: z.string().optional(),
        projectDescription: z.string().optional(),
        visibility: z.enum(["public", "private"]).optional().default("private"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.user.id;
        const token = await getUserGithubToken(userId);
        
        // Submit CloudRun job to clone repository
        const { submitRepoCloneJob } = await import("../lib/cloudRun.js");
        
        const job = await submitRepoCloneJob({
          ...input,
          token,
        }, userId);
        
        console.log(`🔍 CloudRun job submitted for cloning ${input.owner}/${input.repoName}: ${job._id}`);

        return {
          success: true,
          message: `Repository clone job submitted for ${input.owner}/${input.repoName}`,
          jobId: job._id,
          projectId: job.projectId,
        };
      } catch (error) {
        console.error("❌ Error submitting repository clone job:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to submit repository clone job",
        });
      }
    }),

  // Update (pull) a repository
  updateRepository: protectedProcedure
    .input(
      z.object({
        repoPath: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { repoPath } = input;

        // Verify the repo path exists
        try {
          await fs.access(repoPath);
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Repository path does not exist",
          });
        }

        // Pull the latest changes
        await exec("git pull", { cwd: repoPath });

        return {
          success: true,
          message: `Repository updated successfully`,
        };
      } catch (error) {
        console.error("Error updating repository:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to update repository",
        });
      }
    }),

  // Get repository contents
  getRepositoryContents: protectedProcedure
    .input(
      z.object({
        repoPath: z.string(),
        filePath: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { repoPath, filePath = "" } = input;
        const fullPath = path.join(repoPath, filePath);

        // Verify the path exists
        try {
          await fs.access(fullPath);
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Path does not exist in repository",
          });
        }

        // Get stats to determine if it's a file or directory
        const stats = await fs.stat(fullPath);

        if (stats.isFile()) {
          // Read file contents
          const content = await fs.readFile(fullPath, "utf8");
          return {
            success: true,
            type: "file",
            content,
          };
        } else if (stats.isDirectory()) {
          // List directory contents
          const items = await fs.readdir(fullPath);
          const contents = await Promise.all(
            items.map(async (item) => {
              const itemPath = path.join(fullPath, item);
              const itemStats = await fs.stat(itemPath);
              return {
                name: item,
                type: itemStats.isDirectory() ? "dir" : "file",
                size: itemStats.size,
                modified: itemStats.mtime,
              };
            })
          );

          return {
            success: true,
            type: "directory",
            contents,
          };
        }
      } catch (error) {
        console.error("Error getting repository contents:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get repository contents",
        });
      }
    }),
};

// Add route to list organizations (namespaces)
githubRoutes.listOrganizations = protectedProcedure.query(async ({ ctx }) => {
  try {
    // Get token using the user-specific function
    const token = await getUserGithubToken(ctx.user.id);
    const githubService = new GitHubService(token);

    // Use GitHubService to list organizations
    const organizations = await githubService.getMyOrganizations();

    return {
      success: true,
      organizations,
    };
  } catch (error) {
    console.error("Error listing GitHub organizations:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message || "Failed to list GitHub organizations",
    });
  }
});

// Add route to list repositories for a specified user
githubRoutes.listUserRepositories = protectedProcedure
  .input(
    z.object({
      username: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    try {
      // Get token using the user-specific function
      const token = await getUserGithubToken(ctx.user.id);
      const githubService = new GitHubService(token);

      // Use GitHubService to list repositories for specified user
      const repositories = await githubService.getUserRepositories(
        input.username,
        {
          sort: "updated",
          per_page: 100,
        }
      );

      return {
        success: true,
        repositories,
      };
    } catch (error) {
      console.error(
        `Error listing repositories for user ${input.username}:`,
        error
      );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error.message ||
          `Failed to list repositories for user ${input.username}`,
      });
    }
  });

// Add route to list organizations for a specified user
githubRoutes.listUserOrganizations = protectedProcedure
  .input(
    z.object({
      username: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    try {
      // Get token using the user-specific function
      const token = await getUserGithubToken(ctx.user.id);
      const githubService = new GitHubService(token);

      // Use GitHubService to list organizations for specified user
      const organizations = await githubService.getUserOrganizations(
        input.username
      );

      return {
        success: true,
        organizations,
      };
    } catch (error) {
      console.error(
        `Error listing organizations for user ${input.username}:`,
        error
      );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error.message ||
          `Failed to list organizations for user ${input.username}`,
      });
    }
  });

// Add route to handle GitHub sign-in sessions
githubRoutes.handleGithubSignIn = protectedProcedure
  .input(
    z.object({
      provider_token: z.string().optional(),
      user: z.object({
        identities: z.array(z.any()).optional(),
      }).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    try {
      console.log("🔑 Processing GitHub sign-in session:", input);
      const { provider_token, user: sessionUser } = input;

      // Check if we have a fresh GitHub sign-in
      if (!provider_token) {
        // LETS INSERT IF NOT NEW GUY!
        console.log("ℹ️ No provider token - not a fresh GitHub login");
        
        return {
          success: true,
          isNewSignIn: false,
          message: "xxx No GitHub provider token sent via handleGithubSignIn",
        };
      }

      console.log("🎉 Found GitHub provider token - processing fresh login");
      
      // Prepare user data with identities if available
      const userData = {
        ...ctx.user,
        // Include identities from session user if available
        identities: sessionUser?.identities || ctx.user.identities,
      };
      
      console.log(`👤 User data prepared for registration: ${userData.email}`);

      // Register the GitHub user with the provider token
      const githubService = new GitHubService();
      const user = await githubService.registerGithubUser(
        provider_token,
        userData
      );
      
      console.log(`✅ GitHub user registered successfully: ${user.email} (${user.githubHandle})`);

      return {
        success: true,
        isNewSignIn: true,
        user,
        message: "GitHub user registered successfully",
      };
    } catch (error) {
      console.error("❌ Error handling GitHub sign-in:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to handle GitHub sign-in",
      });
    }
  });

// Add route to save GitHub Supabase provider token for current user
githubRoutes.saveGithubSupaProviderToken = protectedProcedure
  .input(z.string())
  .mutation(async ({ input, ctx }) => {
    try {
      console.log(`🔑 Saving GitHub Supabase provider token for user ID: ${ctx.user.id}`);
      
      // Import db
      const { db } = await import("../db.js");
      
      // Find user and update with the new GitHub token
      const find = { id: ctx.user.id };
      const updateResult = await db.users.updateOne(find, {
        $set: {
          githubSupaToken: input,
          githubSupaTokenUpdatedAt: new Date().toISOString(),
        }
      });
      
      if (updateResult.matchedCount === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      
      console.log(`✅ GitHub Supabase provider token saved successfully for user: ${ctx.user.email}`);
      
      // Fetch the updated user to return
      const updatedUser = await db.users.findOne(find);
      
      return {
        success: true,
        message: "GitHub Supabase provider token saved successfully",
        user: updatedUser
      };
    } catch (error) {
      console.error("❌ Error saving GitHub Supabase provider token:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to save GitHub Supabase provider token",
      });
    }
  });

// Add route to get GitHub token for current user
githubRoutes.getGithubToken = protectedProcedure.query(async ({ ctx }) => {
  try {
    console.log(`🔑 Retrieving GitHub token for user ID: ${ctx.user.id}`);
    
    const token = await getUserGithubToken(ctx.user.id);
    
    if (!token) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No GitHub token found for this user",
      });
    }
    
    // Check if it's the user's personal token or a fallback token
    const { db } = await import("../db.js");
    const user = await db.users.findOne({ id: ctx.user.id });
    const hasPersonalToken = !!(user && user.githubSupaToken);
    
    return {
      success: true,
      token,
      hasPersonalToken,
      tokenUpdatedAt: user?.githubSupaTokenUpdatedAt || null,
    };
  } catch (error) {
    console.error("❌ Error retrieving GitHub token:", error);
    throw new TRPCError({
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "Failed to retrieve GitHub token",
    });
  }
});

// Export the router with all GitHub routes
export const githubRouter = router({
  checkIntegration: githubRoutes.checkIntegration,
  getProfile: githubRoutes.getProfile,
  listRepositories: githubRoutes.listRepositories,
  listOrganizations: githubRoutes.listOrganizations,
  listUserRepositories: githubRoutes.listUserRepositories,
  listUserOrganizations: githubRoutes.listUserOrganizations,
  cloneRepository: githubRoutes.cloneRepository,
  updateRepository: githubRoutes.updateRepository,
  getRepositoryContents: githubRoutes.getRepositoryContents,
  handleGithubSignIn: githubRoutes.handleGithubSignIn,
  saveGithubSupaProviderToken: githubRoutes.saveGithubSupaProviderToken,
  getGithubToken: githubRoutes.getGithubToken,
});
