<script setup>
import { ref, onMounted, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import trpc from "@/trpc";
import GuideList from "@/components/GuideList.vue";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-vue-next";
import { useToast } from "@/components/ui/toast/use-toast";

// Initialize route, router and toast
const route = useRoute();
const router = useRouter();
const { toast } = useToast();

// State management
const loading = ref(true);
const error = ref(null);
const blogs = ref([]);
const totalPages = ref(1);
const currentPage = ref(1);
const searchQuery = ref("");

// Pagination settings
const ITEMS_PER_PAGE = 10;

// Data fetching
const fetchGuides = async () => {
	try {
		loading.value = true;
		error.value = null;

		// Prepare query parameters
		const params = {
			page: currentPage.value,
			limit: ITEMS_PER_PAGE,
			search: searchQuery.value,
			category: "Guide", // Always filter by "Guide" category
		};

		// Fetch guides from blogs using TRPC
		const data = await trpc.getBlogs.query(params);
		blogs.value = data.blogs || [];
		totalPages.value = data.totalPages || 1;
	} catch (err) {
		console.error("Error fetching guides:", err);
		error.value = "Failed to load guides. Please try again later.";
		toast({
			title: "Error",
			description: "Unable to load guides",
			variant: "destructive",
		});
	} finally {
		loading.value = false;
	}
};

// Navigation handlers
const navigateToPage = (page) => {
	if (page >= 1 && page <= totalPages.value) {
		currentPage.value = page;
		router.push({ query: { ...route.query, page } });
	}
};

// Watch for route changes
watch(
	() => route.query,
	(newQuery) => {
		if (newQuery.page) {
			currentPage.value = parseInt(newQuery.page);
		}
		if (newQuery.search) {
			searchQuery.value = newQuery.search;
		}
		fetchGuides();
	},
);

// Initialize on mount
onMounted(() => {
	// Set initial values from route query parameters
	if (route.query.page) {
		currentPage.value = parseInt(route.query.page);
	}
	if (route.query.search) {
		searchQuery.value = route.query.search;
	}

	fetchGuides();
});
</script>

<template>
  <div class="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header section -->
      <div class="flex flex-col lg:flex-row justify-between items-start mb-16">
        <div class="lg:w-1/2 mb-8 lg:mb-0">
          <h1 class="text-4xl font-bold text-gray-900 mb-6">Guides</h1>
        </div>
        <div class="lg:w-1/3">
          <p class="text-gray-600">
            Step-by-step guides and tutorials to help you get the most out of our platform.
          </p>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center min-h-[60vh]">
        <Loader2 class="w-10 h-10 animate-spin text-gray-600" />
      </div>

      <!-- Error state -->
      <div
        v-else-if="error"
        class="flex flex-col items-center justify-center min-h-[60vh]"
      >
        <AlertTriangle class="w-14 h-14 text-red-500 mb-6" />
        <p class="text-xl text-gray-600">{{ error }}</p>
        <Button class="mt-6" @click="fetchGuides">Try Again</Button>
      </div>

      <!-- Guide listing component -->
      <GuideList v-else-if="blogs.length" :blogs="blogs" />

      <!-- Empty state -->
      <div
        v-else
        class="flex flex-col items-center justify-center min-h-[60vh]"
      >
        <p class="text-xl text-gray-600 mb-4">No guides found</p>
        <Button
          v-if="searchQuery"
          @click="
            () => {
              searchQuery = '';
              router.push({ query: {} });
              fetchGuides();
            }
          "
        >
          Clear search
        </Button>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-16">
        <Button
          variant="outline"
          :disabled="currentPage === 1"
          @click="navigateToPage(currentPage - 1)"
        >
          Previous
        </Button>
        <Button
          v-for="page in totalPages"
          :key="page"
          :variant="page === currentPage ? 'default' : 'outline'"
          @click="navigateToPage(page)"
        >
          {{ page }}
        </Button>
        <Button
          variant="outline"
          :disabled="currentPage === totalPages"
          @click="navigateToPage(currentPage + 1)"
        >
          Next
        </Button>
      </div>
    </div>
  </div>
</template>