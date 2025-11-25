<script setup>
import { HelpCircle } from "lucide-vue-next";
import { computed, defineProps, defineEmits } from "vue";

const props = defineProps({
	modelValue: {
		type: String,
		default: "",
	},
	placeholder: {
		type: String,
		default: "Enter your project name",
	},
	label: {
		type: String,
		default: "RepoMd Project Name",
	},
	hasTooltip: {
		type: Boolean,
		default: true,
	},
});

const emit = defineEmits(["update:modelValue"]);

const projectName = computed({
	get: () => props.modelValue,
	set: (value) => emit("update:modelValue", value),
});

// Basic validation could be expanded later
const isValid = computed(() => {
	return projectName.value.length > 0;
});
</script>

<template>
  <div>
    <label class="block text-sm text-muted-foreground mb-2">{{ label }}</label>
    <div class="relative">
      <input
        v-model="projectName"
        type="text"
        class="w-full bg-muted border border-border rounded-md px-4 py-2 text-foreground"
        :placeholder="placeholder"
      />
      <span v-if="hasTooltip" class="absolute right-2 top-2">
        <HelpCircle size="16" class="text-muted-foreground" />
      </span>
    </div>
  </div>
</template>