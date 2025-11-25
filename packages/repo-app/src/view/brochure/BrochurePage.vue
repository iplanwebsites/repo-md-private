<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import Blocks from "@/components/pushmd/Blocks.vue";
import { getContentByPath, allContent, contentMap } from "@/brochureContent";
import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import { isLocalhost } from "@/lib/utils/devUtils";

const route = useRoute();
const blocks = ref([]);
const notFound = ref(false);

// Determine the section and id from the route
const section = computed(() => {
	if (route.path.startsWith("/products/")) {
		return "products";
	} else if (route.path.startsWith("/solutions/")) {
		return "solutions";
	}
	return null;
});

const pageId = computed(() => route.params.id);

// Load content based on route parameters
const loadContent = () => {
	notFound.value = false;

	// Try to get content from the path
	const content = getContentByPath(section.value, pageId.value);

	if (content) {
		blocks.value = content;
	} else {
		console.error(`Content not found for ${section.value}/${pageId.value}`);
		notFound.value = true;

		// Create a "Not Found" block
		blocks.value = [
			{
				type: BLOCK_TYPES.HERO,
				title: "Page Not Found",
				subtitle: `The requested ${section.value || ""} page "${pageId.value}" could not be found.`,
				btnLabel: "Back to Home",
				btnTo: "/",
				bgImage: getBannerImageByPath("/img/lan1/Landing_F.png"),
			},
			{
				type: BLOCK_TYPES.TEXT,
				title: "Available Pages",
				content: `
          <p class="mb-4">Here are some pages you might be looking for:</p>
          <ul class="list-disc pl-5 mb-4">
            <li><a href="/" class="text-blue-600 hover:underline">Home</a></li>
                 </ul>
        `,
			},
		];
	}
};

// Watch for route changes
watch(
	() => route.params,
	() => {
		loadContent();
	},
);

// Initial content load
onMounted(() => {
	loadContent();
});
</script>

<template>
  <div class="min-h-screen bg-background">
    <main>
      <!-- Use the Blocks component to render content -->
      <Blocks :blocks="blocks" />

      <!-- Debug information (only visible on localhost) -->
      <div v-if="isLocalhost()" class="p-4 m-4 border rounded bg-gray-100">
        <h3 class="font-bold">Debug Info</h3>
        <p>Section: {{ section || "N/A" }}</p>
        <p>Page ID: {{ pageId }}</p>
        <p>Found: {{ !notFound }}</p>
      </div>
    </main>
  </div>
</template>
