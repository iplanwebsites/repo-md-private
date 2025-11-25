<script setup>
import { RouterLink } from "vue-router";
import { Calendar, ArrowRight } from "lucide-vue-next";
import { formatDateCustom } from "@/lib/utils/dateUtils";

// Props
const props = defineProps({
	blogs: {
		type: Array,
		required: true,
	},
});
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-16">
    <RouterLink
      v-for="blog in blogs"
      :key="blog.id"
      :to="`/guides/${blog.slug}`"
      class="group"
    >
      <!-- Blog image with translucent info bar -->
      <div class="relative aspect-[16/9] mb-4 bg-gray-100 overflow-hidden">
        <img
          :src="blog.cover || '/api/placeholder/600/340'"
          :alt="blog.title"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <!-- Translucent information bar -->
        <div
          class="absolute bottom-0 left-0 right-0 bg-white bg-opacity-30 p-4"
        >
          <div
            class="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-gray/70 border-t border-white flex justify-between items-center px-4 py-2 text-white"
            style="border-top: 1px solid rgba(255, 255, 255, 0.2)"
          >
            <!-- Author information -->
            <div class="flex items-center">
              <img
                :src="blog.authorAvatar || '/img/TBD/placeholder/32/32'"
                :alt="blog.author || 'Anonymous'"
                class="w-8 h-8 rounded-full border-2 border-white"
              />
              <span class="ml-2 text-sm font-medium text-white-800">
                {{ blog.author || "Anonymous" }}
              </span>

              <!-- Date with calendar icon -->
              <span class="ml-4 flex items-center text-xs text-white-600">
                <Calendar class="w-3 h-3 mr-1" />
                {{ formatDateCustom(blog.date || new Date()) }}
              </span>
            </div>

            <!-- Category on the right edge -->
            <div class="text-sm font-medium text-white-700">
              {{ blog.category }}
            </div>
          </div>
        </div>
      </div>

      <!-- Title -->
      <h2 class="text-xl font-bold text-gray-900 mb-2 group-hover:underline">
        {{ blog.title }}
      </h2>

      <!-- Description with 2-line limit -->
      <p class="text-gray-600 mb-4 line-clamp-2">
        {{ blog.firstParagraphText || blog.excerpt }}
      </p>

      <!-- Read post text -->
      <div
        class="text-gray-900 font-medium group-hover:underline flex items-center"
      >
        Read
        <ArrowRight class="w-4 h-4 ml-1" />
      </div>
    </RouterLink>
  </div>
</template>

<style scoped>
/* Ensure text trimming for blog descriptions */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Prevent the default underline on RouterLink while preserving link behavior */
.group {
  text-decoration: none;
  color: inherit;
  display: block;
}
</style>