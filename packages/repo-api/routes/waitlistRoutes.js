import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, procedure } from "../lib/trpc/trpc.js";
import { protectedProcedure, adminProcedure } from "../lib/trpc/procedures.js";
import { db } from "../db.js";

// Define rate limiting for waitlist submissions
const RATE_LIMIT = {
  MAX_REQUESTS: 5, // Maximum number of waitlist submission attempts
  WINDOW_MS: 3600000, // Time window in milliseconds (1 hour)
};

// Helper function to check rate limit by IP address
async function checkRateLimit(ip) {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - RATE_LIMIT.WINDOW_MS);

  // Count submissions from this IP in the last hour
  const count = await db.waitlist.countDocuments({
    ipAddress: ip,
    createdAt: { $gte: hourAgo },
  });

  return count < RATE_LIMIT.MAX_REQUESTS;
}

// Define the waitlist router
export const waitlistRouter = router({
  // Public route: Add a new entry to the waitlist
  add: procedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        name: z.string().optional(),
        company: z.string().optional(),
        useCases: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get the IP address from the request
        const ip =
          ctx.req.headers["x-forwarded-for"] ||
          ctx.req.connection.remoteAddress;

        // Check rate limit
        const withinRateLimit = await checkRateLimit(ip);
        if (!withinRateLimit) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Rate limit exceeded. Please try again later.",
          });
        }

        // Check if email already exists in waitlist
        const existing = await db.waitlist.findOne({ email: input.email });
        if (existing) {
          // Return success but don't create duplicate entry
          return {
            success: true,
            message: "You're already on the waitlist!",
          };
        }

        // Create new waitlist entry
        const waitlistEntry = {
          id: crypto.randomUUID(), // Generate a UUID
          email: input.email,
          name: input.name || "",
          company: input.company || "",
          useCases: input.useCases || [],
          createdAt: new Date(),
          invited: false,
          invitedOn: null,
          notes: "",
          ipAddress: ip, // Store IP for rate limiting
        };

        await db.waitlist.insertOne(waitlistEntry);

        return {
          success: true,
          message: "Successfully added to waitlist!",
        };
      } catch (error) {
        console.error("Error adding to waitlist:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add to waitlist",
        });
      }
    }),

  // Admin-only: Get all waitlist entries
  getAll: adminProcedure.query(async () => {
    try {
      // Fetch all entries, sort by creation date (newest first)
      const entries = await db.waitlist
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      // Strip IP addresses before sending to client
      const sanitizedEntries = entries.map((entry) => {
        const { ipAddress, ...rest } = entry;
        return rest;
      });

      return sanitizedEntries;
    } catch (error) {
      console.error("Error getting waitlist entries:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve waitlist entries",
      });
    }
  }),

  // Admin-only: Mark a user as invited
  invite: adminProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { id } = input;

        // TODO: Send invitation email here

        // Update the waitlist entry
        const result = await db.waitlist.updateOne(
          { id },
          {
            $set: {
              invited: true,
              invitedOn: new Date(),
            },
          }
        );

        if (result.matchedCount === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Waitlist entry not found",
          });
        }

        // Return the updated entry
        const updatedEntry = await db.waitlist.findOne({ id });

        // Strip IP address
        const { ipAddress, ...sanitizedEntry } = updatedEntry;

        return sanitizedEntry;
      } catch (error) {
        console.error("Error marking user as invited:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update waitlist entry",
        });
      }
    }),

  // Admin-only: Update notes on a waitlist entry
  updateNotes: adminProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { id, notes } = input;

        // Update the notes field
        const result = await db.waitlist.updateOne({ id }, { $set: { notes } });

        if (result.matchedCount === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Waitlist entry not found",
          });
        }

        // Return the updated entry
        const updatedEntry = await db.waitlist.findOne({ id });

        // Strip IP address
        const { ipAddress, ...sanitizedEntry } = updatedEntry;

        return sanitizedEntry;
      } catch (error) {
        console.error("Error updating notes:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update waitlist notes",
        });
      }
    }),
});

// Export the routes in the same format as stripeRoutes
export const waitlistRoutes = {
  waitlist: waitlistRouter,
};
