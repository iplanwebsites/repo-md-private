<template>
  <div class="brochure-editor min-h-screen bg-background">
    <header class="bg-muted py-4 mb-8">
      <div class="container mx-auto px-4">
        <h1 class="text-2xl font-bold">Landing Page Editor</h1>
      </div>
    </header>
    
    <main class="container mx-auto px-4 pb-16">
      <div class="mb-8">
        <h2 class="text-xl font-semibold mb-4">Edit Landing Page Blocks</h2>
        <p class="mb-4">Use this editor to create and manage your landing page blocks. Preview your changes in real time and export the JSON configuration when you're done.</p>
        
        <div class="mb-8">
          <h3 class="font-medium text-gray-700 mb-2">Load Template</h3>
          
          <!-- Main pages -->
          <div class="mb-4">
            <p class="text-sm text-gray-500 mb-2">Main Pages:</p>
            <div class="flex flex-wrap gap-2">
              <Button 
                @click="loadTemplate('home')" 
                variant="outline"
                size="sm"
                class="bg-blue-50"
              >
                Home
              </Button>
              <Button 
                @click="loadTemplate('product')" 
                variant="outline"
                size="sm"
                class="bg-blue-50"
              >
                Product
              </Button>
            </div>
          </div>
          
          <!-- Product pages -->
          <div class="mb-4">
            <p class="text-sm text-gray-500 mb-2">Product Pages:</p>
            <div class="flex flex-wrap gap-2">
              <Button 
                v-for="(_, key) in allContent.products" 
                :key="key"
                @click="loadTemplate(`products/${key}`)" 
                variant="outline"
                size="sm"
                class="bg-green-50"
              >
                {{ key }}
              </Button>
            </div>
          </div>
          
          <!-- Solution pages -->
          <div class="mb-4">
            <p class="text-sm text-gray-500 mb-2">Solution Pages:</p>
            <div class="flex flex-wrap gap-2">
              <Button 
                v-for="(_, key) in allContent.solutions" 
                :key="key"
                @click="loadTemplate(`solutions/${key}`)" 
                variant="outline"
                size="sm"
                class="bg-purple-50"
              >
                {{ key }}
              </Button>
            </div>
          </div>
          
          <div class="mt-4">
            <Button 
              @click="blocks = []" 
              variant="destructive"
              size="sm"
            >
              Clear All
            </Button>
          </div>
        </div>
      </div>
      
      <BlockEditor 
        :initialBlocks="blocks" 
        @update:blocks="blocks = $event" 
      />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import BlockEditor from "@/components/pushmd/BlockEditor.vue";
import { createSampleBlock, BLOCK_TYPES } from "@/components/pushmd/blockTypes";
import { Button } from "@/components/ui/button";
import {
	homeBlocks,
	productBlocks,
	contentMap,
	allContent,
	getContentByPath,
} from "@/brochureContent";

const blocks = ref([]);

// Load template blocks
const loadTemplate = (templateName) => {
	try {
		// Parse template name to check for section/id format
		const parts = templateName.split("/");
		let content;

		if (parts.length === 2) {
			// Format: "section/id" (e.g., "products/enterprise")
			const [section, id] = parts;
			content = getContentByPath(section, id);
		} else if (contentMap[templateName]) {
			// Direct access by name (e.g., "home", "product")
			content = contentMap[templateName];
		} else {
			// Try as a simple path lookup
			content = getContentByPath(null, templateName);
		}

		if (content) {
			blocks.value = JSON.parse(JSON.stringify(content));
		} else {
			console.error("Template not found:", templateName);
			blocks.value = [createSampleBlock(BLOCK_TYPES.HERO)];
		}
	} catch (error) {
		console.error("Error loading template:", error);
		// Fallback to a basic template
		blocks.value = [createSampleBlock(BLOCK_TYPES.HERO)];
	}
};

onMounted(() => {
	// Initialize with a hero block if no blocks are provided
	if (blocks.value.length === 0) {
		blocks.value = [createSampleBlock(BLOCK_TYPES.HERO)];
	}
});
</script>