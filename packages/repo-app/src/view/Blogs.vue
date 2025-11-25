<script setup>
import { ref, onMounted, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import trpc from "@/trpc";
import BlogList from "@/components/BlogList.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast/use-toast";
import { Loader2, AlertTriangle } from "lucide-vue-next";

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
const selectedCategory = ref("all");
const categories = ref(["Product", "Community", "Writing", "Design", "Dev"]);
const email = ref("");

// Pagination settings
const ITEMS_PER_PAGE = 10;

// Computed properties
const filteredBlogs = computed(() => {
  if (selectedCategory.value === "all") {
    return blogs.value;
  }
  return blogs.value.filter((blog) => blog.category == selectedCategory.value);
});

// Data fetching
const fetchBlogs = async () => {
  try {
    loading.value = true;
    error.value = null;

    // Prepare query parameters
    const params = {
      page: currentPage.value,
      limit: ITEMS_PER_PAGE,
      search: searchQuery.value,
      category:
        selectedCategory.value === "all" ? null : selectedCategory.value,
    };

    // Fetch blogs using TRPC
    const data = await trpc.getBlogs.query(params);
    blogs.value = data.blogs || [];
    totalPages.value = data.totalPages || 1;
  } catch (err) {
    console.error("Error fetching blogs:", err);
    error.value = "Failed to load articles. Please try again later.";
    toast({
      title: "Error",
      description: "Unable to load articles",
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

// Filter handlers
const handleCategoryChange = (category) => {
  selectedCategory.value = category;
  currentPage.value = 1;
  router.push({
    query: {
      ...route.query,
      category: category === "all" ? undefined : category,
      page: 1,
    },
  });
};

const handleSubscribe = () => {
  if (!email.value || !email.value.includes("@")) {
    toast({
      title: "Error",
      description: "Please enter a valid email address",
      variant: "destructive",
    });
    return;
  }

  toast({
    title: "Thank you!",
    description: "You are now subscribed to our newsletter",
    variant: "default",
  });

  email.value = "";
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
    if (newQuery.category) {
      selectedCategory.value = newQuery.category;
    } else {
      selectedCategory.value = "all";
    }
    fetchBlogs();
  }
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
  if (route.query.category) {
    selectedCategory.value = route.query.category;
  }

  fetchBlogs();
});

const DEFAULT_AUTHOR = 'Repo.md Team';
</script>

<template>
  <div class="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header section with subscribe form -->
      <div class="flex flex-col lg:flex-row justify-between items-start mb-16">
        <div class="lg:w-1/2 mb-8 lg:mb-0">
          <h1 class="text-4xl font-bold text-gray-900 mb-6">Blog</h1>
          <div class="flex w-full max-w-sm items-center space-x-2">
            <Input
              v-model="email"
              type="email"
              placeholder="My email"
              class="rounded-full border-gray-300"
            />
            <Button
              @click="handleSubscribe"
              class="rounded-full bg-gray-900 hover:bg-gray-800 text-white"
            >
              Subscribe
            </Button>
          </div>
        </div>
        <div class="lg:w-1/3">
          <p class="text-gray-600">
            Articles, news and resources about the repo.md platform and
            community.
          </p>
        </div>
      </div>

      <!-- Category tabs -->
      <div class="border-b border-gray-200 mb-12">
        <div class="flex overflow-x-auto py-2 space-x-8">
          <button
            @click="handleCategoryChange('all')"
            :class="[
              'py-2 px-1 font-medium text-sm whitespace-nowrap',
              selectedCategory === 'all'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-700',
            ]"
          >
            View all
          </button>
          <button
            v-for="category in categories"
            :key="category"
            @click="handleCategoryChange(category)"
            :class="[
              'py-2 px-1 font-medium text-sm whitespace-nowrap',
              selectedCategory === category
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-700',
            ]"
          >
            {{ category }}
          </button>
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
        <Button class="mt-6" @click="fetchBlogs">Try Again</Button>
      </div>

      <!-- Blog listing component -->
      <BlogList v-else-if="filteredBlogs.length" :blogs="filteredBlogs" />

      <!-- Empty state -->
      <div
        v-else
        class="flex flex-col items-center justify-center min-h-[60vh]"
      >
        <p class="text-xl text-gray-600 mb-4">No articles found</p>
        <Button
          v-if="searchQuery || selectedCategory !== 'all'"
          @click="
            () => {
              searchQuery = '';
              selectedCategory = 'all';
              router.push({ query: {} });
              fetchBlogs();
            }
          "
        >
          Clear filters
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