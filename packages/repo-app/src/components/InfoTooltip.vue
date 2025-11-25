<!-- InfoTooltip.vue -->
<script setup>
import { Info } from "lucide-vue-next";
import {
	TooltipProvider,
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

// Props definition with validation
const props = defineProps({
	// The text to display in the tooltip
	text: {
		type: String,
		default: "",
	},
	// Optional class names to apply to the trigger button
	buttonClass: {
		type: String,
		default: "inline-flex items-center m-0 p-0", // Changed from 'flex' to 'inline-flex'
	},
	// Optional class names to apply to the icon
	iconClass: {
		type: String,
		default: "w-4 h-4 ml-3 text-primary",
	},
});
</script>

<template>
  <!-- Only render the tooltip if there's text to show -->
  <!-- We use inline-block to ensure the tooltip stays inline with text -->
  <span v-if="text" class="inline-block">
    <TooltipProvider>
      <Tooltip>
        <!-- Trigger element that users interact with -->
        <TooltipTrigger as-child>
          <Button variant="text" :class="buttonClass">
            <!-- Allow custom content through slot, fallback to Info icon -->
            <slot>
              <Info :class="iconClass" />
            </slot>
          </Button>
        </TooltipTrigger>
        <!-- Tooltip content -->
        <TooltipContent>
          <p>{{ text }}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </span>
</template>
