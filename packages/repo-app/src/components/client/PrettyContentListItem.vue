<!-- PrettyContentListItem.vue -->
<script setup>
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-vue-next";

const props = defineProps({
	// Image props
	img: {
		type: String,
		default: null,
	},
	// Tag props
	tagText: {
		type: String,
		default: null,
	},
	tagColor: {
		type: String,
		default: "blue", // Options: blue, red, green, yellow, purple
	},
	tagIcon: {
		type: Object,
		default: null,
	},
	// Status icon props (left side)
	status: {
		type: String,
		default: "none", // Options: completed, locked, available, none
	},
	// Content props
	title: {
		type: String,
		required: true,
	},
	infoTooltip: {
		type: String,
		default: null,
	},
	// Button props
	buttonText: {
		type: String,
		default: "View",
	},
	buttonIcon: {
		type: Object,
		default: () => ChevronRight,
	},
	// State props
	active: {
		type: Boolean,
		default: false,
	},
	disabled: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits(["click"]);

// Computed styles for tag colors
const tagClasses = computed(() => {
	const baseClass =
		"text-xs font-medium px-3 py-1 rounded-full inline-block mb-1";

	switch (props.tagColor) {
		case "red":
			return `bg-red-100 text-red-800 ${baseClass} dark:bg-red-900 dark:text-red-300`;
		case "green":
			return `bg-green-100 text-green-800 ${baseClass} dark:bg-green-900 dark:text-green-300`;
		case "yellow":
			return `bg-yellow-100 text-yellow-800 ${baseClass} dark:bg-yellow-900 dark:text-yellow-300`;
		case "purple":
			return `bg-purple-100 text-purple-800 ${baseClass} dark:bg-purple-900 dark:text-purple-300`;
		case "blue":
		default:
			return `bg-blue-100 text-blue-800 ${baseClass} dark:bg-blue-900 dark:text-blue-300`;
	}
});

// Status icon selection
const statusIconComponent = computed(() => {
	switch (props.status) {
		case "completed":
			return "Check";
		case "locked":
			return "Lock";
		case "available":
			return "Circle";
		default:
			return null;
	}
});

const statusIconClass = computed(() => {
	switch (props.status) {
		case "completed":
			return "w-5 h-5 text-green-600";
		case "locked":
			return "w-4 h-4";
		case "available":
			return "w-5 h-5 text-muted-foreground";
		default:
			return "";
	}
});

// Computed property for tooltip text
const tooltipText = computed(() => {
	return props.infoTooltip;
});

// Combined classes for the list item
const itemClasses = computed(() => {
	return {
		"opacity-60": props.disabled,
		"opacity-80": props.active,
		"hover:bg-accent": !props.active && !props.disabled,
	};
});

const handleClick = () => {
	if (!props.disabled) {
		emit("click");
	}
};
</script>

<template>
  <div
    class="flex items-center justify-between rounded-lg cursor-pointer transition-all duration-200"
    :class="itemClasses"
    @click="handleClick"
  >
    <div class="flex items-center gap-1">
      <!-- Left side image (if provided) -->
      <div v-if="img" class="relative w-22 h-14 rounded-lg overflow-hidden">
        <img :src="img" alt="" class="object-cover w-full h-full" />
      </div>

      <!-- Status icon -->
      <component
        :is="statusIconComponent"
        v-if="statusIconComponent"
        :class="statusIconClass"
      />

      <!-- Content -->
      <div class="flex flex-col">
        <!-- Tags on separate line -->
        <div v-if="tagText">
          <span :class="tagClasses">
            {{ tagText }}
            <component
              :is="tagIcon"
              v-if="tagIcon"
              class="inline w-3 h-3 ml-1"
            />
          </span>
        </div>

        <!-- Title -->
        <span class="text-foreground text-xl"
          >{{ title }}

          <InfoTooltip
            v-if="tooltipText"
            :text="tooltipText"
            buttonClass="inline-flex items-center m-0 p-0 ml-2"
            iconClass="w-4 h-4 text-muted-foreground"
          />
        </span>
      </div>
    </div>

    <!-- Right side button (purple) -->
    <Button
      variant="ghost"
      size="sm"
      class="text-purple-600 hover:bg-purple-100 hover:text-purple-700 dark:text-purple-400 dark:hover:bg-purple-900 dark:hover:text-purple-300"
    >
      {{ buttonText }}
      <component :is="buttonIcon" class="w-4 h-4 ml-2" />
    </Button>
  </div>
</template>
