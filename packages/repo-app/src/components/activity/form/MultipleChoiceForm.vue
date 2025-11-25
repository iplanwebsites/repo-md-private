<!-- MultipleChoice.vue -->
<script setup>
import { ref, computed } from "vue";

const props = defineProps({
	lastQuestion: {
		type: Boolean,
		default: false,
	},
	// Complete question object containing all configuration
	question: {
		type: Object,
		required: true,
		validator: (question) => {
			return (
				question.id &&
				question.type &&
				question.question &&
				Array.isArray(question.options) &&
				question.options.every(
					(option) =>
						typeof option.id === "string" && typeof option.text === "string",
				)
			);
		},
	},
	// Current selection state
	selected: {
		type: [String, Array],
		default: null,
	},
	DEBUG: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits(["select"]);

// Internal state initialized from props.selected
const selectedOptions = computed(() => {
	if (props.selected === null) return [];
	return Array.isArray(props.selected) ? props.selected : [props.selected];
});

// Determine if multiple selection is allowed based on question configuration
const isMultipleMode = computed(() => {
	return (
		["multiple", "multiple_choice_multiple_correct"].includes(
			props.question.mode,
		) || props.question.allowMultiple === true
	);
});

// Compute selection limits from question configuration
const minSelections = computed(() => props.question.minSelections || 0);
const maxSelections = computed(() => props.question.maxSelections || Infinity);

// Handle randomization if specified
const displayedOptions = computed(() => {
	let options = [...props.question.options];
	if (props.question.randomize) {
		options = options.sort(() => Math.random() - 0.5);
	}
	return options;
});

// Check if selection is valid
const isValid = computed(() => {
	const selectionCount = selectedOptions.value.length;

	if (props.question.required && selectionCount === 0) {
		return false;
	}

	if (isMultipleMode.value) {
		return (
			selectionCount >= minSelections.value &&
			selectionCount <= maxSelections.value
		);
	}

	return true;
});

// Handle option selection
const handleSelect = (optionId) => {
	let newSelection;

	if (isMultipleMode.value) {
		if (selectedOptions.value.includes(optionId)) {
			// Remove if already selected
			newSelection = selectedOptions.value.filter((id) => id !== optionId);
		} else {
			// Add if under maxSelections
			if (selectedOptions.value.length < maxSelections.value) {
				newSelection = [...selectedOptions.value, optionId];
			} else {
				return;
			}
		}
	} else {
		// Single selection mode
		newSelection = [optionId];
	}

	// Validate and emit new selection
	if (newSelection.length >= minSelections.value) {
		emit("select", isMultipleMode.value ? newSelection : newSelection[0]);
	}
};

// Check if an option can be selected
const canSelect = (optionId) => {
	if (isMultipleMode.value) {
		return (
			selectedOptions.value.includes(optionId) ||
			selectedOptions.value.length < maxSelections.value
		);
	}
	return true;
};

// Get styles for option based on selection state
const getOptionStyles = (optionId) => {
	const selected = selectedOptions.value.includes(optionId);
	const selectable = canSelect(optionId);

	return {
		"bg-blue-50 border-blue-500 text-blue-700": selected,
		"bg-gray-50 hover:bg-gray-100 border-transparent text-gray-700":
			!selected && selectable,
		"opacity-50 cursor-not-allowed": !selectable,
		"border-2 rounded-lg transition-all duration-200": true,
	};
};

// Helper for selection requirements text
const getSelectionRequirements = computed(() => {
	if (!isMultipleMode.value) return "";

	if (maxSelections.value < Infinity) {
		return `Sélectionez de ${minSelections.value} à ${maxSelections.value} options`;
	}
	if (minSelections.value > 0) {
		return `Sélectionez au moins ${minSelections.value} options`;
	}
	return "";
});
</script>

<template>
  <div class="w-full max-w-2xl mx-auto">
    <!-- Question Header
    <div class="mb-4">
      <h3 class="text-lg font-medium text-gray-900">{{ question.question }}</h3>
      <p v-if="question.description" class="mt-1 text-sm text-gray-500">
        {{ question.description }}
      </p>
    </div> -->

    <!-- Selection Requirements -->
    <div v-if="getSelectionRequirements" class="mb-4 text-sm text-gray-600">
      {{ getSelectionRequirements }}
    </div>

    <!-- Options Grid -->
    <div class="space-y-2">
      <button
        v-for="option in displayedOptions"
        :key="option.id"
        @click="handleSelect(option.id)"
        :disabled="
          !canSelect(option.id) && !selectedOptions.includes(option.id)
        "
        class="w-full p-4 text-left flex items-center"
        :class="getOptionStyles(option.id)"
      >
        <!-- Selection Indicator -->
        <div class="mr-3 flex-shrink-0">
          <div
            v-if="isMultipleMode"
            class="w-5 h-5 border-2 rounded flex items-center justify-center"
            :class="
              selectedOptions.includes(option.id)
                ? 'border-blue-500 bg-blue-500'
                : 'border-gray-300'
            "
          >
            <svg
              v-if="selectedOptions.includes(option.id)"
              class="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div
            v-else
            class="w-5 h-5 border-2 rounded-full flex items-center justify-center"
            :class="
              selectedOptions.includes(option.id)
                ? 'border-blue-500'
                : 'border-gray-300'
            "
          >
            <div
              v-if="selectedOptions.includes(option.id)"
              class="w-3 h-3 rounded-full bg-blue-500"
            ></div>
          </div>
        </div>

        <!-- Option Content -->
        <div class="flex-grow">
          <span class="block font-medium">{{ option.text }}</span>
          <span v-if="option.description" class="block text-sm text-gray-500">
            {{ option.description }}
          </span>
        </div>
      </button>
    </div>

    <!-- Selection Summary -->
    <div
      v-if="DEBUG && selectedOptions.length > 0"
      class="mt-4 text-sm text-gray-600"
    >
      Selected: {{ selectedOptions.length }} /
      {{ maxSelections < Infinity ? maxSelections : "unlimited" }}
    </div>

    <!-- Explanation (if provided and something is selected) -->
    <div
      v-if="question.explanation && selectedOptions.length > 0"
      class="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700"
    >
      {{ question.explanation }}
    </div>
  </div>
</template>
