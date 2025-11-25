/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

// models refs:
// https://platform.openai.com/docs/models

// comapre here:
// https://docsbot.ai/models/compare/o1/gpt-4.1-mini-2024-11-20

const aiModelConfigs = {
  default: {
    model: "gpt-4.1-mini",
    // max_tokens: 16384,
    // temperature: 0.7,
  },
  extras: {
    model: "o1-mini",
  },

  extrasContextSummary: {
    model: "gpt-4.1-mini", // we chain activity-analysis into it to create a better summary
  },
  memory: {
    model: "gpt-4.1-mini",
  },
  realtimeActivity: {
    model: "gpt-4.1-mini-realtime-preview",
  },
  realtimeActivityTranscribe: {
    // model: "whisper-1", ///TODO; test with newer
    language: "fr",
    model: "gpt-4.1-mini-mini-transcribe",
    //model: "gpt-4.1-mini-transcribe",
    // model: "whisper-1",
  },
  meetTranscribe: {
    //language: "fr",
    language: "en",
    model: "gpt-4.1-mini-transcribe", //"gpt-4.1-mini-mini-transcribe", //
    response_format: "json", // Request verbose JSON format to get more detailed output
    // include: ["item.input_audio_transcription.logprobs"],
    //  message: "response_format 'verbose_json' is not compatible with model 'gpt-4.1-mini-transcribe'. Use 'json' or 'text' instead.",
  },
  summarizeMeetTranscript: {
    model: "gpt-4.1-mini-mini",
  },
  chatActivity: {
    model: "o1-mini",
  },
  activityAnalysis: {
    model: "o1",
  },
  fiche: {
    model: "gpt-4.1-mini", // "o1' has larger con text. would be good too.
  },
  wiso: {
    model: "o3-mini",
  },
  chatAgentConvoStarters: {
    model: "gpt-4.1-mini",
  },
  meetAnalysis: {
    model: "o1", //MAX TOKEN NOT SUPPORTED...
  },
  tts: {
    //text 2 audio, pretty shitty model for FR
    // model: "tts-1", //tts-1-hd model = better quality, slower
    model: "gpt-4.1-mini-mini-tts", ///march 20 2025
    instructions:
      "Speak in a cheerful and positive tone. In french. En francais, du canada.",
  },
  llmApi: {
    model: "o3-mini", // "gpt-4.1-mini",
  },
};

export function getAiModelConfig(feature) {
  return {
    ...aiModelConfigs.default,
    ...aiModelConfigs[feature],
  };
}

/*


USAGE:
    const response = await llm.chat.completions.create({
      ...getAiModelConfig("extra"), //"gpt-4.1-mini", // or your specific model
      messages: messages,
      temperature: 0.7,
      max_tokens: 16384, //max token for that model.
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      // response_format: { type: "json_object" }, //new stuff
    });*/

export default aiModelConfigs;
