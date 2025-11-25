<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import LazyGitHubFileTree from './LazyGitHubFileTree.vue';

const props = defineProps({
  rootPath: {
    type: String,
    default: '',
  },
  selectedFile: {
    type: [Object, null],
    default: null,
  },
  showSizes: {
    type: Boolean,
    default: true,
  },
  showFoldersFirst: {
    type: Boolean,
    default: true,
  },
  loadDirectory: {
    type: Function,
    required: true,
  }
});

const emit = defineEmits(['select']);

// Store all API responses by path
const directoryResponses = ref(new Map());
const loading = ref(true);
const selectedFileLocal = ref(null);
const loadingFolders = ref(new Set());

// Load directory and store response
const loadDir = async (path = '') => {
  if (directoryResponses.value.has(path)) return;
  
  // Add to loading set
  const newLoadingSet = new Set(loadingFolders.value);
  newLoadingSet.add(path);
  loadingFolders.value = newLoadingSet;
  
  try {
    const files = await props.loadDirectory(path);
    // Force reactivity with new Map
    const newMap = new Map(directoryResponses.value);
    newMap.set(path, files);
    directoryResponses.value = newMap;
  } catch (error) {
    console.error('Error loading directory:', error);
    const newMap = new Map(directoryResponses.value);
    newMap.set(path, []);
    directoryResponses.value = newMap;
  } finally {
    // Remove from loading set
    const newLoadingSet = new Set(loadingFolders.value);
    newLoadingSet.delete(path);
    loadingFolders.value = newLoadingSet;
  }
};

// Removed allFiles computed - now passing directoryResponses directly to tree

// Handle file selection from FileTree
const handleFileSelect = (file) => {
  if (file && file.type === 'file') {
    selectedFileLocal.value = file;
    emit('select', file);
  }
};

// Handle folder toggle from FileTree
const handleFolderToggle = async (event) => {
  const { folder, expanded } = event;
  if (expanded && folder.type === 'folder') {
    await loadDir(folder.path);
  }
};

// Watch for prop changes
watch(() => props.selectedFile, (newVal) => {
  selectedFileLocal.value = newVal;
});

// Initial load
onMounted(async () => {
  await loadDir(props.rootPath);
  loading.value = false;
});
</script>

<template>
  <div class="w-full">
    <div v-if="loading" class="text-center py-4">
      <span class="text-muted-foreground">Loading files...</span>
    </div>
    <LazyGitHubFileTree
      v-else
      v-model="selectedFileLocal"
      :directoryResponses="directoryResponses"
      :showSizes="showSizes"
      :showFoldersFirst="showFoldersFirst"
      :loadingFolders="loadingFolders"
      @file:select="handleFileSelect"
      @folder:toggle="handleFolderToggle"
    />
  </div>
</template>