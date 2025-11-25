/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { llm, getAiModelConfig, getAiPromptConfig } from "./openaiClient.js";
import { analyzeBigFive } from "../form/analyseBig5Form.js";
import {
  constructFormDataWithAnswers,
  generatePlainTextSummary,
} from "../form/form.js";

const formAnalFunctions = {
  big5: analyzeBigFive,
};

export const analyseConvo = async (convo) => {
  try {
    const activity = convo.activity;
    console.log("Analysing activity:", activity);

    let formDataToAppendToLLM = null;
    let formPlainTextResults = null;

    // First we compute the form data
    let formResults = null; // formatted variable to store the form data
    if (activity.type == "form") {
      formDataToAppendToLLM = convo.formAnswers;

      // Use the imported function to create a structured form data representation
      const formattedData = constructFormDataWithAnswers(
        convo.formAnswers,
        activity.formConfig
      );

      // Generate a plain text summary from the structured data
      formPlainTextResults = generatePlainTextSummary(formattedData);

      // Apply specific form analysis function if defined
      const formFn = formAnalFunctions[activity.formAnalFunction];
      if (!formFn) {
        console.log("Unknown formAnalFunction:", activity.formAnalFunction);
        // throw new Error(`Unknown form type: ${activity.formType}`);
      } else {
        formResults = await formFn(
          convo.formAnswers,
          activity.formConfig.questions
        );
      }
    }

    const messages = [
      {
        role: "system",
        content:
          activity.analysisSystemPrompt ||
          "analysé l'échange en tant qu'un coach expert.",
      },
      {
        role: "user",
        content: JSON.stringify({
          form: formDataToAppendToLLM,
          formSummary: formPlainTextResults, // Include the comprehensive form summary
          transcript: convo.transcript,
        }),
      },
    ];

    console.log(messages, "messages for analysis");

    const response = await llm.chat.completions.create({
      //model: "gpt-4.1", // or your specific model
      ...getAiModelConfig("activityAnalysis"),
      messages: messages,
      //temperature: 0.7,
      //max_tokens: 16384,
      //top_p: 1,
      //frequency_penalty: 0,
      //presence_penalty: 0,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("No completion choices returned from API");
    }

    const analysis = response.choices[0].message.content;

    // Optional: Add additional processing of the analysis here
    const result = {
      raw: response,
      analysis: analysis,
      formResults: formResults, // for form activities
      formSummary: formPlainTextResults, // Include the plain text summary in the result
      metadata: {
        model: response.model,
        usage: response.usage,
        timestamp: new Date().toISOString(),
      },
    };
    console.log("Analysis result:", result);
    return result;
  } catch (error) {
    console.error("Error analyzing conversation:", error);
    throw new Error(`Failed to analyze conversation: ${error.message}`);
  }
};

// Example usage:
/*
const convo = {
  activity: {
    transcript: "User: How can I improve my code?\nAssistant: Let's look at some best practices...",
    systemPrompt: "Analyze this coding conversation and provide improvement suggestions."
  }
};

try {
  const result = await analyseConvo(convo);
  console.log("Analysis result:", result);
} catch (error) {
  console.error("Analysis failed:", error);
}
*/
