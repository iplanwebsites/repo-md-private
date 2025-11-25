<script setup>
import { Loader } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";

// PROPS
const { status, setRefObject, className } = defineProps({
	status: {
		type: String,
		default: "",
	},
	setRefObject: {
		type: Function,
		default: () => {},
	},
	className: {
		type: String,
		default: "",
	},
});

const container = ref(null);

const loading = computed(() => {
	return status === "loading";
});

defineExpose({ container });
</script>

<template>
  <div
    class="relative w-full h-full max-h-full flex justify-center items-center flex-wrap gap-8"
    :class="className"
    ref="container"
  >
    <div
      class="w-full h-full flex justify-center items-center bg-black/10"
      v-if="loading"
    >
      <Loader class="size-20 animate-spin" />
    </div>
    <slot v-else></slot>
  </div>
</template>
