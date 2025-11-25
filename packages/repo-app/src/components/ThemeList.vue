<!-- Child Component: ThemeList.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Search, ChevronDown, ExternalLink, User } from "lucide-vue-next";
import { useThemeStore } from "@/store/themeStore";

const props = defineProps({
	orgId: {
		type: String,
		default: "",
	},
});

const emit = defineEmits(["theme-selected"]);
const router = useRouter();
const themeStore = useThemeStore();

// Filter categories based on actual theme data
const filterCategories = ref([
	{
		name: "Use Case",
		expanded: true,
		options: [
			{ label: "Portfolio", checked: false },
			{ label: "Personal", checked: false },
			{ label: "Blog", checked: false },
			{ label: "Notes", checked: false },
			{ label: "Knowledge", checked: false },
			{ label: "Documentation", checked: false },
			{ label: "Starter", checked: false },
		],
	},
	{
		name: "Purpose",
		expanded: true,
		options: [
			{ label: "Writing", checked: false },
			{ label: "Publishing", checked: false },
			{ label: "Productivity", checked: false },
			{ label: "Education", checked: false },
			{ label: "Business", checked: false },
			{ label: "Development", checked: false },
		],
	},
	{
		name: "Content Type",
		expanded: false,
		options: [
			{ label: "Academic", checked: false },
			{ label: "Technical", checked: false },
			{ label: "Food", checked: false },
			{ label: "Wellness", checked: false },
			{ label: "Support", checked: false },
			{ label: "Organization", checked: false },
			{ label: "Content", checked: false },
			{ label: "Collaboration", checked: false },
		],
	},
]);

// Search query
const searchQuery = ref("");

// Filtered themes based on search and category filters
const filteredThemes = computed(() => {
	let result = [...themeStore.getAllThemes];

	// Apply search filter
	if (searchQuery.value.trim() !== "") {
		const query = searchQuery.value.toLowerCase();
		result = result.filter(
			(theme) =>
				theme.name.toLowerCase().includes(query) ||
				theme.description.toLowerCase().includes(query),
		);
	}

	// Extract all selected filter options
	const selectedCategoryFilters = [];

	filterCategories.value.forEach((filterGroup) => {
		filterGroup.options.forEach((option) => {
			if (option.checked) {
				selectedCategoryFilters.push(option.label);
			}
		});
	});

	// Apply category filters
	if (selectedCategoryFilters.length > 0) {
		result = result.filter((theme) =>
			theme.categories.some((category) =>
				selectedCategoryFilters.includes(category),
			),
		);
	}

	return result;
});

const selectedTheme = ref(null);

// Generate simplified filter categories based on core user needs
const generateDynamicCategories = () => {
	// Core categories that represent fundamental user needs
	const coreCategories = [
		"Business",
		"Personal",
		"Blog",
		"Education",
		"Portfolio",
		"Notes",
		"Documentation",
		"Writing",
		"Knowledge",
	];

	// Create a single filter group with core categories
	return [
		{
			name: "Categories",
			expanded: true,
			options: coreCategories.map((cat) => ({ label: cat, checked: false })),
		},
	];
};

onMounted(async () => {
	// Fetch themes if needed
	await themeStore.fetchThemes();

	// Generate dynamic filter categories based on actual data
	filterCategories.value = generateDynamicCategories();

	// Auto-select first theme on mount if available
	if (filteredThemes.value.length > 0) {
		selectTheme(filteredThemes.value[0]);
	}
});

const selectTheme = (theme) => {
	selectedTheme.value = theme;
	emit("theme-selected", theme);
};

const getThemePath = (theme) => {
	return props.orgId
		? `/new/${props.orgId}/themes/${theme.id}`
		: `/themes/${theme.id}`;
};

// Toggle category expansion
const toggleCategoryExpansion = (category) => {
	category.expanded = !category.expanded;
};

// Clear all filters
const clearAllFilters = () => {
	searchQuery.value = "";
	filterCategories.value.forEach((category) =>
		category.options.forEach((option) => (option.checked = false)),
	);
};

// Handle checkbox change
const handleCheckboxChange = () => {
	// If filters change and selected theme is no longer in filtered list, select first filtered theme
	if (
		selectedTheme.value &&
		!filteredThemes.value.some((theme) => theme.id === selectedTheme.value.id)
	) {
		if (filteredThemes.value.length > 0) {
			selectTheme(filteredThemes.value[0]);
		} else {
			selectedTheme.value = null;
		}
	}
};
</script>

<template>
  <div class="flex mb-10">
    <!-- Filter Sidebar -->
    <div class="w-64 mr-8">
      <div class="mb-6">
        <h2 class="text-lg font-medium mb-4">Filter Themes</h2>

        <!-- Search input -->
        <div class="relative mb-4">
          <div
            class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"
          >
            <Search class="h-5 w-5 text-gray-400" />
          </div>
          <Input
            type="text"
            v-model="searchQuery"
            placeholder="Search..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Filter categories -->
        <div
          v-for="(category, categoryIndex) in filterCategories"
          :key="categoryIndex"
        >
          <div
            @click="toggleCategoryExpansion(category)"
            class="flex items-center justify-between py-2 cursor-pointer hover:text-blue-600"
          >
            <span class="font-medium">{{ category.name }}</span>
            <ChevronDown
              class="h-5 w-5 transform transition-transform"
              :class="{ 'rotate-180': !category.expanded }"
            />
          </div>

          <div v-if="category.expanded" class="ml-1 mb-4">
            <div
              v-for="(option, optionIndex) in category.options"
              :key="optionIndex"
              class="flex items-center my-2"
            >
              <input
                type="checkbox"
                :id="`option-${categoryIndex}-${optionIndex}`"
                v-model="option.checked"
                @change="handleCheckboxChange"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                :for="`option-${categoryIndex}-${optionIndex}`"
                class="ml-2 text-sm text-gray-700"
              >
                {{ option.label }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Theme Grid -->
    <div class="flex-1">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <router-link
          v-for="theme in filteredThemes"
          :to="getThemePath(theme)"
          :key="theme.id"
        >
          <div
            class="border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          >
            <!-- Theme Image -->
            <div class="relative h-40 bg-gray-100">
              <img
                :src="theme.image"
                :alt="theme.name"
                class="w-full h-full object-cover"
              />
              <div class="absolute bottom-3 left-3">
                <div
                  class="bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center"
                >
                  <img
                    :src="theme.icon"
                    :alt="theme.name + ' icon'"
                    class="w-5 h-5"
                  />
                </div>
              </div>
            </div>

            <!-- Theme Info -->
            <div class="p-4">
              <h3 class="font-medium text-lg mb-1">{{ theme.name }}</h3>
              <p class="text-sm text-gray-600 mb-3">
                {{ theme.description }}
              </p>

              <!-- Author -->
              <div class="flex items-center text-sm text-gray-500">
                <span>by</span>
                <span class="ml-1 flex items-center">
                  <User class="h-4 w-4 text-gray-400 mr-1" />
                  {{ theme.author }}
                </span>

                <!-- External link icon -->
                <span class="ml-auto">
                  <ExternalLink class="h-4 w-4 text-gray-400" />
                </span>
              </div>
            </div>
          </div>
        </router-link>
      </div>

      <!-- Empty state when no themes match filters -->
      <div v-if="filteredThemes.length === 0" class="text-center py-10">
        <p class="text-gray-500">No themes match your current filters.</p>
        <button
          @click="clearAllFilters"
          class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Clear filters
        </button>
      </div>
    </div>
  </div>
</template>
