<script>
import cytoscape from "cytoscape";
import {
	Search,
	RefreshCw,
	ZoomIn,
	ZoomOut,
	Maximize,
	FileText,
	Image,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export default {
	name: "CytoscapeGraph",

	components: {
		Button,
		Input,
		Switch,
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue,
		Search,
		RefreshCw,
		ZoomIn,
		ZoomOut,
		Maximize,
		FileText,
		Image,
	},

	// Component receives the graph data as a prop
	props: {
		graphData: {
			type: Object,
			required: true,
			// Expected format: { nodes: [...], edges: [...] }
		},
	},

	data() {
		return {
			// Store Cytoscape instance
			cy: null,

			// Layout options
			selectedLayout: "cose",

			// Filtering options
			showPosts: true,
			showMedia: true,
			searchQuery: "", // New text search query

			// Selected node details
			selectedNode: null,

			// Node styling based on type
			nodeStyles: {
				post: {
					"background-color": "#6FB1FC", // Blue for posts
					shape: "round-rectangle",
				},
				media: {
					"background-color": "#F5A45D", // Orange for media files
					shape: "diamond",
				},
			},
		};
	},

	// Watch for changes to filter settings
	watch: {
		// Update graph when filters change
		showPosts() {
			this.updateFilters();
		},
		showMedia() {
			this.updateFilters();
		},
		searchQuery() {
			this.updateFilters();
		},
		// Update graph when data changes
		graphData: {
			handler() {
				this.initializeGraph();
			},
			deep: true,
		},
	},

	mounted() {
		// Initialize the graph after component is mounted
		this.initializeGraph();
	},

	methods: {
		initializeGraph() {
			// Ensure we have the DOM element
			const container = this.$refs.cyElement;
			if (!container) return;

			// Format data for Cytoscape
			const elements = this.formatGraphData();

			// Define Cytoscape instance
			this.cy = cytoscape({
				container,
				elements,

				// Graph styling
				style: [
					// Node styling
					{
						selector: "node",
						style: {
							label: "data(label)",
							"text-valign": "center",
							"text-halign": "center",
							color: "#000",
							width: 100,
							height: 40,
							"font-size": 12,
							"text-wrap": "ellipsis",
							"text-max-width": "80px",
							"background-opacity": 0.9,
						},
					},
					// Post node styling
					{
						selector: 'node[type="post"]',
						style: {
							"background-color": this.nodeStyles.post["background-color"],
							shape: this.nodeStyles.post.shape,
						},
					},
					// Media node styling
					{
						selector: 'node[type="media"]',
						style: {
							"background-color": this.nodeStyles.media["background-color"],
							shape: this.nodeStyles.media.shape,
						},
					},
					// Edge styling
					{
						selector: "edge",
						style: {
							width: 2,
							"line-color": "#ccc",
							"target-arrow-color": "#ccc",
							"target-arrow-shape": "triangle",
							"curve-style": "bezier",
							opacity: 0.7,
						},
					},
					// POST_USE_IMAGE edge styling
					{
						selector: 'edge[type="POST_USE_IMAGE"]',
						style: {
							"line-color": "#8BC34A",
							"target-arrow-color": "#8BC34A",
							"line-style": "solid",
						},
					},
					// Selected element styling
					{
						selector: ":selected",
						style: {
							"background-color": "#ff7f00",
							"line-color": "#ff7f00",
							"target-arrow-color": "#ff7f00",
							"source-arrow-color": "#ff7f00",
							opacity: 1,
						},
					},
				],

				// Initial layout configuration
				layout: this.getLayoutConfig(),

				// Interaction settings
				minZoom: 0.2,
				maxZoom: 3,
				wheelSensitivity: 0.3,
			});

			// Add event listener for node selection
			this.cy.on("tap", "node", (event) => {
				const node = event.target;
				this.selectedNode = {
					id: node.id(),
					label: node.data("label"),
					type: node.data("type"),
				};
			});

			// Clear selection when clicking on background
			this.cy.on("tap", (event) => {
				if (event.target === this.cy) {
					this.selectedNode = null;
				}
			});

			// Apply initial filters
			this.updateFilters();
		},

		// Format the graph data for Cytoscape
		formatGraphData() {
			const elements = [];

			// Add nodes with proper Cytoscape format
			if (this.graphData.nodes) {
				this.graphData.nodes.forEach((node) => {
					elements.push({
						data: {
							id: node.id,
							label: node.label,
							type: node.type,
						},
					});
				});
			}

			// Add edges with proper Cytoscape format
			if (this.graphData.edges) {
				this.graphData.edges.forEach((edge, index) => {
					elements.push({
						data: {
							id: `e${index}`,
							source: edge.source,
							target: edge.target,
							type: edge.type,
						},
					});
				});
			}

			return elements;
		},

		// Get layout configuration based on selected layout
		getLayoutConfig() {
			const baseConfig = {
				name: this.selectedLayout,
				fit: true,
				padding: 30,
			};

			// Add specific options for different layouts
			switch (this.selectedLayout) {
				case "circle":
					return {
						...baseConfig,
						radius: 300,
						startAngle: (3 / 2) * Math.PI,
					};
				case "grid":
					return {
						...baseConfig,
						rows: undefined,
						cols: undefined,
					};
				case "breadthfirst":
					return {
						...baseConfig,
						directed: true,
						spacingFactor: 1.5,
					};
				case "concentric":
					return {
						...baseConfig,
						concentric: function (node) {
							// Posts in inner circles, media in outer circles
							return node.data("type") === "post" ? 10 : 1;
						},
						levelWidth: function () {
							return 3;
						},
						minNodeSpacing: 50,
					};
				case "cose":
				default:
					return {
						...baseConfig,
						idealEdgeLength: 100,
						nodeOverlap: 20,
						refresh: 20,
						fit: true,
						padding: 30,
						randomize: false,
						componentSpacing: 100,
						nodeRepulsion: 400000,
						edgeElasticity: 100,
						nestingFactor: 5,
						gravity: 80,
						numIter: 1000,
						initialTemp: 200,
						coolingFactor: 0.95,
						minTemp: 1.0,
					};
			}
		},

		// Apply the selected layout
		applyLayout() {
			if (!this.cy) return;

			const layout = this.cy.layout(this.getLayoutConfig());
			layout.run();
		},

		// Update node visibility based on filters
		updateFilters() {
			if (!this.cy) return;

			// Reset all nodes to default state first
			this.cy.nodes().style("display", "element");

			// Apply type filters first
			// Show/hide posts based on filter
			if (!this.showPosts) {
				this.cy
					.nodes()
					.filter((node) => node.data("type") === "post")
					.style("display", "none");
			}

			// Show/hide media based on filter
			if (!this.showMedia) {
				this.cy
					.nodes()
					.filter((node) => node.data("type") === "media")
					.style("display", "none");
			}

			// Apply text search filter if searchQuery is not empty
			if (this.searchQuery.trim()) {
				const query = this.searchQuery.toLowerCase();

				// Hide nodes that don't match the search query
				this.cy
					.nodes()
					.filter((node) => {
						// Check if the node is already hidden by type filter
						if (node.style("display") === "none") return true;

						// Only filter nodes that are visible after type filtering
						const label = node.data("label") || "";
						return !label.toLowerCase().includes(query);
					})
					.style("display", "none");
			}

			// Hide edges connected to hidden nodes
			this.cy.edges().forEach((edge) => {
				const sourceVisible =
					this.cy.getElementById(edge.data("source")).style("display") !==
					"none";
				const targetVisible =
					this.cy.getElementById(edge.data("target")).style("display") !==
					"none";
				edge.style(
					"display",
					sourceVisible && targetVisible ? "element" : "none",
				);
			});

			// Auto-apply layout when filters change
			this.applyLayout();
		},

		// Zoom controls
		zoomIn() {
			if (!this.cy) return;
			this.cy.zoom({
				level: this.cy.zoom() * 1.2,
				renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 },
			});
		},

		zoomOut() {
			if (!this.cy) return;
			this.cy.zoom({
				level: this.cy.zoom() * 0.8,
				renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 },
			});
		},

		resetView() {
			if (!this.cy) return;
			this.cy.fit();
			this.cy.center();
		},

		// Center the view on the selected node
		centerOnNode() {
			if (!this.cy || !this.selectedNode) return;
			const node = this.cy.getElementById(this.selectedNode.id);
			this.cy.center(node);
			this.cy.zoom(1.5);
		},

		// Close the node details panel
		closeDetails() {
			this.selectedNode = null;
			// Deselect all elements in the graph
			if (this.cy) {
				this.cy.elements().unselect();
			}
		},
	},
};
</script>

<template>
  <div class="flex flex-col h-full relative overflow-hidden">
    <!-- Controls section for interacting with the graph -->
    <div class="bg-background border-b p-4 flex flex-wrap justify-between items-center gap-4 z-10">
      <div class="w-full mb-2">
        <div class="relative w-full">
          <Search
            class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
            size="16"
          />
          <Input
            v-model="searchQuery" 
            placeholder="Search nodes by label..." 
            class="pl-10 w-full"
          />
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Layout:</span>
        <Select v-model="selectedLayout" class="w-full md:w-[200px]">
          <SelectTrigger>
            <SelectValue placeholder="Select layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="circle">Circle</SelectItem>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="concentric">Concentric</SelectItem>
            <SelectItem value="breadthfirst">Breadth-first</SelectItem>
            <SelectItem value="cose">Force-directed (COSE)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div class="flex items-center gap-4">
        <span class="text-sm font-medium">Show types:</span>
        <div class="flex items-center gap-2">
          <FileText size="16" class="text-blue-500" />
          <span class="text-sm">Posts</span>
          <Switch v-model="showPosts" class="ml-1" />
        </div>
        <div class="flex items-center gap-2">
          <Image size="16" class="text-orange-500" />
          <span class="text-sm">Media</span>
          <Switch v-model="showMedia" class="ml-1" />
        </div>
      </div>
      
      <div class="flex gap-2">
        <Button @click="zoomIn" size="sm" variant="outline">
          <ZoomIn class="mr-1" size="16" />
          Zoom In
        </Button>
        <Button @click="zoomOut" size="sm" variant="outline">
          <ZoomOut class="mr-1" size="16" />
          Zoom Out
        </Button>
        <Button @click="resetView" size="sm" variant="outline">
          <Maximize class="mr-1" size="16" />
          Reset View
        </Button>
      </div>
    </div>

    <!-- Graph container where Cytoscape will render -->
    <div id="cy" ref="cyElement" class="flex-grow w-full z-[1]"></div>

    <!-- Node details panel that shows when a node is selected -->
    <div 
      v-if="selectedNode" 
      class="absolute bottom-5 right-5 bg-background border rounded-lg p-4 shadow-md max-w-[300px] z-10"
    >
      <h3 class="text-lg font-medium mb-2 break-words">
        Selected: {{ selectedNode.label }}
      </h3>
      <p class="mb-1"><strong>Type:</strong> {{ selectedNode.type }}</p>
      <p class="mb-3 break-all"><strong>ID:</strong> {{ selectedNode.id.substring(0, 8) }}...</p>
      <div class="flex gap-2 mt-3">
        <Button @click="centerOnNode" size="sm" variant="outline">
          <Maximize class="mr-1" size="16" />
          Center View
        </Button>
        <Button @click="closeDetails" size="sm" variant="destructive">Close</Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Minimal custom styles needed for Cytoscape */
#cy {
  min-height: 400px;
}

@media (max-width: 768px) {
  .controls {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
