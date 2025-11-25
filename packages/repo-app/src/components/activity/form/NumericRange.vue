<!-- NumericRange.vue -->
<script setup>
import { ref, watch, computed } from "vue";
import { ArrowUp, ArrowDown } from "lucide-vue-next";

const props = defineProps({
	question: {
		type: Object,
		required: true,
		validator: (value) => {
			return (
				typeof value.question === "string" &&
				typeof value.description === "string" &&
				value.range &&
				typeof value.range.min === "number" &&
				typeof value.range.max === "number"
			);
		},
	},
	lastQuestion: {
		type: Boolean,
		default: false,
	},
	selected: {
		type: Number,
		default: null,
	},
});

const emit = defineEmits(["select"]);

// Internal state to track the current value before submission
const numericValue = ref(props.selected ?? props.question.range.min);
const isDirty = ref(false);

// Improved error handling for slider emojis
const emojiError = computed(() => {
	if (!props.question.sliderEmojis) return null;

	// Handle different types of emoji input
	if (typeof props.question.sliderEmojis === "string") {
		const emojis = props.question.sliderEmojis.trim().split(/\s+/);
		if (emojis.length !== 2) {
			return "Slider emojis must contain exactly 2 emojis separated by a space";
		}
	} else if (Array.isArray(props.question.sliderEmojis)) {
		if (props.question.sliderEmojis.length !== 2) {
			return "Slider emojis array must contain exactly 2 emojis";
		}
	} else {
		return "Slider emojis must be provided as a string or array";
	}

	return null;
});

// Get slider emojis as an array regardless of input format
const sliderEmojis = computed(() => {
	if (!props.question.sliderEmojis || emojiError.value) return null;

	if (typeof props.question.sliderEmojis === "string") {
		return props.question.sliderEmojis.trim().split(/\s+/);
	} else if (Array.isArray(props.question.sliderEmojis)) {
		return props.question.sliderEmojis;
	}

	return null;
});

// Watch for external selected value changes
watch(
	() => props.selected,
	(newValue) => {
		if (newValue !== null) {
			numericValue.value = newValue;
			isDirty.value = false; // Reset dirty state when receiving new external value
		}
	},
);

const isValid = computed(() => {
	const value = numericValue.value;
	if (value === null) return false;

	const { min, max, step } = props.question.range;
	const withinRange = value >= min && value <= max;
	const matchesStep = step
		? Math.abs((value - min) % step) < Number.EPSILON
		: true;

	return withinRange && matchesStep;
});

const displayValue = computed(() => {
	if (numericValue.value === null) return "";
	return `${numericValue.value}${props.question.unit ? ` ${props.question.unit}` : ""}`;
});

const handleInputChange = (event) => {
	const newValue = parseFloat(event.target.value);
	if (!isNaN(newValue)) {
		updateValue(newValue);
	}
};

const handleSliderChange = (event) => {
	const { min, max, step } = props.question.range;
	let newValue = parseFloat(event.target.value);

	if (step) {
		// Round to nearest step
		newValue = Math.round((newValue - min) / step) * step + min;
	}

	updateValue(newValue);
};

const incrementValue = () => {
	const { step = 1 } = props.question.range;
	updateValue(numericValue.value + step);
};

const decrementValue = () => {
	const { step = 1 } = props.question.range;
	updateValue(numericValue.value - step);
};

const updateValue = (newValue) => {
	const { min, max } = props.question.range;
	newValue = Math.max(min, Math.min(max, newValue));
	numericValue.value = newValue;
	isDirty.value = true; // Mark as dirty when value changes

	// Emit the value change immediately if it's valid
	if (isValid.value) {
		emit("select", numericValue.value);
	}
};
</script>

<template>
  <div class="w-full max-w-2xl mx-auto">
    <div class="space-y-4">
      <!-- Input with Increment/Decrement Buttons -->
      <div class="flex items-center space-x-4">
        <div class="relative flex-1">
          <Input
            type="number"
            :value="numericValue"
            @input="handleInputChange"
            :min="question.range.min"
            :max="question.range.max"
            :step="question.range.step"
            class="w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            :class="{
              'border-red-500': !isValid && isDirty,
              'border-gray-300': isValid || !isDirty,
            }"
          />
          <span
            v-if="question.unit"
            class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
          >
            {{ question.unit }}
          </span>
        </div>

        <div class="flex flex-col space-y-1">
          <button
            @click="incrementValue"
            :disabled="numericValue >= question.range.max"
            class="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            <ArrowUp class="w-4 h-4" />
          </button>
          <button
            @click="decrementValue"
            :disabled="numericValue <= question.range.min"
            class="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            <ArrowDown class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Slider Control -->
      <div class="space-y-2">
        <div class="flex items-center space-x-2">
          <span v-if="sliderEmojis" class="text-xl">{{ sliderEmojis[0] }}</span>
          <input
            type="range"
            :value="numericValue"
            @input="handleSliderChange"
            :min="question.range.min"
            :max="question.range.max"
            :step="question.range.step"
            class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span v-if="sliderEmojis" class="text-xl">{{ sliderEmojis[1] }}</span>
        </div>

        <!-- Range Labels -->
        <div class="flex justify-between text-sm text-gray-500">
          <span>{{ question.range.min }}{{ question.unit }}</span>
          <span>{{ question.range.max }}{{ question.unit }}</span>
        </div>
      </div>

      <!-- Validation Messages -->
      <div class="space-y-2">
        <div v-if="!isValid && isDirty" class="text-sm text-red-500">
          Please enter a value between {{ question.range.min }} and
          {{ question.range.max }}
          {{ question.range.step ? `in steps of ${question.range.step}` : "" }}
          {{ question.unit ? question.unit : "" }}
        </div>
        <div v-if="emojiError" class="text-sm text-red-500">
          {{ emojiError }}
        </div>
      </div>

      <!-- QuizContinueButton if needed
      <QuizContinueButton
        v-if="lastQuestion"
        :is-valid="isValid"
        :is-dirty="isDirty"
        :has-error="!!emojiError"
        @submit="emit('select', numericValue.value)"
        :lastQuestion="lastQuestion"
      />
       -->
    </div>
  </div>
</template>
