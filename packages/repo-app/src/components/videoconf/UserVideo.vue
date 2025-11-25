<script setup>
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { computed, onMounted } from "vue";

const { status, participantsCount, className } = defineProps({
	status: {
		type: String,
		default: "preview",
	},
	participantsCount: {
		type: Number,
		default: 0,
	},
	className: {
		type: String,
		default: "",
	},
});

// REFS
const isClosed = ref(false);
const isMini = ref(false);

//EVENTS LISTENER
function handleClick() {
	isClosed.value = !isClosed.value;
}

// FORMATTING METHODS
const mini = computed(() => {
	return isMini.value ? "" : undefined;
});

const closed = computed(() => {
	return isClosed.value && isMini.value ? "" : undefined;
});

watch([() => status, () => participantsCount], () => {
	return (isMini.value = status === "ongoing" && participantsCount > 0);
});

onMounted(() => {
	isMini.value = status === "ongoing" && participantsCount > 0;
});
</script>
<template>
  <div
    :data-mini="mini"
    :data-closed="closed"
    class="z-30 w-full h-full flex items-center overflow-hidden bottom-20 right-3 justify-end border-2 border-black/50 data-[mini]:bg-neutral-900 data-[mini]:fixed data-[mini]:h-1/6 data-[mini]:max-h-[10rem] data-[mini]:md:h-1/5 data-[mini]:rounded-lg data-[mini]:min-h-[6rem] data-[mini]:w-fit origin-right max-w-full data-[mini]:duration-1000 data-[closed]:!max-w-[3rem]"
    :class="className"
  >
    <div
      v-if="isMini"
      class="h-full text-white flex items-center cursor-pointer"
      @click="handleClick"
    >
      <button type="button">
        <ChevronLeft v-if="isClosed" />
        <ChevronRight v-else />
      </button>
    </div>
    <div
      :data-mini="mini"
      :data-closed="closed"
      class="w-full data-[closed]:opacity-0 duration-500 h-full"
    >
      <slot></slot>
    </div>
  </div>
</template>
