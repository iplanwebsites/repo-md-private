<!-- CollapsibleFicheCard.vue -->
<script setup>
import { ref } from "vue";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-vue-next";

const props = defineProps({
	title: {
		type: String,
		required: true,
	},
	icon: {
		type: Object,
		default: null,
	},
	defaultOpen: {
		type: Boolean,
		default: false,
	},
	variant: {
		type: String,
		default: "minimal",
		validator: (value) => ["default", "minimal"].includes(value),
	},
});

const isOpen = ref(props.defaultOpen);

function toggleCard() {
	isOpen.value = !isOpen.value;
}
</script>

<template>
  <Card :class="{ 'border-0 shadow-none p-0': variant === 'minimal' }">
    <div :class="{ 'p-6': variant === 'default' }">
      <div
        @click="toggleCard"
        class="flex items-center justify-between cursor-pointer"
      >
        <h2 class="text-lg font-bold flex items-center gap-2">
          <component :is="icon" v-if="icon" class="w-5 h-5" />
          {{ title }}
        </h2>
        <div v-if="variant === 'minimal'" class="p-2 bg-purple-100 rounded-lg">
          <ChevronDown
            class="w-5 h-5 transition-transform duration-200 text-purple-500"
            :class="{ 'transform rotate-180': isOpen }"
          />
        </div>
        <ChevronDown
          v-else
          class="w-5 h-5 transition-transform duration-200"
          :class="{ 'transform rotate-180': isOpen }"
        />
      </div>

      <div
        v-show="isOpen"
        class="mt-4 transition-all duration-200 overflow-hidden"
      >
        <slot></slot>
      </div>
    </div>
  </Card>
</template>
