/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

/**
 * Constructs a comprehensive form data summary with answers and context
 * @param {Array} formAnswers - The answers provided by the user
 * @param {Object} formConfig - The configuration of the form including questions
 * @returns {Array} An array of formatted question-answer pairs with context
 */
function constructFormDataWithAnswers(formAnswers, formConfig) {
  if (!formConfig || !formConfig.questions || !formAnswers) {
    return [];
  }

  return formConfig.questions.map((question) => {
    const questionId = question.id;
    const userAnswer = formAnswers[questionId];

    // Create the base question data
    const questionData = {
      id: questionId,
      type: question.type,
      question: question.question,
      description: question.description || null,
      preQuestion: question.preQuestion || null,
      userAnswer: null, // Will be populated based on question type
      formattedAnswer: null, // Human-readable version of the answer
      options: null, // For questions with options
      required: question.required || false,
    };

    // Process different question types
    switch (question.type) {
      case "multiple_choice":
        questionData.options = question.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          correct: opt.correct !== undefined ? opt.correct : null,
          metadata: opt.metadata || null,
        }));
        questionData.mode = question.mode;
        questionData.explanation = question.explanation || null;

        if (question.mode === "single" || question.mode === "preference") {
          questionData.userAnswer = userAnswer;
          // Find the text of the selected option
          const selectedOption = question.options.find(
            (opt) => opt.id === userAnswer
          );
          questionData.formattedAnswer = selectedOption
            ? selectedOption.text
            : "No answer";
        } else if (question.mode === "multiple") {
          questionData.userAnswer = Array.isArray(userAnswer) ? userAnswer : [];
          // Get text for all selected options
          const selectedTexts = questionData.userAnswer.map((answerId) => {
            const option = question.options.find((opt) => opt.id === answerId);
            return option ? option.text : answerId;
          });
          questionData.formattedAnswer = selectedTexts.join(", ");
          questionData.minSelections = question.minSelections;
          questionData.maxSelections = question.maxSelections;
        }
        break;

      case "true_false":
        questionData.options = question.options;
        questionData.userAnswer = userAnswer;
        questionData.formattedAnswer =
          userAnswer === "A"
            ? "True"
            : userAnswer === "B"
            ? "False"
            : "No answer";
        questionData.explanation = question.explanation || null;
        break;

      case "likert_scale":
        questionData.scale = question.scale;
        questionData.userAnswer = userAnswer;
        const label = question.scale?.labels?.[userAnswer];
        questionData.formattedAnswer = label || `Rating: ${userAnswer}`;
        break;

      case "ranking":
        questionData.options = question.options;
        questionData.userAnswer = userAnswer;
        // Format as "1. Option A, 2. Option B, etc."
        if (Array.isArray(userAnswer)) {
          const rankedOptions = userAnswer.map((optionId, index) => {
            const option = question.options.find((opt) => opt.id === optionId);
            return `${index + 1}. ${option ? option.text : optionId}`;
          });
          questionData.formattedAnswer = rankedOptions.join(", ");
        } else {
          questionData.formattedAnswer = "No ranking provided";
        }
        break;

      case "open_text":
        questionData.userAnswer = userAnswer;
        questionData.formattedAnswer = userAnswer || "No response";
        questionData.responseConfig = question.responseConfig;
        questionData.long = question.long;
        break;

      case "numeric_range":
        questionData.range = question.range;
        questionData.userAnswer = userAnswer;
        questionData.formattedAnswer = `${userAnswer}${
          question.unit ? " " + question.unit : ""
        }`;
        break;

      case "matrix_likert":
        questionData.statements = question.statements;
        questionData.scale = question.scale;
        questionData.userAnswer = userAnswer;

        // Format as "Statement 1: Agree, Statement 2: Disagree, etc."
        if (typeof userAnswer === "object" && userAnswer !== null) {
          const statementResponses = Object.entries(userAnswer).map(
            ([statementId, rating]) => {
              const statement = question.statements.find(
                (s) => s.id === statementId
              );
              const ratingLabel = question.scale?.labels?.[rating] || rating;
              return `${
                statement ? statement.text : statementId
              }: ${ratingLabel}`;
            }
          );
          questionData.formattedAnswer = statementResponses.join(", ");
        } else {
          questionData.formattedAnswer = "No matrix responses";
        }
        break;

      default:
        questionData.userAnswer = userAnswer;
        questionData.formattedAnswer = JSON.stringify(userAnswer);
    }

    return questionData;
  });
}

/**
 * Generates a plain text summary of the form data
 * @param {Array} formattedData - The formatted form data from constructFormDataWithAnswers
 * @returns {string} A plain text summary of the form
 */
function generatePlainTextSummary(formattedData) {
  if (
    !formattedData ||
    !Array.isArray(formattedData) ||
    formattedData.length === 0
  ) {
    return "No form data available.";
  }

  let summary = "FORM SUMMARY\n============\n\n";

  formattedData.forEach((item, index) => {
    summary += `QUESTION ${index + 1} [ID: ${item.id}] (${item.type})\n`;

    if (item.description) {
      summary += `Description: ${item.description}\n`;
    }

    if (item.preQuestion) {
      summary += `Context: "${item.preQuestion}"\n`;
    }

    summary += `Q: ${item.question}\n`;

    // Add options for question types that have them
    if (item.options && Array.isArray(item.options)) {
      summary += "Options:\n";
      item.options.forEach((opt) => {
        let optionText = `  - ${opt.id}: ${opt.text}`;

        if (opt.correct !== null && opt.correct !== undefined) {
          optionText += opt.correct ? " [CORRECT]" : " [INCORRECT]";
        }

        summary += optionText + "\n";
      });
    } else if (item.scale) {
      summary += "Scale:\n";
      for (let i = item.scale.min; i <= item.scale.max; i++) {
        const label = item.scale.labels?.[i] || i;
        summary += `  - ${i}: ${label}\n`;
      }
    }

    // Add statements for matrix questions
    if (item.statements) {
      summary += "Statements:\n";
      item.statements.forEach((stmt) => {
        summary += `  - ${stmt.id}: ${stmt.text}\n`;
      });
    }

    // Add the user's answer
    summary += `Answer: ${item.formattedAnswer}\n`;

    // Add raw answer data if complex
    if (typeof item.userAnswer === "object" && item.userAnswer !== null) {
      summary += `Raw Answer: ${JSON.stringify(item.userAnswer)}\n`;
    }

    // Add explanation if available
    if (item.explanation) {
      summary += `Explanation: ${item.explanation}\n`;
    }

    summary += "\n---\n\n";
  });

  return summary;
}

// Export the functions to be used in your analysis pipeline
export { constructFormDataWithAnswers, generatePlainTextSummary };
