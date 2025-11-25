<script setup>
import { ArrowLeft } from "lucide-vue-next";

defineProps({
	title: {
		type: String,
		default: "Back",
	},
	to: {
		type: [String, Object],
		default: null,
	},
});

const back = () => {
  router.back();
};

defineEmits(["click"]);
</script>

<template>
  <router-link
    v-if="to"
    :to="to"
    class="mt-3 flex items-center text-sm text-gray-600 hover:text-gray-900"
  >
    <ArrowLeft class="h-4 w-4 mr-1" />
    {{ title }}
  </router-link>
  <button
    v-else
    class="flex items-center text-sm text-gray-600 hover:text-gray-900"
    @click="$emit('click')"
  >
    <ArrowLeft class="h-4 w-4 mr-1" />
    {{ title }}
  </button>
</template>
