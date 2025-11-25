<!-- AdminDbData.vue -->
<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useToast } from "@/components/ui/toast/use-toast";
import { useRoute, useRouter } from "vue-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SelectGroup, SelectLabel } from "@/components/ui/select";
import {
	Search,
	Filter,
	ListIcon,
	GridIcon,
	Database,
	FileIcon,
	User,
	Calendar,
	MessageCircle,
	Settings,
	Clock,
	Tag,
	Key,
	Eye,
	Copy,
	CheckCircle,
	Cloud,
	Users,
	Building,
	FolderKanban,
	Rocket,
	FileText,
	Image,
	Brain,
	Palette,
} from "lucide-vue-next";
import trpc from "@/trpc";

const { toast } = useToast();
const route = useRoute();
const router = useRouter();

// State
const loading = ref(true);
const collections = ref([]);
const selectedCollection = ref(null);
const collectionData = ref([]);
const searchQuery = ref("");
const viewMode = ref("table"); // 'table' or 'card'
const showItemModal = ref(false);
const selectedItem = ref(null);
const page = ref(1);
const limit = ref(20);
const totalPages = ref(1);
const totalItems = ref(0);
const copiedId = ref(null);
const showCollectionsGrid = ref(true); // New state for collections grid

// Collection display configurations
const collectionDisplayConfig = {
	convos: {
		icon: MessageCircle,
		displayName: "Conversations",
		cardFields: ["title", "createdAt", "user"],
		primaryField: "title",
		secondaryField: "user",
		dateField: "createdAt",
		avatar: "user",
	},
	patients: {
		icon: User,
		displayName: "Patients",
		cardFields: ["name", "email", "createdAt"],
		primaryField: "name",
		secondaryField: "email",
		dateField: "createdAt",
	},
	mentors: {
		icon: User,
		displayName: "Mentors",
		cardFields: ["name", "email", "createdAt"],
		primaryField: "name",
		secondaryField: "email",
		dateField: "createdAt",
	},
	extras: {
		icon: FileIcon,
		displayName: "Extras",
		cardFields: ["name", "type", "updatedAt"],
		primaryField: "name",
		secondaryField: "type",
		dateField: "updatedAt",
	},
	extraConfigs: {
		icon: Settings,
		displayName: "Extra Configs",
		cardFields: ["key", "value", "updatedAt"],
		primaryField: "key",
		secondaryField: "value",
		dateField: "updatedAt",
	},
	meets: {
		icon: Calendar,
		displayName: "Meetings",
		cardFields: ["title", "status", "scheduledAt"],
		primaryField: "title",
		secondaryField: "status",
		dateField: "scheduledAt",
	},
	r2: {
		icon: Cloud, // Changed from FileIcon to Cloud
		displayName: "R2 Storage",
		cardFields: ["name", "type", "updatedAt"],
		primaryField: "name",
		secondaryField: "type",
		dateField: "updatedAt",
	},
	userActivities: {
		icon: Clock,
		displayName: "User Activities",
		cardFields: ["userId", "action", "createdAt"],
		primaryField: "action",
		secondaryField: "userId",
		dateField: "createdAt",
	},
	reccos: {
		icon: Tag,
		displayName: "Recommendations",
		cardFields: ["title", "status", "createdAt"],
		primaryField: "title",
		secondaryField: "status",
		dateField: "createdAt",
	},
	// Add your new collections:
	users: {
		icon: Users, // Users instead of User for multiple users
		displayName: "Users",
		cardFields: ["name", "email", "createdAt"],
		primaryField: "name",
		secondaryField: "email",
		dateField: "createdAt",
	},
	orgs: {
		icon: Building, // Building icon for organizations
		displayName: "Organizations",
		cardFields: ["name", "type", "createdAt"],
		primaryField: "name",
		secondaryField: "type",
		dateField: "createdAt",
	},
	projects: {
		icon: FolderKanban, // FolderKanban for projects
		displayName: "Projects",
		cardFields: ["name", "status", "updatedAt"],
		primaryField: "name",
		secondaryField: "status",
		dateField: "updatedAt",
	},
	deploys: {
		icon: Rocket, // Rocket for deployments
		displayName: "Deployments",
		cardFields: ["name", "status", "createdAt"],
		primaryField: "name",
		secondaryField: "status",
		dateField: "createdAt",
	},
	notes: {
		icon: FileText, // FileText for notes
		displayName: "Notes",
		cardFields: ["title", "content", "createdAt"],
		primaryField: "title",
		secondaryField: "content",
		dateField: "createdAt",
	},
	medias: {
		icon: Image, // Image for media files
		displayName: "Media Files",
		cardFields: ["name", "type", "size"],
		primaryField: "name",
		secondaryField: "type",
		dateField: "createdAt",
	},
	llmApiCache: {
		icon: Brain, // Brain for LLM API cache
		displayName: "LLM API Cache",
		cardFields: ["query", "model", "createdAt"],
		primaryField: "query",
		secondaryField: "model",
		dateField: "createdAt",
	},
	dalleApiCache: {
		icon: Palette, // Palette for DALL-E image generation
		displayName: "DALL-E API Cache",
		cardFields: ["prompt", "model", "createdAt"],
		primaryField: "prompt",
		secondaryField: "model",
		dateField: "createdAt",
	},
};

// Computed properties
const filteredData = computed(() => {
	if (!collectionData.value || !Array.isArray(collectionData.value)) {
		return [];
	}

	if (!searchQuery.value.trim()) {
		return collectionData.value;
	}

	const query = searchQuery.value.toLowerCase();
	return collectionData.value.filter((item) => {
		// Search in all string fields
		return Object.entries(item).some(([key, value]) => {
			if (typeof value === "string") {
				return value.toLowerCase().includes(query);
			}
			if (typeof value === "number" || typeof value === "boolean") {
				return String(value).toLowerCase().includes(query);
			}
			return false;
		});
	});
});

const currentCollectionConfig = computed(() => {
	return (
		collectionDisplayConfig[selectedCollection.value] || {
			icon: Database,
			displayName: selectedCollection.value,
			cardFields: [],
			primaryField: "_id",
			secondaryField: "",
			dateField: "createdAt",
		}
	);
});

const visibleFields = computed(() => {
	if (!collectionData.value || collectionData.value.length === 0) return [];

	// Get all fields from the first item
	const allFields = Object.keys(collectionData.value[0]);

	// Filter out MongoDB specific fields or fields with objects/arrays
	return allFields.filter((field) => {
		const value = collectionData.value[0][field];
		const isBasicType =
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean" ||
			value instanceof Date;

		// Include basic types and exclude fields that start with $ or are _id
		return isBasicType && !field.startsWith("$");
	});
});

// Methods
const fetchCollections = async () => {
	try {
		loading.value = true;
		const result = await trpc.getAllCollections.query();
		collections.value = result.collections || [];

		// If URL contains a collection parameter, use it
		if (route.params.collection) {
			const routeCollection = route.params.collection;
			if (collections.value.includes(routeCollection)) {
				selectedCollection.value = routeCollection;
				showCollectionsGrid.value = false;
				await fetchCollectionData();
			} else {
				router.replace({ params: { collection: null } });
				showCollectionsGrid.value = true;
			}
		} else if (collections.value.length > 0 && !showCollectionsGrid.value) {
			// If no collection in URL and not showing grid, default to first collection
			selectedCollection.value = collections.value[0];
			await fetchCollectionData();
		}
	} catch (error) {
		console.error("Error fetching collections:", error);
		toast({
			title: "Error",
			description: "Unable to load database collections",
			variant: "destructive",
		});
	} finally {
		loading.value = false;
	}
};

const fetchCollectionData = async () => {
	if (!selectedCollection.value) return;

	try {
		loading.value = true;
		const result = await trpc.getCollectionData.query({
			collectionName: selectedCollection.value,
			page: page.value,
			limit: limit.value,
		});

		collectionData.value = result.data || [];
		totalPages.value = result.pagination?.pages || 1;
		totalItems.value = result.pagination?.total || 0;
	} catch (error) {
		console.error(`Error fetching ${selectedCollection.value} data:`, error);
		toast({
			title: "Error",
			description: `Unable to load ${selectedCollection.value} data`,
			variant: "destructive",
		});
		collectionData.value = [];
	} finally {
		loading.value = false;
	}
};

const handleCollectionChange = async (collection) => {
	selectedCollection.value = collection;
	page.value = 1; // Reset pagination
	searchQuery.value = ""; // Reset search
	showCollectionsGrid.value = false; // Hide collections grid

	// Update URL
	router.push({ params: { collection } });

	await fetchCollectionData();
};

const handleCollectionCardClick = (collection) => {
	handleCollectionChange(collection);
};

const handlePageChange = async (newPage) => {
	page.value = newPage;
	await fetchCollectionData();
};

const toggleViewMode = () => {
	viewMode.value = viewMode.value === "table" ? "card" : "table";
};

const viewItem = (item) => {
	console.log("Viewing item details:", item);
	selectedItem.value = item;
	showItemModal.value = true;
};

const formatDate = (dateString) => {
	if (!dateString) return "N/A";
	try {
		const date = new Date(dateString);
		return date.toLocaleString();
	} catch (e) {
		return dateString;
	}
};

const getFieldValue = (item, field) => {
	if (!item || !field) return "N/A";

	const value = item[field];

	if (value === undefined || value === null) return "N/A";

	if (
		value instanceof Date ||
		(typeof value === "string" && !isNaN(Date.parse(value)))
	) {
		return formatDate(value);
	}

	if (typeof value === "object") {
		return JSON.stringify(value).slice(0, 50) + "...";
	}

	return String(value);
};

const getFieldIcon = (fieldName) => {
	const iconMap = {
		_id: Key,
		id: Key,
		name: User,
		title: FileIcon,
		email: MessageCircle,
		createdAt: Calendar,
		updatedAt: Clock,
		status: Tag,
	};

	return iconMap[fieldName] || FileIcon;
};

const copyToClipboard = (text) => {
	navigator.clipboard
		.writeText(text)
		.then(() => {
			toast({
				title: "Copied!",
				description: "Value copied to clipboard",
			});
		})
		.catch((err) => {
			console.error("Unable to copy to clipboard", err);
			toast({
				title: "Error",
				description: "Failed to copy value to clipboard",
				variant: "destructive",
			});
		});
};

const copyItemId = (item) => {
	const id = item._id || item.id;
	if (id) {
		copyToClipboard(id);
		copiedId.value = id;

		setTimeout(() => {
			copiedId.value = null;
		}, 2000);
	}
};

const returnToCollectionsGrid = () => {
	showCollectionsGrid.value = true;
	selectedCollection.value = null;
	router.push({ params: { collection: null } });
};

// Lifecycle
onMounted(() => {
	fetchCollections();
});

// Watchers
watch(selectedCollection, () => {
	console.log("Selected collection changed:", selectedCollection.value);
});
</script>

<template>
  <div class="container mx-auto p-6" style="background: #fff">
    <!-- Page Header -->
    <div class="mb-8" v-if="showCollectionsGrid">
      <h1 class="text-3xl font-bold">Database Explorer</h1>
      <p class="text-muted-foreground mt-2">
        Browse and manage all database collections.
      </p>
    </div>

    <!-- Collections Grid View -->
    <div v-if="showCollectionsGrid">
      <h2 class="text-xl font-semibold mb-6">Available Collections</h2>
      <div
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
      >
        <Card
          v-for="collection in collections"
          :key="collection"
          class="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
          @click="handleCollectionCardClick(collection)"
        >
          <div class="p-6 flex flex-col items-center text-center">
            <component
              :is="collectionDisplayConfig[collection]?.icon || Database"
              class="w-12 h-12 mb-4 text-primary"
            />
            <h3 class="text-lg font-medium mb-2">
              {{
                collectionDisplayConfig[collection]?.displayName || collection
              }}
            </h3>
            <p class="text-sm text-muted-foreground">
              Click to browse this collection
            </p>
          </div>
        </Card>
      </div>
    </div>

    <!-- Collection View -->
    <div v-else>
      <!-- Navigation and Collection Selection -->

      <Button
        variant="outline"
        @click="returnToCollectionsGrid"
        class="flex items-center mb-4"
      >
        <span class="mr-2">&larr;</span>
        Back to collections
      </Button>

      <div class="flex items-center justify-between mb-6">
        <!-- Collection Dropdown -->
        <Select
          :model-value="selectedCollection"
          @update:model-value="handleCollectionChange"
          class="w-full md:w-[280px]"
          size="xl"
        >
          <SelectTrigger>
            <div class="flex items-center">
              <component
                :is="currentCollectionConfig.icon || Database"
                class="w-4 h-4 mr-2"
              />
              <SelectValue :placeholder="'Select a collection'" />
              <span
                v-if="totalItems > 0"
                class="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full"
              >
                {{ totalItems }}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Collections</SelectLabel>
              <SelectItem
                v-for="collection in collections"
                :key="collection"
                :value="collection"
              >
                <div class="flex items-center">
                  <component
                    :is="collectionDisplayConfig[collection]?.icon || Database"
                    class="w-4 h-4 mr-2"
                  />
                  {{
                    collectionDisplayConfig[collection]?.displayName ||
                    collection
                  }}
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <!-- Collection Title -->
      <div v-if="selectedCollection" class="collection-title mt-6">
        <h2 class="text-4xl mt-7">
          <component
            :is="currentCollectionConfig.icon || Database"
            class="icon w-5 h-5 inline"
          />
          {{ currentCollectionConfig.displayName || selectedCollection }}
        </h2>
      </div>

      <!-- Search and Controls -->
      <div class="flex flex-col md:flex-row gap-4 mb-6">
        <!-- Search Input -->
        <div class="relative flex-grow">
          <Search
            class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="searchQuery"
            placeholder="Search in collection..."
            class="pl-10 w-full"
          />
        </div>

        <!-- View Toggle and Pagination Controls -->
        <div class="flex gap-2">
          <!-- View Toggle -->
          <div class="flex border rounded overflow-hidden shrink-0">
            <Button
              variant="ghost"
              class="px-3 rounded-none"
              :class="{ 'bg-accent': viewMode === 'table' }"
              @click="viewMode = 'table'"
            >
              <ListIcon class="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              class="px-3 rounded-none"
              :class="{ 'bg-accent': viewMode === 'card' }"
              @click="viewMode = 'card'"
            >
              <GridIcon class="w-5 h-5" />
            </Button>
          </div>

          <!-- Pagination Controls -->
          <div class="flex items-center space-x-2 border rounded p-1 h-10">
            <span class="text-sm text-muted-foreground mx-2">
              {{ page }} / {{ totalPages }}
            </span>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0"
              :disabled="page <= 1"
              @click="handlePageChange(page - 1)"
            >
              &lt;
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0"
              :disabled="page >= totalPages"
              @click="handlePageChange(page + 1)"
            >
              &gt;
            </Button>
          </div>

          <!-- Limit Selector -->
          <Select v-model="limit" @update:modelValue="fetchCollectionData">
            <SelectTrigger class="w-[80px]">
              <SelectValue placeholder="Limit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="10">10</SelectItem>
              <SelectItem :value="20">20</SelectItem>
              <SelectItem :value="50">50</SelectItem>
              <SelectItem :value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-64">
        <div
          class="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"
        ></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredData.length === 0" class="text-center py-12">
        <Database class="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 class="mt-4 text-lg font-medium">No data found</h3>
        <p class="text-muted-foreground mt-2">
          This collection is empty or no data matches your search criteria.
        </p>
        <Button @click="searchQuery = ''" variant="outline" class="mt-4">
          Reset filters
        </Button>
      </div>

      <!-- Table View -->
      <div
        v-else-if="viewMode === 'table' && filteredData.length > 0"
        class="overflow-x-auto border rounded-md"
      >
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-muted">
              <th
                v-for="field in visibleFields"
                :key="field"
                class="text-left p-3 font-medium text-sm"
              >
                {{ field }}
              </th>
              <th class="text-center p-3 font-medium text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in filteredData"
              :key="index"
              class="border-t border-border hover:bg-accent/5 transition-colors"
            >
              <td
                v-for="field in visibleFields"
                :key="`${index}-${field}`"
                class="p-3 text-sm"
              >
                <div
                  class="truncate max-w-[200px]"
                  :title="getFieldValue(item, field)"
                >
                  {{ getFieldValue(item, field) }}
                </div>
              </td>
              <td class="p-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  @click="viewItem(item)"
                  title="View details"
                >
                  <Eye class="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="copyItemId(item)"
                  title="Copy ID"
                >
                  <CheckCircle
                    v-if="copiedId === (item._id || item.id)"
                    class="w-4 h-4 text-green-500"
                  />
                  <Copy v-else class="w-4 h-4" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Card View -->
      <div
        v-else-if="viewMode === 'card' && filteredData.length > 0"
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        <Card
          v-for="(item, index) in filteredData"
          :key="index"
          class="overflow-hidden flex flex-col group relative hover:shadow-md transition-shadow cursor-pointer"
          @click="viewItem(item)"
        >
          <!-- Card Header -->
          <div class="p-4 bg-accent/10 border-b">
            <div class="flex justify-between items-start">
              <div class="truncate font-medium">
                {{ getFieldValue(item, currentCollectionConfig.primaryField) }}
              </div>
              <component
                :is="currentCollectionConfig.icon"
                class="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2"
              />
            </div>
          </div>

          <!-- Card Content -->
          <div class="p-4 flex-grow space-y-2">
            <!-- Display configured card fields -->
            <div
              v-for="field in currentCollectionConfig.cardFields"
              :key="field"
              class="flex items-center text-sm"
              v-if="field !== currentCollectionConfig.primaryField"
            >
              <component
                :is="getFieldIcon(field)"
                class="w-4 h-4 mr-2 text-muted-foreground"
              />
              <div class="truncate">
                <span class="text-muted-foreground mr-1">{{ field }}:</span>
                {{ getFieldValue(item, field) }}
              </div>
            </div>

            <!-- ID Display -->
            <div class="flex items-center text-sm mt-auto pt-2">
              <Key class="w-4 h-4 mr-2 text-muted-foreground" />
              <div class="truncate text-muted-foreground">
                ID: {{ item._id || item.id || "N/A" }}
              </div>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="p-3 border-t bg-muted/10 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              @click.stop="copyItemId(item)"
              title="Copy ID"
              class="h-8 w-8 p-0"
            >
              <CheckCircle
                v-if="copiedId === (item._id || item.id)"
                class="w-4 h-4 text-green-500"
              />
              <Copy v-else class="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>

    <!-- Item Detail Modal -->
    <Dialog :open="showItemModal" @update:open="showItemModal = $event">
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Item Details</DialogTitle>
          <DialogDescription>
            Collection: {{ currentCollectionConfig.displayName }}
          </DialogDescription>
        </DialogHeader>

        <div class="py-4" v-if="selectedItem">
          <!-- Item properties -->
          <div
            class="grid grid-cols-1 gap-2 overflow-y-auto max-h-[400px] pr-2"
          >
            <div
              v-for="(value, key) in selectedItem"
              :key="key"
              class="grid grid-cols-3 gap-2 border-b py-2"
            >
              <div class="text-sm font-medium text-muted-foreground">
                {{ key }}:
              </div>
              <div class="text-sm col-span-2 break-all">
                <div v-if="typeof value === 'object' && value !== null">
                  <pre
                    class="bg-accent/10 p-2 rounded text-xs overflow-x-auto"
                    >{{ JSON.stringify(value, null, 2) }}</pre
                  >
                </div>
                <div v-else>
                  {{ getFieldValue(selectedItem, key) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showItemModal = false">
            Close
          </Button>
          <Button
            @click="copyItemId(selectedItem)"
            v-if="selectedItem && (selectedItem._id || selectedItem.id)"
          >
            <span class="flex items-center gap-2">
              <Copy class="w-4 h-4" />
              Copy ID
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.text-muted-foreground {
  color: hsl(var(--muted-foreground));
}

.bg-accent {
  background-color: hsl(var(--accent));
}

.bg-muted {
  background-color: hsl(var(--muted));
}

.collection-title {
  display: flex;
  align-items: center;
  font-weight: 500;
  margin-bottom: 8px;
}

.collection-title .icon {
  margin-right: 8px;
}
</style>
