<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { watch } from "vue";

const props = defineProps({
	tabs: {
		type: Array,
		required: true,
	},
	indicatorPadding: {
		type: Number,
		default: 2,
	},
	hoverIndicatorHeight: {
		type: Number,
		default: 3,
	},
	activeIndicatorHeight: {
		type: Number,
		default: 2,
	},
	sticky: {
		type: Boolean,
		default: false,
	},
	stickyTop: {
		type: String,
		default: "64px",
	},
});

const emit = defineEmits(["tab-change"]);

const route = useRoute();
const router = useRouter();
const tabsContainer = ref(null);
const tabRefs = ref([]);
const currentHoverIndex = ref(null);

// Improved logic to compute which tab is active based on the current route
const activeTab = computed(() => {
	const currentPath = route.path;
	
	// First check for exact matches
	const exactMatch = props.tabs.find(tab => currentPath === tab.path);
	if (exactMatch) {
		return exactMatch.id;
	}
	
	// Handle root path case separately
	if (currentPath === "/") {
		const rootTab = props.tabs.find(tab => tab.path === "/");
		return rootTab ? rootTab.id : props.tabs[0]?.id;
	}
	
	// Check for child paths (current path starts with tab path)
	// Sort tabs by path length descending to match the most specific path first
	const sortedTabs = [...props.tabs]
		.filter(tab => tab.path !== "/") // Exclude root path from this check
		.sort((a, b) => b.path.length - a.path.length);
	
	const parentMatch = sortedTabs.find(tab => 
		currentPath.startsWith(tab.path + "/") || currentPath === tab.path
	);
	
	if (parentMatch) {
		return parentMatch.id;
	}
	
	// Default to the first tab if no match is found
	return props.tabs[0]?.id;
});

// Get the active tab index
const activeTabIndex = computed(() => {
	return props.tabs.findIndex((tab) => tab.id === activeTab.value);
});

// Get the active tab element
const activeTabElement = computed(() => {
	if (activeTabIndex.value === -1 || !tabRefs.value[activeTabIndex.value]) {
		return null;
	}
	const tabElement = tabRefs.value[activeTabIndex.value];
	return tabElement.$el || tabElement;
});

// Calculate active indicator position and width
const activeIndicatorStyle = computed(() => {
	if (!activeTabElement.value) {
		return {
			left: "0px",
			width: "0px",
			height: `${props.activeIndicatorHeight}px`,
			opacity: "1",
			zIndex: "2",
		};
	}

	return {
		left: `${activeTabElement.value.offsetLeft}px`,
		width: `${activeTabElement.value.offsetWidth}px`,
		height: `${props.activeIndicatorHeight}px`,
		backgroundColor: "black",
		opacity: "1",
		zIndex: "2",
	};
});

// Get the hover tab element
const hoverTabElement = computed(() => {
	if (
		currentHoverIndex.value === null ||
		!tabRefs.value[currentHoverIndex.value]
	) {
		return activeTabElement.value; // Default to active tab when not hovering
	}
	const tabElement = tabRefs.value[currentHoverIndex.value];
	return tabElement.$el || tabElement;
});

// Calculate hover indicator position and width
const hoverIndicatorStyle = computed(() => {
	if (!hoverTabElement.value) {
		return {
			left: "0px",
			width: "0px",
			backgroundColor: "blue",
			opacity: "0",
			zIndex: "0",
		};
	}

	const isHovering = currentHoverIndex.value !== null;

	const PADDING_HOVER_W = 5;

	return {
		left: `${hoverTabElement.value.offsetLeft + PADDING_HOVER_W}px`,
		width: `${hoverTabElement.value.offsetWidth - PADDING_HOVER_W * 2}px`,
		top: 8 + "px",
		height: 29 + `px`,
		backgroundColor: "rgba(0, 0, 0, 0.15)",
		opacity: isHovering ? "0.3" : "0.0",
		zIndex: "0",
		position: "absolute",
		borderRadius: "5px",
	};
});

// Handle tab hover
const handleTabHover = (index) => {
	currentHoverIndex.value = index;
};

// Handle mouse leaving tabs area
const handleMouseLeave = () => {
	currentHoverIndex.value = null;
};

// Handle tab click
const handleTabClick = (tab) => {
	emit("tab-change", tab.id);

	// If it's a route, use the router
	if (tab.path) {
		router.push(tab.path);
	}
};

// Register a tab element reference
const registerTabRef = (el, index) => {
	tabRefs.value[index] = el;
};

// Force update of computed values after DOM updates
const forceUpdate = async () => {
	await nextTick();
};

// Debug current active tab and path (can be removed in production)
const debugInfo = computed(() => {
	return {
		currentPath: route.path,
		activeTabId: activeTab.value,
		activeTabIndex: activeTabIndex.value,
	};
});

// Watch for route changes to update tab selection
watch(
	() => route.path,
	() => {
		forceUpdate();
		// Optionally log debug info
		// console.log("Route changed:", debugInfo.value);
	}
);

// Initialize after component is mounted
onMounted(() => {
	forceUpdate();
	window.addEventListener("resize", forceUpdate);
});

// Clean up
onUnmounted(() => {
	window.removeEventListener("resize", forceUpdate);
});

// Watch for changes in active tab and tabs array
watch(activeTab, forceUpdate);
watch(() => props.tabs, forceUpdate, { deep: true });
</script>

<template>
  <div
    class="border-b border-border relative"
    :class="{ 'sticky bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10': sticky }"
    :style="sticky ? { top: stickyTop } : {}"
    ref="tabsContainer"
    @mouseleave="handleMouseLeave"
  >
    <div class="flex overflow-x-auto">
      <div
        v-for="(tab, index) in tabs"
        :key="`tab-${tab.id}-${index}`"
        class="py-3 px-4 text-sm whitespace-nowrap transition-colors duration-200 cursor-pointer"
        :class="{
          'text-foreground font-medium': activeTab === tab.id,
          'text-muted-foreground hover:text-foreground': activeTab !== tab.id,
        }"
        @click="handleTabClick(tab)"
        @mouseenter="handleTabHover(index)"
        :ref="(el) => registerTabRef(el, index)"
      >
        {{ tab.name }}
      </div>
    </div>

    <!-- Hover indicator -->
    <div class="indicator-bar" :style="hoverIndicatorStyle"></div>

    <!-- Active tab indicator -->
    <div class="indicator-bar" :style="activeIndicatorStyle"></div>
  </div>
</template>

<style scoped>
.indicator-bar {
  display: block;
  border-radius: 2px;
  pointer-events: none;
  position: relative;
  transition:
    left 0.3s ease,
    width 0.3s ease;
}
</style>