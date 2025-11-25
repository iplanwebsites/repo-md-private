import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, procedure } from "../lib/trpc/trpc.js";
import { protectedProcedure } from "../lib/trpc/procedures.js";
import { db } from "../db.js";

export const accountRoutes = {
  // Get account settings for the logged-in user
  getAccountSettings: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get user ID from the context (provided by protectedProcedure)
      const userId = ctx.user.id; //that supa id

      // Fetch the user from the database
      const find = { id: userId };
      const user = await db.users.findOne(find);

      console.log("User found:", user, find);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      //todo sanitize.

      return {
        ctxUser: ctx.user,
        user: user,
        find,
      };
    } catch (error) {
      console.error("Error getting account settings:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to fetch account settings",
      });
    }
  }),

  // Update account settings for the logged-in user
  updateAccountSettings: protectedProcedure
    .input(
      z.object({
        // Define the fields that users are allowed to update
        name: z.string().optional(),
        // Removed email field to prevent updates to it
        profileImage: z.string().optional(),
        timezone: z.string().optional(),
        language: z.string().optional(),
        notificationPreferences: z
          .object({
            email: z.boolean().optional(),
            push: z.boolean().optional(),
            sms: z.boolean().optional(),
          })
          .optional(),
        // Add other fields as needed
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get user ID from the context
        const userId = ctx.user.id;
        const find = { id: userId };
        
        // Filter out undefined values to only update the fields that were provided
        const updateData = Object.fromEntries(
          Object.entries(input).filter(([_, value]) => value !== undefined)
        );
        
        // Ensure protected fields cannot be updated
        const protectedFields = ['_id', 'id', 'email'];
        protectedFields.forEach(field => {
          if (field in updateData) {
            delete updateData[field];
          }
        });

        // Update the user in the database
        const updateResult = await db.users.updateOne(find, {
          $set: updateData,
        });

        if (updateResult.matchedCount === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // Fetch the updated user to return
        const updatedUser = await db.users.findOne(find);
        //sanitize... todo

        return updatedUser;
      } catch (error) {
        console.error("Error updating account settings:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to update account settings",
        });
      }
    }),
};
