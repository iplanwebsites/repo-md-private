/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { llm, getAiModelConfig, getAiPromptConfig } from "./openaiClient.js";
import { db } from "../../db.js";

import { generateSecureId } from "../utils.js";

const DEFAULT_MODEL = "gpt-4.1-mini";

// Insert a new conversation
export const insertConvo = async ({
  // activity, //superflous
  // clientId,
  patientId,
  ownerId,
  activityId,
  programId,
  initialMessage,
  activity,
}) => {
  const convoId = generateSecureId();

  const convo = {
    id: convoId,
    // clientId,
    patientId,
    ownerId,
    activityId,
    programId,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: initialMessage
      ? [
          {
            role: "user",
            content: initialMessage,
            timestamp: new Date(),
          },
        ]
      : [],
    status: "active",
    activity,
  };

  await db.convos.insertOne(convo);

  // If there's an initial message, get LLM response
  if (initialMessage) {
    await replyToConvo(convoId, initialMessage);
  }

  return convoId;
};

// Reply to an existing conversation
export const replyToConvo = async (
  convoId,
  userMessage,
  model = DEFAULT_MODEL
) => {
  // Get existing conversation
  const convo = await db.convos.findOne({ id: convoId });
  if (!convo) throw new Error("Conversation not found");

  // Add user message
  const userMsg = {
    role: "user",
    content: userMessage,
    timestamp: new Date(),
  };

  // Get all messages for context
  const messages = [...convo.messages, userMsg];

  // Get LLM response
  const llmResponse = await llm.chat.completions.create({
    messages: messages.map(({ role, content }) => ({ role, content })),
    model,
  });

  const assistantMsg = {
    role: "assistant",
    content: llmResponse.choices[0].message.content,
    timestamp: new Date(),
    requestId: llmResponse._requestid,
  };

  // Update conversation with both messages
  await db.convos.updateOne(
    { id: convoId },
    {
      $push: {
        messages: {
          $each: [userMsg, assistantMsg],
        },
      },
      $set: { updatedAt: new Date() },
    }
  );

  return assistantMsg;
};

export const getConvos = async (filters = {}) => {
  return await db.convos.find(filters).sort({ updatedAt: -1 }).toArray();
};

export const updateConvoById = async (convoId, set) => {
  console.log("updateConvoById====", convoId, set);
  //ensure covoid is str
  if (typeof convoId !== "string") {
    throw new Error("Convo ID must be a string");
  }
  // Update conversation

  return await db.convos.updateOne(
    { id: convoId },
    {
      $set: { ...set, updatedAt: new Date() },
      /* {
        transcript: transcript,
        updatedAt: new Date(),
        completedAt: new Date(),
        completed: true,
      },*/
    }
  );
};

// Get conversation by ID
export const getConvo = async (convoId) => {
  return await db.convos.findOne({ id: convoId });
};

// List conversations with optional filters
export const listConvos = async (filters = {}) => {
  return await db.convos.find(filters).sort({ updatedAt: -1 }).toArray();
};

// Archive/delete conversation
export const archiveConvo = async (convoId) => {
  await db.convos.updateOne(
    { id: convoId },
    {
      $set: {
        status: "archived",
        updatedAt: new Date(),
      },
    }
  );
};

// For testing purposes
export const testReply = async (messages, model = DEFAULT_MODEL) => {
  console.log("testReply", messages, model);

  const response = await llm.chat.completions.create({
    messages,
    model,
  });

  console.log("response", response);
  return response.choices[0].message;
};
