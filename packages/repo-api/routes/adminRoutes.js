import { TRPCError } from "@trpc/server";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { router, procedure } from "../lib/trpc/trpc.js";
import {
  protectedProcedure,
  adminProcedure,
  editorProcedure,
} from "../lib/trpc/procedures.js";
import User from "../models/userModel.js";

export const adminRoutes = {
  // Get all media data from JSON file
  getAllMedias: editorProcedure.query(async ({ ctx }) => {
    try {
      // Read the JSON file
      const raw = await fs.readFile(
        path.join(process.cwd(), "data", "media-results.json"),
        "utf8"
      );

      // Parse the JSON data
      const parsedData = JSON.parse(raw);
      console.log("Parsed media data:", parsedData, 6668844);
      //print keys
      console.log(Object.keys(parsedData), 6668844);
      //[ 'mediaData', 'mediaPathMap' ]
      const { mediaData, mediaPathMap } = parsedData;
      console.log(mediaData);
      /*
       [ {
    originalPath: 'assets/img/Images-illustrations/Illustration-PushMD-49.png',
    fileName: 'Illustration-PushMD-49.png',
    fileExt: 'png',
    mimeType: 'image/png',
    sizes: { sm: [Array] },
    metadata: {
      size: 13344550,
      width: 3992,
      height: 3007,
      format: 'png',
      exif: [Object]
    }]
  },
  */
      return mediaData;
      return parsedData;
      // Optionally remove sensitive prompts if needed
      const sanitizedData = parsedData.map((item) => {
        // Create a copy without the prompt field if you want to omit it
        const { prompt, ...rest } = item;
        return rest;
      });

      return {
        success: true,
        medias: sanitizedData,
      };
    } catch (error) {
      console.error("Error getting media data:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to fetch media data",
      });
    }
  }),

  // Get all users (dummy route)
  getAllUsers: adminProcedure.query(async ({ ctx }) => {
    try {
      // Fetch all users from the database
      const users = await User.find({})
        .select("-password") // Exclude password field
        .lean();

      return {
        success: true,
        users,
      };
    } catch (error) {
      console.error("Error getting users:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to fetch users",
      });
    }
  }),

  // Get all configuration settings (dummy route)
  getAllConfigs: adminProcedure.query(async ({ ctx }) => {
    try {
      // Dummy config data - in a real application, this would be fetched from a database
      const configs = [
        {
          id: "1",
          key: "system.maintenance",
          value: "false",
          description: "System maintenance mode",
        },
        {
          id: "2",
          key: "system.version",
          value: "1.0.0",
          description: "Current system version",
        },
        {
          id: "3",
          key: "notification.enabled",
          value: "true",
          description: "Enable system notifications",
        },
        {
          id: "4",
          key: "api.throttling",
          value: "100",
          description: "API calls per minute",
        },
      ];

      return {
        success: true,
        configs,
      };
    } catch (error) {
      console.error("Error getting config data:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to fetch configuration data",
      });
    }
  }),

  // Update configuration (dummy route)
  updateConfig: adminProcedure
    .input(
      z.object({
        configId: z.string(),
        value: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // In a real application, this would update a database record

        return {
          success: true,
          message: `Configuration ${input.configId} updated successfully`,
        };
      } catch (error) {
        console.error("Error updating config:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to update configuration",
        });
      }
    }),

  // Get system statistics (dummy route)
  getSystemStats: adminProcedure.query(async ({ ctx }) => {
    try {
      // Dummy statistics data
      const stats = {
        totalUsers: 120,
        activeUsers: 87,
        totalMeetings: 342,
        completedMeetings: 215,
        averageMeetingDuration: 45, // minutes
        systemUptime: "99.8%",
        storageUsed: "12.4 GB",
        lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      };

      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error("Error getting system stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to fetch system statistics",
      });
    }
  }),
};
