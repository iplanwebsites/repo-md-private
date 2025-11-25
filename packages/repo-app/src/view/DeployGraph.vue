<script setup>
import { ref, computed, inject, onMounted, watch } from "vue";
import { useOrgStore } from "@/store/orgStore";
import {
	Search,
	User,
	FileText,
	Users,
	Lock,
	Shield,
	Server,
	BadgeAlert,
	Save,
	Link,
	ClipboardCopy,
	ExternalLink,
	CornerLeftUp,
	RefreshCw,
	Loader,
} from "lucide-vue-next";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "vue-router";
import RessourceGraph from "@/components/pushmd/RessourceGraph.vue";
import D3CircleViz from "@/components/viz/D3CircleViz.vue";
import EmbeddingsGraphViz from "@/components/viz/EmbeddingsGraphViz.vue";
import dummyGraphData from "@/components/viz/files/graph1.json";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	sortByDegree,
	detectCommunities,
	spectralOrdering,
	forceDirectedCircular,
	bidirectionalGrouping,
	bestClustering
} from "@/lib/graph/clusteringAlgorithms";

// Define props from parent
const props = defineProps({
	deployment: {
		type: Object,
		required: true,
	},
	isLoading: {
		type: Boolean,
		default: false,
	},
	error: {
		type: [String, Object, null],
		default: null,
	},
	repoClient: {
		type: Object,
		default: null,
	},
});

// Define emits to parent
const emit = defineEmits(["refresh"]);

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();

// Development flag for using dummy data
const USE_DUMMY_DATA = ref(false);

// Graph data state
const graphData = ref(null);
const graphLoading = ref(false);
const graphError = ref(null);

// Control whether to show images in the graph
const showImages = ref(false);

// Control whether to show orphan nodes (nodes with no connections)
const showOrphans = ref(true);

// Sort mode for nodes
const sortMode = ref("best");

// Group nodes by folder when clustering
const groupByFolder = ref(false);

// Active tab
const activeTab = ref("interactive");

// Custom colors for the D3 visualization
const customColors = {
	in: "#0066cc",
	out: "#cc0000",
	mutual: "#9900cc", // Purple for bidirectional links
	image: "#ff6600",
	none: "#cccccc", // Default for all links
	oneWay: "#e6e6e6", // Lighter gray for one-way links
};

// Computed property for the data to display
const displayGraphData = computed(() => {
	let data = USE_DUMMY_DATA.value ? dummyGraphData : graphData.value;
	
	if (!data) return null;
	
	// Don't apply filters for embeddings view
	if (activeTab.value === 'embeddings') {
		return data;
	}
	
	// Apply filters for other views
	if (!showImages.value) {
		const mediaNodes = data.nodes.filter(node => node.type === 'media');
		const mediaNodeIds = new Set(mediaNodes.map(node => node.id));
		
		const filteredData = {
			nodes: data.nodes.filter(node => node.type !== 'media'),
			edges: data.edges.filter(edge => {
				const shouldFilter = edge.type === 'POST_USE_IMAGE' || 
					mediaNodeIds.has(edge.source) || 
					mediaNodeIds.has(edge.target);
				return !shouldFilter;
			})
		};
		
		data = filteredData;
	}
	
	// Filter out orphan nodes if showOrphans is false
	if (!showOrphans.value) {
		const connectedNodeIds = new Set();
		data.edges.forEach(edge => {
			connectedNodeIds.add(edge.source);
			connectedNodeIds.add(edge.target);
		});
		
		data = {
			nodes: data.nodes.filter(node => connectedNodeIds.has(node.id)),
			edges: data.edges
		};
	}
	
	// Apply sorting for circular view
	if (activeTab.value === 'circular' && data && data.nodes) {
		let sortedNodes = [...data.nodes];
		const options = { groupByFolder: groupByFolder.value };
		
		switch (sortMode.value) {
			case 'alpha':
				// Alphabetical sort
				if (groupByFolder.value) {
					sortedNodes.sort((a, b) => {
						const getPath = (node) => {
							if (node.path) return node.path;
							if (node.label && node.label.includes('/')) return node.label;
							return node.label || '';
						};
						
						const pathA = getPath(a);
						const pathB = getPath(b);
						
						const folderA = pathA.includes('/') ? pathA.substring(0, pathA.lastIndexOf('/')) : '';
						const folderB = pathB.includes('/') ? pathB.substring(0, pathB.lastIndexOf('/')) : '';
						
						if (folderA !== folderB) {
							return folderA.localeCompare(folderB);
						}
						
						return a.label.localeCompare(b.label);
					});
				} else {
					sortedNodes.sort((a, b) => a.label.localeCompare(b.label));
				}
				break;
				
			case 'degree':
				sortedNodes = sortByDegree(sortedNodes, data.edges, options);
				break;
				
			case 'community':
				sortedNodes = detectCommunities(sortedNodes, data.edges, options);
				break;
				
			case 'spectral':
				sortedNodes = spectralOrdering(sortedNodes, data.edges, options);
				break;
				
			case 'force':
				sortedNodes = forceDirectedCircular(sortedNodes, data.edges, options);
				break;
				
			case 'bidirectional':
				sortedNodes = bidirectionalGrouping(sortedNodes, data.edges, options);
				break;
				
			case 'best':
				sortedNodes = bestClustering(sortedNodes, data.edges, options);
				break;
		}
		
		data = {
			...data,
			nodes: sortedNodes
		};
	}
	
	return data;
});

// Fetch graph data
const fetchGraphData = async () => {
	if (!props.repoClient) return;

	graphLoading.value = true;
	graphError.value = null;

	try {
		graphData.value = await props.repoClient.getGraph();
		console.log("Graph data loaded:", graphData.value);
	} catch (err) {
		console.error("Error fetching graph data:", err);
		graphError.value = err.message || "Failed to load graph data";
	} finally {
		graphLoading.value = false;
	}
};

// Refresh graph data
const refreshGraph = () => {
	fetchGraphData();
	// If embeddings tab is active, refresh it too
	if (activeTab.value === 'embeddings' && embeddingsRef.value) {
		embeddingsRef.value.refresh();
	}
};

// Ref for embeddings component
const embeddingsRef = ref(null);

// Watch for changes in the repoClient prop
watch(
	() => props.repoClient,
	() => {
		if (props.repoClient) {
			fetchGraphData();
		}
	},
	{ immediate: true },
);

// Initialize on component mount
onMounted(() => {
	if (props.repoClient) {
		fetchGraphData();
	}
});

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);

// Computed properties for graph statistics
const graphStats = computed(() => {
	if (!graphData.value) return null;

	const nodes = graphData.value.nodes || [];
	const edges = graphData.value.edges || [];

	const nodeTypes = {};
	const edgeTypes = {};

	// Count node types
	nodes.forEach((node) => {
		nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
	});

	// Count edge types
	edges.forEach((edge) => {
		edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
	});

	return {
		totalNodes: nodes.length,
		totalEdges: edges.length,
		nodeTypes,
		edgeTypes,
	};
});
</script>

<template>
  <PageHeadingBar title="Graph" subtitle="How your content is connected">
    <div class="flex items-center gap-4 ml-auto">
      <!-- Controls for interactive and circular views -->
      <template v-if="activeTab === 'interactive' || activeTab === 'circular'">
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            v-model="showImages"
            class="rounded"
          />
          Show Media
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            v-model="showOrphans"
            class="rounded"
          />
          Show Orphans
        </label>
      </template>
      
      <!-- Additional controls for circular view -->
      <template v-if="activeTab === 'circular'">
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            v-model="groupByFolder"
            class="rounded"
          />
          Group by Folder
        </label>
        
        <!-- Sort Mode Selector -->
        <Select v-model="sortMode" class="w-40">
          <SelectTrigger>
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alpha">Alphabetical</SelectItem>
            <SelectItem value="degree">By Degree</SelectItem>
            <SelectItem value="community">Community Detection</SelectItem>
            <SelectItem value="spectral">Spectral Ordering</SelectItem>
            <SelectItem value="force">Force-Directed</SelectItem>
            <SelectItem value="bidirectional">Bidirectional Groups</SelectItem>
            <SelectItem value="best">Best Clustering</SelectItem>
          </SelectContent>
        </Select>
      </template>
      
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          v-model="USE_DUMMY_DATA"
          class="rounded"
        />
        Use Dummy Data
      </label>
      <Button
        @click="refreshGraph"
        :disabled="graphLoading"
        variant="outline"
      >
        <RefreshCw v-if="!graphLoading" class="w-4 h-4 mr-2" />
        <Loader v-else class="w-4 h-4 mr-2 animate-spin" />
        Refresh
      </Button>
    </div>
  </PageHeadingBar>

  <div class="container mt-4">
    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="interactive">Interactive Graph</TabsTrigger>
        <TabsTrigger value="circular">Circular Graph</TabsTrigger>
        <TabsTrigger value="embeddings">Embeddings View</TabsTrigger>
      </TabsList>
      
      <!-- Interactive Graph Tab -->
      <TabsContent value="interactive">
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden p-4">
          <!-- Loading state -->
          <div
            v-if="graphLoading"
            class="flex flex-col items-center justify-center h-64"
          >
            <Loader class="w-8 h-8 text-blue-500 animate-spin mb-2" />
            <span class="text-sm text-gray-500">Loading graph data...</span>
          </div>

          <!-- Error state -->
          <div v-else-if="graphError" class="p-4 text-red-500">
            <p>Error loading graph: {{ graphError }}</p>
            <Button @click="refreshGraph" variant="outline" size="sm" class="mt-2">
              Try Again
            </Button>
          </div>

          <!-- Graph visualization -->
          <div v-else-if="displayGraphData" class="h-[70vh]">
            <RessourceGraph
              :graphData="displayGraphData"
              style="height: 100%"
            />
          </div>

          <!-- Empty state -->
          <div
            v-else
            class="flex flex-col items-center justify-center h-64 text-center"
          >
            <FileText class="w-12 h-12 text-gray-300 mb-2" />
            <h3 class="text-lg font-medium mb-1">No Graph Data</h3>
            <p class="text-sm text-gray-500">
              There's no graph data available for this deployment
            </p>
          </div>
        </div>
      </TabsContent>
      
      <!-- Circular Graph Tab -->
      <TabsContent value="circular">
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden p-6">
          <div v-if="displayGraphData">
            <D3CircleViz
              :data="displayGraphData"
              :width="800"
              :show-controls="false"
              :colors="customColors"
              title="Links between your content"
            />
          </div>

          <!-- Loading state -->
          <div
            v-else-if="graphLoading"
            class="flex flex-col items-center justify-center h-64"
          >
            <Loader class="w-8 h-8 text-blue-500 animate-spin mb-2" />
            <span class="text-sm text-gray-500">Loading graph data...</span>
          </div>

          <!-- Error state -->
          <div v-else-if="graphError" class="p-4 text-red-500">
            <p>Error loading graph: {{ graphError }}</p>
            <Button @click="refreshGraph" variant="outline" size="sm" class="mt-2">
              Try Again
            </Button>
          </div>

          <!-- Empty state -->
          <div
            v-else
            class="flex flex-col items-center justify-center h-64 text-center"
          >
            <FileText class="w-12 h-12 text-gray-300 mb-2" />
            <h3 class="text-lg font-medium mb-1">No Graph Data</h3>
            <p class="text-sm text-gray-500">
              There's no graph data available for this deployment
            </p>
          </div>
        </div>
        
        <!-- Graph statistics below circular view -->
        <div v-if="displayGraphData && graphStats" class="mt-6">
          <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h3 class="text-lg font-medium mb-4">Graph Statistics</h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm font-medium text-gray-600">Nodes</p>
                <p class="text-2xl font-bold">{{ graphStats.totalNodes }}</p>

                <div class="mt-2">
                  <p class="text-sm font-medium text-gray-600 mb-1">
                    Node Types:
                  </p>
                  <div
                    v-for="(count, type) in graphStats.nodeTypes"
                    :key="type"
                    class="flex justify-between text-sm"
                  >
                    <span>{{ type }}</span>
                    <span class="font-medium">{{ count }}</span>
                  </div>
                </div>
              </div>

              <div>
                <p class="text-sm font-medium text-gray-600">Connections</p>
                <p class="text-2xl font-bold">{{ graphStats.totalEdges }}</p>

                <div class="mt-2">
                  <p class="text-sm font-medium text-gray-600 mb-1">
                    Connection Types:
                  </p>
                  <div
                    v-for="(count, type) in graphStats.edgeTypes"
                    :key="type"
                    class="flex justify-between text-sm"
                  >
                    <span>{{ type }}</span>
                    <span class="font-medium">{{ count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
      
      <!-- Embeddings View Tab -->
      <TabsContent value="embeddings">
        <EmbeddingsGraphViz
          ref="embeddingsRef"
          :repo-client="repoClient"
          :deployment="deployment"
          :graph-data="displayGraphData"
        />
      </TabsContent>
    </Tabs>
  </div>
</template>

<style scoped>
/* Additional styling can be added here */
</style>