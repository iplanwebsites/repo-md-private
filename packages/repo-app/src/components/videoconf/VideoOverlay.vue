<script setup>
import { MicIcon, MicOffIcon, PinIcon, PinOffIcon } from "lucide-vue-next";
import { computed } from "vue";

const { name, isMuted, isPinned, type } = defineProps({
	name: {
		type: String,
		default: "Invité",
	},
	isMuted: {
		type: Boolean,
		default: true,
	},
	isPinned: {
		type: Boolean,
		default: false,
	},
	pinEnabled: {
		type: Boolean,
		default: false,
	},
	type: {
		type: String,
		default: "normal",
	},
});

const emit = defineEmits(["pinned"]);

function handlePinned() {
	emit("pinned");
}

const small = computed(() => {
	return type === "small";
});
</script>

<template>
  <div
    class="absolute top-0.5 left-0.5 px-0.5 flex items-center gap-3 bg-black/25 w-fit rounded text-white text-sm"
    :class="{ 'left-auto top-auto bottom-0.5 text-sm py-0.5': small }"
  >
    <span class="text-xs sm:text-base">{{ name }}</span>
    <span>
      <MicOffIcon v-if="isMuted" class="size-3 sm:size-5 text-red-500" />
      <MicIcon v-else class="size-3 sm:size-5" />
    </span>
  </div>

  <div
    v-if="pinEnabled"
    class="absolute top-0.5 right-0.5 flex justify-center items-center rounded-lg p-0.5 bg-black/25 cursor-pointer"
    @click="handlePinned"
  >
    <PinOffIcon title="Unpin" class="size-5 text-white" v-if="isPinned" />
    <PinIcon title="Pin" class="size-5 text-white" v-else />
  </div>
</template>
