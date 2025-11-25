<script setup>
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RouterLink, useRoute } from "vue-router";
import {
	ChevronDown,
	ChevronRight,
	Search,
	Book,
	Code,
	Box,
	Layers,
	Server,
	Shield,
	Cloud,
	Settings,
	Zap,
	Home,
	Loader2,
	AlertTriangle,
	FileText,
	FileCode,
	Lightbulb,
	Palette,
	HelpCircle, 
} from "lucide-vue-next";
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import DocsHome from "@/view/docs/DocsHome.vue";
import E404 from "@/components/E404.vue";
import { Button } from "@/components/ui/button";
import repoDocsOfficial from "@/lib/repoDocsOfficial";
import { usePageTitle } from "@/lib/utils/vueUtils";

// Router integration for active state detection
const route = useRoute();

// Check if a route is active and handle section open states
const isRouteActive = (url) => {
	// Exact match for the home route
	if (url === "/docs" && route.path === "/docs") {
		return true;
	}
	// For other routes, check if the current path starts with the url
	return url !== "/docs" && route.path.startsWith(url);
};

// Computed property for current route path
const currentRoutePath = computed(() => route.path);

// Auto-open sections that contain the active route
const updateOpenSections = () => {
	navItems.value.forEach((section) => {
		if (!section.standalone && section.items) {
			// Check if any of the section's items match the current route
			const hasActiveItem = section.items.some((item) =>
				isRouteActive(item.url),
			);
			if (hasActiveItem) {
				section.isOpen = true;
			}
		}
	});
};

// Toggle section open/closed state
const toggleSection = (section) => {
	if (!section.standalone) {
		section.isOpen = !section.isOpen;
	}
};

// Sidebar navigation with organized documentation structure

// Sidebar navigation items
const navItems = ref([
	{
		title: "Introduction",
		icon: Book,
		url: "/docs",
		standalone: true,
	},
	{
		title: "Get Started",
		icon: Zap,
		isOpen: false,
		items: [
			{ title: "What is RepoMD", url: "/docs/what-is-repomd" },
			{ title: "Quick Start", url: "/docs/quick-start" },
			{ title: "Installation", url: "/docs/installation" },
			{ title: "First Repository", url: "/docs/first-repository" },
		],
	},
	{
		title: "Content",
		icon: FileText,
		isOpen: false,
		items: [
			{ title: "Front Matter", url: "/docs/front-matter" },
			{ title: "Markdown Basics", url: "/docs/markdown-basics" },
			{ title: "Media Management", url: "/docs/media-management" },
			{ title: "Organization", url: "/docs/organization" },
		],
	},
	{
		title: "Themes",
		icon: Palette,
		isOpen: false,
		items: [
    { title: "Themes, sites & apps", url: "/docs/themes-essentials" },
			{ title: "Using Themes", url: "/docs/using-themes" },
			{ title: "Creating Themes", url: "/docs/creating-themes" },
 
		//	{ title: "Components", url: "/docs/components" },
		//	{ title: "API Reference", url: "/docs/themes-api-reference" },
		],
	},
	{
		title: "Developers",
		icon: FileCode,
		isOpen: false,
		items: [
			{ title: "API Reference", url: "/docs/api-reference" },
			{ title: "JavaScript Library", url: "/docs/javascript-library" },
			{ title: "Plugins", url: "/docs/plugins" },
			{ title: "Webhooks", url: "/docs/webhooks" },
		],
	},
	{
		title: "Use Cases",
		icon: Lightbulb,
		isOpen: false,
		items: [
			{ title: "Blog Setup", url: "/docs/blog-setup" },
			{ title: "Documentation Sites", url: "/docs/documentation-sites" },
			{ title: "WordPress Migration", url: "/docs/wordpress-migration" },
			{ title: "AI Integration", url: "/docs/ai-integration" },
			{ title: "OpenAI Integration", url: "/docs/openai-integration" },
		],
	},
	{
		title: "Troubleshooting",
		icon: FileText,
		isOpen: false,
		items: [
			{ title: "Common Issues", url: "/docs/common-issues" },
			{ title: "FAQ", url: "/docs/faq" },
			{ title: "Performance", url: "/docs/performance" },
		],
	},
]);

// Outline items (right sidebar) - will be dynamically updated based on route
const outlineItems = ref([]);

// Dynamically generate outline based on current path
const generateOutline = (path) => {
	// Different outlines for different routes
	const outlines = {
		"/docs": [
			{ title: "Introduction", url: "#introduction", level: 1 },
			{ title: "Key Features", url: "#key-features", level: 2 },
			{ title: "Getting Started", url: "#getting-started", level: 1 },
			{ title: "Support", url: "#support", level: 1 },
		],
		"/docs/getting-started/installation": [
			{ title: "Installation", url: "#installation", level: 1 },
			{ title: "Requirements", url: "#requirements", level: 2 },
			{ title: "Quick Setup", url: "#quick-setup", level: 2 },
			{ title: "Troubleshooting", url: "#troubleshooting", level: 1 },
		],
		"/docs/getting-started/configuration": [
			{ title: "Configuration", url: "#configuration", level: 1 },
			{ title: "Basic Options", url: "#basic-options", level: 2 },
			{ title: "Advanced Settings", url: "#advanced-settings", level: 2 },
			{
				title: "Environment Variables",
				url: "#environment-variables",
				level: 1,
			},
		],
		"/docs/getting-started/first-steps": [
			{ title: "First Steps", url: "#first-steps", level: 1 },
			{ title: "Creating a Project", url: "#creating-a-project", level: 2 },
			{ title: "Project Structure", url: "#project-structure", level: 2 },
			{ title: "Next Steps", url: "#next-steps", level: 1 },
		],
	};

	// Return the outline for the current path or a default outline
	return (
		outlines[path] || [
			{ title: "Overview", url: "#overview", level: 1 },
			{ title: "Details", url: "#details", level: 2 },
		]
	);
};

// Update outline when route changes
watch(
	currentRoutePath,
	(newPath) => {
		outlineItems.value = generateOutline(newPath);
	},
	{ immediate: true },
);

// Content state management
const loading = ref(false);
const error = ref(null);
const article = ref(null);
const activeSection = ref(null);
const currentContent = ref({
	title: "",
	content: " ",
});

// Search
const searchQuery = ref("");

// Create a computed property for the actual path without the hash
const articlePath = computed(() => {
	// If we're on the docs home page, return null
	if (route.path === "/docs") return null;

	const pathMatch = route.params.pathMatch;
	return Array.isArray(pathMatch) ? pathMatch.join("/") : pathMatch;
});

// Fetches documentation content from repoDocsOfficial
const fetchDocArticle = async (slug) => {
	try {
		loading.value = true;
		error.value = null;

		if (!slug) {
			// Home page - just set the title
			currentContent.value = {
				title: "Documentation",
				content: null
			};
			article.value = null;
			return;
		}

		// Get the article directly using the RepoMD client
		const post = await repoDocsOfficial.getPostBySlug(slug);

		if (!post) {
			throw new Error("Article not found");
		}

		// Add the article to state
		article.value = post;

		// Update current content for backward compatibility
		currentContent.value = {
			title: post.title,
			content: post.html
		};

		// Set up intersection observer after content is loaded
		nextTick(() => {
			// Update outline items based on article TOC
			if (post.toc && post.toc.length) {
				outlineItems.value = post.toc.map(item => ({
					title: item.title,
					url: `#${item.id}`,
					level: item.depth
				}));
			}

			// Observe headers for scroll tracking
			observeHeaders();
		});
	} catch (err) {
		console.error("Error fetching article:", err);
		error.value = "Failed to load the documentation. Please try again later.";
		article.value = null;
	} finally {
		loading.value = false;
	}
};

// Add page title update
const pageTitle = computed(() => {
	return article.value ? article.value.title : "";
});

// Set page title
usePageTitle({
	title: pageTitle,
});

// Watch for article path changes to fetch the content
watch(
	articlePath,
	async (newPath) => {
		await fetchDocArticle(newPath);
		// Update sidebar open sections based on current route
		updateOpenSections();
	},
	{ immediate: true },
);

// Initialize when component mounts
onMounted(() => {
	// Add scroll event listener to track section visibility
	window.addEventListener("scroll", handleScroll);
});

// Clean up event listener
onUnmounted(() => {
	window.removeEventListener("scroll", handleScroll);
});

// Set up intersection observer for headers
const observeHeaders = () => {
	// Get all section headers
	const headers = document.querySelectorAll("h1[id], h2[id], h3[id]");
	if (!headers.length) return;

	// Add appropriate classes to make the observer work correctly
	headers.forEach(header => {
		header.classList.add('scroll-header');
	});
};

// Track active section based on scroll position
const handleScroll = () => {
	// Get all section headers
	const headers = document.querySelectorAll("h1[id], h2[id], h3[id]");
	if (!headers.length) return;

	// Find the header that's currently in view
	let currentHeader = null;
	let closestDistance = Infinity;

	headers.forEach((header) => {
		const rect = header.getBoundingClientRect();
		const distance = Math.abs(rect.top);

		if (distance < closestDistance && rect.top <= 100) {
			closestDistance = distance;
			currentHeader = header;
		}
	});

	// Update active section state
	if (currentHeader) {
		activeSection.value = currentHeader.id;
	}
};

// Function to get item link
function getItemLink(item) {
	if (item.url) return item.url;
	return "#";
}

// Smooth scroll to section
const scrollToSection = (sectionId) => {
	const element = document.getElementById(sectionId);
	if (element) {
		element.scrollIntoView({ behavior: "smooth" });
		// Update active section manually
		activeSection.value = sectionId;
	}
};

// Handle item click
const handleItemClick = async (url) => {
	// Content will be loaded automatically via the route watcher
	// No need to call loadContent directly here
};

// Search function (placeholder for now)
const handleSearch = () => {
	// Implement search functionality
	console.log("Searching for:", searchQuery.value);
	// This would typically trigger a search API call
};
</script>

<template>
  <!-- Main container for documentation -->
  <div class="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 smooth-scroll">
    <!-- Add breadcrumb navigation -->
    <div class="hidden md:block max-w-7xl mx-auto mb-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">
              <Home class="w-4 h-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/docs"> Documentation </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator
            v-if="currentContent.title !== 'Documentation'"
          />
          <BreadcrumbItem v-if="currentContent.title !== 'Documentation'">
            <span class="text-muted-foreground">{{
              currentContent.title
            }}</span>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <hr class="my-5" />
    </div>

    <div class="max-w-7xl mx-auto flex gap-8">
      <!-- Left Sidebar -->
      <div class="hidden lg:block w-80">
        <div class="sticky top-20">
          <Card class="bg-white shadow-lg">
            <CardContent class="p-0">
              <!-- Search box -->
              <div class="p-4 border-b border-gray-200">
                <div class="relative flex items-center">
                  <Search class="absolute left-3 w-4 h-4 text-gray-500" />
                  <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search docs..."
                    class="w-full py-2 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    @keyup.enter="handleSearch"
                  />
                  <span
                    class="absolute right-3 text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded"
                    >⌘K</span
                  >
                </div>
              </div>

              <!-- Navigation menu -->
              <nav class="p-4 max-h-[calc(100vh-10rem)] overflow-y-auto">
                <ul class="space-y-1">
                  <!-- Loop through navigation items -->
                  <li v-for="(item, index) in navItems" :key="index">
                    <!-- Standalone navigation items -->
                    <template v-if="item.standalone">
                      <RouterLink
                        :to="item.url"
                        class="flex items-center px-3 py-2 rounded-md"
                        :class="
                          isRouteActive(item.url)
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        "
                        @click="handleItemClick(item.url)"
                      >
                        <component :is="item.icon" class="w-5 h-5 mr-2" />
                        <span>{{ item.title }}</span>
                      </RouterLink>
                    </template>

                    <!-- Collapsible sections -->
                    <template v-else>
                      <!-- Section header -->
                      <button
                        class="flex items-center justify-between w-full px-3 py-2 rounded-md hover:bg-gray-100"
                        :class="
                          item.isOpen
                            ? 'text-gray-900 font-medium'
                            : 'text-gray-700'
                        "
                        @click="toggleSection(item)"
                      >
                        <div class="flex items-center">
                          <component :is="item.icon" class="w-5 h-5 mr-2" />
                          <span>{{ item.title }}</span>
                        </div>
                        <component
                          :is="item.isOpen ? ChevronDown : ChevronRight"
                          class="w-4 h-4 text-gray-500 transition-transform duration-200"
                        />
                      </button>

                      <!-- Section content - conditionally shown -->
                      <div
                        v-show="item.isOpen"
                        class="mt-1 ml-4 pl-4 border-l border-gray-200"
                      >
                        <RouterLink
                          v-for="(subItem, subIndex) in item.items"
                          :key="subIndex"
                          :to="subItem.url"
                          class="flex items-center px-3 py-2 rounded-md text-sm"
                          :class="
                            isRouteActive(subItem.url)
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          "
                          @click="handleItemClick(subItem.url)"
                        >
                          <span>{{ subItem.title }}</span>
                        </RouterLink>
                      </div>
                    </template>
                  </li>
                </ul>
              </nav>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-grow max-w-4xl">
        <Card class="bg-white shadow-xl overflow-hidden">
          <CardHeader class="p-8 pb-0">
            <CardTitle
              class="text-4xl font-bold mb-6 text-gray-900 leading-tight"
            >
              {{ currentContent.title }}
            </CardTitle>
          </CardHeader>
          <CardContent class="p-8">
            <!-- Loading state -->
            <div
              v-if="loading"
              class="flex items-center justify-center min-h-[60vh]"
            >
              <Loader2 class="w-10 h-10 animate-spin text-gray-600" />
            </div>

            <!-- Error state -->
            <div
              v-else-if="error"
              class="flex flex-col items-center justify-center min-h-[60vh]"
            >
              <AlertTriangle class="w-14 h-14 text-red-500 mb-6" />
              <p class="text-xl text-gray-600">{{ error }}</p>
              <Button class="mt-6" @click="fetchDocArticle(articlePath)">Retry</Button>
            </div>

            <!-- 404 state - No article found and not loading -->
            <E404 v-else-if="!article && currentRoutePath !== '/docs' && !loading" title="Article not found" />

            <!-- Content for home page -->
            <DocsHome v-else-if="currentRoutePath === '/docs'" />

            <!-- Content for article pages -->
            <div
              v-else-if="article && article.html"
              class="prose max-w-none"
              v-html="article.html"
            ></div>
          </CardContent>
        </Card>
      </div>

      <!-- Right Sidebar (Outline) - Only shown when we have an article with TOC -->
      <div
        v-if="article && article.toc && article.toc.length > 0"
        class="hidden lg:block w-80"
      >
        <div
          class="sticky top-20 p-6 bg-white rounded-lg shadow-lg"
        >
          <h3 class="text-lg font-semibold mb-6 border-b pb-3">On this page</h3>
          <nav class="space-y-1 max-h-[calc(100vh-10rem)] overflow-y-auto">
            <a
              v-for="item in article.toc"
              :key="item.id"
              :href="`#${item.id}`"
              @click.prevent="scrollToSection(item.id)"
              :class="[
                'block hover:text-gray-900 transition-colors py-2 px-3 rounded-md',
                item.depth === 2 ? 'font-medium' : 'pl-6 text-sm my-1',
                activeSection === item.id
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600',
              ]"
            >
              {{ item.title }}
            </a>
          </nav>
        </div>
      </div>

      <!-- Fallback to generated outline when no article TOC is available -->
      <div
        v-else-if="outlineItems.length > 0 && currentRoutePath !== '/docs'"
        class="hidden lg:block w-80"
      >
        <div
          class="sticky top-20 p-6 bg-white rounded-lg shadow-lg"
        >
          <h3 class="text-lg font-semibold mb-6 border-b pb-3">On this page</h3>
          <nav class="space-y-1 max-h-[calc(100vh-10rem)] overflow-y-auto">
            <a
              v-for="item in outlineItems"
              :key="item.url"
              :href="item.url"
              :class="[
                'block hover:text-gray-900 transition-colors py-2 px-3 rounded-md',
                item.level === 1 ? 'font-medium' : 'pl-6 text-sm my-1',
                activeSection === item.url.substring(1)
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600',
              ]"
            >
              {{ item.title }}
            </a>
          </nav>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Smooth scrolling */
.smooth-scroll {
  scroll-behavior: smooth;
}

/* Enhanced typography for prose content */
:deep(.prose) {
  max-width: none;
  font-size: 1.125rem;
  line-height: 1.8;
}

:deep(.prose p) {
  margin-bottom: 1.5em;
}

:deep(.prose h1, .prose h2, .prose h3, .prose h4) {
  scroll-margin-top: 120px;
  position: relative;
}

/* Add styling for the scroll headers that will be used for intersection observation */
:deep(.scroll-header) {
  scroll-margin-top: 120px;
  position: relative;
}

/* Fix for title anchors - prevent blue underline */
:deep(.prose h1 a),
:deep(.prose h2 a),
:deep(.prose h3 a),
:deep(.prose h4 a) {
  color: inherit !important;
  text-decoration: none !important;
  border-bottom: none !important;
  background: none !important;
  box-shadow: none !important;
  outline: none !important;
}

:deep(.prose h1) {
  font-size: 2.5rem;
  margin-top: 2em;
  margin-bottom: 1em;
}

:deep(.prose h2) {
  font-size: 2rem;
  margin-top: 1.8em;
  margin-bottom: 0.8em;
}

:deep(.prose h3) {
  font-size: 1.5rem;
  margin-top: 1.6em;
  margin-bottom: 0.6em;
}

:deep(.prose a) {
  color: #2563eb;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
}

/* Additional specificity to ensure heading links aren't styled like normal links */
:deep(.prose) h1 a:any-link,
:deep(.prose) h2 a:any-link,
:deep(.prose) h3 a:any-link,
:deep(.prose) h4 a:any-link,
:deep(.prose) h5 a:any-link,
:deep(.prose) h6 a:any-link {
  color: inherit !important;
  text-decoration: none !important;
  border-bottom: none !important;
}

:deep(.prose code) {
  background-color: #f3f4f6;
  padding: 0.2em 0.4em;
  border-radius: 0.375rem;
  font-size: 0.875em;
}

:deep(.prose pre) {
 
}


     :deep(code.hljs) {
            display: block;
            border-radius: 4px;
            padding: 10px;
             @apply   p-4 rounded-lg
        }

:deep(.prose blockquote) {
  border-left-width: 4px;
  border-left-color: #e2e8f0;
  padding-left: 1.5em;
  font-style: italic;
  color: #4b5563;
}

:deep(.prose ul) {
  list-style-type: disc;
  padding-left: 1.5em;
}

:deep(.prose ol) {
  list-style-type: decimal;
  padding-left: 1.5em;
}

:deep(.prose li) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.position-static {
  position: static !important;
  height: auto !important;
  overflow: visible !important;
}

/* Ensure outline links transition smoothly */
nav a {
  transition: all 0.2s ease-in-out;
}

/* Active outline item styling */
nav a.active,
nav a[data-active="true"] {
  color: var(--primary) !important;
  background-color: var(--primary-light) !important;
  font-weight: 500;
}

/* Search styling */
.search-container {
  padding: 0.75rem 1rem;
}

.search-box {
  display: flex;
  align-items: center;
  background-color: var(--search-bg, #f3f4f6);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  position: relative;
}

.search-icon {
  color: var(--search-icon, #6b7280);
  margin-right: 0.5rem;
}

.search-input {
  border: none;
  background: transparent;
  flex: 1;
  outline: none;
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
}

.search-shortcut {
  font-size: 0.75rem;
  color: var(--text-muted, #6b7280);
  background-color: var(--shortcut-bg, #e5e7eb);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

/* Footer link */
.sidebar-footer-link {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  color: var(--text-muted, #6b7280);
  text-decoration: none;
  font-size: 0.875rem;
}

.sidebar-footer-link:hover {
  background-color: var(--hover-bg, #f3f4f6);
}

/* Active state styling */
.isActive {
  background-color: var(--sidebar-accent, #f1f1f1);
  color: var(--sidebar-accent-foreground, #111827);
}
</style>
