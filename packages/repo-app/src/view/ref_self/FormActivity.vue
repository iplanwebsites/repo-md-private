<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import trpc from "@/trpc";
import { debounce } from "lodash";

// Import all form components
import MultipleChoiceForm from "@/components/activity/form/MultipleChoiceForm.vue";
import LikertScale from "@/components/activity/form/LikertScale.vue";

import RankingForm from "@/components/activity/form/RankingForm.vue";
import OpenTextForm from "@/components/activity/form/OpenTextForm.vue";
import TrueFalseForm from "@/components/activity/form/TrueFalseForm.vue";
import NumericRange from "@/components/activity/form/NumericRange.vue";
import MatrixLikert from "@/components/activity/form/MatrixLikert.vue";
import ActivityOutro from "@/components/activity/ActivityOutro.vue";

import FormQuestion from "@/components/activity/form/FormQuestion.vue";

// mport ActivityDone from "@/components/activity/ActivityDone.vue";
import {
	ChevronLeft,
	ChevronRight,
	FileText,
	MessageSquare,
	Lightbulb,
	BookOpen,
	CheckCircle2,
	AlertCircle,
	HelpCircle,
	Book,
	Cog,
	CheckCircle,
	ArrowLeft,
} from "lucide-vue-next";

import { isLocalhost } from "@/lib/utils/devUtils.js";

import { useToast } from "@/components/ui/toast";
const { toast } = useToast();

// Layout management
const layoutOptions = [
	{ value: "one-page", label: "One Page" },
	{ value: "pages", label: "Pages" },
	{ value: "stories", label: "Stories" },
];
const selectedLayout = ref("pages"); // Default to pages (original behavior)

// State management
// Debug mode configuration
const DEBUG_ON_DEV = false;
const DEBUG = ref(isLocalhost() && DEBUG_ON_DEV);
const route = useRoute();
const convoId = computed(() => route.params.id);
const isLoading = ref(true);
const currentQuestionIndex = ref(0);
const userResponses = ref({});
const quizStarted = ref(false);
const quizCompleted = ref(false);
const activityConfig = ref({});
const isSubmitAttempted = ref(false);

// Helper function to display user-friendly question types
const getQuestionTypeDisplay = (type) => {
	const typeMap = {
		multiple: "Multiple Choice",
		multiple_random: "Multiple Choice (Randomized)",
		multiple_choice_preference: "Preference Selection",
		likert: "Likert Scale",
		strongly_disagree_agree5: "5-Point Agreement Scale",
		open_text: "Open Text Response",
		true_false: "True/False",
		numeric_range: "Numeric Range",
		matrix_likert: "Matrix Likert Scale",
		ranking: "Ranking",
	};
	return typeMap[type] || type;
};

// Computed properties
const formConfig = computed(() => activityConfig.value.formConfig);

const currentQuestion = computed(() => {
	if (!formConfig.value?.questions) return null;
	return formConfig.value.questions[currentQuestionIndex.value];
});

const progress = computed(() => {
	if (!formConfig.value?.questions) return 0;
	return (currentQuestionIndex.value / formConfig.value.questions.length) * 100;
});

const isLastQuestion = computed(() => {
	if (!formConfig.value?.questions) return false;
	return currentQuestionIndex.value === formConfig.value.questions.length - 1;
});

const isFirstQuestion = computed(() => currentQuestionIndex.value === 0);

// Computed property to determine if intro should be shown
const shouldShowIntro = computed(() => {
	return formConfig.value?.showIntro === true;
});

// Navigation methods
const goToPreviousQuestion = () => {
	if (currentQuestionIndex.value > 0) {
		currentQuestionIndex.value--;
	}
};

// Quiz state management
const startQuiz = () => {
	quizStarted.value = true;
	currentQuestionIndex.value = 0;
};

// New unified validation function that both layouts can use
const validateForm = () => {
	isSubmitAttempted.value = true;

	// Find all questions that are required but not answered
	const missingRequired = [];

	formConfig.value.questions.forEach((question, index) => {
		if (
			question.required &&
			!isQuestionAnswered(question.id, userResponses.value[question.id])
		) {
			missingRequired.push({
				index: index, // Zero-based index for navigation
				id: question.id,
				question: question.question,
			});
		}
	});

	// Clear any previous error highlighting
	formConfig.value.questions.forEach((question) => {
		question.highlightError = false;
	});

	if (missingRequired.length > 0) {
		// Set error highlighting for missing questions
		missingRequired.forEach((item) => {
			const questionObj = formConfig.value.questions.find(
				(q) => q.id === item.id,
			);
			if (questionObj) {
				questionObj.highlightError = true;
			}
		});

		// Show toast with count of missing questions
		toast({
			title: "Questions requises manquantes",
			description: `Veuillez répondre aux ${missingRequired.length} question(s) requise(s)`,
			variant: "destructive",
		});

		return { valid: false, missingRequired };
	}

	return { valid: true };
};

const completeQuiz = async () => {
	try {
		// Use shared validation function regardless of layout
		const validation = validateForm();

		if (!validation.valid) {
			if (selectedLayout.value === "pages") {
				// For pages layout: navigate to the first unanswered question
				currentQuestionIndex.value = validation.missingRequired[0].index;
			} else if (selectedLayout.value === "one-page") {
				// For single-page: scroll to the first unanswered question
				const firstMissingEl = document.getElementById(
					`question-${validation.missingRequired[0].id}`,
				);
				if (firstMissingEl) {
					firstMissingEl.scrollIntoView({
						behavior: "smooth",
						block: "center",
					});
				}
			}
			return;
		}

		// If we get here, validation has passed
		console.log(userResponses.value, "===userResponses formAnswers");

		// Save results to backend
		await trpc.saveFormActivityAnswers.mutate({
			convoId: convoId.value,
			formAnswers: userResponses.value,
		});

		quizCompleted.value = true;
		isSubmitAttempted.value = false; // Reset for potential restart
	} catch (error) {
		console.error("Failed to save quiz results:", error);
		alert("There was an error saving your responses. Please try again.");
	}
};

const handleStartOver = () => {
	// Reset all state variables
	userResponses.value = {};
	currentQuestionIndex.value = 0;
	quizCompleted.value = false;
	quizStarted.value = false;
	isSubmitAttempted.value = false;
};

// Updated to use the shared validation function
const validateAndSubmitOnePageForm = async () => {
	// Simply use the main completeQuiz function which now handles both layouts
	await completeQuiz();
};

const isQuestionAnswered = (questionId, answer) => {
	if (answer === undefined || answer === null || answer === "") {
		return false;
	}

	// For array-type answers (like multiple selection questions)
	if (Array.isArray(answer) && answer.length === 0) {
		return false;
	}

	// For object-type answers (like complex question types)
	if (
		typeof answer === "object" &&
		!Array.isArray(answer) &&
		Object.keys(answer).length === 0
	) {
		return false;
	}

	return true;
};

// Scoring calculation
const calculateScores = () => {
	if (!formConfig.value.scoring) return null;

	const scores = {};
	formConfig.value.scoring.dimensions.forEach((dimension) => {
		let dimensionScore = 0;
		Object.entries(dimension.weights).forEach(([questionId, weight]) => {
			const response = userResponses.value[questionId];
			const question = formConfig.value.questions.find(
				(q) => q.id === questionId,
			);
			const isReversed =
				formConfig.value.scoring.reversedQuestions.includes(questionId);

			if (["multiple", "multiple_random"].includes(question.questionType)) {
				const option = question.options.find((opt) => opt.id === response);
				dimensionScore += (option?.score || 0) * weight * (isReversed ? -1 : 1);
			} else if (
				["likert", "strongly_disagree_agree5"].includes(question.questionType)
			) {
				dimensionScore += response * weight * (isReversed ? -1 : 1);
			}
		});
		scores[dimension.id] = dimensionScore;
	});

	return scores;
};

// Data fetching
const convo = ref(null);
const fetchQuizData = async () => {
	if (!convoId.value) return;

	try {
		const response = await trpc.getConvoById.query({
			token: convoId.value,
		});
		convo.value = response;
		activityConfig.value = response.activity;
		if (activityConfig.value.formLayout) {
			//set it!
			selectedLayout.value = activityConfig.value.formLayout;
		}

		// Auto-start quiz if intro should be skipped
		if (!shouldShowIntro.value && !isLoading.value) {
			quizStarted.value = true;
		}
	} catch (error) {
		console.error("Failed to fetch quiz data:", error);
	} finally {
		isLoading.value = false;

		// Check if we should skip the intro after loading
		if (!shouldShowIntro.value) {
			quizStarted.value = true;
		}
	}
};

// Lifecycle hooks
onMounted(() => {
	fetchQuizData();
});

// Watchers
watch(
	[() => currentQuestion.value?.id, () => userResponses.value],
	([questionId]) => {
		if (questionId) {
			// Force a reactive update when needed
		}
	},
	{ deep: true },
);

const handleQuestionChange = (questionId, value) => {
	// Update the response value
	userResponses.value[questionId] = value;

	// Clear error highlighting if this question was previously marked as error
	const question = formConfig.value.questions.find((q) => q.id === questionId);
	if (question && question.highlightError) {
		// Only clear the error flag if the new value is valid
		if (isQuestionAnswered(questionId, value)) {
			question.highlightError = false;
		}
	}

	// If we're in one-page layout, we don't need to advance
	if (selectedLayout.value === "one-page") return;

	// For pages layout with auto-advance disabled, we may want to perform validation
	// but not advance to the next question
	validateQuestion(questionId);
};

// Method to validate a specific question
const validateQuestion = (questionId) => {
	const isRequired =
		formConfig.value.validation?.requiredQuestions?.includes(questionId);
	const hasAnswer = !!userResponses.value[questionId];

	if (isRequired && !hasAnswer) {
		// Could show inline validation here instead of an alert
		return false;
	}

	return true;
};

// Updated method for one-page layout question changes
const updateOnePageAnswer = (questionId, answer) => {
	userResponses.value[questionId] = answer;
	validateQuestion(questionId);
};

// Modified submitAnswer method that now only handles submission
const submitAnswer = async (answer) => {
	userResponses.value[currentQuestion.value.id] = answer;

	// If auto-advance is enabled in pages layout, handle navigation
	if (selectedLayout.value === "pages") {
		if (isLastQuestion.value) {
			await completeQuiz();
		} else {
			currentQuestionIndex.value++;
		}
	}
};

// Updated goToNextQuestion to include validation
const goToNextQuestion = async () => {
	if (selectedLayout.value === "one-page") {
		console.log("one-page layout - dont advance...");
		//validateAndSubmitOnePageForm();
		return;
	}

	const currentQuestionId = currentQuestion.value.id;

	// Validate the current question before proceeding
	if (!validateQuestion(currentQuestionId)) {
		alert("Please answer this question before proceeding.");
		return;
	}

	if (isLastQuestion.value) {
		await completeQuiz();
	} else {
		currentQuestionIndex.value++;
	}
};

// Add navigation method for progress bar
const navigateToQuestion = (targetIndex) => {
	// If we're going backward, just go
	if (targetIndex <= currentQuestionIndex.value) {
		currentQuestionIndex.value = targetIndex;
		return;
	}

	// If we're jumping ahead, only allow if current question is answered
	const currentQuestionId = currentQuestion.value.id;
	if (
		currentQuestion.value.required &&
		!isQuestionAnswered(
			currentQuestionId,
			userResponses.value[currentQuestionId],
		)
	) {
		// Show validation feedback
		formConfig.value.questions[currentQuestionIndex.value].highlightError =
			true;

		toast({
			title: "Question requise",
			description:
				"Veuillez répondre à la question actuelle avant de continuer",
			variant: "destructive",
		});
		return;
	}

	// Navigation allowed
	currentQuestionIndex.value = targetIndex;
};

// Add this computed property after your existing computed properties
const canContinue = computed(() => {
	// If there's no current question, we can't continue
	if (!currentQuestion.value) return false;

	const currentQuestionId = currentQuestion.value.id;
	const isRequired = currentQuestion.value.required;
	// formConfig.value.validation?.requiredQuestions?.includes(currentQuestionId);

	// If the question is required, check if it has been answered
	if (isRequired) {
		const answer = userResponses.value[currentQuestionId];
		// Different question types might have different "empty" values
		console.log("answer" + answer);
		if (answer === undefined || answer === null || answer === "") {
			return false;
		}

		// For array-type answers (like multiple selection questions), check if array is empty
		if (Array.isArray(answer) && answer.length === 0) {
			return false;
		}
	}

	// If we get here, either the question is not required or it has been answered
	return true;
});

// For the one-page layout, check if all required questions are answered
const allRequiredQuestionsAnswered = computed(() => {
	const requiredQuestions =
		formConfig.value?.validation?.requiredQuestions || [];
	if (requiredQuestions.length === 0) return true;

	// Check if all required questions have been answered
	return requiredQuestions.every((questionId) => {
		const answer = userResponses.value[questionId];

		// Check if the answer exists and isn't empty
		if (answer === undefined || answer === null || answer === "") {
			return false;
		}

		// For array-type answers, check if array is empty
		if (Array.isArray(answer) && answer.length === 0) {
			return false;
		}

		return true;
	});
});
</script>

<template>
  <!-- Main container with full height and background -->

  <div class="min-h-screen bg-gray-50" v-if="!isLoading">
    <!-- Flex container for three-column layout -->
    <div class="flex flex-row h-screen">
      <!-- Left Column: Debug Question List (Conditional) -->
      <div
        v-if="DEBUG"
        class="w-1/4 bg-white shadow-md overflow-y-auto p-4 border-r"
      >
        <!-- Debug panel header -->
        <h2 class="text-lg font-semibold mb-4">Question List</h2>
        <Button @click="DEBUG = false" class="w-full mb-4"
          >Hide debugger</Button
        >

        <!-- Layout Selector -->
        <div class="flex items-center" v-if="!isLoading && !quizCompleted">
          <label
            for="layout-selector"
            class="mr-2 text-sm font-medium text-gray-700"
            >Layout:</label
          >
          <select
            id="layout-selector"
            v-model="selectedLayout"
            class="block w-40 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option
              v-for="option in layoutOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- Question list for quick navigation -->
        <div class="space-y-2">
          <button
            v-for="(question, index) in formConfig?.questions"
            :key="question.id"
            @click="navigateToQuestion(index)"
            class="w-full text-left px-3 py-1.5 text-sm rounded whitespace-normal"
            :class="[
              currentQuestionIndex === index
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
              'border',
            ]"
          >
            <!--  -->
            <span class="font-medium">{{ question.id }}</span>
            <br />
            <span class="font-medium" v-if="question.highlightError">
              ❌ highlightError</span
            >
            <br />
            <span class="text-xs text-gray-500">[{{ question.type }}]</span>
            <br />

            {{ question.question }}
          </button>
        </div>
      </div>

      <!-- Center Column: Main Form Content -->
      <div
        class="flex-1 overflow-y-auto flex flex-col"
        :class="{
          'w-full': !DEBUG,
          'w-1/2': DEBUG,
        }"
      >
        <!-- Header Section -->
        <header class="bg-white shadow">
          <div class="max-w-7xl mx-auto px-4 py-4">
            <h1 class="text-xl font-bold text-gray-900">
              {{ activityConfig.activityName || "NONAME" }}
            </h1>
          </div>
        </header>

        <!-- Progress Bar Section -->
        <div
          v-if="selectedLayout == 'pages'"
          class="w-full px-4 py-2 bg-white border-b"
        >
          <!-- Progress segments -->
          <div class="max-w-3xl mx-auto flex space-x-1">
            <div
              v-for="(question, index) in formConfig?.questions"
              :key="question.id"
              @click="navigateToQuestion(index)"
              class="flex-1 h-2 rounded cursor-pointer transition-all duration-200 hover:opacity-80"
              :class="[
                {
                  'bg-blue-500': index < currentQuestionIndex,
                  'bg-blue-300': index === currentQuestionIndex,
                  'bg-gray-200': index > currentQuestionIndex,
                  'bg-green-500': userResponses[question.id],
                },
              ]"
              :title="question.question"
            ></div>
          </div>

          <!-- Question counter -->
          <div class="max-w-3xl mx-auto mt-2 text-sm text-gray-600">
            Question {{ currentQuestionIndex + 1 }} de
            {{ formConfig?.questions?.length }}
          </div>
        </div>

        <!-- Main Content Area -->
        <main class="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
          <!-- Loading State -->
          <div v-if="isLoading" class="text-center py-8">
            <div class="animate-spin h-8 w-8 mx-auto mb-4">⌛</div>
            <p>Chargement...</p>
          </div>

          <!-- Introduction Screen (Only shown if shouldShowIntro is true) -->
          <div
            v-else-if="shouldShowIntro && !quizStarted && !quizCompleted"
            class="bg-white shadow rounded-lg p-6"
          >
            <h2 class="text-2xl font-bold mb-4">
              {{ formConfig?.intro?.title }}
            </h2>
            <p class="mb-4">{{ formConfig?.intro?.description }}</p>
            <ul class="list-disc pl-6 mb-6">
              <li
                v-for="instruction in formConfig?.intro?.instructions"
                :key="instruction"
                class="mb-2"
              >
                {{ instruction }}
              </li>
            </ul>
            <button
              @click="startQuiz"
              class="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
              Débuter
            </button>
          </div>

          <!-- Question Display -->
          <div
            v-else-if="!quizCompleted"
            class="bg-white shadow rounded-lg p-6"
          >
            <div
              v-if="selectedLayout == 'pages'"
              class="bg-red shadow rounded-lg p-6"
              style="background: #e0f0f0"
            >
              <button
                v-if="!isFirstQuestion"
                @click="goToPreviousQuestion"
                :disabled="isFirstQuestion"
                class="mb-5 px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft class="w-4 h-4" />
              </button>

              <!-- Question Type Badge
              <div class="mb-4">
                <span
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  {{ getQuestionTypeDisplay(currentQuestion?.type) }}
                </span>
              </div>
               -->

              <!-- Question Content -->
              <div v-if="currentQuestion && currentQuestion.type">
                <!-- Pre-question text if available -->
                <p
                  class="text-gray-600 mb-4"
                  v-if="currentQuestion.preQuestion"
                >
                  {{ currentQuestion.preQuestion }}
                </p>

                <!-- Main question text -->
                <h3 class="text-2xl font-medium mb-2">
                  {{ currentQuestion.question }}
                </h3>

                <!-- Question description if available -->
                <p
                  v-if="currentQuestion.description"
                  class="text-gray-600 mb-4"
                >
                  {{ currentQuestion.description }}
                </p>

                <!-- Dynamic Question Component -->
                <!-- Open Text Questions -->

                <span class="font-medium" v-if="currentQuestion.highlightError">
                  ❌
                </span>

                <FormQuestion
                  :layout="selectedLayout"
                  :autoAdvance="formConfig.autoAdvance"
                  :question="currentQuestion"
                  :key="currentQuestion.id + 'qq'"
                  :selected="userResponses[currentQuestion.id]"
                  @change="
                    (value) => handleQuestionChange(currentQuestion.id, value)
                  "
                  @advance="goToNextQuestion"
                  :highlightError="currentQuestion.highlightError"
                />

                <hr />

                <!-- Navigation Buttons -->
                <div class="flex justify-between mt-6">
                  <!--
                  <button
                    @click="goToPreviousQuestion"
                    :disabled="isFirstQuestion"
                    class="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                   

                  <Button
                    @click="goToNextQuestion"
                    :disabled="!canContinue"
                    class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    {{ isLastQuestion ? "Complete" : "Next" }}
                  </Button>
 -->

                  <div
                    class="md:inline-block fixed md:static bottom-0 left-0 right-0 p-4 md:p-0 bg-white md:bg-transparent border-t md:border-t-0 border-gray-200 md:text-right"
                  >
                    <Button
                      @click="goToNextQuestion"
                      :disabled="!canContinue"
                      size="lg"
                      class="w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {{ isLastQuestion ? "Continuer" : "Continuer" }}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="selectedLayout == 'one-page'"
              class="bg-white shadow rounded-lg p-6"
            >
              <h2 class="text-xl font-bold mb-6">
                {{ activityConfig.activityName || "NONAME" }}
              </h2>

              <!-- Form Instructions -->
              <div
                v-if="formConfig?.intro && shouldShowIntro"
                class="mb-8 p-4 bg-blue-50 rounded-lg"
              >
                <h3 class="text-lg font-medium mb-2">Instructions</h3>
                <p class="mb-3">{{ formConfig?.intro?.description }}</p>
                <ul class="list-disc pl-6">
                  <li
                    v-for="instruction in formConfig?.intro?.instructions"
                    :key="instruction"
                    class="mb-1"
                  >
                    {{ instruction }}
                  </li>
                </ul>
              </div>

              <!-- All Questions Display -->
              <div v-if="formConfig?.questions" class="space-y-12">
                <div
                  v-for="(question, index) in formConfig?.questions"
                  :key="question.id"
                  :id="`question-${question.id}`"
                  class="p-6 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors"
                  :class="{
                    'border-red-300 bg-red-50':
                      formConfig.validation?.requiredQuestions?.includes(
                        question.id
                      ) &&
                      !userResponses[question.id] &&
                      isSubmitAttempted,
                  }"
                  style="background: #e0f0f0"
                >
                  <!-- Pre-question text if available -->
                  <p class="text-gray-600 mb-4" v-if="question.preQuestion">
                    {{ question.preQuestion }}
                  </p>

                  <!-- Main question text -->
                  <h4 class="text-2xl font-medium mb-2">
                    {{ question.question }}
                    <span
                      v-if="
                        formConfig.validation?.requiredQuestions?.includes(
                          question.id
                        )
                      "
                      class="text-red-500 ml-1"
                      >*</span
                    >
                  </h4>

                  <!-- Question description if available -->
                  <p v-if="question.description" class="text-gray-600 mb-4">
                    {{ question.description }}
                  </p>

                  <span class="font-medium" v-if="question.highlightError">
                    ❌
                  </span>

                  <!-- Dynamic Question Component -->
                  <FormQuestion
                    :layout="selectedLayout"
                    :autoAdvance="formConfig.autoAdvance"
                    :question="question"
                    :key="question.id"
                    :selected="userResponses[question.id]"
                    @change="
                      (value) => handleQuestionChange(question.id, value)
                    "
                    @advance="goToNextQuestion"
                    :highlightError="question.highlightError"
                  />

                  <!-- Required question indicator -->
                  <p
                    v-if="
                      formConfig.validation?.requiredQuestions?.includes(
                        question.id
                      )
                    "
                    class="text-xs text-red-500 mt-2"
                  >
                    * Requis
                  </p>
                </div>
              </div>

              <!-- Submit Button -->
              <div class="mt-10 flex justify-end">
                <button
                  @click="validateAndSubmitOnePageForm"
                  class="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Terminer
                </button>
              </div>
            </div>

            <div
              v-if="selectedLayout == 'stories'"
              class="bg-red shadow rounded-lg p-6"
            >
              stories / todo
            </div>
          </div>

          <!-- Completion Screen -->

          <ActivityOutro
            v-if="quizCompleted"
            :debug="DEBUG"
            :activityConfig="activityConfig"
            @startOver="handleStartOver"
            :nextActivityInviteUrl="convo.nextActivityInviteUrl"
          />
        </main>
      </div>

      <!-- Right Column: Debug Information (Conditional) -->
      <div
        v-if="DEBUG"
        class="w-1/4 bg-white shadow-md overflow-y-auto p-4 border-l"
      >
        <h2 class="text-lg font-semibold mb-4">Debug Information</h2>
        <div class="space-y-4">
          <json-debug :data="convo" :expanded="false" label="convo" />
          <json-debug
            :data="activityConfig"
            :expanded="false"
            label="Activity config"
          />
          <json-debug :data="formConfig" :expanded="false" label="formConfig" />
          <json-debug
            :data="currentQuestion"
            :expanded="false"
            label="currentQuestion"
          />
          <json-debug
            :data="userResponses"
            :expanded="1"
            label="userResponses"
          />
        </div>
      </div>
    </div>
  </div>
</template>
