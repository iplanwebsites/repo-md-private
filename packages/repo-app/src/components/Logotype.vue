<script setup>
import { computed } from "vue";

const props = defineProps({
	variant: {
		type: String,
		default: "default",
		//  validator: (value) => ["default", "light", "dark"].includes(value),
	},
	height: {
		type: [Number, String],
		default: 20,
	},
	to: {
		type: String,
		default: "/",
	},
});

/*
const variantPathsPush = {
  default: "/brand/logo1_black.svg",
  light: "/brand/logo1_white.svg",
  dark: "/brand/logo1_black.svg",
};*/
const variantPaths = {
	default: "/brand/repo/logo_purple.svg",
	light: "/brand/repo/logo_white.svg",
	dark: "/brand/repo/logo_black.svg",
	purple: "/brand/repo/logo_purple.svg",
};

const logoSrc = computed(() => {
	return variantPaths[props.variant] || variantPaths.default;
});
</script>

<template>
  <RouterLink :to="props.to" class="">
    <img :src="logoSrc" :style="{ maxHeight: `${height}px` }" alt="Repo.md" />
  </RouterLink>
</template>
