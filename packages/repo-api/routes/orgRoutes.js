import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, procedure } from "../lib/trpc/trpc.js";
import { protectedProcedure, adminProcedure } from "../lib/trpc/procedures.js";
import { db } from "../db.js";

// Organization route implementations
const orgRoutes = {
  // Get all organizations for a user
  listOrgs: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Find all organizations where the user is either owner or member
      const orgs = await db.orgs
        .find({
          $or: [
            { owner: ctx.user.id },
            { members: { $elemMatch: { userId: ctx.user.id } } },
          ],
        })
        .toArray();

      return {
        success: true,
        orgs,
      };
    } catch (error) {
      console.error("Error listing organizations:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to list organizations",
      });
    }
  }),

  // Get a single organization by ID
  getOrg: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { orgId } = input;

        // Get the organization and verify user access
        const org = await db.orgs.findOne({ handle: orgId });

        if (!org) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        // Check if user is owner or member of the organization
        const hasAccess =
          org.owner === ctx.user.id ||
          (org.members &&
            org.members.some((member) => member.userId === ctx.user.id));

        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this organization",
          });
        }

        return {
          success: true,
          org,
        };
      } catch (error) {
        console.error("Error getting organization:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to get organization",
        });
      }
    }),

  // Create a new organization
  createOrg: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        handle: z
          .string()
          .min(1, "Handle is required")
          .regex(
            /^[a-z0-9-]+$/,
            "Handle must contain only lowercase letters, numbers, and hyphens"
          ),
        description: z.string().optional(),
        isPersonal: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { name, handle, description, isPersonal = false } = input;

        // Check if handle is already taken
        const existingOrg = await db.orgs.findOne({ handle });
        if (existingOrg) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Organization handle already exists",
          });
        }

        // Create the organization
        const newOrg = {
          name,
          handle,
          description,
          created_at: new Date(),
          updated_at: new Date(),
          owner: ctx.user.id,
          is_personal: isPersonal,
          members: [], // Initially just the owner
          settings: {
            default_visibility: "private",
          },
        };

        const result = await db.orgs.insertOne(newOrg);

        return {
          success: true,
          message: "Organization created successfully",
          org: {
            ...newOrg,
            _id: result.insertedId,
          },
        };
      } catch (error) {
        console.error("Error creating organization:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create organization",
        });
      }
    }),

  // Update an organization
  updateOrg: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        updates: z.object({
          name: z.string().min(1, "Name is required").optional(),
          description: z.string().optional(),
          settings: z.object({}).passthrough().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { orgId, updates } = input;

        // Verify ownership
        const org = await db.orgs.findOne({ _id: orgId });

        if (!org) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        if (org.owner !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the organization owner can update it",
          });
        }

        // Prepare updates
        const updateData = {
          ...updates,
          updated_at: new Date(),
        };

        // Update the organization
        await db.orgs.updateOne({ _id: orgId }, { $set: updateData });

        return {
          success: true,
          message: "Organization updated successfully",
        };
      } catch (error) {
        console.error("Error updating organization:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to update organization",
        });
      }
    }),

  // Add a member to an organization
  addOrgMember: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        userEmail: z.string().email("Invalid email address"),
        role: z.enum(["admin", "member", "viewer"]).default("member"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { orgId, userEmail, role } = input;

        // Verify ownership
        const org = await db.orgs.findOne({ _id: orgId });

        if (!org) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        if (org.owner !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the organization owner can add members",
          });
        }

        // Find the user to add
        const user = await db.users.findOne({ email: userEmail });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // Check if user is already a member
        if (
          org.members &&
          org.members.some((member) => member.userId === user.id)
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User is already a member of this organization",
          });
        }

        // Add the user to the organization
        await db.orgs.updateOne(
          { _id: orgId },
          {
            $push: {
              members: {
                userId: user.id,
                role,
                added_at: new Date(),
              },
            },
            $set: { updated_at: new Date() },
          }
        );

        return {
          success: true,
          message: "Member added successfully",
        };
      } catch (error) {
        console.error("Error adding organization member:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to add member to organization",
        });
      }
    }),

  // Remove a member from an organization
  removeOrgMember: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { orgId, userId } = input;

        // Verify ownership
        const org = await db.orgs.findOne({ _id: orgId });

        if (!org) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        if (org.owner !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the organization owner can remove members",
          });
        }

        // Prevent removing the owner
        if (userId === org.owner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the organization owner",
          });
        }

        // Remove the user from the organization
        await db.orgs.updateOne(
          { _id: orgId },
          {
            $pull: { members: { userId } },
            $set: { updated_at: new Date() },
          }
        );

        return {
          success: true,
          message: "Member removed successfully",
        };
      } catch (error) {
        console.error("Error removing organization member:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to remove member from organization",
        });
      }
    }),

  // Delete an organization
  deleteOrg: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { orgId } = input;

        // Verify ownership
        const org = await db.orgs.findOne({ _id: orgId });

        if (!org) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        if (org.owner !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the organization owner can delete it",
          });
        }

        // Check if this is a personal organization (optional: prevent deletion of personal orgs)
        if (org.is_personal) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete your personal organization",
          });
        }

        // Delete the organization
        await db.orgs.deleteOne({ _id: orgId });

        // Optionally: Delete all projects belonging to this organization or move them elsewhere
        await db.projects.deleteMany({ orgId });

        return {
          success: true,
          message: "Organization deleted successfully",
        };
      } catch (error) {
        console.error("Error deleting organization:", error);
        throw new TRPCError({
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to delete organization",
        });
      }
    }),
};

// Export the router with all organization routes
export const orgRouter = router({
  list: orgRoutes.listOrgs,
  get: orgRoutes.getOrg,
  create: orgRoutes.createOrg,
  update: orgRoutes.updateOrg,
  addMember: orgRoutes.addOrgMember,
  removeMember: orgRoutes.removeOrgMember,
  delete: orgRoutes.deleteOrg,
});
