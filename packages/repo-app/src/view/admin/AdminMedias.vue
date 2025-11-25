<!-- MediaListing.vue with dropdown for selecting default size -->
<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useToast } from "@/components/ui/toast/use-toast";
import { Card } from "@/components/ui/card";
import { formatFileSize } from "@/lib/utils/dateUtils";
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
import {
	Search,
	Filter,
	Copy,
	CheckCircle,
	Image,
	Video,
	File,
	MoreHorizontal,
	ListIcon,
	GridIcon,
} from "lucide-vue-next";
import trpc from "@/trpc";

import { isLocalhost } from "@/lib/utils/devUtils.js";
import { appConfigs } from "@/appConfigs.js";
const { USE_DEV_API_IN_DEV, API_DOMAIN, DEV_API_DOMAIN, staticDomain } =
	appConfigs;
const { toast } = useToast();

// Configuration
//const STATIC_DOMAIN = staticDomain; // "https://static.repo.md";

const API_BASE_URL = staticDomain;

// isLocalhost() && USE_DEV_API_IN_DEV ? DEV_API_DOMAIN : STATIC_DOMAIN;

// State
const loading = ref(true);
const medias = ref([]);
const searchQuery = ref("");
const copiedId = ref(null);
const selectedMediaType = ref("all");
const showMediaModal = ref(false);
const selectedMedia = ref(null);
const viewMode = ref("grid"); // 'grid' for mosaic view, 'list' for table view
const defaultSize = ref("sm"); // Default size selection

// Get available size options from first media item with sizes
const availableSizeOptions = computed(() => {
	// Look for the first media with sizes to determine available options
	const mediaWithSizes = medias.value.find(
		(media) => media && media.sizes && Object.keys(media.sizes).length > 0,
	);

	if (!mediaWithSizes) return ["ori"]; // Original size only if no sizes found

	// Get all size keys and ensure "ori" is included for original size
	const sizes = Object.keys(mediaWithSizes.sizes);
	if (!sizes.includes("ori")) {
		sizes.push("ori");
	}

	return sizes.sort(); // Sort sizes (usually will be sm, md, lg, ori)
});

// Media types for filtering
const mediaTypes = computed(() => {
	console.log("DEBUG: Computing mediaTypes from medias:", medias.value);
	const types = new Set(
		medias.value.map((media) => {
			if (!media || !media.fileName) {
				console.warn("DEBUG: Found media with missing filename:", media);
				return "unknown";
			}
			const extension = media.fileExt?.toLowerCase();
			console.log(
				"DEBUG: Media extension:",
				extension,
				"for filename:",
				media.fileName,
			);
			if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension))
				return "image";
			if (["mp4", "webm", "mov", "avi"].includes(extension)) return "video";
			if (["mp3", "wav", "ogg"].includes(extension)) return "audio";
			return "other";
		}),
	);
	const typesArray = Array.from(types);
	console.log("DEBUG: Detected media types:", typesArray);
	return typesArray;
});

// Helper to construct proper CDN URLs
const constructCdnUrl = (path) => {
	if (!path) return "#";
	return `${API_BASE_URL}${path}`;
};

// Get the appropriate CDN URL based on size preference
const getPreferredCdnUrl = (media) => {
	if (!media) return "#";

	// If selected size exists and is not "ori", use that size's URL
	if (
		defaultSize.value !== "ori" &&
		media.sizes &&
		media.sizes[defaultSize.value] &&
		media.sizes[defaultSize.value].length > 0
	) {
		return media.sizes[defaultSize.value][0].cdnUrl;
	}

	// Otherwise use original URL
	return constructCdnUrl(media.publicPath);
};

// Enhanced media list with computed properties
const enhancedMedias = computed(() => {
	console.log("DEBUG: Computing enhancedMedias from medias:", medias.value);

	if (!Array.isArray(medias.value)) {
		console.error("DEBUG: medias.value is not an array:", medias.value);
		return [];
	}

	const enhanced = medias.value
		.map((media) => {
			if (!media) {
				console.warn("DEBUG: Found null or undefined media item");
				return null;
			}

			if (!media.fileName) {
				console.warn("DEBUG: Media missing filename:", media);
				return {
					...media,
					mediaType: "unknown",
					extension: "unknown",
					fullUrl: "#",
					cdnUrl: "#",
					directory: "/",
					displayName: "Unknown",
				};
			}

			const extension = media.fileExt?.toLowerCase();
			const mediaType = ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(
				extension,
			)
				? "image"
				: ["mp4", "webm", "mov", "avi"].includes(extension)
					? "video"
					: ["mp3", "wav", "ogg"].includes(extension)
						? "audio"
						: "other";

			// Process image sizes and add proper CDN urls to each size
			const enhancedSizes = {};
			if (media.sizes) {
				Object.keys(media.sizes).forEach((sizeKey) => {
					if (Array.isArray(media.sizes[sizeKey])) {
						enhancedSizes[sizeKey] = media.sizes[sizeKey].map((size) => {
							// Use full outputPath for CDN URL
							return {
								...size,
								cdnUrl: constructCdnUrl(size.publicPath),
							};
						});
					}
				});
			}

			// Determine main CDN URL (now handled by the computed function getPreferredCdnUrl)
			const originalCdnUrl = constructCdnUrl(media.publicPath);

			// Get directory path
			const pathParts = media.originalPath.split("/");
			const directory =
				pathParts.length > 1 ? pathParts.slice(0, -1).join("/") : "/";

			// Get display name (just the filename without path)
			const displayName =
				pathParts.length > 0 ? pathParts[pathParts.length - 1] : media.fileName;

			const formattedSize = media.metadata?.size
				? formatFileSize(media.metadata.size)
				: media.sizes?.sm?.[0]?.size
					? formatFileSize(media.sizes.sm[0].size)
					: "Unknown";

			const enhancedMedia = {
				...media,
				id: media.fileName, // Using fileName as id if no id is provided
				mediaType,
				extension: media.fileExt,
				fullUrl: originalCdnUrl,
				originalCdnUrl, // Store the original URL
				cdnUrl: originalCdnUrl, // Will be computed dynamically based on defaultSize
				directory,
				displayName,
				sizes: enhancedSizes,
				fileSize: formattedSize,
				dimensions:
					media.metadata?.width && media.metadata?.height
						? `${media.metadata.width}×${media.metadata.height}`
						: "Unknown",
				dateCreated: media.createdAt
					? new Date(media.createdAt).toLocaleDateString()
					: new Date().toLocaleDateString(), // Fallback to current date
			};

			return enhancedMedia;
		})
		.filter(Boolean); // Remove any null entries

	console.log("DEBUG: Enhanced media items count:", enhanced.length);
	if (enhanced.length > 0) {
		console.log("DEBUG: First enhanced item sample:", enhanced[0]);
	}

	return enhanced;
});

// Filtered media based on search and type filter
const filteredMedias = computed(() => {
	console.log("DEBUG: Computing filteredMedias");
	console.log("DEBUG: Current search query:", searchQuery.value);
	console.log("DEBUG: Current media type filter:", selectedMediaType.value);

	if (!enhancedMedias.value || !Array.isArray(enhancedMedias.value)) {
		console.error(
			"DEBUG: enhancedMedias.value is invalid:",
			enhancedMedias.value,
		);
		return [];
	}

	let filtered = enhancedMedias.value;

	// Filter by media type
	if (selectedMediaType.value !== "all") {
		filtered = filtered.filter(
			(media) => media.mediaType === selectedMediaType.value,
		);
		console.log("DEBUG: After type filtering, items count:", filtered.length);
	}

	// Filter by search query
	if (searchQuery.value.trim()) {
		const query = searchQuery.value.toLowerCase();
		filtered = filtered.filter(
			(media) =>
				media.fileName.toLowerCase().includes(query) ||
				media.originalPath.toLowerCase().includes(query) ||
				media.directory.toLowerCase().includes(query) ||
				(media.description && media.description.toLowerCase().includes(query)),
		);
		console.log("DEBUG: After search filtering, items count:", filtered.length);
	}

	return filtered;
});

// Methods
const fetchMedias = async () => {
	console.log("DEBUG: Starting fetchMedias()");
	try {
		loading.value = true;
		console.log("DEBUG: Calling trpc.getAllMedias.query()");
		const result = await trpc.getAllMedias.query();
		console.log("DEBUG: TRPC result received:", result);

		// Ensure we're setting an array
		medias.value = Array.isArray(result) ? result : [];
	} catch (error) {
		console.error("DEBUG: Error fetching media:", error);
		toast({
			title: "Error",
			description: "Unable to load media files",
			variant: "destructive",
		});
	} finally {
		loading.value = false;
		console.log("DEBUG: fetchMedias completed. loading set to false");
	}
};

const copyToClipboard = (url) => {
	console.log("DEBUG: Copying URL to clipboard:", url);
	navigator.clipboard
		.writeText(url)
		.then(() => {
			toast({
				title: "Copied!",
				description: "URL copied to clipboard",
			});
		})
		.catch((err) => {
			console.error("DEBUG: Unable to copy to clipboard", err);
			toast({
				title: "Error",
				description: "Failed to copy URL to clipboard",
				variant: "destructive",
			});
		});
};

const copyMediaUrl = (media) => {
	// Use the getPreferredCdnUrl function to get the correct URL based on size preference
	const urlToCopy = getPreferredCdnUrl(media);
	copyToClipboard(urlToCopy);
	copiedId.value = media.id;

	setTimeout(() => {
		copiedId.value = null;
	}, 2000);
};

const openMediaDetails = (media) => {
	console.log("DEBUG: Opening media details for:", media);

	// Log the complete media entry for debugging
	console.log("DEBUG: Complete media entry:", JSON.stringify(media, null, 2));

	// Specifically log the 'sm' sizes if they exist
	if (media.sizes && media.sizes.sm) {
		console.log("DEBUG: SM sizes:", JSON.stringify(media.sizes.sm, null, 2));
	} else {
		console.log("DEBUG: No SM sizes found for this media");
	}

	selectedMedia.value = media;
	showMediaModal.value = true;
};

// Using formatFileSize from dateUtils now

const getMediaIcon = (type) => {
	switch (type) {
		case "image":
			return Image;
		case "video":
			return Video;
		default:
			return File;
	}
};

// Get size variants available for a media
const getAvailableSizes = (media) => {
	if (!media || !media.sizes) return [];

	return Object.keys(media.sizes).filter(
		(key) => Array.isArray(media.sizes[key]) && media.sizes[key].length > 0,
	);
};

// Get preview URL for media based on type and size preferences
const getPreviewUrl = (media) => {
	if (!media || media.mediaType !== "image") return "#";

	// For preview thumbnails, prefer 'sm' size if available
	if (media.sizes?.sm?.[0]?.cdnUrl) {
		return media.sizes.sm[0].cdnUrl;
	}

	// Fall back to original URL if no thumbnail
	return media.originalCdnUrl;
};

// Toggle view between grid and list
const toggleViewMode = () => {
	viewMode.value = viewMode.value === "grid" ? "list" : "grid";
};

// Format size label for display
const formatSizeLabel = (sizeKey) => {
	if (sizeKey === "ori") return "Original";
	return sizeKey.toUpperCase();
};

// Debug logs for state changes
watch(
	medias,
	(newValue) => {
		console.log("DEBUG: medias ref updated:", newValue);
		console.log("DEBUG: medias length:", newValue?.length || 0);
		console.log("DEBUG: first item sample:", newValue?.[0]);
	},
	{ deep: true },
);

watch(
	filteredMedias,
	(newValue) => {
		console.log("DEBUG: filteredMedias computed updated:", newValue);
		console.log("DEBUG: filteredMedias length:", newValue?.length || 0);
	},
	{ deep: true },
);

// Watch for changes in default size
watch(defaultSize, (newSize) => {
	console.log("DEBUG: Default size changed to:", newSize);
});

// Lifecycle
onMounted(() => {
	console.log("DEBUG: Component mounted, calling fetchMedias()");
	fetchMedias();
});
</script>

<template>
  <json-debug :data="medias" label="medias" />
  <json-debug :data="filteredMedias" label="filters" />

  <div class="container mx-auto p-6" style="background: #fff">
    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold">Librarie Médias</h1>
      <p class="text-muted-foreground mt-2">
        Images et médias disponibles pour utilisation dans le contenu.<br />
        Ressources compilées à partir du
        <a href="https://github.com/Repo.md/pushmd/">Wiki-Repo.md</a>.
      </p>
    </div>

    <!-- Filters, Size Select, and View Toggle -->
    <!-- Filters, Size Select, and View Toggle -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <!-- Search Input (takes most space) -->
      <div class="relative flex-grow">
        <Search
          class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="searchQuery"
          placeholder="Search by filename or path..."
          class="pl-10 w-full"
        />
      </div>

      <!-- Fixed width controls container -->
      <div class="flex flex-wrap md:flex-nowrap gap-2">
        <!-- Media Type Dropdown (fixed width) -->
        <Select v-model="selectedMediaType" class="w-full md:w-[150px]">
          <SelectTrigger>
            <SelectValue placeholder="All media types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All media types</SelectItem>
            <SelectItem v-for="type in mediaTypes" :key="type" :value="type">
              {{ type.charAt(0).toUpperCase() + type.slice(1) }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- View Toggle Buttons (fixed width) -->
        <div class="flex border rounded overflow-hidden shrink-0">
          <Button
            variant="ghost"
            class="px-3 rounded-none"
            :class="{ 'bg-accent': viewMode === 'grid' }"
            @click="viewMode = 'grid'"
          >
            <GridIcon class="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            class="px-3 rounded-none"
            :class="{ 'bg-accent': viewMode === 'list' }"
            @click="viewMode = 'list'"
          >
            <ListIcon class="w-5 h-5" />
          </Button>
        </div>

        <!-- Default Size Selector (fixed width) -->
        <Select v-model="defaultSize" class="w-full md:w-[120px]">
          <SelectTrigger>
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="size in availableSizeOptions"
              :key="size"
              :value="size"
            >
              {{ formatSizeLabel(size) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div
        class="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"
      ></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredMedias.length === 0" class="text-center py-12">
      <File class="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No media found</h3>
      <p class="text-muted-foreground mt-2">
        No media matches your search criteria.
      </p>
      <Button
        @click="
          searchQuery = '';
          selectedMediaType = 'all';
        "
        variant="outline"
        class="mt-4"
      >
        Reset filters
      </Button>
    </div>

    <!-- Media Grid (Mosaic) View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
    >
      <Card
        v-for="media in filteredMedias"
        :key="media.id"
        class="overflow-hidden flex flex-col h-full group relative"
      >
        <!-- Media Preview -->
        <div
          class="aspect-square relative overflow-hidden bg-gray-100 flex items-center justify-center"
          @click="openMediaDetails(media)"
        >
          <!-- Image Preview -->
          <img
            v-if="media.mediaType === 'image'"
            :src="getPreviewUrl(media)"
            :alt="media.displayName"
            class="object-cover w-full h-full cursor-pointer transition-transform group-hover:scale-105"
            loading="lazy"
          />
          <!-- Video Preview -->
          <div
            v-else-if="media.mediaType === 'video'"
            class="relative w-full h-full bg-black flex items-center justify-center"
          >
            <Video class="w-12 h-12 text-white opacity-80" />
          </div>
          <!-- Other File Types -->
          <component
            v-else
            :is="getMediaIcon(media.mediaType)"
            class="w-12 h-12 text-muted-foreground"
          />
        </div>

        <!-- Card Content -->
        <div class="p-3 flex-grow flex flex-col">
          <div
            class="truncate font-medium text-sm mb-1"
            :title="media.displayName"
          >
            {{ media.displayName }}
          </div>
          <div class="text-xs text-muted-foreground mb-2 flex-grow">
            <span
              class="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-xs mr-1"
            >
              {{ media.extension }}
            </span>
            <span>{{ media.fileSize }}</span>
            <!-- Show selected size indicator -->
            <span
              v-if="
                media.sizes && Object.keys(media.sizes).includes(defaultSize)
              "
              class="inline-block px-1.5 py-0.5 rounded bg-blue-100 text-xs ml-1"
            >
              {{ formatSizeLabel(defaultSize) }}
            </span>
          </div>

          <!-- Actions -->
          <div class="flex justify-between items-center pt-1">
            <Button
              variant="ghost"
              size="sm"
              @click="copyMediaUrl(media)"
              title="Copy URL (Selected Size)"
              class="w-8 h-8 p-0"
            >
              <CheckCircle
                v-if="copiedId === media.id"
                class="w-4 h-4 text-green-500"
              />
              <Copy v-else class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="openMediaDetails(media)"
              title="View details"
              class="w-8 h-8 p-0"
            >
              <MoreHorizontal class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Media Table View -->
    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b">
            <th class="text-left p-3 font-medium">Preview</th>
            <th class="text-left p-3 font-medium">Filename</th>
            <th class="text-left p-3 font-medium">Dimensions</th>
            <th class="text-left p-3 font-medium">Size</th>
            <th class="text-left p-3 font-medium">Type</th>
            <th class="text-center p-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="media in filteredMedias"
            :key="media.id"
            class="border-b hover:bg-accent/20 transition-colors"
          >
            <td class="p-3 w-16">
              <div
                v-if="media.mediaType === 'image'"
                class="w-12 h-12 relative overflow-hidden bg-gray-100 rounded border border-gray-200"
              >
                <img
                  :src="getPreviewUrl(media)"
                  :alt="media.displayName"
                  class="object-cover w-full h-full"
                  loading="lazy"
                />
              </div>
              <component
                v-else
                :is="getMediaIcon(media.mediaType)"
                class="w-8 h-8 text-muted-foreground mx-auto"
              />
            </td>
            <td class="p-3 cursor-pointer" @click="openMediaDetails(media)">
              <div class="font-medium">{{ media.displayName }}</div>
              <div class="text-xs text-muted-foreground truncate max-w-xs">
                {{ media.originalPath }}
              </div>
              <!-- Show selected size indicator -->
              <div
                v-if="
                  media.sizes && Object.keys(media.sizes).includes(defaultSize)
                "
              >
                <span class="px-2 py-0.5 rounded bg-blue-100 text-xs uppercase">
                  {{ formatSizeLabel(defaultSize) }}
                </span>
              </div>
            </td>
            <td class="p-3 text-sm">{{ media.dimensions }}</td>
            <td class="p-3 text-sm">{{ media.fileSize }}</td>
            <td class="p-3 text-sm">
              <span class="px-2 py-1 rounded bg-gray-100 text-xs uppercase">
                {{ media.extension }}
              </span>
            </td>
            <td class="p-3 text-center">
              <Button
                variant="ghost"
                size="sm"
                @click="copyMediaUrl(media)"
                title="Copy URL (Selected Size)"
              >
                <CheckCircle
                  v-if="copiedId === media.id"
                  class="w-4 h-4 text-green-500"
                />
                <Copy v-else class="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                @click="openMediaDetails(media)"
                title="View details"
              >
                <MoreHorizontal class="w-4 h-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Media Detail Modal -->
    <Dialog :open="showMediaModal" @update:open="showMediaModal = $event">
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Media Details</DialogTitle>
        </DialogHeader>

        <div class="py-4" v-if="selectedMedia">
          <!-- Preview for images -->
          <div
            v-if="selectedMedia.mediaType === 'image'"
            class="mb-4 flex justify-center"
          >
            <img
              :src="getPreviewUrl(selectedMedia)"
              :alt="selectedMedia.displayName"
              class="max-h-64 object-contain rounded-md border border-border"
            />

            <!-- Full resolution button if thumbnail is shown -->
            <Button
              v-if="
                getPreviewUrl(selectedMedia) !== selectedMedia.originalCdnUrl
              "
              size="sm"
              variant="outline"
              class="absolute top-2 right-2"
              @click="window.open(selectedMedia.originalCdnUrl, '_blank')"
            >
              View Full Resolution
            </Button>
          </div>

          <!-- Preview for videos -->
          <div
            v-else-if="selectedMedia.mediaType === 'video'"
            class="mb-4 flex justify-center"
          >
            <video
              :src="selectedMedia.originalCdnUrl"
              controls
              class="max-h-64 object-contain rounded-md border border-border"
            ></video>
          </div>

          <!-- File details -->
          <div class="grid grid-cols-2 gap-2 mt-4">
            <div class="text-sm font-medium">Filename:</div>
            <div class="text-sm">{{ selectedMedia.displayName }}</div>

            <div class="text-sm font-medium">Original path:</div>
            <div class="text-sm break-all">
              {{ selectedMedia.originalPath }}
            </div>

            <div class="text-sm font-medium">Selected Size URL:</div>
            <div class="text-sm break-all flex items-center">
              <span class="truncate flex-grow">{{
                getPreferredCdnUrl(selectedMedia)
              }}</span>
              <Button
                variant="ghost"
                size="sm"
                @click="copyToClipboard(getPreferredCdnUrl(selectedMedia))"
                class="ml-2 flex-shrink-0"
              >
                <Copy class="w-4 h-4" />
              </Button>
            </div>

            <div class="text-sm font-medium">Type:</div>
            <div class="text-sm">
              {{ selectedMedia.mediaType }} ({{ selectedMedia.extension }})
            </div>

            <div class="text-sm font-medium">Dimensions:</div>
            <div class="text-sm">{{ selectedMedia.dimensions }}</div>

            <div class="text-sm font-medium">Size:</div>
            <div class="text-sm">{{ selectedMedia.fileSize }}</div>

            <!-- Available sizes section -->
            <div
              v-if="getAvailableSizes(selectedMedia).length > 0"
              class="col-span-2 mt-4 border-t pt-4"
            >
              <h4 class="font-medium mb-2">Available Sizes:</h4>
              <div class="grid grid-cols-2 gap-2">
                <!-- Original size row -->
                <div class="text-sm font-medium">Original:</div>
                <div class="text-sm flex items-center">
                  <span class="truncate flex-grow">
                    Original file ({{ selectedMedia.fileSize }})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="copyToClipboard(selectedMedia.originalCdnUrl)"
                    class="ml-2 flex-shrink-0"
                    title="Copy URL"
                  >
                    <Copy class="w-4 h-4" />
                  </Button>
                </div>

                <!-- Other available sizes -->
                <template
                  v-for="sizeKey in getAvailableSizes(selectedMedia)"
                  :key="sizeKey"
                >
                  <div class="text-sm font-medium">
                    {{ formatSizeLabel(sizeKey) }}:
                    <span
                      v-if="sizeKey === defaultSize"
                      class="text-xs bg-blue-100 px-1 rounded ml-1"
                    >
                      Default
                    </span>
                  </div>
                  <div class="text-sm flex items-center">
                    <span class="truncate flex-grow">
                      {{ selectedMedia.sizes[sizeKey][0].width }}×{{
                        selectedMedia.sizes[sizeKey][0].height
                      }}
                      ({{
                        formatFileSize(selectedMedia.sizes[sizeKey][0].size)
                      }})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      @click="
                        copyToClipboard(selectedMedia.sizes[sizeKey][0].cdnUrl)
                      "
                      class="ml-2 flex-shrink-0"
                      title="Copy URL"
                    >
                      <Copy class="w-4 h-4" />
                    </Button>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showMediaModal = false">
            Close
          </Button>
          <Button @click="copyMediaUrl(selectedMedia)">
            <span class="flex items-center gap-2">
              <Copy class="w-4 h-4" />
              Copy URL
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
</style>
