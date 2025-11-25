/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

// patientMemory.js - Enhanced Memory Management Module for LLM Coaching Agent
import { getPatient, updatePatient } from "../patient.js";
import {
  llm,
  getAiModelConfig,
  getAiPromptConfig,
  wrapInSystemUserMsg,
} from "../chat/openaiClient.js";

// Debug configuration
const DEBUG = true; // Set to false in production

// Simple logger function with emoji support
function log(message, type = "info") {
  if (!DEBUG) return;

  const emoji = {
    info: "📘",
    success: "✅",
    error: "❌",
    memory: "🧠",
    load: "⏳",
    save: "💾",
    update: "🔄",
    search: "🔎",
    compact: "📝",
    append: "📃",
    ingest: "📥",
  };

  console.log(`${emoji[type] || "🔹"} ${message}`);
}

async function runLlmRequest({
  systemPrompt,
  userContent,
  modelType = "memory",
}) {
  try {
    log(`Making LLM request for ${modelType}`, "info");

    // Convert userContent to string if it's an object
    const userContentStr =
      typeof userContent === "object"
        ? JSON.stringify(userContent)
        : userContent;

    const messages = wrapInSystemUserMsg(systemPrompt, userContentStr);

    log(`Sending messages to API`, "info");
    const response = await llm.chat.completions.create({
      ...getAiModelConfig(modelType),
      messages: messages,
    });

    if (!response.choices || response.choices.length === 0) {
      log(`No completion choices returned from API`, "error");
      throw new Error("No completion choices returned from API");
    }

    log(`Received successful response from API`, "success");
    return response.choices[0].message.content;
  } catch (error) {
    log(`Error in LLM request: ${error.message}`, "error");
    console.error("Error in LLM request:", error);
    throw new Error(`Failed LLM request: ${error.message}`);
  }
}

class MemoryManager {
  constructor(patientIdOrObject = null) {
    log(`Initializing MemoryManager`, "info");

    // Check if we received a full patient object or just an ID
    if (patientIdOrObject && typeof patientIdOrObject === "object") {
      // We received a patient object
      this.patientId = patientIdOrObject.id;
      log(`Initialized with patient object ID: ${this.patientId}`, "info");

      // Initialize memory from the patient object
      this.memory = patientIdOrObject.memory || "";
      this.lastUpdated = patientIdOrObject.memoryUpdated || null;
      this.isLoaded = true; // Skip db fetch since we already have data
      log(
        `Memory loaded from patient object: ${this.memory.length} chars`,
        "memory"
      );
    } else {
      // We received just a patient ID (or null)
      this.patientId = patientIdOrObject;
      this.memory = null;
      this.lastUpdated = null;
      this.isLoaded = false;
      log(`Initialized with patient ID: ${this.patientId || "none"}`, "info");
    }
  }

  async ensureMemoryLoaded() {
    if (!this.patientId) {
      log(`No patient ID provided`, "error");
      throw new Error("No patient ID provided");
    }

    if (!this.isLoaded) {
      log(`Loading memory for patient ${this.patientId}`, "load");
      const patient = await getPatient(this.patientId);
      this.memory = patient.memory || "";
      this.lastUpdated = patient.memoryUpdated || null;
      this.isLoaded = true;
      log(`Memory loaded: ${this.memory.length} chars`, "memory");
    }

    return this.memory;
  }

  async saveMemory({ source = "system" } = {}) {
    log(`Saving memory for patient ${this.patientId}`, "save");

    const updatedData = {
      memory: this.memory,
      memoryUpdated: this.lastUpdated || Date.now(),
      memoryUpdatedBy: source,
    };

    const edit = await updatePatient(this.patientId, updatedData);
    log(`Memory saved successfully: ${this.memory.length} chars`, "success");
    //TODO: update system logs with the new saved memory
    return edit;
  }

  async updateMemory(newText) {
    log(`Updating memory content`, "update");
    await this.ensureMemoryLoaded();

    this.memory = newText;
    this.lastUpdated = Date.now();

    log(`Memory content updated: ${this.memory.length} chars`, "update");
    await this.saveMemory();
    return true;
  }

  async setMemory(memory) {
    try {
      log(`Setting completely new memory`, "update");
      // No need to load existing memory as we're replacing it entirely

      // Set the memory directly as a string
      this.memory = typeof memory === "string" ? memory : String(memory);
      this.lastUpdated = Date.now();
      this.isLoaded = true;

      log(`New memory set: ${this.memory.length} chars`, "memory");
      // Save to database with source marked as user
      const result = await this.saveMemory({ source: "user" });

      return {
        success: true,
        message: "Memory updated successfully from user edit",
        result,
      };
    } catch (error) {
      log(`Error in setMemory: ${error.message}`, "error");
      console.error("Error in setMemory:", error);
      return {
        success: false,
        message: `Failed to set memory: ${error.message}`,
        error,
      };
    }
  }

  async getMemory() {
    log(`Retrieving memory`, "memory");
    await this.ensureMemoryLoaded();
    log(`Returning memory: ${this.memory.length} chars`, "success");
    return this.memory;
  }

  async appendMemory(newContent) {
    log(`Appending to memory`, "append");
    await this.ensureMemoryLoaded();

    this.memory += "\n\n" + newContent;
    this.lastUpdated = Date.now();

    log(`Memory appended, new size: ${this.memory.length} chars`, "success");
    await this.saveMemory();
    return true;
  }

  async retrieveRelatedMemories(context) {
    log(
      `Retrieving related memories for context: ${context.substring(0, 30)}...`,
      "search"
    );
    await this.ensureMemoryLoaded();

    if (!this.memory.trim()) {
      log(`No memory available to search`, "info");
      return "";
    }

    try {
      const systemPrompt = `
      Extract only the most relevant information from the patient's coaching memory 
      that relates to the given context. Focus on growth patterns, goals, challenges, 
      and breakthrough moments. Return only the extracted text without any 
      additional commentary.
      `;
      const userContent = `Patient Coaching Memory:\n${this.memory}\n\nContext: ${context}`;

      log(`Executing LLM request for related memories`, "info");
      const result = await runLlmRequest({
        systemPrompt,
        userContent,
      });

      log(`Retrieved related memories: ${result.length} chars`, "success");
      return result;
    } catch (error) {
      log(`Error retrieving related memories: ${error.message}`, "error");
      console.error("Error retrieving related memories:", error);
      return "";
    }
  }

  async compactMemory() {
    log(`Starting memory compaction process`, "compact");
    await this.ensureMemoryLoaded();

    if (!this.memory.trim()) {
      log(`No memory to compact`, "info");
      return { status: "No memory to compact" };
    }

    const originalLength = this.memory.length;
    log(`Original memory size: ${originalLength} chars`, "info");

    try {
      const systemPrompt = `
      Synthesize the following patient coaching memory into a more concise form 
      while preserving all key information, especially important goals, breakthroughs, 
      challenges, habits, values, and personal development history. Return only the 
      synthesized text without any additional commentary.
      `;

      log(`Executing LLM request for memory compaction`, "info");
      this.memory = await runLlmRequest({
        systemPrompt,
        userContent: this.memory,
      });

      this.lastUpdated = Date.now();
      await this.saveMemory();

      const newLength = this.memory.length;
      const reduction = Math.round(
        ((originalLength - newLength) / originalLength) * 100
      );

      log(
        `Compaction complete. New size: ${newLength} chars (${reduction}% reduction)`,
        "success"
      );
      return {
        status: "Compaction complete",
        originalLength,
        newLength,
        reduction: `${reduction}%`,
        memory: this.memory,
      };
    } catch (error) {
      log(`Error compacting memory: ${error.message}`, "error");
      console.error("Error compacting memory:", error);
      return { status: "Error compacting memory", error: error.message };
    }
  }

  async askQuestion(question) {
    log(`Processing question: ${question}`, "search");
    await this.ensureMemoryLoaded();

    if (!this.memory.trim()) {
      log(`No memory available to answer question`, "info");
      return "No patient coaching memory available to answer this question.";
    }

    try {
      const systemPrompt = `
      Answer the following question based only on the provided patient coaching memory.
      Be concise and direct. Focus on personal development insights, patterns, and 
      progress. If the answer cannot be determined from the memory, clearly state that.
      Return only the answer without any additional commentary.
      `;
      const userContent = `Patient Coaching Memory:\n${this.memory}\n\nQuestion: ${question}`;

      log(`Executing LLM request for question answering`, "info");
      const answer = await runLlmRequest({
        systemPrompt,
        userContent,
      });

      log(`Question answered: ${answer.length} chars`, "success");
      return answer;
    } catch (error) {
      log(`Error asking question: ${error.message}`, "error");
      console.error("Error asking question:", error);
      return "Error processing question.";
    }
  }

  async summarizeMemory() {
    log(`Summarizing memory`, "compact");
    await this.ensureMemoryLoaded();

    if (!this.memory.trim()) {
      log(`No memory available to summarize`, "info");
      return "No patient coaching memory available to summarize.";
    }

    try {
      const systemPrompt = `
      Create a concise summary of the following patient coaching memory. 
      Focus on key development areas, goals achieved, ongoing challenges, 
      personal strengths, growth areas, and patient preferences for coaching approach.
      Highlight patterns in behavior and thinking that would be valuable for 
      future coaching sessions. Return only the summary without any additional commentary.
      DOn't invent anything. Use only facts and data from the memory. Sort 2-3 phrases maximum.
      In french.
      `;

      log(`Executing LLM request for memory summarization`, "info");
      const summary = await runLlmRequest({
        systemPrompt,
        userContent: this.memory,
      });

      log(`Memory summarized: ${summary.length} chars`, "success");
      return summary;
    } catch (error) {
      log(`Error summarizing memory: ${error.message}`, "error");
      console.error("Error summarizing memory:", error);
      return "Error generating summary.";
    }
  }

  async searchMemory(searchTerm) {
    log(`Searching memory for: ${searchTerm}`, "search");
    await this.ensureMemoryLoaded();

    if (!this.memory.trim()) {
      log(`No memory available to search`, "info");
      return "";
    }

    try {
      const systemPrompt = `
      Extract only the segments from the patient's coaching memory that relate 
      to the search term. Include context around these segments to ensure meaning
      is preserved. Focus on coaching-relevant information that shows patterns,
      progress, or obstacles related to the search term.
      Return only the extracted text without any additional commentary.
      `;
      const userContent = `Patient Coaching Memory:\n${this.memory}\n\nSearch for: ${searchTerm}`;

      log(`Executing LLM request for memory search`, "info");
      const results = await runLlmRequest({
        systemPrompt,
        userContent,
      });

      log(`Search complete: ${results.length} chars of results`, "success");
      return results;
    } catch (error) {
      log(`Error searching memory: ${error.message}`, "error");
      console.error("Error searching memory:", error);
      return "";
    }
  }

  async ingestMeetingTranscript(transcriptStr) {
    log(
      `Ingesting meeting transcript: ${transcriptStr.length} chars`,
      "ingest"
    );
    if (!transcriptStr || typeof transcriptStr !== "string") {
      log(`Invalid transcript provided`, "error");
      return {
        success: false,
        message: "Invalid transcript provided",
      };
    }

    await this.ensureMemoryLoaded();

    try {
      const systemPrompt = `
      Analyze this coaching session transcript and extract ONLY 5-6 MOST IMPORTANT NEW insights 
      that are NOT already present in the current memory. Be extremely concise.
      Focus on:
      - Completely new information not reflected in current memory
      - Key breakthroughs or significant shifts in perspective
      - New goals or major adjustments to existing goals
      - Critical challenges or obstacles newly identified
      - Specific actionable strategies agreed upon
      
      Format as maximum 5-6 extremely brief bullet points.
      Each point should be 1-2 sentences maximum.
      Do NOT repeat information already in memory.
      Return only the extracted points without any commentary.
      `;

      const userContent = `
      Current Coaching Memory:
      ${this.memory}
      
      Meeting Transcript:
      ${transcriptStr}
      `;

      log(`Executing LLM request for transcript analysis`, "info");
      const extractedMemories = await runLlmRequest({
        systemPrompt,
        userContent,
      });

      if (extractedMemories) {
        const newEntry = `--- MEETING NOTES (${
          new Date().toISOString().split("T")[0]
        }) ---\n${extractedMemories}`;

        log(
          `Adding extracted memories to patient record: ${extractedMemories.length} chars`,
          "append"
        );
        await this.appendMemory(newEntry);

        return {
          success: true,
          message:
            "Meeting transcript processed and relevant information added to memory",
          addedContent: newEntry,
        };
      } else {
        log(`No relevant information extracted from transcript`, "info");
        return {
          success: false,
          message: "No relevant information extracted from transcript",
        };
      }
    } catch (error) {
      log(`Error ingesting meeting transcript: ${error.message}`, "error");
      console.error("Error ingesting meeting transcript:", error);
      return {
        success: false,
        message: `Failed to process meeting transcript: ${error.message}`,
        error,
      };
    }
  }

  async ingestActivityAnalysis(reportStr) {
    log(`Ingesting activity analysis: ${reportStr.length} chars`, "ingest");
    if (!reportStr || typeof reportStr !== "string") {
      log(`Invalid activity analysis report provided`, "error");
      return {
        success: false,
        message: "Invalid activity analysis report provided",
      };
    }

    await this.ensureMemoryLoaded();

    try {
      // First request: just get the activity type
      const typePrompt = `
      Identify the type of activity or assessment described in this report.
      Return ONLY the activity type as a brief label (3-5 words maximum).
      Examples: "Values Assessment", "Goal Planning Exercise", "Habit Tracker", "Strengths Finder", etc.
      `;

      log(`Identifying activity type`, "info");
      const activityType = await runLlmRequest({
        systemPrompt: typePrompt,
        userContent: reportStr,
      });
      log(`Activity type identified: ${activityType}`, "success");

      // Second request: get the insights
      const insightsPrompt = `
      Analyze this activity report and extract ONLY 5-6 MOST IMPORTANT NEW insights 
      that are NOT already present in the current memory. Be extremely concise.
      Focus on:
      - Only new information not reflected in current memory
      - Key metrics or results that represent significant changes
      - Surprising discrepancies between expectations and results
      - Specific actionable insights directly relevant to established goals
      - Critical patterns that weren't previously identified
      
      Format as maximum 5-6 extremely brief bullet points.
      Each point should be 1sentences maximum.
      Do NOT repeat information already in memory.
      Return only the extracted points without any commentary.
      `;

      const userContent = `
      Current Coaching Memory:
      ${this.memory}
      
      Activity/Assessment Report:
      ${reportStr}
      `;

      log(`Extracting insights from activity analysis`, "info");
      const extractedInsights = await runLlmRequest({
        systemPrompt: insightsPrompt,
        userContent,
      });

      if (!extractedInsights) {
        log(`No insights extracted from activity report`, "info");
        return {
          success: false,
          message: "No insights extracted from activity report",
        };
      }

      const type = activityType.trim() || "Activity Assessment";
      const newEntry = `--- ${type} RESULTS (${
        new Date().toISOString().split("T")[0]
      }) ---\n${extractedInsights}`;

      log(
        `Adding activity results to patient record: ${extractedInsights.length} chars`,
        "append"
      );
      await this.appendMemory(newEntry);

      return {
        success: true,
        message: `${type} results processed and relevant insights added to memory`,
        addedContent: newEntry,
      };
    } catch (error) {
      log(`Error ingesting activity analysis: ${error.message}`, "error");
      console.error("Error ingesting activity analysis:", error);
      return {
        success: false,
        message: `Failed to process activity analysis: ${error.message}`,
        error,
      };
    }
  }

  // Set a new patient ID and reset the loaded state
  setPatientId(patientId) {
    log(`Setting new patient ID: ${patientId}`, "update");
    this.patientId = patientId;
    this.memory = null;
    this.lastUpdated = null;
    this.isLoaded = false;
    return this;
  }

  // Set a complete patient object
  setPatient(patient) {
    if (!patient || !patient.id) {
      log(`Invalid patient object: missing ID`, "error");
      throw new Error("Invalid patient object: must contain an id property");
    }

    log(`Setting complete patient object with ID: ${patient.id}`, "update");
    this.patientId = patient.id;
    this.memory = patient.memory || "";
    this.lastUpdated = patient.memoryUpdated || null;
    this.isLoaded = true;

    log(
      `Patient object set, memory size: ${this.memory.length} chars`,
      "success"
    );
    return this;
  }
}

export default MemoryManager;
