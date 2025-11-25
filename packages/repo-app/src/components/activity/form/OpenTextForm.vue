<script setup>
import { ref, computed, watch } from "vue";
import VoiceInputBrowser from "./VoiceInputBrowser.vue";

const props = defineProps({
	question: {
		type: Object,
		required: true,
		validator: (value) => {
			return (
				typeof value.question === "string" &&
				typeof value.description === "string"
			);
		},
	},
	value: {
		type: String,
		default: "",
	},
	selected: {
		type: String,
		default: "",
	},
	lastQuestion: {
		type: Boolean,
		default: false,
	},
});

const ENABLE_CHAR_LIMITS = false;

const emit = defineEmits(["submit", "change"]);

// Extract properties from question object with defaults
const responseConfig = computed(() => props.question.responseConfig || {});
const isLongResponse = computed(() => props.question.long || false);
const hasLlmValidation = computed(() => props.question.llmValidation || false);
const hasAudioInput = computed(() => props.question.audioInput !== false); // default to true
const largeImageUrl = computed(() => props.question.largeImage || "");

// Internal state - initialize with selected prop first, then fall back to value
const answer = ref(props.selected || props.value || "");
const isRecording = ref(false);
const isProcessing = ref(false);
const errorMessage = ref("");

// Handle new voice input from the VoiceInputBrowser component
const handleNewVoiceInput = (newText) => {
	// Append new text with proper spacing
	if (!answer.value.endsWith(newText.trim())) {
		answer.value = answer.value
			? answer.value + (answer.value.endsWith(" ") ? "" : " ") + newText
			: newText;
	}
};

// Watch for external value or selected prop changes
watch(
	() => props.value,
	(newValue) => {
		if (newValue !== answer.value) {
			answer.value = newValue;
		}
	},
);

watch(
	() => props.selected,
	(newValue) => {
		if (newValue !== answer.value) {
			answer.value = newValue;
		}
	},
);

// Computed properties for input configuration
const config = computed(() => {
	const defaults = {
		rows: 3,
	};

	if (ENABLE_CHAR_LIMITS) {
		return {
			...defaults,
			minLength:
				responseConfig.value.minLength || (isLongResponse.value ? 50 : 10),
			maxLength:
				responseConfig.value.maxLength || (isLongResponse.value ? 500 : 100),
			placeholder:
				responseConfig.value.placeholder || "Enter your response here...",
		};
	} else {
		return {
			...defaults,
			placeholder:
				responseConfig.value.placeholder || "Enter your response here...",
		};
	}
});

// Validation
const isValid = computed(() => {
	if (ENABLE_CHAR_LIMITS) {
		const length = answer.value.length;
		return length >= config.value.minLength && length <= config.value.maxLength;
	} else {
		return true;
	}
});

const validationMessage = computed(() => {
	if (ENABLE_CHAR_LIMITS) {
		const length = answer.value.length;
		if (length < config.value.minLength) {
			return `Please enter at least ${config.value.minLength} characters`;
		}
		if (length > config.value.maxLength) {
			return `Response must be no longer than ${config.value.maxLength} characters`;
		}
	}
	return "";
});

// Text handling
const handleInput = (event) => {
	answer.value = event.target.value;
	errorMessage.value = "";
	console.log("handleInput  input", answer.value);
	//TODO: emit change event here.
	emit("change", answer.value);
};

const handleSubmit = () => {
	if (isValid.value) {
		emit("submit", answer.value);
	} else {
		errorMessage.value = validationMessage.value;
	}
};
</script>

<template>
  <div class="w-full max-w-2xl mx-auto">
    <img v-if="largeImageUrl" :src="largeImageUrl" :alt="question.question" />
    <!-- Text Input Area -->
    <div class="relative">
      <Textarea
        v-model="answer"
        @input="handleInput"
        :rows="config.rows"
        :placeholder="config.placeholder"
        :disabled="isRecording || isProcessing"
        class="w-full px-3 py-2 border bg-white border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
      />

      <!-- Character Count -->
      <div v-if="ENABLE_CHAR_LIMITS" class="mt-1 text-sm text-gray-500">
        {{ String(answer).length }} / {{ config.maxLength }} characters
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="mt-2 text-sm text-red-600">
      {{ errorMessage }}
    </div>

    <!-- Voice Input Component -->
    <VoiceInputBrowser
      v-if="hasAudioInput"
      v-model="answer"
      :disabled="isProcessing"
      @transcribing="isRecording = $event"
      @newVoiceInput="handleNewVoiceInput"
    />
  </div>
</template>
