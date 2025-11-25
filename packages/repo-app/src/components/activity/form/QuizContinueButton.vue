<!-- QuizContinueButton.vue -->
<script setup>
defineProps({
	lastQuestion: {
		type: Boolean,
		default: false,
	},
	isValid: {
		type: Boolean,
		required: true,
	},
	isDirty: {
		type: Boolean,
		required: true,
	},
	hasError: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits(["submit"]);
</script>

<template>
  <div
    class="md:inline-block fixed md:static bottom-0 left-0 right-0 p-4 md:p-0 bg-white md:bg-transparent border-t md:border-t-0 border-gray-200"
  >
    <Button
      @click="$emit('submit')"
      :disabled="!isValid || !isDirty || hasError"
      class="w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Continue
    </Button>
  </div>
</template>
