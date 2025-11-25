/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import _ from "lodash";

// Custom error class for validation errors
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validates the structure and content of a question specification
 * @param {Object} question - Question specification to validate
 * @throws {ValidationError} If the question specification is invalid
 */
function validateQuestion(question) {
  // Check required fields
  const requiredFields = ["id", "type", "dimension"];
  const missingFields = requiredFields.filter((field) => !question[field]);

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Question missing required fields: ${missingFields.join(", ")}`
    );
  }

  // Validate dimension
  const validDimensions = ["O", "C", "E", "A", "N"];
  if (!validDimensions.includes(question.dimension)) {
    throw new ValidationError(
      `Invalid dimension "${
        question.dimension
      }". Must be one of: ${validDimensions.join(", ")}`
    );
  }

  // Validate question type and associated fields
  if (question.type === "numeric_range") {
    if (
      !question.range ||
      typeof question.range.min !== "number" ||
      typeof question.range.max !== "number"
    ) {
      throw new ValidationError(
        `Numeric range question must specify valid min and max values`
      );
    }
    if (question.range.min >= question.range.max) {
      throw new ValidationError(
        `Range min (${question.range.min}) must be less than max (${question.range.max})`
      );
    }
  } else if (question.type === "likert_scale") {
    // Likert scales are assumed to be 1-5
    // You could make this configurable if needed
  } else {
    throw new ValidationError(
      `Invalid question type "${question.type}". Must be "likert_scale" or "numeric_range"`
    );
  }
}

/**
 * Validates answer values against question specifications
 * @param {number} answer - The provided answer
 * @param {Object} question - The question specification
 * @throws {ValidationError} If the answer is invalid
 */
function validateAnswer(answer, question) {
  if (typeof answer !== "number") {
    throw new ValidationError(
      `Answer for question ${
        question.id
      } must be a number, got ${typeof answer}`
    );
  }

  if (question.type === "likert_scale") {
    if (answer < 1 || answer > 5 || !Number.isInteger(answer)) {
      throw new ValidationError(
        `Likert scale answer must be an integer between 1 and 5, got ${answer}`
      );
    }
  } else if (question.type === "numeric_range") {
    if (answer < question.range.min || answer > question.range.max) {
      throw new ValidationError(
        `Answer ${answer} is outside valid range ${question.range.min}-${question.range.max}`
      );
    }
  }
}

export function analyzeBigFive(answers, questions) {
  try {
    // Validate input arguments
    if (!answers || typeof answers !== "object") {
      throw new ValidationError("Answers must be provided as an object");
    }
    console.log("✨✨✨✨ ANSEWERS", answers);
    if (!Array.isArray(questions) || questions.length === 0) {
      console.log("✨✨✨✨ questions", questions);
      throw new ValidationError(
        "✨✨✨Questions must be provided as a non-empty array"
      );
    }

    // Initialize dimension scores with error checking for duplicate dimensions
    const dimensions = {
      O: {
        scores: [],
        total: 0,
        average: 0,
        label: "Ouverture à l'expérience",
      },
      C: { scores: [], total: 0, average: 0, label: "Conscience" },
      E: { scores: [], total: 0, average: 0, label: "Extraversion" },
      A: { scores: [], total: 0, average: 0, label: "Agréabilité" },
      N: { scores: [], total: 0, average: 0, label: "Névrosisme" },
    };

    // Validate all questions first
    questions.forEach((question) => {
      validateQuestion(question);
    });

    // Check for missing answers
    const missingAnswers = questions
      .filter((q) => answers[q.id] === undefined)
      .map((q) => q.id);

    if (missingAnswers.length > 0) {
      throw new ValidationError(
        `Missing answers for questions: ${missingAnswers.join(", ")}`
      );
    }

    // Process each question with validation
    questions.forEach((question) => {
      const response = answers[question.id];

      // Validate the answer
      validateAnswer(response, question);

      // Normalize the score
      let normalizedScore;
      if (question.type === "likert_scale") {
        normalizedScore = normalizeScore(
          response,
          1,
          5,
          question.reverse_coded
        );
      } else if (question.type === "numeric_range") {
        normalizedScore = normalizeScore(
          response,
          question.range.min,
          question.range.max,
          question.reverse_coded
        );
      }

      // Add score to appropriate dimension
      dimensions[question.dimension].scores.push({
        questionId: question.id,
        score: normalizedScore,
        description: question.description,
      });
    });

    // Calculate final scores with validation
    Object.keys(dimensions).forEach((dim) => {
      const dimensionData = dimensions[dim];

      if (dimensionData.scores.length === 0) {
        throw new ValidationError(
          `No valid questions found for dimension ${dim}`
        );
      }

      dimensionData.total = _.sumBy(dimensionData.scores, "score");
      dimensionData.average = dimensionData.total / dimensionData.scores.length;
      // Round to 2 decimal places
      dimensionData.average = Math.round(dimensionData.average * 100) / 100;
    });

    // Add interpretation levels
    const results = addInterpretationLevels(dimensions);

    return {
      dimensions: results,
      summary: generateSummary(results),
    };
  } catch (error) {
    // Add context to the error message
    if (error instanceof ValidationError) {
      throw new ValidationError(
        `Personality analysis failed: ${error.message}`
      );
    }
    // For unexpected errors, preserve the stack trace
    throw error;
  }
}

/**
 * Normalizes a score to a 0-1 scale with input validation
 * @param {number} score - Raw score
 * @param {number} min - Minimum possible score
 * @param {number} max - Maximum possible score
 * @param {boolean} reverse - Whether to reverse the score
 * @returns {number} Normalized score between 0 and 1
 * @throws {ValidationError} If inputs are invalid
 */
function normalizeScore(score, min, max, reverse = false) {
  // Validate inputs
  if (typeof score !== "number" || isNaN(score)) {
    throw new ValidationError(`Invalid score value: ${score}`);
  }
  if (typeof min !== "number" || typeof max !== "number" || min >= max) {
    throw new ValidationError(`Invalid range: min=${min}, max=${max}`);
  }

  // First normalize to 0-1 scale
  let normalized = (score - min) / (max - min);

  // Check for out of bounds results (can happen with floating point arithmetic)
  if (normalized < 0) normalized = 0;
  if (normalized > 1) normalized = 1;

  // Reverse if needed
  return reverse ? 1 - normalized : normalized;
}

// The rest of the helper functions remain the same
function addInterpretationLevels(dimensions) {
  const interpretationThresholds = {
    low: 0.33,
    medium: 0.66,
  };

  Object.keys(dimensions).forEach((dim) => {
    const average = dimensions[dim].average;
    let level;

    if (average < interpretationThresholds.low) {
      level = "Faible";
    } else if (average < interpretationThresholds.medium) {
      level = "Modéré";
    } else {
      level = "Élevé";
    }

    dimensions[dim].level = level;
  });

  return dimensions;
}

function generateSummary(dimensions) {
  const summaries = [];

  Object.entries(dimensions).forEach(([dim, data]) => {
    summaries.push(
      `${data.label}: ${data.level} (${Math.round(data.average * 100)}%)`
    );
  });

  return summaries.join("\n");
}
