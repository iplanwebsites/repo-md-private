/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import {
  llm,
  getAiModelConfig,
  getAiPromptConfig,
} from "./chat/openaiClient.js";
import chalk from "chalk";

// Initialize OpenAI client
const openai = llm;

/**
 * Process audio buffer for transcript using OpenAI's models with speaker diarization
 * @param {Buffer} audioBuffer - The audio data buffer
 * @param {string} meetId - The meeting ID
 * @param {string} mimeType - The MIME type of the audio (e.g., "audio/webm")
 * @param {Array} speakerInfo - Optional array of speaker information for diarization
 * @returns {Object} Transcription result
 */
export const processAudioBufferForTranscript = async (
  audioBuffer,
  meetId,
  mimeType,
  speakerInfo = []
) => {
  console.log(
    chalk.blue(`Processing audio buffer for meeting ${meetId} with OpenAI`)
  );

  try {
    // Create a File object from the buffer
    const file = new File([audioBuffer], `meeting-${meetId}.webm`, {
      type: mimeType,
    });

    // Get the AI model configuration for transcription
    const modelConfig = getAiModelConfig("meetTranscribe");

    const prompt = getAiPromptConfig("meetTranscribe", { speakerInfo });

    console.log("PROMPT audio2text:", prompt);
    // Create the transcription
    const transcription = await openai.audio.transcriptions.create({
      ...modelConfig,
      file: file,
      prompt: prompt,
    });

    let processedTranscript = transcription.text;

    // If we have the segments data in the response, format it with speaker roles
    if (transcription.segments) {
      processedTranscript = formatTranscriptWithSpeakers(
        transcription.segments,
        speakerInfo
      );
    }

    return {
      success: true,
      transcript: processedTranscript,
      rawTranscript: transcription,
      segments: transcription.segments || [],
      confidence: transcription.segments
        ? calculateAverageConfidence(transcription.segments)
        : 0.95,
      processingTime: new Date().toISOString(),
    };
  } catch (error) {
    console.error(chalk.red("OpenAI transcription error:"), error);
    return {
      success: false,
      error: error.message || "Failed to transcribe audio",
    };
  }
};

/**
 * Calculate average confidence from segments
 * @param {Array} segments - The segments from the transcription
 * @returns {number} Average confidence score
 */
const calculateAverageConfidence = (segments) => {
  if (!segments || segments.length === 0) return 0.95;

  const totalConfidence = segments.reduce(
    (sum, segment) => sum + segment.confidence,
    0
  );
  return totalConfidence / segments.length;
};

/**
 * Format transcript with speaker roles
 * @param {Array} segments - The segments from the transcription
 * @param {Array} speakerInfo - Array of speaker information
 * @returns {string} Formatted transcript with speaker labels
 */
const formatTranscriptWithSpeakers = (segments, speakerInfo) => {
  if (!segments || segments.length === 0) return "";

  // gpt-4.1 models don't natively support speaker diarization yet, so we'll
  // use heuristics to try to identify different speakers based on pauses
  // and potential speaker changes

  const formattedLines = [];
  let currentSpeakerIndex = 0;

  segments.forEach((segment, index) => {
    // Check if we should change the speaker (simple heuristic based on pauses)
    if (index > 0) {
      const prevSegment = segments[index - 1];
      const timeBetweenSegments = segment.start - prevSegment.end;

      // If there's a significant pause, assume it might be a new speaker
      if (timeBetweenSegments > 1.5) {
        currentSpeakerIndex =
          (currentSpeakerIndex + 1) % Math.max(speakerInfo.length, 2);
      }
    }

    // Get speaker label
    let speakerLabel = "Speaker 1";
    if (speakerInfo && speakerInfo.length > 0) {
      const speaker = speakerInfo[currentSpeakerIndex % speakerInfo.length];
      speakerLabel =
        speaker.name || `Speaker ${speaker.id || currentSpeakerIndex + 1}`;
    } else {
      speakerLabel = `Speaker ${(currentSpeakerIndex % 2) + 1}`;
    }

    // Format the line with timestamp and speaker
    const timeStamp = formatTimestamp(segment.start);
    formattedLines.push(`[${timeStamp}] ${speakerLabel}: ${segment.text}`);
  });

  return formattedLines.join("\n");
};

/**
 * Format timestamp in MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted timestamp
 */
const formatTimestamp = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
};

/**
 * Get transcript in different formats
 * @param {Object} transcription - The transcription result
 * @param {string} format - The desired format ('plain', 'json', 'srt', 'vtt', 'all')
 * @returns {Object} Formatted transcript
 */
export const getFormattedTranscript = (transcription, format = "all") => {
  if (!transcription || !transcription.success) {
    return {
      [format]: "Transcription failed or unavailable.",
    };
  }

  // If "all" format is requested, return all available formats
  if (format === "all") {
    return {
      plain: transcription.transcript,
      json: JSON.stringify(
        transcription.rawTranscript || { text: transcription.transcript }
      ),
      srt: convertToSRT(transcription.segments || []),
      vtt: convertToVTT(transcription.segments || []),
      // Include the original format key as well to maintain compatibility
      all: transcription.transcript,
      fullObject: transcription,
    };
  }

  // Otherwise, handle individual format requests as before
  switch (format) {
    case "json":
      return {
        json: JSON.stringify(
          transcription.rawTranscript || { text: transcription.transcript }
        ),
      };

    case "srt":
      return {
        srt: convertToSRT(transcription.segments || []),
      };

    case "vtt":
      return {
        vtt: convertToVTT(transcription.segments || []),
      };

    case "plain":
    default:
      return {
        plain: transcription.transcript,
      };
  }
};

/**
 * Convert segments to SRT format
 * @param {Array} segments - The segments from the transcription
 * @returns {string} SRT formatted transcript
 */
const convertToSRT = (segments) => {
  if (!segments || segments.length === 0) return "";

  return segments
    .map((segment, index) => {
      const startTime = formatSRTTimestamp(segment.start);
      const endTime = formatSRTTimestamp(segment.end);

      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    })
    .join("\n");
};

/**
 * Convert segments to VTT format
 * @param {Array} segments - The segments from the transcription
 * @returns {string} VTT formatted transcript
 */
const convertToVTT = (segments) => {
  if (!segments || segments.length === 0) return "";

  const header = "WEBVTT\n\n";

  const body = segments
    .map((segment, index) => {
      const startTime = formatVTTTimestamp(segment.start);
      const endTime = formatVTTTimestamp(segment.end);

      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    })
    .join("\n");

  return header + body;
};

/**
 * Format timestamp for SRT
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted timestamp for SRT
 */
const formatSRTTimestamp = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`;
};

/**
 * Format timestamp for VTT
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted timestamp for VTT
 */
const formatVTTTimestamp = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(3, "0")}`;
};
