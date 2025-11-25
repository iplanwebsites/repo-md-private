<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import ThreeJSGraphViz from './ThreeJSGraphViz.vue';
import { FileText } from 'lucide-vue-next';
import { Loader } from 'lucide-vue-next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const props = defineProps({
  repoClient: {
    type: Object,
    required: true
  },
  deployment: {
    type: Object,
    required: true
  },
  graphData: {
    type: Object,
    default: null
  }
});

// Embeddings data state
const embeddingsData = ref(null);
const embeddingsLoading = ref(false);
const embeddingsError = ref(null);

// Toggle between 2D and 3D visualization
const visualizationMode = ref("3d"); // "2d" or "3d"

// Dimensionality reduction method
const reductionMethod = ref("pca"); // "pca", "tsne", or "umap"

// Fetch embeddings data
const fetchEmbeddingsData = async () => {
  if (!props.repoClient) return;

  embeddingsLoading.value = true;
  embeddingsError.value = null;

  try {
    // Fetch both posts.json and embeddings file
    const [postsResponse, embeddingsResponse] = await Promise.all([
      props.repoClient.getFile('posts.json').catch(() => null),
      props.repoClient.getFile('posts-embedding-hash-map.json').catch(() => null)
    ]);

    if (embeddingsResponse && embeddingsResponse.content) {
      const embeddingsHashMap = JSON.parse(embeddingsResponse.content);
      
      // If we have posts.json, map post IDs to embeddings
      if (postsResponse && postsResponse.content) {
        const posts = JSON.parse(postsResponse.content);
        embeddingsData.value = {};
        
        // Map each post to its embedding using the hash
        posts.forEach(post => {
          if (post.hash && embeddingsHashMap[post.hash]) {
            // Use post path as the key for consistency with graph nodes
            const postId = post.path || post.id;
            embeddingsData.value[postId] = embeddingsHashMap[post.hash];
          }
        });
        
        console.log("Embeddings data loaded:", Object.keys(embeddingsData.value).length, "embeddings mapped from", Object.keys(embeddingsHashMap).length, "hashes");
      } else {
        // Fallback: use hash as ID if posts.json not available
        embeddingsData.value = embeddingsHashMap;
        console.log("Embeddings data loaded:", Object.keys(embeddingsData.value).length, "embeddings (using hashes as IDs)");
      }
    } else if (props.deployment && props.deployment.project_id && props.deployment.deployment_id) {
      // Try to fetch from static URL as fallback
      try {
        const staticUrl = `https://static.repo.md/projects/${props.deployment.project_id}/${props.deployment.deployment_id}/posts-embedding-hash-map.json`;
        const response = await fetch(staticUrl);
        if (response.ok) {
          const embeddingsHashMap = await response.json();
          
          // Try to get posts.json from static URL too
          const postsUrl = `https://static.repo.md/projects/${props.deployment.project_id}/${props.deployment.deployment_id}/posts.json`;
          const postsResponse = await fetch(postsUrl);
          
          if (postsResponse.ok) {
            const posts = await postsResponse.json();
            embeddingsData.value = {};
            
            // Map each post to its embedding using the hash
            posts.forEach(post => {
              if (post.hash && embeddingsHashMap[post.hash]) {
                const postId = post.path || post.id;
                embeddingsData.value[postId] = embeddingsHashMap[post.hash];
              }
            });
            
            console.log("Embeddings data loaded from static URL:", Object.keys(embeddingsData.value).length, "embeddings");
          } else {
            embeddingsData.value = embeddingsHashMap;
            console.log("Embeddings data loaded from static URL:", Object.keys(embeddingsData.value).length, "embeddings (using hashes)");
          }
        }
      } catch (staticErr) {
        console.error("Error fetching from static URL:", staticErr);
      }
    }
  } catch (err) {
    console.error("Error fetching embeddings data:", err);
    embeddingsError.value = err.message || "Failed to load embeddings data";
    // Generate dummy embeddings for demo purposes
    if (props.graphData && props.graphData.nodes) {
      embeddingsData.value = {};
      props.graphData.nodes.forEach(node => {
        if (node.type === 'post') {
          // Generate random 384-dimensional embedding (typical for sentence transformers)
          embeddingsData.value[node.id] = Array.from({ length: 384 }, () => Math.random() * 2 - 1);
        }
      });
      console.log("Generated dummy embeddings for", Object.keys(embeddingsData.value).length, "posts");
    }
  } finally {
    embeddingsLoading.value = false;
  }
};

// Watch for repoClient changes
watch(() => props.repoClient, (newClient) => {
  if (newClient && !embeddingsData.value && !embeddingsLoading.value) {
    fetchEmbeddingsData();
  }
}, { immediate: true });

// Refresh function
const refresh = () => {
  fetchEmbeddingsData();
};

// Expose refresh method to parent
defineExpose({ refresh });
</script>

<template>
  <div class="embeddings-graph-container">
    <!-- Controls -->
    <div class="flex items-center gap-4 mb-4">
      <Select v-model="visualizationMode" class="w-32">
        <SelectTrigger>
          <SelectValue placeholder="View mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="3d">3D View</SelectItem>
          <SelectItem value="2d">2D View</SelectItem>
        </SelectContent>
      </Select>
      
      <Select v-model="reductionMethod" class="w-40">
        <SelectTrigger>
          <SelectValue placeholder="Reduction method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pca">PCA</SelectItem>
          <SelectItem value="tsne">t-SNE</SelectItem>
          <SelectItem value="umap">UMAP</SelectItem>
        </SelectContent>
      </Select>
      
      <div class="text-sm text-gray-500 ml-4">
        Color-coded by folder
      </div>
    </div>

    <!-- Content -->
    <div v-if="embeddingsData && graphData" class="bg-white border border-gray-200 rounded-lg overflow-hidden p-6">
      <ThreeJSGraphViz
        :embeddings="embeddingsData"
        :graph-data="graphData"
        :width="1200"
        :height="600"
        :is3D="visualizationMode === '3d'"
        :reductionMethod="reductionMethod"
      />
    </div>
    
    <div v-else-if="embeddingsLoading" class="bg-white border border-gray-200 rounded-lg overflow-hidden p-6">
      <div class="flex flex-col items-center justify-center h-64">
        <Loader class="w-8 h-8 text-blue-500 animate-spin mb-2" />
        <span class="text-sm text-gray-500">Loading embeddings data...</span>
      </div>
    </div>
    
    <div v-else-if="embeddingsError" class="bg-white border border-gray-200 rounded-lg overflow-hidden p-6">
      <div class="flex flex-col items-center justify-center h-64 text-center">
        <FileText class="w-12 h-12 text-red-300 mb-2" />
        <h3 class="text-lg font-medium mb-1 text-red-600">Error Loading Embeddings</h3>
        <p class="text-sm text-gray-500">{{ embeddingsError }}</p>
      </div>
    </div>
    
    <div v-else class="bg-white border border-gray-200 rounded-lg overflow-hidden p-6">
      <div class="flex flex-col items-center justify-center h-64 text-center">
        <FileText class="w-12 h-12 text-gray-300 mb-2" />
        <h3 class="text-lg font-medium mb-1">No Embeddings Data</h3>
        <p class="text-sm text-gray-500">
          Embeddings data is not available for this deployment
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.embeddings-graph-container {
  width: 100%;
}
</style>