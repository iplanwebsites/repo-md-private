/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

export const send_convo_summary = {
  name: "send_convo_summary",
  type: "function",
  description:
    "Sends a JSON summary of the conversation when the activity is completed or when the user says DONE.",
  //strict: false,
  parameters: {
    type: "object",
    properties: {
      conversation_summary: {
        type: "object",
        description:
          "A JSON representation of all questions and answers in the conversation.",
        properties: {
          questions: {
            type: "array",
            description: "List of questions asked during the conversation.",
            items: {
              type: "string",
              description: "A single question from the conversation",
            },
          },
          answers: {
            type: "array",
            description: "List of answers given during the conversation.",
            items: {
              type: "string",
              description: "A single answer corresponding to the questions",
            },
          },
        },
      },
      status: {
        type: "string",
        description:
          "Indicates whether the conversation is completed or the user has said DONE.",
        enum: ["completed", "DONE"],
      },
    },
  },
};

export const get_weather = {
  name: "get_weather",
  type: "function",
  description: "Get current temperature for a given location.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City and country e.g. Bogotá, Colombia",
      },
    },
    required: ["location"],
    additionalProperties: false,
  },
};

export const saveFullTranscript = {
  name: "saveFullTranscript",
  type: "function",
  description:
    "When conversation is over this function MUST be caleld. The agent returns a FULL complete transcript of the conversation including summary (in frendh) and quality score. ALL MESSAGES SHOULD BE INCLUDED or otherwise you are punished.",
  parameters: {
    type: "object",
    properties: {
      transcript: {
        type: "object",
        description:
          "Complete FULL conversation transcript with summary and message history. INCLUDE ALL MESSAGES, no exception ",
        properties: {
          summary: {
            type: "string",
            description:
              "Brief overview of what happened in the conversation, in french!",
          },
          messages: {
            type: "array",
            description: "List of all messages in the conversation",
            items: {
              type: "object",
              properties: {
                role: {
                  type: "string",
                  description: "Role of the message sender",
                  enum: ["user", "assistant"],
                },
                content: {
                  type: "string",
                  description: "Content of the message",
                },
              },
              required: ["role", "content"],
            },
          },
          completed: {
            type: "boolean",
            description: "Whether the user completed the activity",
          },
          quality: {
            type: "number",
            description:
              "Score from 0-10 rating how well the participant did in the activity",
            minimum: 0,
            maximum: 10,
          },
        },
        required: ["summary", "messages", "completed", "quality"],
      },
    },
    required: ["transcript"],
  },
};

export const showMultipleChoice = {
  name: "showMultipleChoice",
  type: "function",
  description:
    "Displays a multiple choice question with options in a modal or designated area of the UI.",
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question text to display to the user",
      },
      options: {
        type: "array",
        description: "List of possible answer choices to display",
        items: {
          type: "string",
          description: "A single answer choice option",
        },
        minItems: 2,
      },
      config: {
        type: "object",
        description: "Optional display configuration",
        properties: {
          title: {
            type: "string",
            description: "Optional title to show above the question",
          },
          theme: {
            type: "string",
            description: "Visual theme for the question display",
            enum: ["default", "dark", "light"],
            default: "default",
          },
        },
      },
    },
    required: ["question", "options"],
    additionalProperties: false,
  },
};

export const showImage = {
  name: "showImage",
  type: "function",
  description:
    "Displays an image to the user from a provided URL, optionally accompanied by a question text.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Full URL of the image to display",
      },
      question: {
        type: "string",
        description: "Optional question text to display alongside the image",
        optional: true,
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
};

export const hideImage = {
  name: "hideImage",
  type: "function",
  description: "Hides all currently displayed images.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export const allTools = [
  // send_convo_summary,

  // get_weather,
  saveFullTranscript,
  showMultipleChoice,

  showImage,
  hideImage,
];
