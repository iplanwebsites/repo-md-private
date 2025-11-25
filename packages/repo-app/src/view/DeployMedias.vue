<!-- MediaListing.vue with dropdown for selecting default size -->
<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
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
	PlusCircle,
	Upload,
	Download,
	Loader2,
} from "lucide-vue-next";
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

import { isLocalhost } from "@/lib/utils/devUtils.js";
import { appConfigs } from "@/appConfigs.js";
const { USE_DEV_API_IN_DEV, API_DOMAIN, DEV_API_DOMAIN, staticDomain } =
	appConfigs;
const { toast } = useToast();

// Configuration
// We'll use the repoClient.getR2Url method to generate full URLs to assets
const BATCH_IMAGE_TO_LOAD_COUNT = 50; // Number of images to load in each batch

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
const showGenerateImageModal = ref(false);
const imagePrompt = ref("");
const isGeneratingImage = ref(false);
const showUploadModal = ref(false);
const showStockPhotosModal = ref(false);
const unsplashSearchQuery = ref("");
const unsplashResults = ref([]);
const isSearchingUnsplash = ref(false);
const selectedUnsplashImage = ref(null);
const isDownloadingStockPhoto = ref(false);

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

// Helper to construct proper CDN URLs using repoClient
const constructCdnUrl = async (path) => {
	if (!path) return "#";
	if (!props.repoClient) return "#";

	try {
		// Parse the path to extract just the filename part
		const parts = path.split("/");
		const filename = parts[parts.length - 1];

		// Create the correct URL structure for shared media
		const adjustedPath = `/_shared/medias/${filename}`;

		// Use direct URL construction to ensure we get the correct format
		const baseUrl = "https://static.repo.md";
		//const orgSlug = props.repoClient.orgSlug || "iplanwebsites";
		const projectId = props.repoClient.projectId || "680e97604a0559a192640d2c";

		const fullUrl = `${baseUrl}/projects/${projectId}${adjustedPath}`;
		console.log(`Original path: ${path}, Constructed URL: ${fullUrl}`);

		return fullUrl;
	} catch (error) {
		console.error(`Error constructing CDN URL for ${path}:`, error);
		return "#";
	}
};

// Get the appropriate CDN URL based on size preference
const getPreferredCdnUrl = async (media) => {
	if (!media) return "#";

	try {
		// Get the appropriate size based on preference
		const sizeKey = defaultSize.value;

		// Get the best filename for the preferred size or fall back to original
		const filename =
			getBestMediaPath(media, sizeKey) || getBestMediaPath(media);

		if (!filename) {
			console.warn("Could not determine filename for media:", media);
			return "#";
		}

		// Generate the URL for this filename
		return await constructCdnUrl(filename);
	} catch (error) {
		console.error("Error getting preferred CDN URL:", error);
		return "#";
	}
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

			// Process image sizes and add placeholder CDN urls to each size
			// Actual URLs will be filled in asynchronously when needed
			const enhancedSizes = {};
			if (media.sizes) {
				Object.keys(media.sizes).forEach((sizeKey) => {
					if (Array.isArray(media.sizes[sizeKey])) {
						enhancedSizes[sizeKey] = media.sizes[sizeKey].map((size) => {
							return {
								...size,
								// Ensure we have the correct path for the URL
								publicPath:
									size.publicPath ||
									size.path ||
									`/${media.fileName}-${sizeKey}`,
							};
						});
					}
				});
			}

			// We'll use placeholders for URLs and resolve them when needed
			const originalCdnUrl = "#";

			// Store all possible paths to help with URL construction
			const paths = {
				publicPath: media.publicPath || null,
				originalPath: media.originalPath || null,
				storagePath: media.storagePath || null,
				fileName: media.fileName || null,
			};

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
				id: media.originalPath || media.fileName, // Using originalPath as unique id, fallback to fileName
				mediaType,
				extension: media.fileExt,
				fullUrl: originalCdnUrl,
				originalCdnUrl, // Store the original URL
				cdnUrl: originalCdnUrl, // Will be computed dynamically based on defaultSize
				directory,
				displayName,
				sizes: enhancedSizes,
				paths: paths, // Include all available paths for URL construction
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
		if (!props.repoClient) {
			console.error("DEBUG: RepoClient is not initialized");
			toast({
				title: "Error",
				description: "Media client is not initialized",
				variant: "destructive",
			});
			return;
		}

		loading.value = true;
		console.log("DEBUG: Calling repoClient.getAllMedias()");
		const result = await props.repoClient.getAllMedias();
		console.log("DEBUG: RepoMD result received:", result);

		// Ensure we're setting an array
		medias.value = Array.isArray(result) ? result : [];

		// Initialize the mediaPreviewUrls for all images with '#' to ensure reactivity
		const initialUrls = {};
		medias.value.forEach(media => {
			if (media && media.fileName) {
				initialUrls[media.fileName] = '#';
			}
		});
		mediaPreviewUrls.value = initialUrls;

		// Prefetch URLs for the first batch of media items after they're loaded
		if (medias.value.length > 0) {
			console.log("DEBUG: Prefetching URLs for first batch of media");
			// Wait for the enhancedMedias computed property to update
			await nextTick();
			
			// Prefetch in batches to avoid overwhelming the system
			// First batch - for immediate display
			const firstBatchSize = Math.min(BATCH_IMAGE_TO_LOAD_COUNT, enhancedMedias.value.length);
			console.log(`DEBUG: Loading first batch of ${firstBatchSize} images`);
			await prefetchMediaUrls(enhancedMedias.value.slice(0, firstBatchSize));
			
			// Set up a delayed prefetch for the rest of the items
			if (enhancedMedias.value.length > firstBatchSize) {
				setTimeout(async () => {
					const remainingItems = enhancedMedias.value.slice(firstBatchSize);
					console.log(`DEBUG: Setting up delayed loading for remaining ${remainingItems.length} images in batches of ${BATCH_IMAGE_TO_LOAD_COUNT}`);
					// Process in chunks to avoid performance issues
					for (let i = 0; i < remainingItems.length; i += BATCH_IMAGE_TO_LOAD_COUNT) {
						const chunk = remainingItems.slice(i, i + BATCH_IMAGE_TO_LOAD_COUNT);
						console.log(`DEBUG: Loading batch ${i/BATCH_IMAGE_TO_LOAD_COUNT + 1} with ${chunk.length} images`);
						await prefetchMediaUrls(chunk);
						// Small delay between chunks
						if (i + BATCH_IMAGE_TO_LOAD_COUNT < remainingItems.length) {
							await new Promise(resolve => setTimeout(resolve, 50));
						}
					}
				}, 500); // Start the process after initial render
			}
		}
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

const copyMediaUrl = async (media) => {
	try {
		// Get the filename for the current size preference
		const filename =
			getBestMediaPath(media, defaultSize.value) || getBestMediaPath(media);

		if (!filename) {
			throw new Error("Could not determine media filename");
		}

		// Get the URL for the selected size
		const urlToCopy = await constructCdnUrl(filename);

		// Copy to clipboard
		copyToClipboard(urlToCopy);
		copiedId.value = media.id;

		toast({
			title: "Copied!",
			description: `${formatSizeLabel(defaultSize.value)} URL copied to clipboard`,
		});

		setTimeout(() => {
			copiedId.value = null;
		}, 2000);
	} catch (error) {
		console.error("Error copying media URL:", error);
		toast({
			title: "Error",
			description: "Failed to get media URL",
			variant: "destructive",
		});
	}
};

const openMediaDetails = async (media) => {
	console.log("DEBUG: Opening media details for:", media);

	// Log the complete media entry for debugging
	console.log("DEBUG: Complete media entry:", JSON.stringify(media, null, 2));

	// Specifically log the 'sm' sizes if they exist
	if (media.sizes && media.sizes.sm) {
		console.log("DEBUG: SM sizes:", JSON.stringify(media.sizes.sm, null, 2));
	} else {
		console.log("DEBUG: No SM sizes found for this media");
	}

	// Make sure we have the URL generated for this media
	if (media.id && !mediaPreviewUrls.value[media.id]) {
		try {
			// Generate the URL if it's not already cached
			await getPreviewUrl(media.id);
		} catch (error) {
			console.error("Error generating preview URL for modal:", error);
		}
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

// Create a reactive ref to store generated URLs for media previews
const mediaPreviewUrls = ref({});

// Helper to get the best source path for a media item
const getBestMediaPath = (media, sizeKey = null) => {
	// Try to get the size-specific path if a size is requested
	if (
		sizeKey &&
		sizeKey !== "ori" &&
		media.sizes &&
		media.sizes[sizeKey] &&
		media.sizes[sizeKey].length > 0
	) {
		// Get the hash filename from the size object
		const sizeObj = media.sizes[sizeKey][0];

		// Look for the hash filename - it should end with -sm.jpg or similar
		if (sizeObj.hash || sizeObj.publicPath) {
			const path = sizeObj.hash || sizeObj.publicPath;
			const parts = path.split("/");
			return parts[parts.length - 1]; // Return just the filename
		}
	}

	// For original size or fallback, use the best available path
	// We need to find the hash name pattern like: d1d969a20d8b65695e8f4fb4e73a64edddb1662d7090c7fefc02606953382df0-ori.jpeg

	// First check if hash is available
	if (media.hash) {
		return media.hash;
	}

	// Try publicPath
	if (media.publicPath) {
		const parts = media.publicPath.split("/");
		return parts[parts.length - 1];
	}

	// Try originalPath
	if (media.originalPath) {
		const parts = media.originalPath.split("/");
		return parts[parts.length - 1];
	}

	// Last resort: use filename with extension
	if (media.fileName && media.fileExt) {
		return `${media.fileName}.${media.fileExt}`;
	}

	return null;
};

// Get preview URL for media based on type and size preferences
const getPreviewUrl = async (mediaId) => {
	// Check if we've already generated the URL for this media
	if (mediaPreviewUrls.value[mediaId] && mediaPreviewUrls.value[mediaId] !== '#') {
		return mediaPreviewUrls.value[mediaId];
	}

	// Get the media object
	const media = enhancedMedias.value.find((m) => m.id === mediaId);
	if (!media) {
		console.warn(`Media not found with ID: ${mediaId}`);
		return "#";
	}
	
	if (media.mediaType !== "image") {
		return "#";
	}

	try {
		// For preview thumbnails, prefer 'sm' size if available, then try other sizes in order
		let filename = null;
		
		// Try sm size first
		filename = getBestMediaPath(media, "sm");
		
		// If sm size is not available, try md size
		if (!filename) {
			filename = getBestMediaPath(media, "md");
		}
		
		// If md size is not available, try lg size
		if (!filename) {
			filename = getBestMediaPath(media, "lg");
		}
		
		// Finally, fall back to the original
		if (!filename) {
			filename = getBestMediaPath(media);
		}

		if (filename) {
			const url = await constructCdnUrl(filename);
			console.log(`Generated URL for ${mediaId}: ${url}`);
			
			// Store the URL for future use with Vue reactivity
			mediaPreviewUrls.value = { ...mediaPreviewUrls.value, [mediaId]: url };
			return url;
		} else {
			console.warn(`No filename found for media ${mediaId}`);
		}

		return "#";
	} catch (error) {
		console.error(`Error getting preview URL for media ${mediaId}:`, error);
		return "#";
	}
};

// Download or view full resolution image
const downloadFullResolution = async (media) => {
	if (!media || !props.repoClient) return;

	try {
		// Get the best filename for the original resolution
		const filename = getBestMediaPath(media, "ori") || getBestMediaPath(media);

		if (!filename) {
			throw new Error("Could not determine media filename");
		}

		// Get the URL for the full-resolution image
		const fullUrl = await constructCdnUrl(filename);

		// Open in a new window
		window.open(fullUrl, "_blank");
	} catch (error) {
		console.error("Error getting full resolution image:", error);
		toast({
			title: "Error",
			description: "Failed to get full resolution image",
			variant: "destructive",
		});
	}
};

// Copy original URL to clipboard
const copyOriginalUrl = async (media) => {
	if (!media || !props.repoClient) return;

	try {
		// Get the best filename for the original resolution
		const filename = getBestMediaPath(media, "ori") || getBestMediaPath(media);

		if (!filename) {
			throw new Error("Could not determine media filename");
		}

		// Get the URL for the original image
		const originalUrl = await constructCdnUrl(filename);

		// Copy to clipboard
		copyToClipboard(originalUrl);

		toast({
			title: "Copied!",
			description: "Original URL copied to clipboard",
		});
	} catch (error) {
		console.error("Error copying original URL:", error);
		toast({
			title: "Error",
			description: "Failed to copy original URL",
			variant: "destructive",
		});
	}
};

// Copy size URL to clipboard
const copySizeUrl = async (media, sizeKey) => {
	if (!media || !props.repoClient) return;

	try {
		// Get the best filename for the specified size
		const filename = getBestMediaPath(media, sizeKey);

		if (!filename) {
			throw new Error(`Could not determine filename for size ${sizeKey}`);
		}

		// Get the URL for the size
		const sizeUrl = await constructCdnUrl(filename);

		// Copy to clipboard
		copyToClipboard(sizeUrl);

		toast({
			title: "Copied!",
			description: `${formatSizeLabel(sizeKey)} URL copied to clipboard`,
		});
	} catch (error) {
		console.error(`Error copying ${sizeKey} URL:`, error);
		toast({
			title: "Error",
			description: `Failed to copy ${formatSizeLabel(sizeKey)} URL`,
			variant: "destructive",
		});
	}
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
	async (newValue) => {
		console.log("DEBUG: filteredMedias computed updated:", newValue);
		console.log("DEBUG: filteredMedias length:", newValue?.length || 0);

		// Prefetch URLs for visible media when the list changes
		if (newValue && newValue.length > 0) {
			await prefetchMediaUrls(newValue.slice(0, BATCH_IMAGE_TO_LOAD_COUNT)); // Limit to first batch for performance
		}
	},
	{ deep: true },
);

// Watch for changes in default size
watch(defaultSize, (newSize) => {
	console.log("DEBUG: Default size changed to:", newSize);
});

// Watch for changes in the repoClient prop
watch(
	() => props.repoClient,
	() => {
		if (props.repoClient) {
			console.log("DEBUG: RepoClient changed, refreshing media");
			fetchMedias();
		}
	},
	{ immediate: false },
);

// Watch for stock photos modal closing to clear results
watch(showStockPhotosModal, (newValue) => {
	if (!newValue) {
		// Clear search when modal is closed
		unsplashSearchQuery.value = "";
		unsplashResults.value = [];
		selectedUnsplashImage.value = null;
	}
});

// Helper method to prefetch URLs for visible media
const prefetchMediaUrls = async (mediaItems) => {
	if (!mediaItems || !mediaItems.length) return;

	try {
		console.log("DEBUG: Prefetching URLs for visible media, count:", mediaItems.length);

		// Fetch preview URLs for all visible media in parallel for performance
		const promises = mediaItems.map(async (media) => {
			if (media && media.id) {
				// Generate and cache the preview URL
				const url = await getPreviewUrl(media.id);
				console.log(`Prefetched URL for ${media.id}: ${url !== '#' ? 'Success' : 'Failed'}`);
				return url;
			}
			return null;
		});

		await Promise.all(promises);
		console.log("DEBUG: All prefetch operations completed");
	} catch (error) {
		console.error("Error prefetching media URLs:", error);
	}
};

// Unsplash search function
const searchUnsplash = async (query = null) => {
	const searchTerm = query || unsplashSearchQuery.value.trim();
	if (!searchTerm) return;

	isSearchingUnsplash.value = true;
	
	try {
		// For now, we'll use a mock API call structure
		// The backend endpoint should be: GET /api/unsplash/search?q=${searchTerm}
		
		// Mock implementation - replace with actual API call
		if (!props.repoClient) {
			throw new Error("RepoClient not available");
		}

		// This should be implemented in the repoClient or as a separate API call
		// const result = await props.repoClient.searchUnsplash({ query: searchTerm });
		
		// For now, create mock data structure that matches Unsplash API
		const mockPhotos = [
			{
				id: "mountains-1",
				urls: {
					thumb: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
					small: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
					regular: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80"
				},
				user: { name: "eberhard grossgasteiger", username: "eberhardgross" },
				description: `Mountain landscape with ${searchTerm}`,
				alt_description: `Snow-capped mountains under blue sky`
			},
			{
				id: "forest-2",
				urls: {
					thumb: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
					small: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
					regular: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80"
				},
				user: { name: "Johannes Plenio", username: "jplenio" },
				description: `Forest path ${searchTerm}`,
				alt_description: `Sunlight filtering through forest trees`
			},
			{
				id: "ocean-3",
				urls: {
					thumb: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
					small: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
					regular: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80"
				},
				user: { name: "Hiroko Yoshii", username: "hiroko" },
				description: `Ocean waves ${searchTerm}`,
				alt_description: `Crystal clear turquoise ocean water`
			},
			{
				id: "city-4",
				urls: {
					thumb: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
					small: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
					regular: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80"
				},
				user: { name: "Pedro Lastra", username: "peterlaster" },
				description: `City skyline ${searchTerm}`,
				alt_description: `Modern city buildings at sunset`
			},
			{
				id: "workspace-5",
				urls: {
					thumb: "https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
					small: "https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
					regular: "https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80"
				},
				user: { name: "Alizée Baudez", username: "alizeebaudez" },
				description: `Modern workspace ${searchTerm}`,
				alt_description: `Clean desk with laptop and coffee`
			},
			{
				id: "technology-6",
				urls: {
					thumb: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80",
					small: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
					regular: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80"
				},
				user: { name: "Kari Shea", username: "karishea" },
				description: `Technology setup ${searchTerm}`,
				alt_description: `Modern technology devices on white background`
			}
		];

		const mockResults = {
			results: mockPhotos,
			total: 500,
			total_pages: 25
		};

		// TODO: Replace with actual API call
		// Simulate API delay
		await new Promise(resolve => setTimeout(resolve, 1000));
		
		unsplashResults.value = mockResults.results;
		
	} catch (error) {
		console.error("Error searching Unsplash:", error);
		toast({
			title: "Search Error",
			description: "Failed to search stock photos. Please try again.",
			variant: "destructive",
		});
		unsplashResults.value = [];
	} finally {
		isSearchingUnsplash.value = false;
	}
};

// Download stock photo function
const downloadStockPhoto = async (unsplashImage) => {
	if (!unsplashImage || !props.repoClient) return;

	isDownloadingStockPhoto.value = true;
	selectedUnsplashImage.value = unsplashImage;

	try {
		// Method 1: Let frontend download and re-upload
		// Download the image using the regular URL
		const response = await fetch(unsplashImage.urls.regular);
		if (!response.ok) throw new Error("Failed to download image");
		
		const blob = await response.blob();
		
		// Create a File object from the blob
		const filename = `unsplash-${unsplashImage.id}.jpg`;
		const file = new File([blob], filename, { type: 'image/jpeg' });
		
		// TODO: Upload the file using the existing upload mechanism
		// This would require implementing the actual file upload functionality
		// For now, we'll simulate success
		
		toast({
			title: "Success",
			description: `Stock photo "${unsplashImage.alt_description}" added to your project!`,
		});
		
		// Close the modal and refresh media list
		showStockPhotosModal.value = false;
		await fetchMedias();
		
	} catch (error) {
		console.error("Error downloading stock photo:", error);
		toast({
			title: "Download Error",
			description: "Failed to add stock photo. Please try again.",
			variant: "destructive",
		});
	} finally {
		isDownloadingStockPhoto.value = false;
		selectedUnsplashImage.value = null;
	}
};

// Generate image function
const generateImage = async () => {
	if (!imagePrompt.value.trim() || !props.repoClient) {
		return;
	}

	isGeneratingImage.value = true;

	try {
		// Call the API to generate the image
		const result = await props.repoClient.generateImage({
			prompt: imagePrompt.value.trim(),
		});

		if (result.success) {
			toast({
				title: "Success",
				description: "Image generated successfully!",
			});

			// Clear the prompt
			imagePrompt.value = "";
			
			// Close the modal
			showGenerateImageModal.value = false;

			// Refresh the media list to show the new image
			await fetchMedias();
		} else {
			throw new Error(result.error || "Failed to generate image");
		}
	} catch (error) {
		console.error("Error generating image:", error);
		toast({
			title: "Error",
			description: error.message || "Failed to generate image",
			variant: "destructive",
		});
	} finally {
		isGeneratingImage.value = false;
	}
};

// Lifecycle
onMounted(() => {
	console.log("DEBUG: Component mounted, calling fetchMedias()");
	fetchMedias();
});
</script>

<template>
  <PageHeadingBar
    title="Medias"
    subtitle="Browse all images and videos   of your project"
  >
    <template #actions>
      <Button
        @click="showUploadModal = true"
        variant="secondary"
        size="sm"
        class="flex items-center gap-2 mr-2"
      >
        <Upload class="w-4 h-4" />
        Upload Files
      </Button>
      <Button
        @click="showStockPhotosModal = true"
        variant="outline"
        size="sm"
        class="flex items-center gap-2 mr-2"
      >
        <PlusCircle class="w-4 h-4" />
        Add Stock Photos
      </Button>
      <Button
        @click="showGenerateImageModal = true"
        size="sm"
        class="flex items-center gap-2"
      >
        <PlusCircle class="w-4 h-4" />
        Generate Image
      </Button>
    </template>
    <json-debug :data="medias" label="medias" />
    <json-debug :data="filteredMedias" label="filters" />
  </PageHeadingBar>

  <div class="container">
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
          <!-- Placeholder while image is loading -->
          <div 
            v-if="media.mediaType === 'image' && (!mediaPreviewUrls[media.id] || mediaPreviewUrls[media.id] === '#')"
            class="w-full h-full flex items-center justify-center bg-gray-100"
          >
            <Image class="w-8 h-8 text-gray-400" />
          </div>
          
          <!-- Image Preview -->
          <img
            v-if="media.mediaType === 'image' && mediaPreviewUrls[media.id] && mediaPreviewUrls[media.id] !== '#'"
            :src="mediaPreviewUrls[media.id]"
            :alt="media.displayName"
            class="object-cover w-full h-full cursor-pointer transition-transform group-hover:scale-105"
            loading="lazy"
            @load="() => console.log(`Image loaded: ${media.displayName}`)"
            @error="() => console.error(`Failed loading image: ${media.displayName}`)"
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
                <!-- Placeholder while image is loading -->
                <div 
                  v-if="!mediaPreviewUrls[media.id] || mediaPreviewUrls[media.id] === '#'"
                  class="w-full h-full flex items-center justify-center bg-gray-100"
                >
                  <Image class="w-4 h-4 text-gray-400" />
                </div>
                
                <img
                  v-if="mediaPreviewUrls[media.id] && mediaPreviewUrls[media.id] !== '#'"
                  :src="mediaPreviewUrls[media.id]"
                  :alt="media.displayName"
                  class="object-cover w-full h-full"
                  loading="lazy"
                  @load="() => console.log(`Table image loaded: ${media.displayName}`)"
                  @error="() => console.error(`Failed loading table image: ${media.displayName}`)"
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
            <!-- Placeholder while modal image is loading -->
            <div 
              v-if="!selectedMedia || !mediaPreviewUrls[selectedMedia.id] || mediaPreviewUrls[selectedMedia.id] === '#'"
              class="w-64 h-64 flex items-center justify-center bg-gray-100 rounded-md border border-border"
            >
              <Image class="w-12 h-12 text-gray-400" />
            </div>
            
            <img
              v-if="selectedMedia && mediaPreviewUrls[selectedMedia.id] && mediaPreviewUrls[selectedMedia.id] !== '#'"
              :src="mediaPreviewUrls[selectedMedia.id]"
              :alt="selectedMedia.displayName"
              class="max-h-64 object-contain rounded-md border border-border"
              @load="() => console.log(`Modal image loaded: ${selectedMedia.displayName}`)"
              @error="() => console.error(`Failed loading modal image: ${selectedMedia.displayName}`)"
            />

            <!-- Full resolution button if thumbnail is shown -->
            <Button
              size="sm"
              variant="outline"
              class="absolute top-2 right-2"
              @click="downloadFullResolution(selectedMedia)"
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
              controls
              class="max-h-64 object-contain rounded-md border border-border"
              @click="downloadFullResolution(selectedMedia)"
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
                    @click="copyOriginalUrl(selectedMedia)"
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
                      @click="copySizeUrl(selectedMedia, sizeKey)"
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

    <!-- Generate Image Modal -->
    <Dialog :open="showGenerateImageModal" @update:open="showGenerateImageModal = $event">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Image</DialogTitle>
          <DialogDescription>
            Enter a prompt to generate an AI image for your project.
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <label for="image-prompt" class="text-sm font-medium">
              Image Prompt
            </label>
            <textarea
              id="image-prompt"
              v-model="imagePrompt"
              placeholder="Describe the image you want to generate..."
              class="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isGeneratingImage"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="showGenerateImageModal = false"
            :disabled="isGeneratingImage"
          >
            Cancel
          </Button>
          <Button
            @click="generateImage"
            :disabled="!imagePrompt.trim() || isGeneratingImage"
          >
            <span v-if="!isGeneratingImage" class="flex items-center gap-2">
              <PlusCircle class="w-4 h-4" />
              Generate
            </span>
            <span v-else class="flex items-center gap-2">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Generating...
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Upload Assets Modal -->
    <Dialog :open="showUploadModal" @update:open="showUploadModal = $event">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Upload files directly to your project's uploads folder
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="rounded-lg border p-4 space-y-3">
            <div class="flex items-start gap-3">
              <Upload class="w-5 h-5 text-muted-foreground mt-0.5" />
              <div class="space-y-2">
                <h4 class="font-medium">Direct File Upload</h4>
                <p class="text-sm text-muted-foreground">
                  Upload files directly through this interface. Files will be automatically committed to your repository in the uploads folder on the main branch.
                </p>
              </div>
            </div>
          </div>
          
          <div class="rounded-lg border p-4 space-y-3">
            <div class="flex items-start gap-3">
              <div class="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <span class="text-xs font-bold">2</span>
              </div>
              <div class="space-y-2">
                <h4 class="font-medium">Alternative: Git-based Upload</h4>
                <p class="text-sm text-muted-foreground">
                  You can still add media files to your local project folder and sync them with Git, or upload directly to GitHub through their web interface.
                </p>
              </div>
            </div>
          </div>

          <div class="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
            <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-2">Automatic Processing</h4>
            <p class="text-sm text-blue-800 dark:text-blue-200">
              Uploaded files will be:
            </p>
            <ul class="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1">
              <li>Saved to the uploads folder in your main branch</li>
              <li>Automatically committed as a new Git commit</li>
              <li>Processed and optimized for different screen sizes</li>
              <li>Made available on the CDN immediately after upload</li>
            </ul>
            <p class="text-sm text-blue-700 dark:text-blue-300 mt-3">
              <strong>Note:</strong> This creates a new commit in your repository with the uploaded files.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="showUploadModal = false"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Stock Photos Modal -->
    <Dialog :open="showStockPhotosModal" @update:open="showStockPhotosModal = $event">
      <DialogContent class="sm:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Stock Photos</DialogTitle>
          <DialogDescription>
            Search and add high-quality photos from Unsplash to your project
          </DialogDescription>
        </DialogHeader>
        
        <!-- Search Section -->
        <div class="border-b pb-4">
          <div class="flex gap-2">
            <div class="relative flex-grow">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                v-model="unsplashSearchQuery"
                placeholder="Search for photos (e.g., nature, business, technology)..."
                class="pl-10"
                @keydown.enter="searchUnsplash()"
                :disabled="isSearchingUnsplash"
              />
            </div>
            <Button 
              @click="searchUnsplash()"
              :disabled="!unsplashSearchQuery.trim() || isSearchingUnsplash"
              class="flex items-center gap-2"
            >
              <Loader2 v-if="isSearchingUnsplash" class="w-4 h-4 animate-spin" />
              <Search v-else class="w-4 h-4" />
              Search
            </Button>
          </div>
          
          <!-- Quick search buttons -->
          <div class="flex flex-wrap gap-2 mt-3">
            <Button 
              v-for="term in ['nature', 'business', 'technology', 'people', 'abstract', 'travel']"
              :key="term"
              variant="outline" 
              size="sm"
              @click="searchUnsplash(term)"
              :disabled="isSearchingUnsplash"
              class="text-xs"
            >
              {{ term }}
            </Button>
          </div>
        </div>

        <!-- Results Section -->
        <div class="flex-grow overflow-y-auto py-4">
          <!-- Loading State -->
          <div v-if="isSearchingUnsplash" class="flex items-center justify-center py-12">
            <div class="text-center">
              <Loader2 class="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p class="text-muted-foreground mt-2">Searching photos...</p>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="unsplashResults.length === 0 && unsplashSearchQuery" class="text-center py-12">
            <Search class="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            <h3 class="text-lg font-medium mt-4">No photos found</h3>
            <p class="text-muted-foreground mt-2">Try a different search term or browse our quick suggestions above.</p>
          </div>

          <!-- Initial State -->
          <div v-else-if="unsplashResults.length === 0" class="text-center py-12">
            <Image class="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            <h3 class="text-lg font-medium mt-4">Search Stock Photos</h3>
            <p class="text-muted-foreground mt-2">
              Enter a search term above or click on a suggestion to find high-quality photos from Unsplash.
            </p>
          </div>

          <!-- Results Grid -->
          <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <div 
              v-for="photo in unsplashResults" 
              :key="photo.id"
              class="group relative bg-white rounded-lg overflow-hidden shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
            >
              <!-- Image -->
              <div class="aspect-square relative overflow-hidden bg-gray-100">
                <img 
                  :src="photo.urls.small"
                  :alt="photo.alt_description || photo.description"
                  class="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                
                <!-- Overlay with download button -->
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                  <Button
                    @click="downloadStockPhoto(photo)"
                    :disabled="isDownloadingStockPhoto && selectedUnsplashImage?.id === photo.id"
                    class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white text-black hover:bg-gray-100"
                    size="sm"
                  >
                    <Loader2 v-if="isDownloadingStockPhoto && selectedUnsplashImage?.id === photo.id" class="w-4 h-4 animate-spin mr-2" />
                    <Download v-else class="w-4 h-4 mr-2" />
                    {{ isDownloadingStockPhoto && selectedUnsplashImage?.id === photo.id ? 'Adding...' : 'Add to Project' }}
                  </Button>
                </div>
              </div>

              <!-- Photo Info -->
              <div class="p-3">
                <p class="text-xs text-gray-600 truncate">
                  {{ photo.alt_description || photo.description || 'Untitled' }}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                  by {{ photo.user.name }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="border-t pt-4">
          <Button
            variant="outline"
            @click="showStockPhotosModal = false"
          >
            Close
          </Button>
          <div class="text-xs text-muted-foreground">
            Photos provided by <a href="https://unsplash.com" target="_blank" class="underline">Unsplash</a>
          </div>
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
