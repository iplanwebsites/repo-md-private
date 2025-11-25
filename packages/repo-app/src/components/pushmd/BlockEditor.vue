<template>
  <div class="block-editor">
    <div class="block-list mb-8">
      <div v-for="(block, index) in blocks" :key="index" class="block-item mb-4 border rounded-lg p-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">{{ getBlockTitle(block) }}</h3>
          <div class="flex gap-2">
            <Button 
              @click="moveBlockUp(index)" 
              :disabled="index === 0"
              variant="ghost"
              size="icon"
              class="h-8 w-8"
            >
              <span class="sr-only">Move up</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            </Button>
            <Button 
              @click="moveBlockDown(index)" 
              :disabled="index === blocks.length - 1"
              variant="ghost"
              size="icon"
              class="h-8 w-8"
            >
              <span class="sr-only">Move down</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </Button>
            <Button 
              @click="removeBlock(index)"
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <span class="sr-only">Delete</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </Button>
          </div>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Block Type</label>
          <select v-model="block.type" class="w-full p-2 border rounded-md">
            <option v-for="(type, key) in BLOCK_TYPES" :key="key" :value="type">
              {{ formatBlockTypeName(type) }}
            </option>
          </select>
        </div>
        
        <!-- Common fields for all block types -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Title</label>
          <input v-model="block.title" type="text" class="w-full p-2 border rounded-md">
        </div>
        
        <!-- Hero block fields -->
        <template v-if="block.type === BLOCK_TYPES.HERO">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Subtitle</label>
            <input v-model="block.subtitle" type="text" class="w-full p-2 border rounded-md">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Background Image URL</label>
            <input v-model="block.bgImage" type="text" class="w-full p-2 border rounded-md">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Button Label</label>
            <input v-model="block.btnLabel" type="text" class="w-full p-2 border rounded-md">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Button Link (to route)</label>
            <input v-model="block.btnTo" type="text" class="w-full p-2 border rounded-md">
          </div>
        </template>
        
        <!-- Cards block fields -->
        <template v-if="block.type === BLOCK_TYPES.CARDS">
          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <h4 class="font-medium">Cards</h4>
              <Button 
                @click="addCard(block)"
                variant="default"
                size="sm"
              >
                Add Card
              </Button>
            </div>
            
            <div v-for="(card, cardIndex) in block.cards || []" :key="cardIndex" class="border p-3 rounded-md mb-3">
              <div class="flex justify-between items-center mb-2">
                <h5 class="text-sm font-medium">Card {{ cardIndex + 1 }}</h5>
                <Button
                  @click="removeCard(block, cardIndex)" 
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </Button>
              </div>
              
              <div class="mb-2">
                <label class="block text-xs font-medium mb-1">Title</label>
                <input v-model="card.title" type="text" class="w-full p-2 border rounded-md">
              </div>
              
              <div class="mb-2">
                <label class="block text-xs font-medium mb-1">Description</label>
                <textarea v-model="card.description" rows="2" class="w-full p-2 border rounded-md"></textarea>
              </div>
              
              <div class="mb-2">
                <label class="block text-xs font-medium mb-1">Icon URL</label>
                <input v-model="card.icon" type="text" class="w-full p-2 border rounded-md">
              </div>
              
              <div class="mb-2" v-if="blockHasMetric(block)">
                <label class="block text-xs font-medium mb-1">Metric</label>
                <input v-model="card.metric" type="text" class="w-full p-2 border rounded-md">
              </div>
            </div>
          </div>
        </template>
        
        <!-- Features block fields -->
        <template v-if="block.type === BLOCK_TYPES.FEATURES">
          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <h4 class="font-medium">Features</h4>
              <Button 
                @click="addFeature(block)"
                variant="default"
                size="sm"
              >
                Add Feature
              </Button>
            </div>
            
            <div v-for="(feature, featureIndex) in block.features || []" :key="featureIndex" class="border p-3 rounded-md mb-3">
              <div class="flex justify-between items-center mb-2">
                <h5 class="text-sm font-medium">Feature {{ featureIndex + 1 }}</h5>
                <Button
                  @click="removeFeature(block, featureIndex)" 
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </Button>
              </div>
              
              <div class="mb-2">
                <label class="block text-xs font-medium mb-1">Title</label>
                <input v-model="feature.title" type="text" class="w-full p-2 border rounded-md">
              </div>
              
              <div class="mb-2">
                <label class="block text-xs font-medium mb-1">Description</label>
                <textarea v-model="feature.description" rows="2" class="w-full p-2 border rounded-md"></textarea>
              </div>
              
              <div class="mb-2">
                <label class="block text-xs font-medium mb-1">Icon URL</label>
                <input v-model="feature.icon" type="text" class="w-full p-2 border rounded-md">
              </div>
            </div>
          </div>
        </template>
        
        <!-- Text block fields -->
        <template v-if="block.type === BLOCK_TYPES.TEXT">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Content</label>
            <textarea v-model="block.content" rows="6" class="w-full p-2 border rounded-md"></textarea>
          </div>
        </template>
        
        <!-- CTA block fields -->
        <template v-if="block.type === BLOCK_TYPES.CTA">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Subtitle</label>
            <input v-model="block.subtitle" type="text" class="w-full p-2 border rounded-md">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Button Label</label>
            <input v-model="block.btnLabel" type="text" class="w-full p-2 border rounded-md">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Button Link</label>
            <input v-model="block.btnTo" type="text" class="w-full p-2 border rounded-md">
          </div>
        </template>
        
        <div class="validation-errors" v-if="!validateBlock(block).isValid">
          <p class="text-red-500 text-sm mt-2">Block validation errors:</p>
          <ul class="list-disc ml-5">
            <li v-for="(error, errorIndex) in validateBlock(block).errors" :key="errorIndex" class="text-red-500 text-sm">
              {{ error }}
            </li>
          </ul>
        </div>
      </div>
    </div>
    
    <div class="add-block mb-8">
      <h3 class="text-lg font-semibold mb-2">Add New Block</h3>
      <div class="flex gap-2 flex-wrap">
        <Button 
          v-for="(type, key) in BLOCK_TYPES" 
          :key="key"
          @click="addBlock(type)"
          variant="outline"
          class="mr-2 mb-2"
        >
          {{ formatBlockTypeName(type) }}
        </Button>
      </div>
    </div>
    
    <div class="block-preview mb-8">
      <h3 class="text-lg font-semibold mb-4">Block Preview</h3>
      <div class="border rounded-lg overflow-hidden">
        <Blocks :blocks="blocks" />
      </div>
    </div>
    
    <div class="block-export mb-8">
      <h3 class="text-lg font-semibold mb-2">Export Blocks</h3>
      <Button 
        @click="exportBlocks"
        variant="default"
        class="bg-green-600 hover:bg-green-700"
      >
        Export JSON
      </Button>
      <div v-if="exportedJson" class="mt-4">
        <p class="mb-2 text-sm font-medium">Copy this JSON:</p>
        <textarea 
          :value="exportedJson" 
          readonly 
          rows="5"
          class="w-full p-2 border rounded-md font-mono text-sm"
          @focus="$event.target.select()"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import Blocks from "./Blocks.vue";
import { BLOCK_TYPES, validateBlock, createSampleBlock } from "./blockTypes";
import { Button } from "@/components/ui/button";

const props = defineProps({
	initialBlocks: {
		type: Array,
		default: () => [],
	},
});

const emit = defineEmits(["update:blocks"]);

const blocks = ref(
	props.initialBlocks.length > 0
		? JSON.parse(JSON.stringify(props.initialBlocks))
		: [createSampleBlock(BLOCK_TYPES.HERO)],
);

const exportedJson = ref("");

// Helper to format block type names for display
const formatBlockTypeName = (type) => {
	return type.charAt(0).toUpperCase() + type.slice(1);
};

// Get a display title for the block
const getBlockTitle = (block) => {
	if (block.title) return block.title;
	return formatBlockTypeName(block.type) + " Block";
};

// Check if a block type should display metric fields
const blockHasMetric = (block) => {
	// If this is a cards block and at least one card has a metric property
	return (
		block.type === BLOCK_TYPES.CARDS &&
		block.cards &&
		block.cards.some((card) => card.hasOwnProperty("metric"))
	);
};

// Block manipulation functions
const addBlock = (type) => {
	blocks.value.push(createSampleBlock(type));
	emit("update:blocks", blocks.value);
};

const removeBlock = (index) => {
	blocks.value.splice(index, 1);
	emit("update:blocks", blocks.value);
};

const moveBlockUp = (index) => {
	if (index > 0) {
		const temp = blocks.value[index];
		blocks.value[index] = blocks.value[index - 1];
		blocks.value[index - 1] = temp;
		emit("update:blocks", blocks.value);
	}
};

const moveBlockDown = (index) => {
	if (index < blocks.value.length - 1) {
		const temp = blocks.value[index];
		blocks.value[index] = blocks.value[index + 1];
		blocks.value[index + 1] = temp;
		emit("update:blocks", blocks.value);
	}
};

// Card manipulation functions
const addCard = (block) => {
	if (!block.cards) block.cards = [];
	block.cards.push({
		title: "New Card",
		description: "Card description goes here",
		icon: "",
	});
	emit("update:blocks", blocks.value);
};

const removeCard = (block, index) => {
	block.cards.splice(index, 1);
	emit("update:blocks", blocks.value);
};

// Feature manipulation functions
const addFeature = (block) => {
	if (!block.features) block.features = [];
	block.features.push({
		title: "New Feature",
		description: "Feature description goes here",
		icon: "",
	});
	emit("update:blocks", blocks.value);
};

const removeFeature = (block, index) => {
	block.features.splice(index, 1);
	emit("update:blocks", blocks.value);
};

// Export blocks as JSON
const exportBlocks = () => {
	exportedJson.value = JSON.stringify(blocks.value, null, 2);
};
</script>

<style scoped>
.block-editor {
  max-width: 1200px;
  margin: 0 auto;
}
</style>