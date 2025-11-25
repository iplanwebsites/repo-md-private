<!-- ThemeDetail.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft, Star, Github } from "lucide-vue-next";
import { useThemeStore } from "@/store/themeStore";
import BackBt from "@/components/BackBt.vue";
import { Button } from "@/components/ui/button";

const route = useRoute();
const themeStore = useThemeStore();

// Get theme ID from route params
const themeId = computed(() => String(route.params.themeId));

// Get theme data from store
const theme = computed(() => themeStore.getThemeById(themeId.value));

// Get related themes
const relatedThemes = computed(() =>
	themeStore.getRelatedThemes(themeId.value),
);

// Placeholder image URL - using one consistent URL for now
const placeholderImage = "https://placehold.co/400x200";

// Compute back URL
const backUrl = computed(() => {
	const orgId = route.params.orgId;
	return orgId ? `/new/${orgId}/themes` : "/themes";
});

onMounted(async () => {
	// Fetch themes if needed
	await themeStore.fetchThemes();
});
</script>

<template>
  <div class="container">
    <BackBt :to="backUrl" title="Back To Themes" />
    <!-- Header with back button -->
    <header class="mt-8">
      <div class="container mx-auto px-4 py-3 flex items-center"></div>
    </header>

    <!-- Main content -->
    <main class="flex-grow" v-if="theme">
      <div class="container mx-auto px-4 py-8">
        <!-- Theme header section -->
        <div class="flex items-center mb-6">
          <div
            class="bg-purple-500 h-8 w-8 rounded-md flex items-center justify-center text-white mr-3"
          >
            <img
              v-if="theme.icon"
              :src="theme.icon"
              alt="Theme icon"
              class="w-5 h-5"
            />
            <span v-else>{{ theme.name.charAt(0) }}</span>
          </div>
          <div>
            <h1 class="text-xl font-bold">{{ theme.name }}</h1>
            <p class="text-sm text-gray-500">
              {{ theme.description }}
            </p>
          </div>
        </div>

        <!-- Framework info -->
        <div class="grid grid-cols-4 gap-8 mb-8">
          <div>
            <div class="text-xs text-gray-500 mb-1">Framework</div>
            <div class="text-sm">{{ theme.framework }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1">Style</div>
            <div class="text-sm">{{ theme.categories.join(", ") }}</div>
          </div>
          <div v-if="theme.stars">
            <div class="text-xs text-gray-500 mb-1">Stars</div>
            <div class="text-sm flex items-center">
              <Star class="w-4 h-4 mr-1 text-yellow-400" />
              {{ theme.stars }}
            </div>
          </div>
        </div>

        <!-- Demo Button -->
        <div class="mb-8">
          <router-link :to="'/new/clone?themeId=' + theme.id">
            <Button variant="default" size="default">Apply Theme</Button>
          </router-link>
          <Button variant="outline" size="default" class="ml-3">Preview</Button>
        </div>

        <!-- Related Themes Section -->
        <div class="mb-8" v-if="relatedThemes && relatedThemes.length > 0">
          <h2 class="text-lg font-bold mb-4">Related Themes</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <!-- Theme Cards -->
            <div
              v-for="relatedTheme in relatedThemes"
              :key="relatedTheme.id"
              class="border rounded-md overflow-hidden hover:shadow-md transition-shadow"
            >
              <div class="h-40 bg-gray-100 relative">
                <img
                  :src="relatedTheme.image || placeholderImage"
                  :alt="relatedTheme.name"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="p-4">
                <h3 class="font-bold text-sm mb-1">
                  {{ relatedTheme.name }}
                </h3>
                <p class="text-xs text-gray-600 mb-3">
                  {{ relatedTheme.description }}
                </p>
                <div class="flex justify-between items-center text-xs">
                  <span class="text-gray-500"
                    >by {{ relatedTheme.author }}</span
                  >
                  <div class="flex items-center" v-if="relatedTheme.stars">
                    <Star class="w-3 h-3 mr-1 text-gray-400" />
                    <span>{{ relatedTheme.stars }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Customization Section -->
        <div class="mb-8">
          <h2 class="text-lg font-bold mb-2">Customization</h2>
          <p class="text-sm text-gray-600">
            This theme is highly customizable. You can easily change colors,
            fonts, and layouts to match your brand's identity. Check out the
            <a href="#" class="text-blue-600 hover:underline">documentation</a>
            for details.
          </p>
        </div>

        <!-- Support Section -->
        <div class="mb-8">
          <h2 class="text-lg font-bold mb-2">Support</h2>
          <p class="text-sm text-gray-600">
            If you need help with customization or have questions, join our
            Discord community at
            <a href="#" class="text-blue-600 hover:underline"
              >https://pushmd.com/discord</a
            >.
          </p>
        </div>

        <!-- License Section -->
        <div class="mb-8">
          <h2 class="text-lg font-bold mb-2">License</h2>
          <p class="text-sm text-gray-600">
            This theme is licensed under the MIT License. For more information,
            see the
            <a href="#" class="text-blue-600 hover:underline">LICENSE file</a>.
          </p>
        </div>

        <!-- Designers Section -->
        <div class="mb-8">
          <h2 class="text-lg font-bold mb-2">Designers</h2>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="i in 3"
              :key="i"
              class="w-10 h-10 rounded-full bg-gray-200 overflow-hidden"
            >
              <img
                :src="placeholderImage"
                alt="Designer"
                class="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Loading or not found state -->
    <div v-else class="container mx-auto px-4 py-8 text-center">
      <p v-if="themeStore.loading">Loading theme...</p>
      <p v-else class="text-gray-500">Theme not found</p>
    </div>

    <!-- Footer with CTA -->
    <footer class="bg-gray-900 text-white py-12">
      <div class="container mx-auto px-4 text-center">
        <h2 class="text-2xl font-bold mb-4">Transform Your Content</h2>
        <p class="mb-6 text-gray-300">
          Apply beautiful themes to your Repo.md projects and make your content
          shine
        </p>
        <Button variant="primary" size="lg">Try Repo.md Free</Button>
      </div>
    </footer>
  </div>
</template>
