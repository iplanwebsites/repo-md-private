<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useRoute } from "vue-router";

// Debug flag to show/hide debug information
const DEBUG = true;

const props = defineProps({
	tabs: {
		type: Array,
		required: true,
	},
	orgId: {
		type: String,
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
		default: 3,
	},
});

const emit = defineEmits(["tab-change"]);

const route = useRoute();
const activeTabIndicator = ref(null);
const hoverTabIndicator = ref(null);
const tabsContainer = ref(null);
const tabRefs = ref([]);
const isHovering = ref(false);
const debugInfo = ref({
	activeTabId: null,
	activeTabIndex: -1,
	position: { left: 0, width: 0 },
});

// Enhanced debug information for each tab
const tabsDebugInfo = computed(() => {
	return props.tabs.map((tab, index) => {
		const el = tabRefs.value[index];
		const isActive = tab.id === activeTab.value;

		return {
			id: tab.id,
			name: tab.name,
			path: tab.path,
			index,
			isActive,
			hasRef: !!el,
			position: el
				? {
						left: el.offsetLeft,
						width: el.offsetWidth,
						top: el.offsetTop,
						height: el.offsetHeight,
					}
				: null,
		};
	});
});

// Compute which tab is active based on the current route
const activeTab = computed(() => {
	const currentPath = route.path;
	const matchingTab = props.tabs.find((tab) => {
		const tabPath = `/${props.orgId}${tab.path}`;
		return (
			currentPath === tabPath ||
			(tab.path === "" && currentPath === `/${props.orgId}`)
		);
	});

	const id = matchingTab ? matchingTab.id : props.tabs[0]?.id;
	if (DEBUG) {
		debugInfo.value.activeTabId = id;
	}
	return id;
});

// Handle tab hover
const handleTabHover = (index) => {
	if (!hoverTabIndicator.value || !tabRefs.value[index]) return;

	isHovering.value = true;
	const tabElement = tabRefs.value[index];

	hoverTabIndicator.value.style.left = `${tabElement.offsetLeft}px`;
	hoverTabIndicator.value.style.width = `${tabElement.offsetWidth}px`;
	hoverTabIndicator.value.style.opacity = "0.7";
};

// Handle mouse leaving tabs area
const handleMouseLeave = () => {
	if (!hoverTabIndicator.value) return;
	isHovering.value = false;
	hoverTabIndicator.value.style.opacity = "0.3";
};

// Handle tab click
const handleTabClick = (tabId) => {
	emit("tab-change", tabId);
};

// Register a tab element reference
const registerTabRef = (el, index) => {
	if (el) {
		console.log(`Registering tab ref for index ${index}`, el);
	} else {
		console.log(`Clearing tab ref for index ${index}`);
	}
	tabRefs.value[index] = el;
};

// Update the active tab indicator - this is now a single source of truth
const updateActiveIndicator = async () => {
	if (!activeTabIndicator.value) return;

	// Wait for DOM updates to complete
	await nextTick();

	const activeIndex = props.tabs.findIndex((tab) => tab.id === activeTab.value);
	if (DEBUG) {
		debugInfo.value.activeTabIndex = activeIndex;
	}

	if (activeIndex === -1 || !tabRefs.value[activeIndex]) {
		console.warn(`Active tab ref not found for index ${activeIndex}`);
		return;
	}

	const el = tabRefs.value[activeIndex];
	const position = {
		left: el.offsetLeft,
		width: el.offsetWidth,
	};

	if (DEBUG) {
		debugInfo.value.position = position;
	}

	activeTabIndicator.value.style.left = `${position.left}px`;
	activeTabIndicator.value.style.width = `${position.width}px`;
};

// Watch ONLY the active tab and the tabs array - not the computed position
const watchActiveTab = async () => {
	console.log("Active tab or tabs array changed, updating indicator");
	await updateActiveIndicator();
};

// Validate tabRefs array after updates
const validateTabRefs = () => {
	console.log("Validating tab refs:", tabRefs.value);

	props.tabs.forEach((tab, index) => {
		if (!tabRefs.value[index]) {
			console.warn(`Missing ref for tab ${tab.id} at index ${index}`);
		}
	});
};

// Initialize after component is mounted
onMounted(() => {
	console.log("Component mounted, initializing");
	watchActiveTab();
	window.addEventListener("resize", updateActiveIndicator);

	// Force a validation of refs after mount
	nextTick(() => {
		validateTabRefs();
	});
});

// Clean up
onUnmounted(() => {
	window.removeEventListener("resize", updateActiveIndicator);
});

// Use a single watcher for both activeTab and props.tabs
// This removes the circular dependency that was causing recursive updates
const setupWatchers = () => {
	watch(activeTab, () => {
		console.log("Active tab changed to:", activeTab.value);
		watchActiveTab();
	});

	watch(
		() => props.tabs,
		(newTabs) => {
			console.log("Tabs array changed, length:", newTabs.length);
			watchActiveTab();

			// Reset and re-validate refs when tabs change
			nextTick(() => {
				validateTabRefs();
			});
		},
		{ deep: true },
	);
};

// Import watch at component level
import { watch } from "vue";
setupWatchers();
</script>

<template>
  <div
    class="border-b border-border relative"
    ref="tabsContainer"
    @mouseleave="handleMouseLeave"
  >
    <div class="flex overflow-x-auto">
      <router-link
        v-for="(tab, index) in tabs"
        :key="`tab-${tab.id}-${index}`"
        :to="'/' + orgId + tab.path"
        class="py-3 px-4 text-sm whitespace-nowrap transition-colors duration-200"
        :class="{
          'text-foreground font-medium': activeTab === tab.id,
          'text-muted-foreground hover:text-foreground': activeTab !== tab.id,
        }"
        @click="handleTabClick(tab.id)"
        @mouseenter="handleTabHover(index)"
        :ref="(el) => registerTabRef(el, index)"
      >
        {{ tab.name }}
      </router-link>
    </div>

    <!-- Hover indicator -->
    <div
      ref="hoverTabIndicator"
      class="indicator-bar"
      :style="{
        height: `${props.hoverIndicatorHeight}px`,
        backgroundColor: 'blue',
        opacity: '0.3',
        zIndex: '1',
        position: 'absolute',
        bottom: '0',
        left: '0',
        width: '55px',
      }"
    ></div>

    <!-- Active tab indicator -->
    <div
      ref="activeTabIndicator"
      class="indicator-bar"
      :style="{
        height: `${props.activeIndicatorHeight}px`,
        backgroundColor: 'red',
        opacity: '1',
        zIndex: isHovering ? '1' : '2',
        position: 'absolute',
        bottom: '0',
        left: '0',
        width: '55px',
      }"
    ></div>

    <!-- Enhanced Debug panel -->
    <div v-if="DEBUG" class="debug-panel">
      <h4>Debug Info:</h4>
      <div class="basic-info">
        <pre>Active Tab ID: {{ debugInfo.activeTabId }}</pre>
        <pre>Active Tab Index: {{ debugInfo.activeTabIndex }}</pre>
        <pre>
Position: Left: {{ debugInfo.position.left }}px, Width: {{
            debugInfo.position.width
          }}px</pre
        >
      </div>

      <h5 class="mt-2">Tabs Debug:</h5>
      <div class="tabs-debug">
        <div
          v-for="(tabInfo, idx) in tabsDebugInfo"
          :key="`debug-${idx}`"
          class="tab-debug-item"
        >
          <div :class="{ 'active-tab': tabInfo.isActive }">
            <strong>Tab {{ idx }}: {{ tabInfo.name }}</strong> ({{
              tabInfo.id
            }})
            <span v-if="tabInfo.isActive" class="active-marker">★ ACTIVE</span>
          </div>
          <div class="ml-2">
            <div>Has Ref: {{ tabInfo.hasRef ? "✓" : "✗" }}</div>
            <div v-if="tabInfo.position">
              <div>Left: {{ tabInfo.position.left }}px</div>
              <div>Width: {{ tabInfo.position.width }}px</div>
              <div>Top: {{ tabInfo.position.top }}px</div>
              <div>Height: {{ tabInfo.position.height }}px</div>
            </div>
            <div v-else class="error-text">
              Position unavailable - ref may be invalid
            </div>
          </div>
        </div>
      </div>

      <h5 class="mt-2">Tab Refs Array:</h5>
      <pre>
Total refs: {{ tabRefs.length }}, Valid refs: {{
          tabRefs.filter((r) => !!r).length
        }}</pre
      >
    </div>
  </div>
</template>

<style scoped>
.indicator-bar {
  display: block;
  border-radius: 2px;
  pointer-events: none;
  transition:
    left 0.3s ease,
    width 0.3s ease;
}

.debug-panel {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 100;
  margin-top: 5px;
  max-height: 500px;
  overflow-y: auto;
  width: 100%;
  max-width: 600px;
}

.tab-debug-item {
  margin-bottom: 8px;
  padding: 5px;
  border-left: 2px solid rgba(255, 255, 255, 0.3);
}

.active-tab {
  color: #00ff00;
}

.active-marker {
  color: yellow;
  margin-left: 5px;
}

.error-text {
  color: #ff6b6b;
}

.mt-2 {
  margin-top: 10px;
}

.ml-2 {
  margin-left: 10px;
}
</style>
