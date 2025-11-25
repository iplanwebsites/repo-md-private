<script setup>
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	onUnmounted,
} from "vue";

const MINIATURE_RATIO = 0.2;
const VIDEO_RATIO = 16 / 10;

const {
	isFullscreen,
	participantsCount,
	pinnedUsersCount,
	resizeTrigger,
	className,
} = defineProps({
	isFullscreen: {
		type: Boolean,
		default: false,
	},
	participantsCount: {
		type: Number,
		default: 1,
	},
	pinnedUsersCount: {
		type: Number,
		default: 0,
	},
	resizeTrigger: {
		type: Boolean,
		default: false,
	},
	className: {
		type: String,
		default: "",
	},
});

const mosaicGrid = [
	{ w: 1, h: 1 },
	{ w: 2, h: 1 },
	{ w: 2, h: 2 },
	{ w: 3, h: 2 },
	{ w: 3, h: 3 },
	{ w: 4, h: 3 },
	{ w: 4, h: 4 },
];

let resizeObserver;
let timeout = null;
const container = ref(null);
const isOverflow = ref(false);

const emit = defineEmits(["videoResize"]);

// Make sure the video ratio is matching VIDEO_RATIO
function correctDimensionMaxValues(width, height, isWidescreen = true) {
	const ratio = VIDEO_RATIO;
	const maxWidth = isWidescreen ? height * ratio : width;
	const maxHeight = isWidescreen ? height : width * ratio;

	if (maxHeight < height && maxWidth < width) return [width, height];

	if (maxHeight < height) height = maxHeight;
	else if (maxWidth < width) width = maxWidth;

	return [width, height];
}

// Calculate dimension of video elements based on grid type
function calculateDimension(mosaicGrid) {
	const ratio = MINIATURE_RATIO; // Determine the size relative to pinned user
	const grid = structuredClone(mosaicGridType.value);
	let containerWidth = container.value.clientWidth;
	let containerHeight = container.value.clientHeight;
	const isWidescreen = containerWidth > containerHeight;
	let width;
	let height;
	let pinnedWidth;
	let pinnedHeight;
	let xOffset;

	// Make sure that the ratio is ok on ultrawide screens
	if (isFullscreen && isWidescreen) width = (height * 16) / 10;
	if (!isWidescreen) {
		// Reverse grid for small screen
		const { w, h } = grid;
		grid.w = h;
		grid.h = w;
	}

	// Set element dimension based on grid and screen orientation
	if (pinnedUsersCount > 0 && pinnedUsersCount !== participantsCount) {
		pinnedWidth = containerWidth / grid.w;
		pinnedHeight = containerHeight / grid.h;
		width = isWidescreen
			? containerWidth * ratio
			: containerHeight * ratio * (16 / 10);
		height = isWidescreen
			? containerWidth * ratio * (10 / 16)
			: containerHeight * ratio;
	} else {
		width = containerWidth / grid.w;
		height = containerHeight / grid.h;
	}

	[width, height] = correctDimensionMaxValues(width, height, isWidescreen);

	if (pinnedWidth && pinnedHeight) {
		[pinnedWidth, pinnedHeight] = correctDimensionMaxValues(
			pinnedWidth,
			pinnedHeight,
			isWidescreen,
		);

		xOffset = (containerWidth - pinnedWidth * grid.w) / 2;
	} else {
		xOffset = (containerWidth - width * grid.w) / 2;
	}

	return [width, height, pinnedWidth, pinnedHeight, xOffset, grid];
}

function setGrid() {
	if (!container.value) return;

	const [width, height, pinnedWidth, pinnedHeight, xOffset, grid] =
		calculateDimension();

	const event = {
		width: width,
		height: height,
		pinnedWidth: pinnedWidth,
		pinnedHeight: pinnedHeight,
		xOffset: xOffset,
		grid: grid,
	};

	emit("videoResize", event);
}

function setOverflow() {
	if (!container.value) return;

	const scrollWidth = container.value.scrollWidth;
	const containerWidth = container.value.clientWidth;

	isOverflow.value = scrollWidth > containerWidth;
}

const mosaicGridType = computed(() => {
	const count = pinnedUsersCount ? pinnedUsersCount : participantsCount;

	for (const grid of mosaicGrid) {
		const total = grid.w * grid.h;

		if (count <= total) {
			return grid;
		}
	}

	return mosaicGrid[0];
});

const small = computed(() => {
	return pinnedUsersCount > 0 ? "" : undefined;
});

const overflow = computed(() => {
	return isOverflow.value ? "" : undefined;
});

onMounted(() => {
	resizeObserver = new ResizeObserver(() => {
		setGrid();
		setOverflow();
	});

	resizeObserver.observe(container.value);
});

onBeforeUnmount(() => {
	if (resizeObserver) resizeObserver.disconnect();
});

watch([() => isFullscreen, () => participantsCount, () => resizeTrigger], () =>
	setGrid(),
);
</script>

<template>
  <div
    class="relative w-full h-full flex justify-center items-end overflow-hidden"
    :class="className"
    ref="container"
  >
    <div
      :data-small="small"
      :data-overflow="overflow"
      class="w-full max-w-full h-full flex justify-center content-center items-center flex-wrap overflow-y-hidden no-scrollbar data-[small]:w-fit data-[small]:h-fit data-[small]:flex-nowrap data-[small]:overflow-x-auto data-[overflow]:justify-start"
    >
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
