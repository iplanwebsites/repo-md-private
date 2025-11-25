/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

// /lib/extras.js
import {
  generateToken,
  generateInviteToken,
  verifyInviteToken,
} from "../utils/jwt.js";

import _ from "lodash";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import chalk from "chalk"; // Added chalk for colorized console output

import { generateSecureId } from "./utils.js";

import { formatMdText } from "./format.js";

import {
  llm,
  getAiModelConfig,
  getAiPromptConfig,
  wrapInSystemUserMsg,
} from "./chat/openaiClient.js";

import { db } from "../db.js";

// Debug logger function
const debugLog = (emoji, category, message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(
    `${emoji} ${chalk.blue(timestamp)} ${chalk.bold.yellow(
      category
    )}: ${chalk.green(message)}`
  );
  if (data) {
    if (typeof data === "object") {
      console.log(chalk.cyan(JSON.stringify(data, null, 2)));
    } else {
      console.log(chalk.cyan(data));
    }
  }
};
/*
export const runMainExtraGeneration = async ({ systemPrompt, options }) => {
  try {
    debugLog("🚀", "EXTRA_GEN", "Starting extra generation", {
      promptLength: systemPrompt?.length,
    });

    const messages = wrapInSystemUserMsg(systemPrompt, JSON.stringify(options));

    debugLog("📨", "EXTRA_GEN", "Sending request to LLM", {
      messageCount: messages.length,
      optionsSize: JSON.stringify(options).length,
    });

    const response = await llm.chat.completions.create({
      ...getAiModelConfig("extra"),
      messages: messages,
    });

    if (!response.choices || response.choices.length === 0) {
      debugLog("❌", "EXTRA_GEN", "No completion choices returned");
      throw new Error("No completion choices returned from API");
    }

    const extra = response.choices[0].message.content;

    debugLog("✅", "EXTRA_GEN", "Successfully generated extra content", {
      contentLength: extra.length,
      contentPreview: extra.substring(0, 100) + "...",
    });
    return extra;
  } catch (error) {
    debugLog("💥", "EXTRA_GEN", "Error generating extra", {
      error: error.message,
      stack: error.stack,
    });
    console.error("Error analyzing conversation:", error);
    throw new Error(`Failed to analyze conversation: ${error.message}`);
  }
};*/

// Get current file's directory for config loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read and parse extras configuration data
export const extraConfigs = JSON.parse(
  readFileSync(join(__dirname, "../data/extraConfigs.json"), "utf8")
);

debugLog("📚", "CONFIG", `Loaded ${extraConfigs.length} extra configurations`);

/**
 * Augments an extra with additional computed properties
 */
function augmentExtra(extra, owner, patient) {
  debugLog(
    "🔄",
    "AUGMENT",
    `Augmenting extra ${extra.id} for patient ${patient}`
  );

  // Generate tokens and URLs similar to activities
  const inviteToken = generateInviteToken(
    owner,
    extra.programId,
    extra.extraId,
    patient
  );

  const augmented = {
    ...extra,
    isAvailable: true,
    sequence: extra.sequence || 999, // Default sequence if not specified
    inviteToken,
    inviteUrl: `/start-extra/${inviteToken}`,
    analysisUrl: `/client/${patient}/${extra.programId}/${extra.extraId}`,
    createdAt: extra.createdAt || new Date().toISOString(),
  };

  debugLog("✨", "AUGMENT", `Extra successfully augmented`, {
    extraId: extra.id,
    inviteUrl: augmented.inviteUrl,
  });

  return augmented;
}

export const generateExtra = async ({
  ownerId,
  patientId,
  extraConfigId,
  customData = {},
  source = "unknown",
  customInstructions = "",
}) => {
  try {
    debugLog("🎯", "GEN_EXTRA", "Starting extra generation process", {
      ownerId,
      patientId,
      extraConfigId,
      source,
      customInstructions,
    });

    // Input validation
    if (!ownerId || !patientId || !extraConfigId) {
      debugLog("⚠️", "GEN_EXTRA", "Missing required parameters");
      throw new Error("Owner ID, patient ID, and config ID are required");
    }

    // Find the configuration template
    const config = extraConfigs.find((c) => c.id === extraConfigId);
    if (!config) {
      debugLog("❓", "GEN_EXTRA", `Extra config not found: ${extraConfigId}`);
      throw new Error(
        `Extra configuration template not found: ${extraConfigId}`
      );
    }

    debugLog("📋", "GEN_EXTRA", `Found config template: ${config.name}`, {
      configId: config.id,
      contentType: config.contentType,
      contextRequired: {
        fiche: config.contextFiche,
        name: config.contextName,
        activityCount: config.contextActivityAnalysis?.length || 0,
      },
    });

    const {
      contextFiche = false,
      contextName = false,
      contextMemory = false,
      contextActivityAnalysis = [],
      contextSummaryPrompt = "",
    } = config;

    // Initialize variables for the prompt
    let patientName = "";
    let patientFiche = "";
    let activitySummary = "";
    let patientMemory = "";

    // Patient context handling
    if (contextFiche || contextName || contextMemory) {
      debugLog("👤", "PATIENT_CONTEXT", "Fetching patient context");
      const patient = await db.patients.findOne({
        id: patientId,
        ownerId,
      });
      if (!patient) {
        debugLog("🚫", "PATIENT_CONTEXT", "Patient not found or access denied");
        throw new Error("Patient not found or access denied");
      }
      debugLog("👥", "PATIENT_CONTEXT", `Patient found: ${patient.name}`, {
        id: patient.id,
        hasFiche: !!patient.fiche,
      });

      patientName = patient.name || "";
      patientFiche = patient.fiche || "";
      patientMemory = patient.memory || "";
    }

    // Activity analysis context handling
    if (contextActivityAnalysis && contextActivityAnalysis.length > 0) {
      debugLog(
        "📊",
        "ACTIVITY_ANALYSIS",
        `Fetching activities: ${contextActivityAnalysis.join(", ")}`
      );

      const allConvos = await db.convos
        .find({
          patientId,
          ownerId,
          activityId: { $in: contextActivityAnalysis },
          completed: true,
        })
        .toArray();

      debugLog(
        "🔍",
        "ACTIVITY_ANALYSIS",
        `Found ${allConvos.length} total conversations`,
        {
          uniqueActivities: _.uniqBy(allConvos, "activityId").length,
        }
      );

      // Sort and filter to get most recent convos per activity
      const sortedConvos = _.orderBy(allConvos, ["completedAt"]);
      const mostRecentConvos = _.uniqBy(sortedConvos, "activityId");

      debugLog(
        "📑",
        "ACTIVITY_ANALYSIS",
        `Filtered to ${mostRecentConvos.length} most recent conversations`,
        {
          activityIds: mostRecentConvos.map((c) => c.activityId),
        }
      );

      const shouldSummarizeAnalysisViaLLM = contextSummaryPrompt || false;

      if (shouldSummarizeAnalysisViaLLM) {
        debugLog("🤖", "SUMMARY_LLM", "Generating summary via LLM");
        try {
          debugLog("📝", "SUMMARY_LLM", "Preparing LLM request", {
            modelConfig: "extrasContextSummary",
            promptProvided: !!contextSummaryPrompt,
            convoCount: mostRecentConvos.length,
          });

          const response = await llm.chat.completions.create({
            ...getAiModelConfig("extrasContextSummary"),
            messages: getAiPromptConfig("extrasContextSummary", {
              prompt: contextSummaryPrompt,
              activities: mostRecentConvos,
              includeTranscript: true,
            }),
          });

          if (!response.choices || response.choices.length === 0) {
            debugLog("❌", "SUMMARY_LLM", "No completion choices returned");
            throw new Error("No completion choices returned from API");
          }

          activitySummary = response.choices[0].message.content;
          debugLog("📃", "SUMMARY_LLM", "Generated summary via LLM", {
            summaryLength: activitySummary.length,
            summaryPreview: activitySummary.substring(0, 100) + "...",
          });
        } catch (error) {
          debugLog("💥", "SUMMARY_LLM", "Error generating summary via LLM", {
            error: error.message,
            stack: error.stack,
          });
          console.error("Error analyzing conversation:", error);
        }
      } else {
        // basic loop dump
        debugLog(
          "📋",
          "SUMMARY_BASIC",
          "Generating basic summary from activities"
        );

        activitySummary = "";
        mostRecentConvos.forEach((convo, index) => {
          debugLog(
            "📌",
            "SUMMARY_ITEM",
            `Processing activity ${index + 1}/${mostRecentConvos.length}`,
            {
              activityId: convo.activityId,
              hasSummary: !!convo?.transcript?.summary,
              hasAnalysis: !!convo.analysis,
            }
          );

          activitySummary += `\n\nActivity: ${convo.activityId} \n\n`;
          if (convo?.transcript?.summary)
            activitySummary += ` \n\nSummary: ${convo.transcript.summary} \n\n`;

          activitySummary += `Analysis: ${
            convo.analysis || "No analysis available"
          } \n\n`;
        });

        debugLog("✅", "SUMMARY_BASIC", "Completed basic summary generation", {
          summaryLength: activitySummary.length,
        });
      }
    }

    // Final content generation
    debugLog("🏁", "CONTENT_GEN", "Preparing for final content generation");

    // Use the new consolidated prompt configuration
    const messages = getAiPromptConfig("extra", {
      systemPrompt: config.systemPrompt,
      patientName,
      patientFiche,
      activitySummary,
      patientMemory: patientMemory,
      mentorInstructions: customInstructions,
      includePatientName: contextName,
      includePatientFiche: contextFiche,
      includePatientMemory: contextMemory,
    });

    debugLog("🔄", "CONTENT_GEN", "Calling LLM with consolidated prompt", {
      messageCount: messages.length,
      systemPromptLength: config.systemPrompt.length,
      patientNameLength: patientName.length,
      activitySummaryLength: activitySummary.length,
      mentorInstructionsLength: customInstructions.length,
    });

    const response = await llm.chat.completions.create({
      ...getAiModelConfig("extra"),
      messages: messages,
    });

    if (!response.choices || response.choices.length === 0) {
      debugLog("❌", "CONTENT_GEN", "No completion choices returned");
      throw new Error("No completion choices returned from API");
    }

    const content = response.choices[0].message.content;

    debugLog("✅", "CONTENT_GEN", "Generated main content", {
      contentLength: content.length,
    });

    // Create the new extra content instance
    const extraId = generateSecureId();
    debugLog("🆔", "EXTRA_CREATE", `Generated new extra ID: ${extraId}`);

    const extraInstance = {
      id: extraId,
      configId: extraConfigId,
      ownerId,
      patientId,
      source,
      name: config.name,
      description: config.description,
      type: config.type,
      content: content,
      contentType: config.contentType || "text",
      contentHtml: formatMdText(content),
      img: config.img || "",
      views: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        template: config.id,
        version: config.version || "1.0",
        generatedFrom: config.source || "system",
      },
      contextSummary: activitySummary,
      promptUsed: messages,
    };

    // Insert into database
    debugLog("💾", "DB_INSERT", `Inserting extra into database`, {
      id: extraInstance.id,
      configId: extraInstance.configId,
      contentType: extraInstance.contentType,
    });

    await db.extras.insertOne(extraInstance);

    debugLog(
      "🎉",
      "EXTRA_CREATED",
      `Successfully created extra: ${extraInstance.id}`,
      {
        name: extraInstance.name,
        type: extraInstance.type,
        contentLength: extraInstance.content.length,
      }
    );

    // Augment with computed properties for frontend
    const augmentedExtra = {
      ...extraInstance,
      detailsUrl: `/client/${patientId}/extra/${extraInstance.id}`,
    };

    return augmentedExtra;
  } catch (error) {
    debugLog("💥", "GEN_EXTRA_ERROR", "Error generating extra content", {
      error: error.message,
      stack: error.stack,
    });
    console.error("Error generating extra content:", error);
    throw error;
  }
};

//getExtra
export const getExtra = async (extraId) => {
  try {
    debugLog("🔍", "GET_EXTRA", `Fetching extra: ${extraId}`);

    // This would typically be a database query
    // For now, we'll simulate finding an extra
    const extra = await db.extras.findOne({ id: extraId });

    if (!extra) {
      debugLog("❓", "GET_EXTRA", `Extra not found: ${extraId}`);
      return null;
    }

    debugLog("✅", "GET_EXTRA", `Found extra: ${extraId}`, {
      name: extra.name,
      type: extra.type,
    });

    return extra;
  } catch (error) {
    debugLog("💥", "GET_EXTRA_ERROR", "Error getting extra", {
      extraId,
      error: error.message,
      stack: error.stack,
    });
    console.error("Error getting extra:", error);
    throw error;
  }
};

/**
 * Get all extras configurations available in the system
 * @returns {Promise<Array>} List of extra configurations
 */
export const getAllExtraConfigs = async () => {
  try {
    debugLog("📚", "GET_CONFIGS", "Fetching all extra configs");

    const visibleConfigs = extraConfigs.filter(
      (config) => config.hidden !== true
    );

    debugLog(
      "✅",
      "GET_CONFIGS",
      `Found ${visibleConfigs.length} visible configs out of ${extraConfigs.length} total`
    );

    return visibleConfigs;
  } catch (error) {
    debugLog("💥", "GET_CONFIGS_ERROR", "Error getting extra configs", {
      error: error.message,
      stack: error.stack,
    });
    console.error("Error getting extra configs:", error);
    throw error;
  }
};

/**
 * Get extras for a specific patient under an owner
 */
export const getOwnerPatientExtras = async (owner, patient) => {
  try {
    debugLog(
      "👥",
      "PATIENT_EXTRAS",
      `Fetching extras for patient: ${patient} under owner: ${owner}`
    );

    if (!owner || !patient) {
      debugLog("⚠️", "PATIENT_EXTRAS", "Missing owner or patient ID");
      throw new Error("Owner and patient IDs are required");
    }

    // This would typically come from your database
    // For now, we'll simulate fetching assigned extras
    const assignedExtras = []; // Replace with actual DB query

    debugLog(
      "📋",
      "PATIENT_EXTRAS",
      `Found ${assignedExtras.length} assigned extras`
    );

    let augmentedExtras = assignedExtras.map((extra) => {
      debugLog("🔄", "PATIENT_EXTRAS", `Augmenting extra: ${extra.id}`);
      return augmentExtra(extra, owner, patient);
    });

    // Sort by sequence and completion status
    const sortedExtras = augmentedExtras.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? -1 : 1;
      }
      return a.sequence - b.sequence;
    });

    debugLog(
      "✅",
      "PATIENT_EXTRAS",
      `Returning ${sortedExtras.length} sorted extras`
    );

    return sortedExtras;
  } catch (error) {
    debugLog("💥", "PATIENT_EXTRAS_ERROR", "Error in getOwnerPatientExtras", {
      owner,
      patient,
      error: error.message,
      stack: error.stack,
    });
    console.error("Error in getOwnerPatientExtras:", error);
    throw error;
  }
};

/**
 * Update an extra's status or data
 */
export const updateExtra = async (extraId, updates) => {
  try {
    debugLog("✏️", "UPDATE_EXTRA", `Updating extra: ${extraId}`, {
      updateFields: Object.keys(updates),
    });

    if (!extraId) {
      debugLog("⚠️", "UPDATE_EXTRA", "Missing extra ID");
      throw new Error("Extra ID is required");
    }

    // Here you would typically update in your database
    // const updated = await updateExtraInDB(extraId, updates);

    debugLog("❗", "UPDATE_EXTRA", "Update functionality not implemented");

    return null; // Replace with actual updated extra
  } catch (error) {
    debugLog("💥", "UPDATE_EXTRA_ERROR", "Error updating extra", {
      extraId,
      error: error.message,
      stack: error.stack,
    });
    console.error("Error updating extra:", error);
    throw error;
  }
};
