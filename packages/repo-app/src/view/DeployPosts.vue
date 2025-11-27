<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useToast } from "@/components/ui/toast/use-toast";
import { Card } from "@/components/ui/card";
import { formatFileSize } from "@/lib/utils/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CodeBlock from "@/components/CodeBlock.vue";
import { useRouter, useRoute } from "vue-router";
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
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import {
	Search,
	Filter,
	Copy,
	CheckCircle,
	FileText,
	File,
	MoreHorizontal,
	ListIcon,
	GridIcon,
	Calendar,
	Tag,
	ExternalLink,
	Eye,
	Edit,
	Clock,
	ImageIcon,
	AlertCircle,
} from "lucide-vue-next";
// No need to import RepoMD here anymore

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
	project: {
		type: Object,
		default: null,
	},
});

// Define emits to parent
const emit = defineEmits(["refresh"]);

// Router for navigation
const router = useRouter();
const route = useRoute();

import { isLocalhost } from "@/lib/utils/devUtils.js";
import { appConfigs } from "@/appConfigs.js";
const { USE_DEV_API_IN_DEV, API_DOMAIN, DEV_API_DOMAIN, staticDomain } =
	appConfigs;
const { toast } = useToast();

// Configuration
const API_BASE_URL = staticDomain;

// State
const loading = ref(true);
const posts = ref([]);
const searchQuery = ref("");
const copiedUrl = ref(null);
const selectedPostType = ref("all");
const showPostModal = ref(false);
const selectedPost = ref(null);
const viewMode = ref("list"); // 'grid' for card view, 'list' for table view
const currentModalTab = ref("preview"); // 'preview', 'html', 'json'

// Post types for filtering
const postTypes = computed(() => {
	const types = new Set(
		posts.value.map((post) => {
			if (!post || !post.contentType) {
				return "unknown";
			}
			return post.contentType;
		}),
	);
	const typesArray = Array.from(types);
	return typesArray;
});

// Helper to construct proper site URLs
const constructPostUrl = (slug) => {
	if (!slug) return "#";
	return `${API_BASE_URL}/${slug}`;
};

// Enhanced post list with computed properties
const enhancedPosts = computed(() => {
	if (!Array.isArray(posts.value)) {
		console.error("DEBUG: posts.value is not an array:", posts.value);
		return [];
	}

	const enhanced = posts.value
		.map((post) => {
			if (!post) {
				console.warn("DEBUG: Found null or undefined post item");
				return null;
			}

			// Format date
			const formattedDate = post.publishedAt
				? new Date(post.publishedAt).toLocaleDateString()
				: post.createdAt
					? new Date(post.createdAt).toLocaleDateString()
					: "Unknown";

			// Get title from frontmatter or filename
			const title =
				post.frontmatter?.title || post.title || post.fileName || "Untitled";

			// Get excerpt from firstParagraphText or description
			const excerpt =
				post.firstParagraphText ||
				post.excerpt ||
				post.description ||
				"No description available";

			// Word count display
			const wordCount = post.wordCount ? `${post.wordCount} words` : "Unknown";

			// Read time estimate (either from post data or calculate from word count)
			const readTime = post.readingTime
				? `${Math.round(post.readingTime)} min`
				: post.wordCount
					? `${Math.round(post.wordCount / 200)} min` // Approx. 200 words per min
					: "Unknown";

			// Get author from frontmatter or default
			const author =
				post.frontmatter?.author ||
				post.frontmatter?.name ||
				post.author ||
				"Unknown";

			// Get tags from frontmatter or post
			const tags = post.frontmatter?.tags || post.tags || [];

			// Check if post is public/draft
			const isPublic =
				post.frontmatter?.public !== undefined
					? post.frontmatter.public
					: post.public !== undefined
						? post.public
						: true;

			// Enhanced post with additional computed properties
			const enhancedPost = {
				...post,
				id: post.id || post._id || post.slug || post.fileName,
				displayTitle: title,
				displayDate: formattedDate,
				postUrl: constructPostUrl(post.slug || post.fileName),
				readTime,
				wordCount,
				author,
				tags: Array.isArray(tags)
					? tags
					: typeof tags === "string"
						? [tags]
						: [],
				excerpt,
				isPublic,
				status: isPublic ? "Published" : "Draft",
			};

			return enhancedPost;
		})
		.filter(Boolean); // Remove any null entries

	if (enhanced.length > 0) {
		console.log("DEBUG: First enhanced post sample:", enhanced[0]);
	}

	return enhanced;
});

// Filtered posts based on search and type filter
const filteredPosts = computed(() => {
	let filtered = enhancedPosts.value;

	// Filter by post type
	if (selectedPostType.value !== "all") {
		filtered = filtered.filter(
			(post) => post.contentType === selectedPostType.value,
		);
	}

	// Filter by search query
	if (searchQuery.value.trim()) {
		const query = searchQuery.value.toLowerCase();
		filtered = filtered.filter(
			(post) =>
				post.displayTitle.toLowerCase().includes(query) ||
				post.slug.toLowerCase().includes(query) ||
				(post.excerpt && post.excerpt.toLowerCase().includes(query)) ||
				(post.tags &&
					post.tags.some((tag) => tag.toLowerCase().includes(query))),
		);
	}

	return filtered;
});

// Methods
const fetchPosts = async () => {
	console.log("DEBUG: Starting fetchPosts()");
	try {
		if (!props.repoClient) {
			console.error("DEBUG: RepoClient is not initialized");
			toast({
				title: "Error",
				description: "Post client is not initialized",
				variant: "destructive",
			});
			return;
		}

		loading.value = true;
		console.log("DEBUG: Calling repoClient.getAllPosts()");
		const result = await props.repoClient.getAllPosts();
		console.log("DEBUG: RepoMD result received:", result);

		// Ensure we're setting an array
		posts.value = Array.isArray(result) ? result : [];
	} catch (error) {
		console.error("DEBUG: Error fetching posts:", error);
		toast({
			title: "Error",
			description: "Unable to load posts",
			variant: "destructive",
		});
	} finally {
		loading.value = false;
		console.log("DEBUG: fetchPosts completed. loading set to false");
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

const copyPostUrl = (post) => {
	const urlToCopy = post.postUrl;
	copyToClipboard(urlToCopy);
	copiedUrl.value = post.id;

	setTimeout(() => {
		copiedUrl.value = null;
	}, 2000);
};

const openPostDetails = (post) => {
	console.log("DEBUG: Opening post details for:", post);
	selectedPost.value = post;
	showPostModal.value = true;
	currentModalTab.value = "preview"; // Reset to preview tab
};

const formatHtml = (html) => {
	if (!html) return '';
	
	// Basic HTML formatting for better readability
	let formatted = html;
	
	// Add newlines after opening tags
	formatted = formatted.replace(/(<[^>]+>)(?=<)/g, '$1\n');
	
	// Add indentation
	const lines = formatted.split('\n');
	let indentLevel = 0;
	const formattedLines = [];
	
	for (let line of lines) {
		line = line.trim();
		if (!line) continue;
		
		// Decrease indent for closing tags
		if (line.match(/^<\/(div|p|h[1-6]|ul|ol|li|blockquote|section|article|header|footer|main|nav|aside)>/)) {
			indentLevel = Math.max(0, indentLevel - 1);
		}
		
		// Add current line with indentation
		formattedLines.push('  '.repeat(indentLevel) + line);
		
		// Increase indent for opening tags (not self-closing)
		if (line.match(/^<(div|p|h[1-6]|ul|ol|li|blockquote|section|article|header|footer|main|nav|aside)[^>]*>/) && 
			!line.match(/\/>\s*$/)) {
			indentLevel++;
		}
	}
	
	return formattedLines.join('\n');
};

const escapeHtml = (text) => {
	if (!text) return '';
	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return text.replace(/[&<>"']/g, m => map[m]);
};

// Toggle view between grid and list
const toggleViewMode = () => {
	viewMode.value = viewMode.value === "grid" ? "list" : "grid";
};


// Format tag for display
const formatTag = (tag) => {
	return tag.charAt(0).toUpperCase() + tag.slice(1);
};

// Get cover image URL (preferring xs size for thumbnails)
const getCoverUrl = (post) => {
	if (!post.cover) return null;

	// Check if cover has an error
	if (post.cover.error) {
		return { error: post.cover.error, original: post.cover.original };
	}

	// Get the xs size if available, otherwise use the main path
	const coverPath = post.cover.sizes?.find(s => s.suffix === 'xs')?.path
		|| post.cover.sizes?.find(s => s.suffix === 'sm')?.path
		|| post.cover.path;

	if (!coverPath) return null;

	// Construct full URL
	const baseUrl = "https://static.repo.md";
	const projectId = props.repoClient?.projectId;

	if (!projectId) {
		console.warn("No projectId available for cover URL");
		return null;
	}

	// Extract just the filename from the path (e.g., "_media/abc123.webp" -> "abc123.webp")
	const filename = coverPath.split('/').pop();
	const fullUrl = `${baseUrl}/projects/${projectId}/_shared/medias/${filename}`;

	return { url: fullUrl, width: post.cover.width, height: post.cover.height };
};

// Determine the repository branch
const repoBranch = computed(() => {
	return props.deployment.source?.branch || 
		   props.project?.github?.defaultBranch || 
		   "main";
});

// Generate source editor link for a post
const getSourceEditorLink = (post) => {
	if (!post.originalFilePath) return null;
	
	const orgId = route.params.orgId;
	const projectId = route.params.projectId;
	
	return {
		path: `/${orgId}/${projectId}/source`,
		query: {
			branch: "main",
			file: post.originalFilePath
		}
	};
};

// Watch for changes in the repoClient prop
watch(
	() => props.repoClient,
	() => {
		if (props.repoClient) {
			console.log("DEBUG: RepoClient changed, refreshing posts");
			fetchPosts();
		}
	},
	{ immediate: false },
);

// Lifecycle
onMounted(() => {
	console.log("DEBUG: Component mounted, calling fetchPosts()");
	fetchPosts();
});
</script>

<template>
  <PageHeadingBar
    title="Posts"
    subtitle="Browse all posts and content of your project"
  >
  </PageHeadingBar>

  <div class="container">
    <!-- Filters and View Toggle -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <!-- Search Input (takes most space) -->
      <div class="relative flex-grow">
        <Search
          class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="searchQuery"
          placeholder="Search by title, slug, or content..."
          class="pl-10 w-full"
        />
      </div>

      <!-- Fixed width controls container -->
      <div class="flex flex-wrap md:flex-nowrap gap-2">
        <!-- Post Type Dropdown (fixed width) -->
        <Select v-model="selectedPostType" class="w-full md:w-[150px]">
          <SelectTrigger>
            <SelectValue placeholder="All post types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All post types</SelectItem>
            <SelectItem v-for="type in postTypes" :key="type" :value="type">
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
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div
        class="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"
      ></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredPosts.length === 0" class="text-center py-12">
      <FileText class="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No posts found</h3>
      <p class="text-muted-foreground mt-2">
        No posts match your search criteria.
      </p>
      <Button
        @click="
          searchQuery = '';
          selectedPostType = 'all';
        "
        variant="outline"
        class="mt-4"
      >
        Reset filters
      </Button>
    </div>

    <!-- Posts Grid View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      <Card
        v-for="post in filteredPosts"
        :key="post.id"
        class="overflow-hidden flex flex-col h-full group relative"
      >
        <!-- Cover Image -->
        <div class="relative h-32 bg-gray-100">
          <img
            v-if="getCoverUrl(post)?.url"
            :src="getCoverUrl(post).url"
            :alt="post.displayTitle"
            class="w-full h-full object-cover"
            loading="lazy"
          />
          <div
            v-else-if="getCoverUrl(post)?.error"
            class="w-full h-full bg-red-50 flex items-center justify-center"
            :title="getCoverUrl(post).error"
          >
            <AlertCircle class="w-8 h-8 text-red-300" />
          </div>
          <div
            v-else
            class="w-full h-full flex items-center justify-center"
          >
            <ImageIcon class="w-8 h-8 text-gray-300" />
          </div>
        </div>
        <!-- Card Content -->
        <div class="p-4 flex-grow flex flex-col">
          <div class="text-xs text-muted-foreground mb-2">
            <div class="flex items-center gap-1">
              <Calendar class="w-3 h-3" />
              <span>{{ post.displayDate }}</span>
            </div>
            <div class="flex items-center gap-1 mt-1">
              <Clock class="w-3 h-3" />
              <span>{{ post.readTime }}</span>
            </div>
          </div>

          <h3
            class="font-medium text-base mb-2 line-clamp-2"
            :title="post.displayTitle"
          >
            {{ post.displayTitle }}
          </h3>

          <p class="text-sm text-muted-foreground mb-3 line-clamp-3 flex-grow">
            {{ post.excerpt }}
          </p>

          <!-- Tags -->
          <div class="flex flex-wrap gap-1 mb-3" v-if="post.tags && post.tags.length > 0">
            <span
              v-for="tag in post.tags.slice(0, 3)"
              :key="tag"
              class="inline-block px-2 py-1 rounded bg-gray-100 text-xs"
            >
              {{ formatTag(tag) }}
            </span>
            <span
              v-if="post.tags.length > 3"
              class="inline-block px-2 py-1 rounded bg-gray-100 text-xs"
            >
              +{{ post.tags.length - 3 }}
            </span>
          </div>

          <!-- Actions -->
          <div class="flex justify-between items-center pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              @click="copyPostUrl(post)"
              title="Copy URL"
              class="w-8 h-8 p-0"
            >
              <CheckCircle
                v-if="copiedUrl === post.id"
                class="w-4 h-4 text-green-500"
              />
              <Copy v-else class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="window.open(post.postUrl, '_blank')"
              title="View post"
              class="w-8 h-8 p-0"
            >
              <ExternalLink class="w-4 h-4" />
            </Button>
            <Button
              v-if="post.originalFilePath && getSourceEditorLink(post)"
              variant="ghost"
              size="sm"
              title="Edit source"
              class="w-8 h-8 p-0"
              :as="'router-link'"
              :to="getSourceEditorLink(post)"
            >
              <Edit class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="openPostDetails(post)"
              title="View details"
              class="w-8 h-8 p-0"
            >
              <MoreHorizontal class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Posts Table View (Default) -->
    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b">
            <th class="text-left p-3 font-medium w-16">Cover</th>
            <th class="text-left p-3 font-medium">Title</th>
            <th class="text-left p-3 font-medium">Slug</th>
            <th class="text-left p-3 font-medium">Published</th>
            <th class="text-left p-3 font-medium">Word Count</th>
            <th class="text-left p-3 font-medium">Reading Time</th>
            <th class="text-left p-3 font-medium">Status</th>
            <th class="text-left p-3 font-medium">Tags</th>
            <th class="text-center p-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="post in filteredPosts"
            :key="post.id"
            class="border-b hover:bg-accent/20 transition-colors"
          >
            <!-- Cover Image Column -->
            <td class="p-2 w-16">
              <div class="w-12 h-12 flex items-center justify-center">
                <!-- Has valid cover image -->
                <img
                  v-if="getCoverUrl(post)?.url"
                  :src="getCoverUrl(post).url"
                  :alt="post.displayTitle"
                  class="w-12 h-12 object-cover rounded"
                  loading="lazy"
                />
                <!-- Cover specified but not found (error) -->
                <div
                  v-else-if="getCoverUrl(post)?.error"
                  class="w-12 h-12 bg-red-50 rounded flex items-center justify-center"
                  :title="getCoverUrl(post).error"
                >
                  <AlertCircle class="w-5 h-5 text-red-400" />
                </div>
                <!-- No cover specified -->
                <div
                  v-else
                  class="w-12 h-12 bg-gray-100 rounded flex items-center justify-center"
                >
                  <ImageIcon class="w-5 h-5 text-gray-300" />
                </div>
              </div>
            </td>
            <td class="p-3 cursor-pointer" @click="openPostDetails(post)">
              <div class="font-medium">{{ post.displayTitle }}</div>
              <div class="text-xs text-muted-foreground truncate max-w-xs" v-if="post.excerpt">
                {{ post.excerpt }}
              </div>
              <div class="text-xs text-muted-foreground" v-if="post.author && post.author !== 'Unknown'">
                By {{ post.author }}
              </div>
            </td>
            <td class="p-3 text-sm">
              <div class="truncate max-w-[150px]">{{ post.slug }}</div>
            </td>
            <td class="p-3 text-sm">{{ post.displayDate }}</td>
            <td class="p-3 text-sm">{{ post.wordCount }}</td>
            <td class="p-3 text-sm">{{ post.readTime }}</td>
            <td class="p-3 text-sm">
              <span 
                class="px-2 py-1 rounded text-xs" 
                :class="post.isPublic ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'"
              >
                {{ post.status }}
              </span>
            </td>
            <td class="p-3 text-sm">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="tag in post.tags.slice(0, 2)"
                  :key="tag"
                  class="px-2 py-1 rounded bg-gray-100 text-xs"
                >
                  {{ formatTag(tag) }}
                </span>
                <span
                  v-if="post.tags.length > 2"
                  class="px-2 py-1 rounded bg-gray-100 text-xs"
                >
                  +{{ post.tags.length - 2 }}
                </span>
              </div>
            </td>
            <td class="p-3 text-center">
              <div class="flex justify-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  @click="copyPostUrl(post)"
                  title="Copy URL"
                >
                  <CheckCircle
                    v-if="copiedUrl === post.id"
                    class="w-4 h-4 text-green-500"
                  />
                  <Copy v-else class="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="window.open(post.postUrl, '_blank')"
                  title="View post"
                >
                  <Eye class="w-4 h-4" />
                </Button>
                <Button
                  v-if="post.originalFilePath && getSourceEditorLink(post)"
                  variant="ghost"
                  size="sm"
                  title="Edit source"
                  :as="'router-link'"
                  :to="getSourceEditorLink(post)"
                >
                  <Edit class="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="openPostDetails(post)"
                  title="View details"
                >
                  <MoreHorizontal class="w-4 h-4" />
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Post Detail Modal -->
    <Dialog :open="showPostModal" @update:open="showPostModal = $event">
      <DialogContent class="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader class="flex-shrink-0">
          <DialogTitle>{{ selectedPost?.displayTitle || 'Post Details' }}</DialogTitle>
          <DialogDescription>
            <div class="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{{ selectedPost?.slug }}</span>
              <span>{{ selectedPost?.displayDate }}</span>
              <span>{{ selectedPost?.wordCount }}</span>
              <span>{{ selectedPost?.readTime }}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 min-h-0" v-if="selectedPost">
          <Tabs v-model="currentModalTab" class="h-full flex flex-col">
            <TabsList class="grid w-full grid-cols-3 flex-shrink-0">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            
            <!-- Preview Tab -->
            <TabsContent value="preview" class="flex-1 mt-4">
              <div class="modal-scroll-area h-full">
                <!-- Frontmatter section -->
                <div v-if="selectedPost.frontmatter && Object.keys(selectedPost.frontmatter).length > 0" class="frontmatter-section mb-6">
                  <h3 class="text-lg font-semibold mb-3">Frontmatter Variables</h3>
                  <div class="overflow-x-auto">
                    <table class="frontmatter-table w-full border-collapse border border-gray-300">
                      <thead>
                        <tr>
                          <th class="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold">Variable</th>
                          <th class="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="[key, value] in Object.entries(selectedPost.frontmatter)" :key="key" class="even:bg-gray-50">
                          <td class="border border-gray-300 px-3 py-2 font-mono text-sm">{{ key }}</td>
                          <td class="border border-gray-300 px-3 py-2 text-sm">{{ JSON.stringify(value) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <!-- HTML Content Preview -->
                <div class="prose max-w-none" v-html="selectedPost.html || selectedPost.content || '<p>No content available</p>'"></div>
              </div>
            </TabsContent>
            
            <!-- HTML Tab -->
            <TabsContent value="html" class="flex-1 mt-4">
              <div class="modal-scroll-area h-full">
                <!-- Frontmatter section -->
                <div v-if="selectedPost.frontmatter && Object.keys(selectedPost.frontmatter).length > 0" class="frontmatter-section mb-6">
                  <h3 class="text-lg font-semibold mb-3">Frontmatter Variables</h3>
                  <div class="overflow-x-auto">
                    <table class="frontmatter-table w-full border-collapse border border-gray-300">
                      <thead>
                        <tr>
                          <th class="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold">Variable</th>
                          <th class="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="[key, value] in Object.entries(selectedPost.frontmatter)" :key="key" class="even:bg-gray-50">
                          <td class="border border-gray-300 px-3 py-2 font-mono text-sm">{{ key }}</td>
                          <td class="border border-gray-300 px-3 py-2 text-sm">{{ JSON.stringify(value) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <!-- HTML Source Code -->
                <div class="m-4">
                  <CodeBlock 
                    :code="formatHtml(selectedPost.html || selectedPost.content || '')"
                    language="html"
                    :noScroll="true"
                  />
                </div>
              </div>
            </TabsContent>
            
            <!-- JSON Tab -->
            <TabsContent value="json" class="flex-1 mt-4">
              <div class="modal-scroll-area h-full">
                <div class="m-4">
                  <CodeBlock 
                    :code="JSON.stringify(selectedPost, null, 2)"
                    language="json"
                    :noScroll="true"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter class="flex-shrink-0 mt-4">
          <Button variant="outline" @click="showPostModal = false">
            Close
          </Button>
          <Button 
            v-if="selectedPost?.originalFilePath && getSourceEditorLink(selectedPost)"
            variant="outline" 
            :as="'router-link'"
            :to="getSourceEditorLink(selectedPost)"
          >
            <span class="flex items-center gap-2">
              <Edit class="w-4 h-4" />
              Edit Source
            </span>
          </Button>
          <Button @click="window.open(selectedPost?.postUrl, '_blank')" v-if="selectedPost?.postUrl">
            <span class="flex items-center gap-2">
              <ExternalLink class="w-4 h-4" />
              View Post
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

/* Modal scroll area */
.modal-scroll-area {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 1rem 1rem 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #fafafa;
  max-height: 60vh;
}

/* Custom scrollbar styling */
.modal-scroll-area::-webkit-scrollbar {
  width: 8px;
}

.modal-scroll-area::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.modal-scroll-area::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.modal-scroll-area::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Firefox scrollbar */
.modal-scroll-area {
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f1f1f1;
}

/* Frontmatter styling */
.frontmatter-section {
  margin: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.frontmatter-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.frontmatter-table th,
.frontmatter-table td {
  padding: 0.75rem;
  border: 1px solid #dee2e6;
  text-align: left;
  vertical-align: top;
}

.frontmatter-table th {
  background-color: #e9ecef;
  font-weight: 600;
}

.frontmatter-table tr:nth-child(even) {
  background-color: #f8f9fa;
}

/* Code styling */
pre {
  background-color: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  font-size: 0.875rem;
  line-height: 1.45;
  overflow: auto;
  padding: 1rem;
}

code {
  background-color: transparent;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
}

/* Prose styling for preview content */
.prose {
  max-width: none;
  color: #374151;
  line-height: 1.7;
  margin: 1rem;
}

.prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
  color: #111827;
  font-weight: 600;
  line-height: 1.25;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.prose h1 { font-size: 2.25em; }
.prose h2 { font-size: 1.875em; }
.prose h3 { font-size: 1.5em; }
.prose h4 { font-size: 1.25em; }
.prose h5 { font-size: 1.125em; }
.prose h6 { font-size: 1em; }

.prose p {
  margin-top: 1.25em;
  margin-bottom: 1.25em;
}

.prose ul, .prose ol {
  margin-top: 1.25em;
  margin-bottom: 1.25em;
  padding-left: 1.625em;
}

.prose li {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.prose blockquote {
  font-style: italic;
  border-left: 4px solid #e5e7eb;
  padding-left: 1em;
  margin: 1.5em 0;
  color: #6b7280;
}

.prose code {
  background-color: #f3f4f6;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.875em;
}

.prose pre {
  background-color: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 1rem;
  overflow-x: auto;
  margin: 1.5em 0;
}

.prose pre code {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 0.875rem;
}

.prose img {
  max-width: 100%;
  height: auto;
  margin: 1.5em 0;
  border-radius: 6px;
}

.prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
}

.prose th, .prose td {
  border: 1px solid #e5e7eb;
  padding: 0.75rem;
  text-align: left;
}

.prose th {
  background-color: #f9fafb;
  font-weight: 600;
}

.prose a {
  color: #3b82f6;
  text-decoration: underline;
}

.prose a:hover {
  color: #1d4ed8;
}
</style>