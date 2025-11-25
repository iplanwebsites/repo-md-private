<script setup>
import { computed, watch } from "vue";
import MultipleChoiceForm from "@/components/activity/form/MultipleChoiceForm.vue";
import LikertScale from "@/components/activity/form/LikertScale.vue";
import OpenTextForm from "@/components/activity/form/OpenTextForm.vue";
import RankingForm from "@/components/activity/form/RankingForm.vue";
import TrueFalseForm from "@/components/activity/form/TrueFalseForm.vue";
import NumericRange from "@/components/activity/form/NumericRange.vue";
import MatrixLikert from "@/components/activity/form/MatrixLikert.vue";

const props = defineProps({
	question: {
		type: Object,
		required: true,
	},
	selected: {
		type: [String, Number, Array, Object, Boolean],
		default: null,
	},
	isLastQuestion: {
		type: Boolean,
		default: false,
	},
	highlightError: {
		type: Boolean,
		default: false,
	},

	layout: {
		type: String,
		default: "pages",
	},

	autoAdvance: {
		type: Boolean,
		default: false,
	},
});

const shouldAutoAdvanceOnChange = computed(() => {
	if (
		props.layout === "pages" &&
		props.autoAdvance &&
		props.question.autoAdvance !== false
	) {
		return true;
	}
	return false;
});

const emit = defineEmits([
	//  "submit", // legacy
	"change", // emitted when value changes
	"advance", // emitted when ready to advance to next question
]);

// Debounce function for text inputs
const debounce = (fn, delay = 300) => {
	let timeout;
	return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => fn(...args), delay);
	};
};

// Helper function to handle submit events from child components
const handleSubmit = (value) => {
	// For legacy support
	// emit("submit", value);

	// First emit the change event for all component types
	emit("change", value);

	// For pages layout, if auto-advance is enabled, also emit advance
	if (shouldAutoAdvanceOnChange.value) {
		emit("advance");
	}
};

// Handle changes without automatically advancing
const handleChange = (value) => {
	emit("change", value);
};

// Watch for changes in the selected value
const debouncedEmitChange = debounce((newValue) => {
	emit("change", newValue);
}, 300);

// Watch selected value and emit change events for text inputs
watch(
	() => props.selected,
	(newValue) => {
		// For text inputs that might change rapidly, use debounced version
		if (questionType.value === "openText") {
			debouncedEmitChange(newValue);
		}
	},
	{ deep: true },
);

// Computed property to determine question type category
const questionType = computed(() => {
	const type = props.question.type;

	// Standardizing type naming for simpler condition checks
	if (["open_text_short", "open_text_long", "open_text"].includes(type)) {
		return "openText";
	}

	if (type === "true_false") {
		return "trueFalse";
	}

	if (type === "numeric_range") {
		return "numericRange";
	}

	if (type === "matrix_likert") {
		return "matrixLikert";
	}

	if (
		[
			"multiple_choice",
			"multiple_choice_single_correct",
			"multiple_choice_multiple_correct",
		].includes(type)
	) {
		return "multipleChoice";
	}

	if (type === "ranking") {
		return "ranking";
	}

	if (["likert", "strongly_disagree_agree5", "likert_scale"].includes(type)) {
		return "likert";
	}

	return null;
});

// computed class for :highlightError="highlightError"

const errorClass = computed(() => {
	return props.highlightError ? "border-red-500" : "";
});
</script>

<template>
  <div v-if="questionType && question.type" :class="errorClass">
    <!-- Open Text Questions -->
    <OpenTextForm
      v-if="questionType === 'openText'"
      :question="question"
      :value="selected"
      @submit="handleSubmit"
      @change="handleChange"
      :highlightError="highlightError"
    />

    <!-- True/False Questions -->
    <TrueFalseForm
      v-else-if="questionType === 'trueFalse'"
      :question="question"
      :selected="selected"
      @select="handleSubmit"
      :highlightError="highlightError"
    />

    <!-- Numeric Range Questions -->
    <NumericRange
      v-else-if="questionType === 'numericRange'"
      :question="question"
      :selected="selected"
      :lastQuestion="isLastQuestion"
      @select="handleSubmit"
      :highlightError="highlightError"
    />

    <!-- Matrix Likert Scale Questions -->
    <MatrixLikert
      v-else-if="questionType === 'matrixLikert'"
      :question="question"
      :selected="selected"
      @select="handleSubmit"
      :highlightError="highlightError"
    />

    <!-- Multiple Choice Questions -->
    <MultipleChoiceForm
      v-else-if="questionType === 'multipleChoice'"
      :question="question"
      :selected="selected"
      @select="handleSubmit"
      :highlightError="highlightError"
    />

    <!-- Ranking Questions -->
    <RankingForm
      v-else-if="questionType === 'ranking'"
      :question="question"
      :value="selected"
      @submit="handleSubmit"
      :highlightError="highlightError"
    />

    <!-- Likert Scale Questions -->
    <LikertScale
      v-else-if="questionType === 'likert'"
      :question="question"
      :scale="question.scale"
      :selected="selected"
      @select="handleSubmit"
      :highlightError="highlightError"
    />

    <!-- Fallback for unhandled question types -->
    <div v-else class="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
      <p class="text-yellow-700">
        Unsupported question type: {{ question.type }}
      </p>
      {{ question }}
    </div>
  </div>
</template>
