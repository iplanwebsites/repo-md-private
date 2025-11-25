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
import fs from "fs";
import path from "path";

import { formatMdText } from "../../lib/format.js";

import {
  insertPatient,
  getPatient,
  getPatientsByOwner,
  updatePatient,
  addPatientNote,
  archivePatient,
} from "../../lib/patient.js";
import MemoryManager from "../../lib/chat/patientMemory.js";
// Import meet functions
import {
  scheduleMeet,
  getMeets,
  getMeet,
  updateMeet,
  cancelMeet,
  getPatientMeets,
  summarizeMeet, //utility
} from "../../lib/meet.js";

// Import the new audio transcription service
import {
  processAudioBufferForTranscript,
  getFormattedTranscript,
} from "../../lib/audio2text.js";

// Input validation schemas for meet operations
const scheduleMeetSchema = z.object({
  patientId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  startTime: z.string().or(z.date()),
  duration: z.number().min(5).max(240), // in minutes, between 5 min and 4 hours
  metadata: z.record(z.any()).optional(),
  ownerName: z.string().optional(),
});

const getMeetsSchema = z.object({
  status: z.enum(["scheduled", "completed", "canceled"]).optional(),
  patientId: z.string().optional(),
  fromDate: z.string().or(z.date()).optional(),
  toDate: z.string().or(z.date()).optional(),
});

const getMeetSchema = z.object({
  meetId: z.string(),
});

const updateMeetSchema = z.object({
  meetData: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    startTime: z.string().or(z.date()).optional(),
    duration: z.number().min(5).max(240).optional(),
    transcript: z.string().optional(),
    chatLogs: z.array(z.any()).optional(),
    status: z.enum(["scheduled", "completed", "canceled"]).optional(),
    metadata: z.record(z.any()).optional(),
  }),
  meetId: z.string().optional(),
  agoraId: z.string().optional(),
});

const cancelMeetSchema = z.object({
  meetId: z.string(),
  reason: z.string().optional(),
});

// Schema for audio upload with speaker information
const sendMeetAudioSchema = z.object({
  id: z.string(), // meetId
  audioData: z.string(), // Base64 encoded audio data
  mimeType: z.string().default("audio/webm"),
  fileName: z.string().optional(),
  speakerInfo: z
    .array(
      z.object({
        id: z.string().or(z.number()).optional(),
        name: z.string().optional(),
        role: z.string().optional(),
      })
    )
    .optional(),
  transcriptFormat: z
    .enum(["plain", "json", "srt", "vtt", "all"])
    .optional()
    .default("plain"),
});

export const meetRoutes = {
  // Schedule a new meeting
  scheduleMeet: protectedProcedure
    .input(scheduleMeetSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const ownerId = ctx.user.id;

        // Check if patient belongs to owner
        const patient = await getPatient(input.patientId);
        if (!patient || patient.ownerId !== ownerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "You don't have permission to schedule meetings for this patient",
          });
        }

        const result = await scheduleMeet(ownerId, input.patientId, {
          title: input.title,
          description: input.description || "",
          startTime: input.startTime,
          duration: input.duration,
          metadata: input.metadata || {},
          ownerEmail: ctx.user.email,
          ownerName:
            input.ownerName ||
            ctx.user?.user_metadata?.full_name ||
            "NO2 ctx.user.meta 22",
        });

        return {
          success: true,
          meet: result,
        };
      } catch (error) {
        console.error("Error scheduling meeting:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to schedule meeting",
        });
      }
    }),

  // Get meetings for the authenticated user
  getMeets: protectedProcedure
    .input(getMeetsSchema)
    .query(async ({ input, ctx }) => {
      try {
        const ownerId = ctx.user.id;

        const filters = {
          status: input.status,
          patientId: input.patientId,
          fromDate: input.fromDate,
          toDate: input.toDate,
        };

        const meets = await getMeets(ownerId, filters);

        return {
          success: true,
          meets,
        };
      } catch (error) {
        console.error("Error getting meetings:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to get meetings",
        });
      }
    }),

  // Get a specific meeting by ID
  getMeet: protectedProcedure
    .input(getMeetSchema)
    .query(async ({ input, ctx }) => {
      try {
        const ownerId = ctx.user.id;

        const meet = await getMeet(input.meetId);

        if (!meet) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Meeting not found",
          });
        }

        // Verify ownership
        if (meet.ownerId !== ownerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to access this meeting",
          });
        }

        return {
          success: true,
          meet,
        };
      } catch (error) {
        console.error("Error getting meeting:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to get meeting",
        });
      }
    }),

  // Update meeting or create if does not exist (with transcript, chat logs)
  updateMeet: protectedProcedure
    .input(updateMeetSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const ownerId = ctx.user.id;

        // If a meetId is provided, verify ownership
        if (input.meetId) {
          const existingMeet = await getMeet(input.meetId);

          if (existingMeet && existingMeet.ownerId !== ownerId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have permission to update this meeting",
            });
          }
        }

        // If agoraId is provided, verify ownership if a meet with this agoraId exists
        if (input.agoraId) {
          const existingMeets = await getMeets(ownerId, {
            "metadata.agoraId": input.agoraId,
          });

          if (
            existingMeets.length > 0 &&
            existingMeets[0].ownerId !== ownerId
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have permission to update this meeting",
            });
          }
        }

        // Add ownerId to meetData if creating a new meeting
        const meetData = {
          ...input.meetData,
          ownerId,
        };

        const result = await updateMeet(meetData, input.meetId, input.agoraId);

        return {
          success: true,
          meet: result,
        };
      } catch (error) {
        console.error("Error updating meeting:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to update meeting",
        });
      }
    }),

  // Cancel a meeting
  cancelMeet: protectedProcedure
    .input(cancelMeetSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const ownerId = ctx.user.id;

        const meet = await getMeet(input.meetId);

        if (!meet) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Meeting not found",
          });
        }

        // Verify ownership
        if (meet.ownerId !== ownerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to cancel this meeting",
          });
        }

        const result = await cancelMeet(input.meetId, ownerId, input.reason);

        return {
          success: true,
          meet: result,
        };
      } catch (error) {
        console.error("Error canceling meeting:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to cancel meeting",
        });
      }
    }),

  // Get patient meetings (mentor only)
  getPatientMeets: protectedProcedure
    .input(
      z.object({
        patientId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const ownerId = ctx.user.id;

        // Check if patient belongs to owner
        const patient = await getPatient(input.patientId);
        if (!patient || patient.ownerId !== ownerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "You don't have permission to access this patient's meetings",
          });
        }

        const meets = await getPatientMeets(input.patientId);

        return {
          success: true,
          meets,
        };
      } catch (error) {
        console.error("Error getting patient meetings:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to get patient meetings",
        });
      }
    }),

  // Send meeting audio for processing with OpenAI transcription - no local file saving
  // Updated route in meetRoutes.js

  // Send meeting audio for processing with OpenAI transcription and automatic summary
  saveMeetAudio: protectedProcedure
    .input(sendMeetAudioSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const ownerId = ctx.user.id;

        const CHECK__OWNERSHIP = true;

        // Verify ownership of the meeting
        let meet;
        let meetingId = input.id;
        if (CHECK__OWNERSHIP && meetingId) {
          console.log(input);
          console.log(
            chalk.green(`Checking ownership for meeting ${meetingId}`)
          );
          meet = await getMeet(meetingId);
          if (!meet) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Meeting not found",
            });
          }

          if (meet.ownerId !== ownerId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "You don't have permission to upload audio for this meeting",
            });
          }
        }
        console.log(chalk.green(`Processing audio for meeting ${meetingId}`));

        // Convert base64 to buffer
        const audioBuffer = Buffer.from(input.audioData, "base64");

        // Process audio directly without saving to disk - now includes summary generation
        const transcriptResult = await processAudioBufferForTranscript(
          audioBuffer,
          meetingId,
          input.mimeType,
          input.speakerInfo || [] //  speakerInfo: [ { id: 1, name: 'Speaker 1', role: 'Participant' } ],
        );

        // Get the formatted transcript in the requested format
        const formattedTranscript = getFormattedTranscript(
          transcriptResult,
          input.transcriptFormat
        );

        const plain = formattedTranscript?.plain;
        let summary;
        if (plain) {
          console.log(chalk.green(`Processing SUMMARY  ::: ${plain}`));
          summary = await summarizeMeet(plain);
          console.log(chalk.blue(`SUMMARY  ::: ${summary}`));
        }

        // Update the meeting with the transcript and summary information
        if (meet) {
          if (transcriptResult.success) {
            await updateMeet(
              {
                transcript: transcriptResult.transcript,
                metadata: {
                  ...meet.metadata,
                  audioProcessed: true,
                  audioProcessedAt: new Date().toISOString(),
                  audioProcessingTime: transcriptResult.processingTime,
                  audioFileInfo: {
                    mimeType: input.mimeType,
                    speakers: input.speakerInfo || [],
                    fileSize: audioBuffer.length,
                  },
                  transcriptSegments: transcriptResult.segments || [],
                  // Add summary to metadata
                  summary: summary,
                  summaryGeneratedAt: new Date(),
                  summaryError: transcriptResult.summaryError,
                },
              },
              meetingId
            );
          } else {
            // If transcription failed, update metadata to reflect failure
            await updateMeet(
              {
                metadata: {
                  ...meet.metadata,
                  audioProcessed: false,
                  audioProcessingError: transcriptResult.error,
                  audioProcessingAttemptedAt: new Date().toISOString(),
                  audioFileInfo: {
                    mimeType: input.mimeType,
                    fileSize: audioBuffer.length,
                  },
                },
              },
              meetingId
            );
          }
        }

        // Ingest the transcript into patient Memory
        /// This could be done async, no need to track it in the response
        const patient = await getPatient(meet.patientId);
        if (patient) {
          const memoryManager = new MemoryManager(patient);
          memoryManager.ingestMeetingTranscript(
            transcriptResult.transcript + "\n\n------- SUMMARY:\n " + summary
          );
        }

        return {
          success: transcriptResult.success,
          fileSize: audioBuffer.length,
          transcript: formattedTranscript,
          summary: summary,
          metadata: {
            processingTime: transcriptResult.processingTime,
            confidence: transcriptResult.confidence,
            speakers: input.speakerInfo || [],
          },
          error: transcriptResult.success ? null : transcriptResult.error,
        };
      } catch (error) {
        console.error(chalk.red("Error processing meeting audio:"), error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to process meeting audio",
        });
      }
    }),

  //WIP
  // Add this to your meetRoutes object

  // Set active meeting for a patient room
  setActiveRoomMeeting: protectedProcedure
    .input(
      z.object({
        roomId: z.string(), // this represents the patientId
        meetingId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const ownerId = ctx.user.id;

        // Check if patient belongs to owner
        const patient = await getPatient(input.roomId);
        if (!patient || patient.ownerId !== ownerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to update this patient's room",
          });
        }

        // Verify ownership of meeting
        const meeting = await getMeet(input.meetingId);
        if (!meeting) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Meeting not found",
          });
        }

        if (meeting.ownerId !== ownerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to use this meeting",
          });
        }

        // Update patient record with active meeting information
        const updatedPatient = await updatePatient(input.roomId, {
          activeMeeting: {
            meetingId: input.meetingId,
            setAt: new Date().toISOString(),
            title: meeting.title,
            startTime: meeting.startTime,
            duration: meeting.duration,
          },
        });

        return {
          success: true,
          patientId: input.roomId,
          meetingId: input.meetingId,
          activatedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Error setting active room meeting:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to set active room meeting",
        });
      }
    }),
};
