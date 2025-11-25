<!-- TemplateDetail.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft, Star, Github } from "lucide-vue-next";
import { useTemplateStore } from "@/store/templateStore";
import BackBt from "@/components/BackBt.vue";
import { Button } from "@/components/ui/button";

const route = useRoute();
const templateStore = useTemplateStore();

// Get template ID from route params
const templateId = computed(() => Number(route.params.templateId));

// Get template data from store
const template = computed(() =>
	templateStore.getTemplateById(templateId.value),
);

// Get related templates
const relatedTemplates = computed(() =>
	templateStore.getRelatedTemplates(templateId.value),
);

// Placeholder image URL - using one consistent URL for now
const placeholderImage = "https://placehold.co/400x200";

// Compute back URL
const backUrl = computed(() => {
	const orgId = route.params.orgId;
	return orgId ? `/new/${orgId}/templates` : "/templates";
});

onMounted(async () => {
	// Fetch templates if needed
	await templateStore.fetchTemplates();
});
</script>

<template>
  <div class="container">
    <BackBt :to="backUrl" title="Back To Templates" />
    <!-- Header with back button -->
    <header class="mt-8">
      <div class="container mx-auto px-4 py-3 flex items-center"></div>
    </header>

    <!-- Main content -->
    <main class="flex-grow" v-if="template">
      <div class="container mx-auto px-4 py-8">
        <!-- Template header section -->
        <div class="flex items-center mb-6">
          <div
            class="bg-red-500 h-8 w-8 rounded-md flex items-center justify-center text-white mr-3"
          >
            <img
              v-if="template.icon"
              :src="template.icon"
              alt="Template icon"
              class="w-5 h-5"
            />
            <span v-else>{{ template.name.charAt(0) }}</span>
          </div>
          <div>
            <h1 class="text-xl font-bold">{{ template.name }}</h1>
            <p class="text-sm text-gray-500">
              {{ template.description }}
            </p>
          </div>
        </div>

        <!-- Framework info -->
        <div class="grid grid-cols-4 gap-8 mb-8">
          <div>
            <div class="text-xs text-gray-500 mb-1">Framework</div>
            <div class="text-sm">{{ template.framework }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1">Use Case</div>
            <div class="text-sm">{{ template.categories.join(", ") }}</div>
          </div>
          <div v-if="template.stars">
            <div class="text-xs text-gray-500 mb-1">Stars</div>
            <div class="text-sm flex items-center">
              <Star class="w-4 h-4 mr-1 text-yellow-400" />
              {{ template.stars }}
            </div>
          </div>
        </div>

        <!-- Demo Button -->
        <div class="mb-8">
          <router-link :to="'/new/clone?templateId=' + template.id">
            <Button variant="default" size="default">Deploy</Button>
          </router-link>
          <Button variant="outline" size="default" class="ml-3"
            >View Demo</Button
          >
        </div>

        <!-- Related Templates Section -->
        <div
          class="mb-8"
          v-if="relatedTemplates && relatedTemplates.length > 0"
        >
          <h2 class="text-lg font-bold mb-4">Related Templates</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <!-- Template Cards -->
            <div
              v-for="relatedTemplate in relatedTemplates"
              :key="relatedTemplate.id"
              class="border rounded-md overflow-hidden hover:shadow-md transition-shadow"
            >
              <div class="h-40 bg-gray-100 relative">
                <img
                  :src="relatedTemplate.image || placeholderImage"
                  :alt="relatedTemplate.name"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="p-4">
                <h3 class="font-bold text-sm mb-1">
                  {{ relatedTemplate.name }}
                </h3>
                <p class="text-xs text-gray-600 mb-3">
                  {{ relatedTemplate.description }}
                </p>
                <div class="flex justify-between items-center text-xs">
                  <span class="text-gray-500"
                    >by {{ relatedTemplate.author }}</span
                  >
                  <div class="flex items-center" v-if="relatedTemplate.stars">
                    <Star class="w-3 h-3 mr-1 text-gray-400" />
                    <span>{{ relatedTemplate.stars }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Support Section -->
        <div class="mb-8">
          <h2 class="text-lg font-bold mb-2">Support</h2>
          <p class="text-sm text-gray-600">
            If you're looking for help or want to share your thoughts, join our
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
            This project is licensed under the MIT License. For more
            information, see the
            <a href="#" class="text-blue-600 hover:underline">LICENSE file</a>.
          </p>
        </div>

        <!-- Contributors Section -->
        <div class="mb-8">
          <h2 class="text-lg font-bold mb-2">Contributors</h2>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="i in 3"
              :key="i"
              class="w-10 h-10 rounded-full bg-gray-200 overflow-hidden"
            >
              <img
                :src="placeholderImage"
                alt="Contributor"
                class="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Loading or not found state -->
    <div v-else class="container mx-auto px-4 py-8 text-center">
      <p v-if="templateStore.loading">Loading template...</p>
      <p v-else class="text-gray-500">Template not found</p>
    </div>

    <!-- Footer with CTA -->
    <footer class="bg-gray-900 text-white py-12">
      <div class="container mx-auto px-4 text-center">
        <h2 class="text-2xl font-bold mb-4">Unleash New Possibilities</h2>
        <p class="mb-6 text-gray-300">
          Deploy your app on Repo.md and unlock its full potential
        </p>
        <Button variant="primary" size="lg">Try Repo.md Free</Button>
      </div>
    </footer>
  </div>
</template>
