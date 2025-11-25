/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { llm, getAiModelConfig, getAiPromptConfig } from "./openaiClient.js";

const fichePrompt = `


Based on provided analysis of patient, generate a summary data card for the patient.
All texts must be in french. Respond in a JSON structure following this format example.
Don't invent data, specify TBD for missing data. it's okay to make informed guess from text.


---
Respond in a JSON structure following rhis format example:

export const dummyData = {
  generalInfo: {
    firstName: "Marie",
    lastName: "Dubois",
    age: 32,
    location: "Lyon",
    contact: {
      email: "marie.dubois@email.fr",
      phone: "+1 6 12 34 56 78",
      languages: ["Français", "Anglais"],
    },
    education: {
      level: "Master",
      field: "Psychologie Organisationnelle",
    },
  },

  personalitySummary: {
    shortSummary:
      "Professionnelle dynamique et empathique avec une forte orientation vers l'innovation et le développement personnel",
    coreValues: {
      values: ["Authenticité", "Innovation", "Bienveillance"],
      description:
        "Fondamentalement orientée vers l'humain tout en gardant une approche structurée et innovante",
    },
    lifeMission: {
      vision: "Créer des environnements de travail plus humains et performants",
      mission: "Accompagner les équipes vers leur plein potentiel",
      alignment: 0.85,
    },
  },

  psychologicalAnalysis: {
    bigFive: {
      openness: {
        score: 4.2,
        percentile: 84,
        interpretation: "Forte curiosité intellectuelle et créativité",
      },
      conscientiousness: {
        score: 3.8,
        percentile: 76,
        interpretation: "Organisation et fiabilité élevées",
      },
      extraversion: {
        score: 3.5,
        percentile: 70,
        interpretation: "Sociable avec besoin d'équilibre",
      },
      agreeableness: {
        score: 4.0,
        percentile: 80,
        interpretation: "Grande capacité de collaboration",
      },
      emotionalStability: {
        score: 3.7,
        percentile: 74,
        interpretation: "Bonne gestion émotionnelle",
      },
    },
    identityStructure: {
      strengths: ["Leadership empathique", "Pensée analytique", "Créativité"],
      values: ["Développement continu", "Impact social", "Excellence"],
      challenges: ["Perfectionnisme", "Difficulté à déléguer"],
    },
  },

  cognitivePatterns: {
    thinkingStyle: {
      analytical: 0.7,
      creative: 0.8,
      primaryStyle: "Pensée systémique",
      secondaryStyle: "Innovation créative",
    },
    decisionMaking: {
      style: "Analytique avec validation intuitive",
      patterns: [
        "Recherche de données probantes",
        "Consultation des parties prenantes",
      ],
      challenges: ["Paralysie de l'analyse sous pression"],
    },
    behavioralPatterns: [
      {
        pattern: "Leadership collaboratif",
        frequency: "Quotidien",
        context: "Situations professionnelles",
      },
      {
        pattern: "Réflexion approfondie",
        frequency: "Régulier",
        context: "Prise de décision importante",
      },
    ],
  },

  emotionalProfile: {
    dominantEmotions: [
      {
        emotion: "Enthousiasme",
        intensity: 4,
        context: "Nouveaux projets",
      },
      {
        emotion: "Empathie",
        intensity: 5,
        context: "Relations interpersonnelles",
      },
    ],
    perfectDay: {
      activities: [
        {
          timeBlock: "Matin",
          activity: "Méditation et exercice",
          significance: "Équilibre et énergie",
        },
        {
          timeBlock: "Après-midi",
          activity: "Sessions de coaching",
          significance: "Impact et accomplissement",
        },
      ],
    },
    fears: [
      {
        description: "Ne pas atteindre son plein potentiel",
        root: "Perfectionnisme",
        copingStrategy: "Définition d'objectifs progressifs",
      },
    ],
    resilience: [
      "Adaptabilité élevée",
      "Réseau de soutien solide",
      "Pratiques de bien-être établies",
    ],
    superpower: "Leadership empathique",
    timeRelationship: "Orientation équilibrée présent-futur",
  },

  development: {
    axes: [
      {
        area: "Gestion du stress",
        priority: "high",
        recommendations: [
          "Programme de mindfulness",
          "Techniques de respiration",
          "Planification stratégique",
        ],
      },
      {
        area: "Délégation",
        priority: "medium",
        recommendations: [
          "Formation en management délégatif",
          "Définition de processus de délégation",
        ],
      },
    ],
    interventions: [
      {
        type: "Formation",
        description: "Programme de gestion du stress",
        exercises: [
          "Méditation guidée quotidienne",
          "Journal de stress",
          "Exercices de respiration",
        ],
        expectedOutcomes: [
          "Réduction du niveau de stress",
          "Meilleure prise de décision sous pression",
        ],
      },
    ],
  },

  vision: {
    longTermVision:
      "Devenir une référence en transformation organisationnelle positive",
    keyMilestones: [
      "Certification en coaching exécutif",
      "Publication d'un livre sur le leadership empathique",
      "Création d'un centre de formation",
    ],
    timeline: [
      {
        age: 25,
        event: "Premier poste de management",
        impact: "Découverte du leadership",
        emotions: ["Enthousiasme", "Défi"],
      },
      {
        age: 30,
        event: "Création de sa pratique de coaching",
        impact: "Autonomie professionnelle",
        emotions: ["Accomplissement", "Motivation"],
      },
    ],
  },

  lastUpdated: "2025-02-22T10:30:00Z",
  version: "2.0.0",
};
"`;

export const generateFiche = async ({ anals, patient = {} }) => {
  try {
    // const activity = convo.activity;
    //console.log("Analysing activity:", activity);

    const form = patient.signupForm || {};
    const messages = [
      {
        role: "system",
        content: fichePrompt,
      },
      {
        role: "user",
        content: JSON.stringify({ anals }),
      },
      {
        role: "user",
        content: JSON.stringify({ form }),
      },
    ];

    console.log(messages, "messages for fiche");

    const response = await llm.chat.completions.create({
      //odel: "gpt-4.1", // or your specific model
      ...getAiModelConfig("fiche"),
      messages: messages,
      // temperature: 0.7,
      //   max_tokens: 16384,
      // top_p: 1,
      //frequency_penalty: 0,
      //presence_penalty: 0,
      response_format: { type: "json_object" }, //new stuff
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("No completion choices returned from API");
    }

    const fiche = response.choices[0].message.content;

    // Optional: Add additional processing of the fiche here
    const result = {
      raw: response,
      fiche: fiche,
      metadata: {
        model: response.model,
        usage: response.usage,
        timestamp: new Date().toISOString(),
      },
    };
    console.log("fiche result:", result);
    return fiche;
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
  console.log("fiche result:", result);
} catch (error) {
  console.error("fiche failed:", error);
}
*/
