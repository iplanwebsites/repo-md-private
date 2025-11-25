<!-- TrueFalseForm.vue -->
<script setup>
import { CheckCircle, XCircle } from "lucide-vue-next";
import { ref, watch } from "vue";

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
				typeof value.question === "string" &&
				typeof value.description === "string"
			);
		},
	},
	selected: {
		type: Boolean,
		default: null,
	},
});

const emit = defineEmits(["select"]);

// Internal state for selection
const selectedValue = ref(props.selected);

// Watch for external value changes
watch(
	() => props.selected,
	(newValue) => {
		selectedValue.value = newValue;
	},
);

// Handle selection of true/false options
const handleSelect = (value) => {
	selectedValue.value = value;
	emit("select", value);
};

// Compute button styles based on selection state
const getButtonStyles = (value) => {
	const isSelected = selectedValue.value === value;
	return {
		"bg-emerald-50 border-emerald-500 text-emerald-700":
			isSelected && value === true,
		"bg-red-50 border-red-500 text-red-700": isSelected && value === false,
		"bg-white hover:bg-gray-50 border-gray-300 text-gray-700": !isSelected,
		"border-2 rounded-lg transition-all duration-200": true,
	};
};

// Compute icon styles based on selection state
const getIconStyles = (value) => {
	const isSelected = selectedValue.value === value;
	return {
		"text-emerald-500": isSelected && value === true,
		"text-red-500": isSelected && value === false,
		"text-gray-400": !isSelected,
	};
};
</script>

<template>
  <div class="w-full max-w-2xl mx-auto">
    <!-- Question Display 
    <div class="mb-4">
      <h3 class="text-lg font-medium text-gray-900">
        {{ question.question }}
      </h3>
      <p v-if="question.description" class="mt-1 text-sm text-gray-500">
        {{ question.description }}
      </p>
    </div>-->

    <!-- True/False Options -->
    <div class="space-y-2">
      <!-- True Option -->
      <button
        @click="handleSelect(true)"
        class="w-full p-4 text-left flex items-center"
        :class="getButtonStyles(true)"
      >
        <div class="mr-3 flex-shrink-0">
          <div
            class="w-5 h-5 border-2 rounded-full flex items-center justify-center"
            :class="
              selectedValue === true ? 'border-emerald-500' : 'border-gray-300'
            "
          >
            <div
              v-if="selectedValue === true"
              class="w-3 h-3 rounded-full bg-emerald-500"
            ></div>
          </div>
        </div>

        <div class="flex-grow flex items-center">
          <CheckCircle class="w-5 h-5 mr-2" :class="getIconStyles(true)" />
          <span class="font-medium">True</span>
        </div>
      </button>

      <!-- False Option -->
      <button
        @click="handleSelect(false)"
        class="w-full p-4 text-left flex items-center"
        :class="getButtonStyles(false)"
      >
        <div class="mr-3 flex-shrink-0">
          <div
            class="w-5 h-5 border-2 rounded-full flex items-center justify-center"
            :class="
              selectedValue === false ? 'border-red-500' : 'border-gray-300'
            "
          >
            <div
              v-if="selectedValue === false"
              class="w-3 h-3 rounded-full bg-red-500"
            ></div>
          </div>
        </div>

        <div class="flex-grow flex items-center">
          <XCircle class="w-5 h-5 mr-2" :class="getIconStyles(false)" />
          <span class="font-medium">False</span>
        </div>
      </button>
    </div>

    <!-- Explanation (if provided and answered) -->
    <div
      v-if="question.explanation && selectedValue !== null"
      class="mt-4 p-4 bg-gray-50 rounded-lg"
    >
      <p class="text-sm text-gray-700">
        {{ question.explanation }}
      </p>
    </div>
  </div>
</template>
