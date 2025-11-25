<!-- CardTitle.vue -->
<script setup>
import { ref, computed } from "vue";
import InfoTooltip from "@/components/InfoTooltip.vue";

const props = defineProps({
	title: {
		type: String,
		required: true,
	},
	tooltipText: {
		type: String,
		default: null,
	},
	icon: {
		// This will accept a component reference
		type: Object,
		default: null,
	},
	iconColor: {
		type: String,
		default: "purple-600", // Default purple color
	},
	iconBgColor: {
		type: String,
		default: "purple-100", // Default light purple background
	},
});
</script>

<template>
  <div class="flex items-center justify-between mb-6 w-full">
    <div class="flex-grow mr-4 flex items-center">
      <div
        v-if="icon"
        class="flex items-center justify-center p-2 rounded-full mr-2"
        :class="`bg-${iconBgColor}`"
      >
        <component :is="icon" class="w-5 h-5" :class="`text-${iconColor}`" />
      </div>
      <h2 class="text-2xl font-semibold">
        {{ title }}
        <InfoTooltip v-if="tooltipText" :text="tooltipText" />
      </h2>
    </div>

    <div class="flex-shrink-0 flex justify-end">
      <slot name="right"></slot>
    </div>
  </div>
</template>
