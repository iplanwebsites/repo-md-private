import { TRPCError } from "@trpc/server";
import { z } from "zod";
import chalk from "chalk";
import { router, procedure } from "../../lib/trpc/trpc.js";
import {
  protectedProcedure,
  adminProcedure,
  patientProcedure,
} from "../../lib/trpc/procedures.js";
import MemoryManager from "../../lib/chat/patientMemory.js";

// Input validation schemas for memory operations
const patientIdSchema = z.object({
  patientId: z.string(),
});

const memoryContentSchema = z.object({
  patientId: z.string(),
  content: z.string(),
});

const memoryAppendSchema = z.object({
  patientId: z.string(),
  content: z.string(),
});

const memorySearchSchema = z.object({
  patientId: z.string(),
  searchTerm: z.string(),
});

const memoryQuestionSchema = z.object({
  patientId: z.string(),
  question: z.string(),
});

const memoryTranscriptSchema = z.object({
  patientId: z.string(),
  transcript: z.string(),
});

const memoryActivitySchema = z.object({
  patientId: z.string(),
  report: z.string(),
});

export const patientMemoryRoutes = {
  // Get the patient's memory
  getMemory: patientProcedure.input(patientIdSchema).query(async ({ ctx }) => {
    try {
      // Pass the entire patient object rather than just the ID
      const memoryManager = new MemoryManager(ctx.patient);
      const memory = await memoryManager.getMemory();

      return {
        success: true,
        memory,
        lastUpdated: ctx.patient.memoryUpdated || null,
        updatedBy: ctx.patient.memoryUpdatedBy || "system",
      };
    } catch (error) {
      console.error(chalk.red("Error getting patient memory:"), error);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: error.message || "Failed to get patient memory",
      });
    }
  }),

  // Set the patient's memory (replace completely)
  setMemory: patientProcedure
    .input(memoryContentSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Pass the entire patient object
        const memoryManager = new MemoryManager(ctx.patient);
        const result = await memoryManager.setMemory(input.content);

        if (!result.success) {
          throw new Error(result.message);
        }

        return {
          success: true,
          message: "Memory updated successfully",
          lastUpdated: new Date(),
        };
      } catch (error) {
        console.error(chalk.red("Error setting patient memory:"), error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to set patient memory",
        });
      }
    }),

  // Append content to the patient's memory
  appendMemory: patientProcedure
    .input(memoryAppendSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Pass the entire patient object
        const memoryManager = new MemoryManager(ctx.patient);
        const result = await memoryManager.appendMemory(input.content);

        return {
          success: true,
          message: "Content appended to memory successfully",
        };
      } catch (error) {
        console.error(chalk.red("Error appending to patient memory:"), error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to append to patient memory",
        });
      }
    }),

  // Compact the patient's memory
  compactMemory: patientProcedure
    .input(patientIdSchema)
    .mutation(async ({ ctx }) => {
      try {
        // Pass the entire patient object
        const memoryManager = new MemoryManager(ctx.patient);
        const result = await memoryManager.compactMemory();

        return {
          success: true,
          compactionResult: result,
        };
      } catch (error) {
        console.error(chalk.red("Error compacting patient memory:"), error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to compact patient memory",
        });
      }
    }),

  // Summarize the patient's memory
  summarizeMemory: patientProcedure
    .input(patientIdSchema)
    .query(async ({ ctx }) => {
      try {
        // Pass the entire patient object
        const memoryManager = new MemoryManager(ctx.patient);
        const summary = await memoryManager.summarizeMemory();

        return {
          success: true,
          summary,
        };
      } catch (error) {
        console.error(chalk.red("Error summarizing patient memory:"), error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to summarize patient memory",
        });
      }
    }),

  // Search within the patient's memory
  searchMemory: patientProcedure
    .input(memorySearchSchema)
    .query(async ({ input, ctx }) => {
      try {
        // Pass the entire patient object
        const memoryManager = new MemoryManager(ctx.patient);
        const results = await memoryManager.searchMemory(input.searchTerm);

        return {
          success: true,
          results,
        };
      } catch (error) {
        console.error(chalk.red("Error searching patient memory:"), error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to search patient memory",
        });
      }
    }),

  // Ask a question about the patient's memory
  askMemoryQuestion: patientProcedure
    .input(memoryQuestionSchema)
    .query(async ({ input, ctx }) => {
      try {
        // Pass the entire patient object
        const memoryManager = new MemoryManager(ctx.patient);
        const answer = await memoryManager.askQuestion(input.question);

        return {
          success: true,
          answer,
        };
      } catch (error) {
        console.error(
          chalk.red("Error asking question about patient memory:"),
          error
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to process memory question",
        });
      }
    }),

  // Retrieve related memories based on context
  getRelatedMemories: patientProcedure
    .input(
      z.object({
        patientId: z.string(),
        context: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // Pass the entire patient object
        const memoryManager = new MemoryManager(ctx.patient);
        const relatedMemories = await memoryManager.retrieveRelatedMemories(
          input.context
        );

        return {
          success: true,
          relatedMemories,
        };
      } catch (error) {
        console.error(chalk.red("Error retrieving related memories:"), error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to retrieve related memories",
        });
      }
    }),

  // Ingest meeting transcript
  ingestMeetingTranscript: patientProcedure
    .input(memoryTranscriptSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Pass the entire patient object
        const memoryManager = new MemoryManager(ctx.patient);
        const result = await memoryManager.ingestMeetingTranscript(
          input.transcript
        );

        if (!result.success) {
          throw new Error(result.message);
        }

        return {
          success: true,
          message: result.message,
          addedContent: result.addedContent,
        };
      } catch (error) {
        console.error(chalk.red("Error ingesting meeting transcript:"), error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to ingest meeting transcript",
        });
      }
    }),

  // Ingest activity analysis
  ingestActivityAnalysis: patientProcedure
    .input(memoryActivitySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Pass the entire patient object
        const memoryManager = new MemoryManager(ctx.patient);
        const result = await memoryManager.ingestActivityAnalysis(input.report);

        if (!result.success) {
          throw new Error(result.message);
        }

        return {
          success: true,
          message: result.message,
          addedContent: result.addedContent,
        };
      } catch (error) {
        console.error(chalk.red("Error ingesting activity analysis:"), error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to ingest activity analysis",
        });
      }
    }),
};
