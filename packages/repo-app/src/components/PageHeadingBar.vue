<!-- PageHeadingBar.vue -->
<script setup>
import InfoTooltip from "@/components/InfoTooltip.vue";

defineProps({
	title: {
		type: String,
		required: true,
	},
	subtitle: {
		type: String,
		default: "",
	},
	info: {
		type: String,
		default: "",
	},
	pad: {
		type: Boolean,
		default: true,
	},
	titleWeight: {
		type: String,
		default: "500",
	},
	titleSize: {
		type: String,
		default: "3xl",
	},
});
</script>

<template>
  <div class="mb-6 border-b px-4 py-12 pb-10">
    <div class="container">
      <div class="flex justify-between items-center">
        <div>
          <h1
            :class="'text-' + titleSize"
            :style="'font-weight:' + titleWeight"
          >
            {{ title }}
            <InfoTooltip
              :text="info"
              buttonClass="inline-flex items-center m-0 p-0"
              iconClass=" "
            />
          </h1>
          <div class="text-gray-500" v-if="subtitle">
            <p class="text-lg">{{ subtitle }}</p>
          </div>
          <!-- Default slot for content below title -->
          <div class="mt-2">
            <slot></slot>
          </div>
          <!-- Secondary slot for additional content -->
          <div class="mt-2">
            <slot name="secondary"></slot>
          </div>
        </div>
        <div class="flex items-center">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>
  </div>
</template>
