<template>
  <div class="block-editor-admin">
    <div class="admin-header mb-8">
      <h1 class="text-2xl font-bold">Landing Page Block Editor</h1>
      <p class="text-gray-500 mt-2">Create and edit block-based landing pages</p>
      
      <div class="mt-4 mb-4 bg-white p-4 rounded-lg shadow-sm">
        <div class="font-medium text-gray-800 mb-2 text-lg">Available Content Templates:</div>
        
        <!-- Main Pages -->
        <div class="mb-3">
          <h3 class="font-medium text-gray-700 mb-1">Main Pages</h3>
          <div class="text-sm text-gray-600 space-y-1">
            <div v-for="(blocks, key) in mainPages" :key="key" class="flex items-center">
              <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2 w-24">{{ key }}</span>
              <span>{{ blocks.length }} blocks</span>
            </div>
          </div>
        </div>
        
        <!-- Product Pages -->
        <div class="mb-3">
          <h3 class="font-medium text-gray-700 mb-1">Product Pages</h3>
          <div class="text-sm text-gray-600 space-y-1">
            <div v-for="(blocks, key) in productPages" :key="key" class="flex items-center">
              <span class="bg-green-100 text-green-800 px-2 py-1 rounded mr-2 w-24">{{ key }}</span>
              <span>{{ blocks.length }} blocks</span>
              <span class="ml-2 text-gray-500">/products/{{ key }}</span>
            </div>
          </div>
        </div>
        
        <!-- Solution Pages -->
        <div class="mb-3">
          <h3 class="font-medium text-gray-700 mb-1">Solution Pages</h3>
          <div class="text-sm text-gray-600 space-y-1">
            <div v-for="(blocks, key) in solutionPages" :key="key" class="flex items-center">
              <span class="bg-purple-100 text-purple-800 px-2 py-1 rounded mr-2 w-24">{{ key }}</span>
              <span>{{ blocks.length }} blocks</span>
              <span class="ml-2 text-gray-500">/solutions/{{ key }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-content">
      <BrochureEditor />
    </div>
  </div>
</template>

<script setup>
import BrochureEditor from "@/view/brochure/BrochureEditor.vue";
import {
	contentMap,
	allContent,
	mainPages,
	productPages,
	solutionPages,
} from "@/brochureContent";
import { ref } from "vue";
</script>

<style scoped>
.block-editor-admin {
  padding: 1rem;
}
</style>