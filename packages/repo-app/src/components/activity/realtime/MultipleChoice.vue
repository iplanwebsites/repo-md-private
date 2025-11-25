<!-- MultipleChoice.vue -->
<script setup>
import { ref } from "vue";

const props = defineProps({
	question: {
		type: String,
		required: true,
	},
	options: {
		type: Array,
		required: true,
		validator: (value) => value.length > 0,
	},
});

const emit = defineEmits(["choice"]);
const selectedOption = ref(null);

const handleSelection = (option) => {
	selectedOption.value = option;
	emit("choice", option);
};
</script>

<template>
  <div class="w-full max-w-2xl mx-auto p-4">
    <!-- Question Card -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <!-- Question Text -->
      <h3 class="text-lg md:text-xl font-semibold text-gray-800 mb-6">
        {{ question }}
      </h3>

      <!-- Options List -->
      <div class="space-y-3">
        <button
          v-for="(option, index) in options"
          :key="index"
          @click="handleSelection(option)"
          class="w-full text-left p-4 rounded-lg transition-colors duration-200 flex items-center gap-3"
          :class="{
            'bg-blue-50 border-2 border-blue-500': selectedOption === option,
            'bg-gray-50 border-2 border-transparent hover:bg-gray-100':
              selectedOption !== option,
          }"
        >
          <!-- Selection Indicator -->
          <div
            class="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
            :class="{
              'border-blue-500 bg-blue-500': selectedOption === option,
              'border-gray-400': selectedOption !== option,
            }"
          >
            <div
              v-if="selectedOption === option"
              class="w-2 h-2 rounded-full bg-white"
            ></div>
          </div>

          <!-- Option Text -->
          <span
            class="text-base"
            :class="{
              'text-blue-700 font-medium': selectedOption === option,
              'text-gray-700': selectedOption !== option,
            }"
          >
            {{ option }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
