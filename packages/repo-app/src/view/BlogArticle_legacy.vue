<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import trpc from "@/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/use-toast";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-vue-next";

// Initialize route, router and toast
const route = useRoute();
const router = useRouter();
const { toast } = useToast();

// State management
const loading = ref(true);
const error = ref(null);
const blog = ref(null);
const relatedArticles = ref([]);

// Get the slug from the route params
const slug = route.params.slug;

// Fetch blog detail
const fetchBlogDetail = async () => {
  try {
    loading.value = true;
    error.value = null;

    // Fetch blog using TRPC
    const data = await trpc.getBlog.query( slug );
    
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

// Handle back navigation
const goBack = () => {
   router.back();
};

// Initialize on mount
onMounted(() => {
  if (!slug) {
    console.log("No slug provided");
   // router.push('/blog');
    return;
  }
  
  fetchBlogDetail();
});
</script>

<template>
  <div class="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
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
        <Button class="mt-6" @click="fetchBlogDetail">Try Again</Button>
        <Button variant="outline" class="mt-3" @click="goBack">Go Back</Button>
      </div>

      <!-- Blog content -->
      <template v-else-if="blog">
        <!-- Back button -->
        <Button
          variant="ghost"
          class="mb-8 flex items-center text-gray-600 hover:text-gray-900"
          @click="goBack"
        >
          <ArrowLeft class="w-4 h-4 mr-2" />
          Back to Blog
        </Button>

        <!-- Blog header -->
        <div class="mb-10">
          <div class="flex items-center mb-4">
            <span
              v-if="blog.category"
              class="inline-block px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800 rounded-full mr-3"
            >
              {{ blog.category }}
            </span>
            <span v-if="blog.publishedAt" class="text-gray-500 text-sm">
              {{ blog.publishedAt }}
            </span>
          </div>
          <h1 class="text-4xl font-bold text-gray-900 mb-6">{{ blog.title }}</h1>
          <div v-if="blog.author" class="flex items-center">
            <div
              v-if="blog.authorAvatar"
              class="w-10 h-10 rounded-full bg-gray-200 overflow-hidden mr-3"
            >
              <img
                :src="blog.authorAvatar"
                :alt="blog.author"
                class="w-full h-full object-cover"
              />
            </div>
            <div v-else class="w-10 h-10 rounded-full bg-gray-200 mr-3 flex items-center justify-center text-gray-500">
              {{ blog.author.charAt(0) }}
            </div>
            <div>
              <p class="font-medium text-gray-900">{{ blog.author }}</p>
              <p v-if="blog.authorTitle" class="text-sm text-gray-500">
                {{ blog.authorTitle }}
              </p>
            </div>
          </div>
        </div>

        <!-- Featured image -->
        <div v-if="blog.featuredImage" class="mb-10">
          <img
            :src="blog.featuredImage"
            :alt="blog.title"
            class="w-full h-auto rounded-lg"
          />
        </div>

        <!-- Blog content -->
        <div class="prose prose-lg max-w-none">
          <div v-html="blog.html"></div>
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
      </template>

      <!-- Related articles -->
      <div
        v-if="relatedArticles.length > 0"
        class="mt-16 pt-10 border-t border-gray-200"
      >
        <h2 class="text-2xl font-bold text-gray-900 mb-6">Related Articles</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
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
    </div>
  </div>
</template>