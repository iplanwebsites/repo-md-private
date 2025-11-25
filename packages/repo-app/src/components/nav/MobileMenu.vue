<script setup>
import {
	ChevronDown,
	ChevronUp,
	LayoutDashboard,
	Settings,
	HelpCircle,
	Info,
	X,
} from "lucide-vue-next";
import { useRoute } from "vue-router";
import { computed, ref } from "vue";
import {
	navigationItems,
	topLevelLinks,
	hiddenSectionInNavbar,
} from "./navigationItems.js";

const route = useRoute();

// Check if the current route is active
const isActive = (path) => {
	if (path === "/" && route.path === "/") {
		return true;
	}
	return path !== "/" && route.path.startsWith(path);
};

// Emit close event when a menu item is clicked
const emit = defineEmits(["close"]);

const closeMenu = () => {
	emit("close");
};

// Track expanded sections
const expandedSections = ref({});

const toggleSection = (section) => {
	expandedSections.value = {
		...expandedSections.value,
		[section]: !expandedSections.value[section],
	};
};

// Format normal menu items with proper classes
const getMenuItems = (items) => {
	return items.map((item) => ({
		...item,
		active: isActive(item.href || item.path),
		class: `flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors ${
			isActive(item.href || item.path) ? "bg-accent" : ""
		}`,
	}));
};

// Compute visible navigation items - mirroring the logic from NavbarBrochureMenu
const visibleNavigationItems = computed(() => {
	const result = {};

	for (const [category, items] of Object.entries(navigationItems)) {
		// Skip categories that are hidden in navbar
		if (hiddenSectionInNavbar.includes(category)) {
			continue;
		}

		// Filter out items with hiddenNavbar property set to true
		const visibleItems = items.filter((item) => !item.hiddenNavbar);

		// Only add the category if it has visible items
		if (visibleItems.length > 0) {
			// Handle special case for Solutions category with grouping
			if (category === "Solutions") {
				// Create a grouped structure
				const groupedItems = {};

				visibleItems.forEach((item) => {
					const group = item.group || "Default";
					if (!groupedItems[group]) {
						groupedItems[group] = [];
					}
					groupedItems[group].push(item);
				});

				result[category] = groupedItems;
			} else {
				// For other categories, keep the flat array structure
				result[category] = visibleItems;
			}
		}
	}

	return result;
});

// Format the navigation items for mobile display with collapsible sections
const mobileNavigationItems = computed(() => {
	const result = {};

	for (const [category, items] of Object.entries(
		visibleNavigationItems.value,
	)) {
		// Handle Solutions with its grouped structure
		if (category === "Solutions") {
			const processedItems = [];

			for (const [groupName, groupItems] of Object.entries(items)) {
				processedItems.push({
					isGroupHeader: true,
					label: groupName,
					class: "text-sm font-medium text-muted-foreground px-3 pt-2",
				});

				processedItems.push(...getMenuItems(groupItems));
			}

			result[category] = processedItems;
		} else {
			// Standard items
			result[category] = getMenuItems(items);
		}
	}

	return result;
});

// Dashboard at the top
const dashboardItem = [
	{ path: "/", icon: LayoutDashboard, label: "Dashboard" },
];

// Footer settings items
const settingsMenuItems = [
	{ path: "/settings", icon: Settings, label: "Settings" },
	{ path: "/help", icon: HelpCircle, label: "Help" },
];

// Determine if a category has grouped items
const hasGroupedItems = (category) => {
	return category === "Solutions";
};

const computedDashboardItem = computed(() => getMenuItems(dashboardItem));
const computedTopLevelLinks = computed(() =>
	getMenuItems(
		topLevelLinks.map((link) => ({ path: link.href, label: link.name })),
	),
);
const computedSettingsMenuItems = computed(() =>
	getMenuItems(settingsMenuItems),
);
</script>

<template>
  <div class="mobile-menu fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
    <!-- Header with close button -->
    <div class="flex items-center justify-between p-4 border-b">
      <h2 class="text-xl font-semibold">Menu</h2>
      <button
        @click="closeMenu"
        class="p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Close menu"
      >
        <X class="h-5 w-5" />
      </button>
    </div>

    <!-- Menu Items -->
    <div class="p-4 overflow-y-auto max-h-[calc(100vh-64px)]">
      <!-- Dashboard Link at the top -->
      <div class="space-y-2 mb-6">
        <RouterLink
          v-for="item in computedDashboardItem"
          :key="item.path"
          :to="item.path"
          @click="closeMenu"
          :class="item.class"
        >
          <component :is="item.icon" class="h-5 w-5" v-if="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>

      <!-- Dynamic Navigation from navigationItems.js -->
      <div class="space-y-4">
        <div v-for="(items, category) in mobileNavigationItems" :key="category" class="border-t pt-4">
          <!-- Collapsible Section Header -->
          <div 
            class="flex items-center justify-between p-3 cursor-pointer hover:bg-accent rounded-lg mb-1"
            @click="toggleSection(category)"
          >
            <span class="font-medium">{{ category }}</span>
            <component 
              :is="expandedSections[category] ? ChevronUp : ChevronDown" 
              class="h-4 w-4"
            />
          </div>

          <!-- Collapsible Content -->
          <div v-if="expandedSections[category]" class="ml-2 space-y-1">
            <template v-for="(item, index) in items" :key="index">
              <!-- Group Header (for Solutions) -->
              <div v-if="item.isGroupHeader" :class="item.class">
                {{ item.label }}
              </div>
              
              <!-- Regular Menu Item -->
              <RouterLink
                v-else
                :to="item.href || item.path"
                @click="closeMenu"
                :class="item.class"
              >
                <component :is="item.icon" class="h-4 w-4" v-if="item.icon" />
                <span>{{ item.label || item.name }}</span>
              </RouterLink>
            </template>
          </div>
        </div>
      </div>

      <!-- Top Level Links (Docs, Pricing) -->
      <div class="border-t pt-4 mt-6 space-y-2">
        <RouterLink
          v-for="item in computedTopLevelLinks"
          :key="item.path"
          :to="item.path"
          @click="closeMenu"
          :class="item.class"
        >
          <component :is="item.icon" class="h-5 w-5" v-if="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>

      <!-- Settings Section -->
      <div class="pt-4 border-t mt-6">
        <RouterLink
          v-for="item in computedSettingsMenuItems"
          :key="item.path"
          :to="item.path"
          @click="closeMenu"
          :class="item.class"
        >
          <component :is="item.icon" class="h-5 w-5" v-if="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-menu {
  animation: slide-in 0.3s ease forwards;
}

@keyframes slide-in {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

/* Dark mode support */
:root.dark .hover\:bg-gray-100:hover {
  background-color: hsl(var(--muted));
}
</style>
