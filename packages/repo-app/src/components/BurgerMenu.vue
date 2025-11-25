<script setup>
import { computed } from "vue";

const props = defineProps({
	isOpen: {
		type: Boolean,
		default: false,
	},
});

const openClass = computed(() => (props.isOpen ? "tham-active" : ""));
</script>

<template>
  <div :class="`tham tham-e-squeeze tham-w-6 ${openClass}`">
    <div class="tham-box">
      <div class="tham-inner"></div>
    </div>
  </div>
</template>

<style scoped>
.tham {
  display: inline-block;
  cursor: pointer;
  transition-timing-function: linear;
  transition-duration: 0.15s;
  transition-property: opacity, filter;
  text-transform: none;
  color: inherit;
  border: 0;
  background-color: transparent;
}

.tham-box {
  position: relative;
  display: inline-block;
  width: 100%;
  height: 24px;
}

.tham-inner {
  top: 50%;
  display: block;
  margin-top: -2px;
  position: absolute;
  width: 100%;
  height: 2px;
  transition-timing-function: ease;
  transition-duration: 0.15s;
  transition-property: transform;
  border-radius: 2px;
  background-color: currentColor;
}

.tham-inner::before,
.tham-inner::after {
  display: block;
  content: "";
  position: absolute;
  width: 100%;
  height: 2px;
  transition-timing-function: ease;
  transition-duration: 0.15s;
  transition-property: transform;
  border-radius: 2px;
  background-color: currentColor;
}

.tham-inner::before {
  top: -8px;
}

.tham-inner::after {
  bottom: -8px;
}

.tham-e-squeeze .tham-inner {
  transition-timing-function: cubic-bezier(0.55, 0.055, 0.675, 0.19);
  transition-duration: 0.1s;
}

.tham-e-squeeze .tham-inner::before {
  transition: top 0.1s ease 0.14s, opacity 0.1s ease;
}

.tham-e-squeeze .tham-inner::after {
  transition: bottom 0.1s ease 0.14s, transform 0.1s cubic-bezier(0.55, 0.055, 0.675, 0.19);
}

.tham-e-squeeze.tham-active .tham-inner {
  transform: rotate(45deg);
  transition-delay: 0.14s;
  transition-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
}

.tham-e-squeeze.tham-active .tham-inner::before {
  top: 0;
  opacity: 0;
  transition: top 0.1s ease, opacity 0.1s ease 0.14s;
}

.tham-e-squeeze.tham-active .tham-inner::after {
  bottom: 0;
  transform: rotate(-90deg);
  transition: bottom 0.1s ease, transform 0.1s cubic-bezier(0.215, 0.61, 0.355, 1) 0.14s;
}
</style>