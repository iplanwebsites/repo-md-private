<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import trpc from "@/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/use-toast";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-vue-next";
import BlogHero from "@/components/BlogHero.vue";
import BlogSidebarCta from "./BlogSidebarCta.vue";
import BlogList from "@/components/BlogList.vue";

// Initialize route, router and toast
const route = useRoute();
const router = useRouter();
const { toast } = useToast();

// State management
const loading = ref(true);
const error = ref(null);
const blog = ref(null);
const relatedArticles = ref([]);
const recentArticles = ref([]);
const recentArticlesLoading = ref(false);

// Get the slug from the route params (reactive)
const slug = computed(() => route.params.slug);

// Constants
const NB_RELATED_POSTS = 4;

// Fetch blog detail
const fetchBlogDetail = async () => {
  try {
    loading.value = true;
    error.value = null;

    // Fetch blog using TRPC
    const data = await trpc.getBlog.query( slug.value );
    
    if (!data) {
      throw new Error("Blog not found");
    }
    
    blog.value = data; 
      relatedArticles.value = data.similarBlogs || []
   
  } catch (err) {
    console.error("Error fetching blog:", err);
    error.value = "Failed to load article. Please try again later.";
    toast({
      title: "Error",
      description: "Unable to load article",
      variant: "destructive",
    });
  } finally {
    loading.value = false;
  }
};

// Fetch recent articles
const fetchRecentArticles = async () => {
  try {
    recentArticlesLoading.value = true;
    
    const data = await trpc.getBlogs.query({
      page: 1,
      limit: NB_RELATED_POSTS + 1,
    });
    
    // Filter out the current article from recent articles and limit to NB_RELATED_POSTS
    recentArticles.value = (data.blogs || [])
      .filter(article => article.slug !== slug.value)
      .slice(0, NB_RELATED_POSTS);
  } catch (err) {
    console.error("Error fetching recent articles:", err);
  } finally {
    recentArticlesLoading.value = false;
  }
};

// Handle back navigation
const goBack = () => {
   router.back();
};

// Watch for route changes
watch(() => route.params.slug, (newSlug) => {
  if (newSlug) {
    fetchBlogDetail();
    fetchRecentArticles();
  }
});

// Initialize on mount
onMounted(() => {
  if (!slug.value) {
    console.log("No slug provided");
   // router.push('/blog');
    return;
  }
  
  fetchBlogDetail();
  fetchRecentArticles();
});
</script>

<template>
  <!-- Loading state -->
  <div v-if="loading" class="min-h-screen bg-white flex items-center justify-center">
    <Loader2 class="w-10 h-10 animate-spin text-gray-600" />
  </div>

  <!-- Error state -->
  <div
    v-else-if="error"
    class="min-h-screen bg-white flex flex-col items-center justify-center px-4"
  >
    <AlertTriangle class="w-14 h-14 text-red-500 mb-6" />
    <p class="text-xl text-gray-600">{{ error }}</p>
    <Button class="mt-6" @click="fetchBlogDetail">Try Again</Button>
    <Button variant="outline" class="mt-3" @click="goBack">Go Back</Button>
  </div>

  <!-- Blog content -->
  <template v-else-if="blog">
    <!-- Blog Hero Header (Full Width) -->
    <BlogHero :blog="blog" />

    <div class="bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <!-- Main content -->
          <div class="lg:col-span-3">
            <!-- Blog content -->
            <div class="prose prose-lg max-w-none">
              
              <Prose :html="blog.html" />
              <!--
               <div v-html="blog.html"></div>
                 -->
            </div>

            <!-- Tags -->
            <div v-if="blog.tags && blog.tags.length > 0" class="mt-10 pt-6 border-t border-gray-200">
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in blog.tags"
                  :key="tag"
                  class="inline-block px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800 rounded-full"
                >
                  {{ tag }}
                </span>
              </div>
            </div>

            <!-- Related articles -->
            <div
              v-if="relatedArticles.length > 0"
              class="mt-16 pt-10 border-t border-gray-200"
            >
              <h2 class="text-2xl font-bold text-gray-900 mb-6">Related Articles</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div
                  v-for="article in relatedArticles"
                  :key="article.slug"
                  class="group"
                >
                  <router-link :to="`/blog/${article.slug}`">
                    <div
                      v-if="article.featuredImage"
                      class="aspect-video mb-4 rounded-lg overflow-hidden bg-gray-100"
                    >
                      <img
                        :src="article.featuredImage"
                        :alt="article.title"
                        class="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                      />
                    </div>
                    <div v-else class="aspect-video mb-4 flex items-center justify-center bg-gray-100 rounded-lg text-gray-400">
                      No image
                    </div>
                    <h3 class="font-semibold text-gray-900 group-hover:text-gray-600 transition-colors">
                      {{ article.title }}
                    </h3>
                  </router-link>
                </div>
              </div>
            </div>

            <blog-footer-cta />
          </div>

          <!-- Sidebar -->
          <div class="hidden lg:block lg:col-span-1">
            <div class="sticky top-16">
              <BlogSidebarCta />
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Articles Section -->
      <div v-if="recentArticles.length > 0" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 class="text-3xl font-bold text-gray-900 mb-12 text-center">Recent Articles</h2>
        
        <!-- Loading state for recent articles -->
        <div v-if="recentArticlesLoading" class="flex items-center justify-center py-12">
          <Loader2 class="w-8 h-8 animate-spin text-gray-600" />
        </div>
        
        <!-- Recent articles list -->
        <BlogList v-else :blogs="recentArticles" />
      </div>
    </div>
  </template>


</template>