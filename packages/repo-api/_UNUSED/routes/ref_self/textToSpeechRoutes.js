import { TRPCError } from "@trpc/server";
import { z } from "zod";
import chalk from "chalk";
import { router, procedure } from "../../lib/trpc/trpc.js";
import {
  protectedProcedure,
  adminProcedure,
} from "../../lib/trpc/procedures.js";
import User from "../../models/userModel.js";
import bcrypt from "bcryptjs";
import { generateText2Audio } from "../../lib/text2audio.js";

import { formatMdText } from "../../lib/format.js";
export const textToSpeechRoutes = {
  generateSpeech: procedure
    .input(
      z.object({
        text: z.string().max(4096).min(1),
        voice: z
          .enum([
            "alloy",
            "ash",
            "coral",
            "echo",
            "fable",
            "onyx",
            "nova",
            "sage",
            "shimmer",
          ])
          .default("alloy"),
        speed: z.number().min(0.25).max(4.0).default(1.0),
        format: z
          .enum(["mp3", "opus", "aac", "flac", "wav", "pcm"])
          .default("mp3"),
      })
    )
    .query(async ({ input }) => {
      try {
        console.log(
          "Generating speech for:",
          input.text.substring(0, 50) + "..."
        );

        // Call the library function to generate audio
        const audioData = await generateText2Audio({
          text: input.text,
          voice: input.voice,
          speed: input.speed,
          format: input.format,
        });

        return {
          success: true,
          audioData: audioData, // Return base64 encoded audio data
          contentType: `audio/${input.format}`,
        };
      } catch (error) {
        console.error("Failed to generate speech:", error);
        return {
          success: false,
          error: error.message || "Failed to generate speech",
        };
      }
    }),
};
