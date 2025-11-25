import { TRPCError } from "@trpc/server";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { router, procedure } from "../lib/trpc/trpc.js";
import { protectedProcedure, adminProcedure } from "../lib/trpc/procedures.js";
import { db, traceCollections, COLLECTIONS } from "../db.js";

/**
 * Extends the existing adminRoutes with new database management functions
 */
export const adminDbRoutes = {
  // Get all collection names
  getAllCollections: adminProcedure.query(async ({ ctx }) => {
    try {
      return {
        success: true,
        collections: COLLECTIONS,
      };
    } catch (error) {
      console.error("Error getting collections:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to fetch collections",
      });
    }
  }),

  // Get collection statistics
  getCollectionStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const stats = await Promise.all(
        COLLECTIONS.map(async (name) => {
          const collection = db[name];
          const count = await collection.countDocuments();
          return {
            name,
            count,
            timestamp: new Date().toISOString(),
          };
        })
      );

      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error("Error getting collection stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to fetch collection statistics",
      });
    }
  }),

  // Get documents from a specific collection with pagination
  getCollectionData: adminProcedure
    .input(
      z.object({
        collectionName: z.string(),
        page: z.number().default(1),
        limit: z.number().default(20),
        filter: z.record(z.any()).optional(),
        sort: z.record(z.number()).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const {
          collectionName,
          page,
          limit,
          filter = {},
          sort = { _id: -1 },
        } = input;

        if (!COLLECTIONS.includes(collectionName)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Collection '${collectionName}' does not exist`,
          });
        }

        const skip = (page - 1) * limit;
        const collection = db[collectionName];

        const documents = await collection
          .find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .toArray();

        const totalDocuments = await collection.countDocuments(filter);
        const totalPages = Math.ceil(totalDocuments / limit);

        return {
          success: true,
          data: documents,
          pagination: {
            total: totalDocuments,
            page,
            limit,
            pages: totalPages,
          },
        };
      } catch (error) {
        console.error(
          `Error getting documents from ${input.collectionName}:`,
          error
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error.message ||
            `Failed to fetch documents from ${input.collectionName}`,
        });
      }
    }),

  // Get a single document by ID
  getDocumentById: adminProcedure
    .input(
      z.object({
        collectionName: z.string(),
        documentId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { collectionName, documentId } = input;

        if (!COLLECTIONS.includes(collectionName)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Collection '${collectionName}' does not exist`,
          });
        }

        const collection = db[collectionName];
        const document = await collection.findOne({
          _id: new (require("mongodb").ObjectId)(documentId),
        });

        if (!document) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Document with ID '${documentId}' not found in collection '${collectionName}'`,
          });
        }

        return {
          success: true,
          data: document,
        };
      } catch (error) {
        console.error(`Error getting document by ID:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || `Failed to fetch document by ID`,
        });
      }
    }),

  // Get configuration files
  getAllConfigFiles: adminProcedure.query(async ({ ctx }) => {
    try {
      const configDir = path.join(process.cwd(), "config");
      const dataDir = path.join(process.cwd(), "data");

      // Get all files from config directory
      const configFiles = await fs.readdir(configDir).catch(() => []);

      // Get all files from data directory
      const dataFiles = await fs.readdir(dataDir).catch(() => []);

      // Combine and format the results
      const allFiles = [
        ...configFiles.map((file) => ({ name: file, path: `config/${file}` })),
        ...dataFiles.map((file) => ({ name: file, path: `data/${file}` })),
      ];

      return {
        success: true,
        files: allFiles,
      };
    } catch (error) {
      console.error("Error listing config files:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to list configuration files",
      });
    }
  }),

  // Get content of a specific config file
  getConfigFileContent: adminProcedure
    .input(
      z.object({
        filePath: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { filePath } = input;
        // Security check to avoid directory traversal
        if (filePath.includes("..")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid file path",
          });
        }

        const fullPath = path.join(process.cwd(), filePath);

        // Check if file exists
        await fs.access(fullPath);

        // Read file content
        const content = await fs.readFile(fullPath, "utf8");

        // Determine content type for proper display
        const ext = path.extname(filePath).toLowerCase();
        let parsedContent = content;

        if (ext === ".json") {
          try {
            parsedContent = JSON.parse(content);
          } catch (e) {
            // If parsing fails, return as plain text
            console.warn("Failed to parse JSON file:", e);
          }
        }

        return {
          success: true,
          fileName: path.basename(filePath),
          filePath,
          content: parsedContent,
          contentType: ext.slice(1), // Remove the dot from extension
        };
      } catch (error) {
        console.error("Error reading config file:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to read configuration file",
        });
      }
    }),

  // Trace all collections (development helper)
  traceAllCollections: adminProcedure.query(async ({ ctx }) => {
    try {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Collection tracing is disabled in production",
        });
      }

      const stats = await traceCollections();

      return {
        success: true,
        message: "Collection statistics traced successfully",
        stats,
      };
    } catch (error) {
      console.error("Error tracing collections:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to trace collections",
      });
    }
  }),

  // Get database information
  getDatabaseInfo: adminProcedure.query(async ({ ctx }) => {
    try {
      // Get a reference to the database
      const database = db[COLLECTIONS[0]].s.db;

      // Get database stats
      const stats = await database.stats();

      // Get server status
      const serverStatus = await database.admin().serverStatus();

      return {
        success: true,
        name: database.databaseName,
        stats: {
          collections: stats.collections,
          views: stats.views,
          objects: stats.objects,
          avgObjSize: stats.avgObjSize,
          dataSize: stats.dataSize,
          storageSize: stats.storageSize,
          indexes: stats.indexes,
          indexSize: stats.indexSize,
        },
        server: {
          version: serverStatus.version,
          uptime: serverStatus.uptime,
          connections: serverStatus.connections,
        },
      };
    } catch (error) {
      console.error("Error getting database info:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Failed to get database information",
      });
    }
  }),
};
