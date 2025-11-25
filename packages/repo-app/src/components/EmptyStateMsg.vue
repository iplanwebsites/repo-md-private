// EmptyStateMsg.vue
<script setup>
import { Button } from "@/components/ui/button";

// Define props with default values using defineProps
// In Vue 3, we use an array of strings for simple props
// or an object for more complex prop definitions
const props = defineProps({
	// Title is required, so we define it with type and required flag
	title: {
		type: String,
		required: true,
	},
	// Optional props with their default values
	description: {
		type: String,
		default: "",
	},
	// CTA button props are objects that can contain label, to, and onClick properties
	primaryCta: {
		type: Object,
		default: () => null,
		// We can add validator function to check object properties
		validator: (value) => {
			if (!value) return true;
			return typeof value.label === "string";
		},
	},
	secondaryCta: {
		type: Object,
		default: () => null,
		validator: (value) => {
			if (!value) return true;
			return typeof value.label === "string";
		},
	},
});

// Helper function to handle button clicks or navigation
const handleAction = (cta) => {
	if (cta && typeof cta.onClick === "function") {
		cta.onClick();
	}
};
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center p-8 space-y-4"
  >
    <!-- Title with semantic heading -->
    <h3 class="text-lg font-semibold text-foreground">
      {{ title }}
    </h3>

    <!-- Description with proper text wrapping -->
    <p v-if="description" class="text-sm text-muted-foreground max-w-sm">
      {{ description }}
    </p>

    <!-- Button container with proper spacing -->
    <div v-if="primaryCta || secondaryCta" class="flex gap-3 mt-2">
      <!-- Primary CTA Button -->
      <template v-if="primaryCta">
        <!-- External links (starting with http) -->
        <a v-if="primaryCta.to && typeof primaryCta.to === 'string' && primaryCta.to.startsWith('http')" 
           :href="primaryCta.to" 
           target="_blank" 
           rel="noopener noreferrer">
          <Button>{{ primaryCta.label }}</Button>
        </a>
        <!-- Internal vue-router links -->
        <router-link v-else-if="primaryCta.to" :to="primaryCta.to">
          <Button>{{ primaryCta.label }}</Button>
        </router-link>
        <!-- Click handler fallback -->
        <Button v-else @click="handleAction(primaryCta)">
          {{ primaryCta.label }}
        </Button>
      </template>

      <!-- Secondary CTA Button -->
      <template v-if="secondaryCta">
        <!-- External links (starting with http) -->
        <a v-if="secondaryCta.to && typeof secondaryCta.to === 'string' && secondaryCta.to.startsWith('http')" 
           :href="secondaryCta.to" 
           target="_blank" 
           rel="noopener noreferrer">
          <Button variant="outline">{{ secondaryCta.label }}</Button>
        </a>
        <!-- Internal vue-router links -->
        <router-link v-else-if="secondaryCta.to" :to="secondaryCta.to">
          <Button variant="outline">{{ secondaryCta.label }}</Button>
        </router-link>
        <!-- Click handler fallback -->
        <Button variant="outline" v-else @click="handleAction(secondaryCta)">
          {{ secondaryCta.label }}
        </Button>
      </template>
    </div>
  </div>
</template>
