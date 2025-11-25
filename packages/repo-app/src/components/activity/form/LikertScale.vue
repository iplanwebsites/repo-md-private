<!-- LikertScale.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";

const props = defineProps({
	lastQuestion: {
		type: Boolean,
		default: false,
	},
	question: {
		type: Object,
		required: true,
		validator: (value) => {
			return (
				value.scale &&
				typeof value.scale.min === "number" &&
				typeof value.scale.max === "number"
			);
		},
	},
});

const emit = defineEmits(["select"]);
const selectedValue = ref(null);
const hasEmojisError = ref(false);
const errorMessage = ref("");

// Default emoji array as fallback
const defaultEmojis = ["😤", "🙁", "😐", "🙂", "💯"];

// Get emojis from scale or use defaults
const getEmojis = computed(() => {
	if (!props.question.scale.emojis) return defaultEmojis;

	// Handle emojis whether they're a string or an array
	let emojisArray;
	if (typeof props.question.scale.emojis === "string") {
		emojisArray = props.question.scale.emojis
			.split(" ")
			.filter((emoji) => emoji.trim());
	} else if (Array.isArray(props.question.scale.emojis)) {
		emojisArray = props.question.scale.emojis;
	} else {
		hasEmojisError.value = true;
		errorMessage.value =
			"Warning: Emojis must be provided as a string or array. Using default emojis.";
		return defaultEmojis;
	}

	const expectedLength =
		props.question.scale.max - props.question.scale.min + 1;

	if (emojisArray.length !== expectedLength) {
		hasEmojisError.value = true;
		errorMessage.value = `Warning: Expected ${expectedLength} emojis but got ${emojisArray.length}. Using default emojis.`;
		return defaultEmojis;
	}

	hasEmojisError.value = false;
	errorMessage.value = "";
	return emojisArray;
});

// Create an array of scale points from min to max
const scalePoints = computed(() => {
	const points = [];
	const emojis = getEmojis.value;

	for (let i = props.question.scale.min; i <= props.question.scale.max; i++) {
		const index = i - props.question.scale.min;
		points.push({
			value: i,
			label: props.question.scale.labels[i.toString()],
			emoji: props.question.scale.emojis ? emojis[index] : null,
		});
	}
	return points;
});

// Validate emojis on mount
onMounted(() => {
	if (props.question.scale.emojis) {
		getEmojis.value; // Trigger validation
	}
});

const handleSelection = (value) => {
	selectedValue.value = value;
	emit("select", value);
};

// Get appropriate background color based on value
const getBackgroundColor = (value) => {
	if (selectedValue.value !== value) return "bg-gray-50 hover:bg-gray-100";
	return "bg-blue-50";
};

// Get appropriate text color based on value
const getTextColor = (value) => {
	if (selectedValue.value !== value) return "text-gray-700";
	return "text-blue-700";
};

// Get border style based on value
const getBorderStyle = (value) => {
	if (selectedValue.value !== value) return "border-transparent";
	return "border-blue-500";
};
</script>

<template>
  <div class="w-full max-w-2xl mx-auto">
    <!-- Error Alert -->
    <div
      v-if="hasEmojisError"
      class="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700"
    >
      <p class="text-sm">{{ errorMessage }}</p>
    </div>

    <!-- Scale Options -->
    <div class="grid grid-cols-1 md:grid-cols-5 gap-2 mt-4">
      <button
        v-for="point in scalePoints"
        :key="point.value"
        @click="handleSelection(point.value)"
        class="p-4 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center text-center"
        :class="[
          getBackgroundColor(point.value),
          getTextColor(point.value),
          getBorderStyle(point.value),
        ]"
      >
        <template v-if="point.emoji">
          <!-- Emoji -->
          <span class="text-4xl mb-2">{{ point.emoji }}</span>
        </template>
        <template v-else>
          <!-- Scale Number -->
          <span class="text-lg font-semibold mb-2">{{ point.value }} </span>
        </template>

        <!-- Scale Label -->
        <span class="text-sm">{{ point.label }}</span>
      </button>
    </div>
  </div>
</template>
