/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

// /lib/meet.js

import _ from "lodash";
import { generateSecureId } from "./utils.js";
import ical from "ical-generator";

import { db } from "../db.js";
import {
  llm,
  getAiModelConfig,
  getAiPromptConfig,
} from "./chat/openaiClient.js";

const openai = llm;

export const summarizeMeet = async (transcript) => {
  try {
    // Validate input
    if (
      !transcript ||
      typeof transcript !== "string" ||
      transcript.trim() === ""
    ) {
      throw new Error("Valid transcript text is required for summarization");
    }

    // better summarization
    /*
    const promptInstructions = `
      Summarize, in French, the following meeting transcript in a clear, concise manner.
      Focus on:
      - Key discussion points
      - Important decisions made
      - Action items and who's responsible
      - Follow-up items and deadlines
      - Don't invent new content. Keep the summary based on transcript and factual.
      
      Keep the summary professional and factual. If the transcript doesn't contain enough information to summarize, please indicate that, don't invent content.
    `;
*/
    // Call OpenAI for summarization
    // const messages = ;
    const response = await openai.chat.completions.create({
      ...getAiModelConfig("summarizeMeetTranscript"),
      messages: getAiPromptConfig("summarizeMeetTranscript", {
        transcript,
      }),
      /*messages: [
        {
          role: "system",
          content: promptInstructions,
        },
        {
          role: "user",
          content: `TRANSCRIPT PROVIDED:\n ${transcript}`,
        },
      ],
      */
    });

    // Handle potential errors or empty responses
    if (!response.choices || response.choices.length === 0) {
      throw new Error("Failed to generate summary: No response from AI model");
    }

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error summarizing meeting:", error);
    throw error;
  }
};

/**
 * Schedule a new appointment between a mentor and patient
 * @param {string} ownerId - ID of the mentor scheduling the appointment
 * @param {string} patientId - ID of the patient for the appointment
 * @param {Object} meetData - Meeting details including date, time, duration, title, etc.
 * @returns {Promise<Object>} - Created meeting with computed properties
 */
export const scheduleMeet = async (ownerId, patientId, meetData) => {
  try {
    // Input validation
    if (!ownerId || !patientId) {
      throw new Error("Owner ID and patient ID are required");
    }

    if (!meetData.startTime || !meetData.duration) {
      throw new Error("Meeting start time and duration are required");
    }

    // Ensure we have patient information (email is required for invitations)
    let patientEmail = meetData.patientEmail;
    if (!patientEmail) {
      // Fetch patient email from the patients collection if not provided
      const patient = await db.patients.findOne({ id: patientId });
      if (patient) {
        patientEmail = patient.email;
      }
    }

    // Create the new meeting instance
    const meet = {
      id: generateMeetId(),
      ownerEmail: meetData.ownerEmail,
      ownerName: meetData.ownerName,
      ownerId,
      patientId,
      title: meetData.title || "Appointment",
      description: meetData.description || "",
      startTime: new Date(meetData.startTime),
      duration: meetData.duration, // in minutes
      status: "scheduled",
      scheduledBy: ownerId,
      scheduledOnDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: meetData.metadata || {},
      // Initialize invitee status for the patient
      inviteeStatus: "pending", // pending, accepted, declined, tentative
      patientEmail: patientEmail,
    };

    // Insert into database
    await db.meets.insertOne(meet);

    console.log("Meeting scheduled with ID:", meet.id);

    // Augment with computed properties for frontend
    return augmentMeet(meet);
  } catch (error) {
    console.error("Error scheduling meeting:", error);
    throw error;
  }
};

/**
 * Get a list of meetings for a specific mentor/owner
 * @param {string} ownerId - ID of the mentor
 * @param {Object} filters - Optional filters (status, date range, etc)
 * @returns {Promise<Array>} - List of meetings with computed properties
 */
export const getMeets = async (ownerId, filters = {}) => {
  try {
    if (!ownerId) {
      throw new Error("Owner ID is required");
    }

    // Build query
    const query = { ownerId };

    // Add optional filters
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.patientId) {
      query.patientId = filters.patientId;
    }

    // Date range filters
    if (filters.fromDate) {
      query.startTime = { $gte: new Date(filters.fromDate) };
    }

    if (filters.toDate) {
      if (query.startTime) {
        query.startTime.$lte = new Date(filters.toDate);
      } else {
        query.startTime = { $lte: new Date(filters.toDate) };
      }
    }

    // Fetch meetings from database
    const meets = await db.meets.find(query).toArray();

    // Augment all meetings with computed properties
    return meets.map((meet) => augmentMeet(meet));
  } catch (error) {
    console.error("Error getting meetings:", error);
    throw error;
  }
};

/**
 * Get a specific meeting by ID
 * @param {string} meetId - Meeting ID
 * @returns {Promise<Object|null>} - Meeting with computed properties or null if not found
 */
export const getMeet = async (meetId) => {
  try {
    if (!meetId) {
      throw new Error("Meeting ID is required");
    }

    const meet = await db.meets.findOne({ id: meetId });

    if (!meet) {
      return null;
    }

    return augmentMeet(meet);
  } catch (error) {
    console.error("Error getting meeting:", error);
    throw error;
  }
};

/**
 * Update a meeting or create it if it doesn't exist (based on optionalId or optionalAgoraId)
 * Particularly useful for adding transcription and chat logs from impromptu meetings
 * @param {Object} meetData - Meeting data to update
 * @param {string} optionalId - Optional meeting ID
 * @param {string} optionalAgoraId - Optional Agora session ID
 * @returns {Promise<Object>} - Updated meeting with computed properties
 */
export const updateMeet = async (
  meetData,
  optionalId = null,
  optionalAgoraId = null
) => {
  try {
    // Try to find existing meeting
    let existingMeet = null;

    if (optionalId) {
      existingMeet = await db.meets.findOne({ id: optionalId });
    } else if (optionalAgoraId) {
      existingMeet = await db.meets.findOne({
        "metadata.agoraId": optionalAgoraId,
      });
    }

    // If meeting exists, update it
    if (existingMeet) {
      const updateData = {
        ...meetData,
        updatedAt: new Date(),
      };

      // Don't overwrite these fields if they already exist
      delete updateData.id;
      delete updateData.createdAt;

      await db.meets.updateOne({ id: existingMeet.id }, { $set: updateData });

      // Fetch and return the updated meeting
      const updatedMeet = await db.meets.findOne({ id: existingMeet.id });
      return augmentMeet(updatedMeet);
    }

    // If meeting doesn't exist, create a new one
    else {
      // Ensure we have required fields for a new meeting
      if (!meetData.ownerId || !meetData.patientId) {
        throw new Error(
          "Owner ID and patient ID are required for creating a new meeting"
        );
      }

      const newMeet = {
        id: optionalId || generateMeetId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "completed", // Assume it's a post-meeting update
        ...meetData,
        metadata: {
          ...meetData.metadata,
          agoraId: optionalAgoraId || meetData.metadata?.agoraId,
        },
      };

      await db.meets.insertOne(newMeet);
      return augmentMeet(newMeet);
    }
  } catch (error) {
    console.error("Error updating meeting:", error);
    throw error;
  }
};

/**
 * Generate a unique ID for a meeting
 * @returns {string} - Unique meeting ID
 */
function generateMeetId() {
  return generateSecureId();
}

/**
 * Augment a meeting with computed properties like iCal data
 * @param {Object} meet - Meeting object from database
 * @returns {Object} - Meeting with additional computed properties
 */
export function augmentMeet(meet) {
  const baseUrl = process.env.BASE_URL || "https://repo.md";
  meet.eventUrl = `${baseUrl}/meet/${meet.patientId}`;

  // Generate iCal data
  const iCalData = generateICalData(meet);

  // Calculate end time based on start time and duration
  const endTime = new Date(meet.startTime);
  endTime.setMinutes(endTime.getMinutes() + meet.duration);

  // For backward compatibility with existing records
  if (!meet.inviteeStatus && meet.invitees && meet.invitees.length > 0) {
    // Find patient in invitees
    const patientInvitee = meet.invitees.find(
      (inv) => inv.id === meet.patientId
    );
    if (patientInvitee) {
      meet.inviteeStatus = patientInvitee.status;
      if (patientInvitee.email) {
        meet.patientEmail = patientInvitee.email;
      }
    } else {
      meet.inviteeStatus = "pending";
    }
  }

  // Default inviteeStatus if not set
  if (!meet.inviteeStatus) {
    meet.inviteeStatus = "pending";
  }

  // Add calculated and convenience properties
  return {
    ...meet,
    endTime,
    iCalData,
    detailsUrl: `${baseUrl}/meets/${meet.id}`,
    joinUrl: `${baseUrl}/meet/${meet.id}`,
  };
}

/**
 * Generate iCal format calendar data for a meeting
 * @param {Object} meet - Meeting object
 * @returns {string} - iCal formatted calendar data
 */
function generateICalData(meet) {
  try {
    // Calculate end time
    const endTime = new Date(meet.startTime);
    endTime.setMinutes(endTime.getMinutes() + meet.duration);

    // Create calendar
    const calendar = ical({
      domain: process.env.DOMAIN || "example.com",
      name: "Appointment Calendar",
    });

    // Determine participation status based on patient's response
    let participationStatus = "CONFIRMED"; // Default for meeting status
    let attendeeStatus = "NEEDS-ACTION"; // Default for patient response

    // Get patient's response status
    if (meet.inviteeStatus) {
      attendeeStatus = mapInviteeStatusToICalStatus(meet.inviteeStatus);

      // If patient declined, mark as tentative in calendar
      if (meet.inviteeStatus === "declined") {
        participationStatus = "TENTATIVE";
      }
    }

    // Add event
    /// WRONG: we should use the newer logic in CALENDARROUTES, and segment function cleanly in a lib.
    const event = calendar.createEvent({
      start: meet.startTime,
      end: endTime,
      summary: meet.title,
      description: meet.description,
      location: "En ligne",
      url: `${process.env.BASE_URL || "https://repo.md"}/room/${meet.id}`,
      organizer: {
        name: "Platform",
        email: process.env.SYSTEM_EMAIL || "system@example.com",
      },
      uid: meet.id,
      status:
        meet.status === "canceled"
          ? "CANCELLED"
          : meet.status === "completed" || meet.status === "scheduled"
          ? participationStatus
          : "TENTATIVE",
    });

    // Add patient as attendee if email is available
    if (meet.patientEmail) {
      event.createAttendee({
        name: "Patient",
        email: meet.patientEmail,
        status: attendeeStatus,
      });
    }

    // Return as string
    return calendar.toString();
  } catch (error) {
    console.error("Error generating iCal data:", error);
    return "";
  }
}

/**
 * Map invitee status to iCalendar attendee status
 * @param {string} status - Internal invitee status
 * @returns {string} - iCalendar compatible attendee status
 */
function mapInviteeStatusToICalStatus(status) {
  switch (status) {
    case "accepted":
      return "ACCEPTED";
    case "declined":
      return "DECLINED";
    case "tentative":
      return "TENTATIVE";
    case "pending":
    default:
      return "NEEDS-ACTION";
  }
}

/**
 * Get all meetings for a patient
 * @param {string} patientId - Patient ID
 * @returns {Promise<Array>} - List of meetings for the patient
 */
export const getPatientMeets = async (patientId) => {
  try {
    if (!patientId) {
      throw new Error("Patient ID is required");
    }

    const meets = await db.meets.find({ patientId }).toArray();
    return meets.map((meet) => augmentMeet(meet));
  } catch (error) {
    console.error("Error getting patient meetings:", error);
    throw error;
  }
};

/**
 * Cancel a meeting
 * @param {string} meetId - Meeting ID
 * @param {string} canceledBy - ID of the user canceling the meeting
 * @param {string} reason - Optional reason for cancellation
 * @returns {Promise<Object>} - Updated meeting
 */
export const cancelMeet = async (meetId, canceledBy, reason = "") => {
  try {
    if (!meetId || !canceledBy) {
      throw new Error("Meeting ID and canceler ID are required");
    }

    const meet = await db.meets.findOne({ id: meetId });
    if (!meet) {
      throw new Error("Meeting not found");
    }

    const updateData = {
      status: "canceled",
      canceledBy,
      canceledAt: new Date(),
      cancelReason: reason,
      updatedAt: new Date(),
    };

    await db.meets.updateOne({ id: meetId }, { $set: updateData });

    const updatedMeet = await db.meets.findOne({ id: meetId });
    return augmentMeet(updatedMeet);
  } catch (error) {
    console.error("Error canceling meeting:", error);
    throw error;
  }
};

/**
 * Update the patient's response status for a meeting
 * @param {string} meetId - Meeting ID
 * @param {string} status - New status (accepted, declined, tentative)
 * @param {string} email - Optional email to update
 * @returns {Promise<Object>} - Updated meeting
 */
export const updatePatientStatus = async (meetId, status, email = null) => {
  try {
    if (!meetId || !status) {
      throw new Error("Meeting ID and status are required");
    }

    // Validate status
    const validStatuses = ["pending", "accepted", "declined", "tentative"];
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    const meet = await db.meets.findOne({ id: meetId });
    if (!meet) {
      throw new Error("Meeting not found");
    }

    // Update data
    const updateData = {
      inviteeStatus: status,
      updatedAt: new Date(),
    };

    // Update email if provided
    if (email) {
      updateData.patientEmail = email;
    }

    // Update meeting
    await db.meets.updateOne({ id: meetId }, { $set: updateData });

    const updatedMeet = await db.meets.findOne({ id: meetId });
    return augmentMeet(updatedMeet);
  } catch (error) {
    console.error("Error updating patient status:", error);
    throw error;
  }
};
