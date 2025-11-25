<script setup>
import { ref, computed } from "vue";
import { useOrgStore } from "@/store/orgStore";
import {
  Search,
  Code,
  FileJson,
  Package,
  ClipboardCopy,
  ExternalLink,
  Braces,
  FileText,
  Puzzle,
  Database,
  FileCode,
  Download,
  Link as LinkIcon,
  Server,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useRoute } from "vue-router";
import { useToast } from "@/components/ui/toast/use-toast";
import PageHeadingBar from "@/components/PageHeadingBar.vue";

// Props for project data passed from parent
const props = defineProps({
  project: {
    type: Object,
    default: null,
  },
});

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();
const route = useRoute();
const { toast } = useToast();

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);
const projectId = computed(() => props.project?._id || route.params.projectId);
const projectSlug = computed(() => props.project?.slug || route.params.projectId);
const projectName = computed(() => props.project?.name || projectSlug.value);
const orgHandle = computed(() => route.params.orgId);

// Base URLs
const cdnBaseUrl = computed(() => `https://cdn.repo.md/${orgHandle.value}/${projectSlug.value}`);
const jsonAPIUrl = computed(() => `https://api.repo.md/v1/${orgHandle.value}/${projectSlug.value}`);

// JSON endpoints - Files, Routes & Maps
const jsonEndpoints = [
  // Core content files
  {
    name: "index.json",
    description: "Root content index",
    url: "/index.json",
  },
  {
    name: "posts.json",
    description: "All posts/pages with metadata",
    url: "/posts.json",
  },
  {
    name: "media.json",
    description: "List of all media files with metadata",
    url: "/media.json",
  },
  {
    name: "graph.json",
    description: "Content relationship graph structure",
    url: "/graph.json",
  },

  // By slug content access
  {
    name: "{slug}.json",
    description: "Access content by slug (e.g., about.json, contact.json)",
    url: "/{slug}.json",
  },

  // Media mapping files
  {
    name: "media-hash-url-map.json",
    description: "Map from content hash to URL",
    url: "/media-hash-url-map.json",
  },
  {
    name: "media-path-hash-map.json",
    description: "Map from file path to content hash",
    url: "/media-path-hash-map.json",
  },
  {
    name: "media-path-url-map.json",
    description: "Map from file path to URL",
    url: "/media-path-url-map.json",
  },

  // Content mapping files
  {
    name: "posts-path-map.json",
    description: "Map from file path to post content",
    url: "/posts-path-map.json",
  },
  {
    name: "posts-slug-hash-map.json",
    description: "Map from post slug to content hash",
    url: "/posts-slug-hash-map.json",
  },

  // AI & Embedding files
  {
    name: "posts-embedding-hash-map.json",
    description: "AI embeddings map by content hash",
    url: "/posts-embedding-hash-map.json",
  },
  {
    name: "posts-embedding-slug-map.json",
    description: "AI embeddings map by content slug",
    url: "/posts-embedding-slug-map.json",
  }
];

// JavaScript SDK example
const jsSdkExample = `// Install the repo.md SDK
// npm install repo-md

import { RepoMD } from '@repo-md/client';

// Initialize with your organization and project info
const repo = new RepoMD({
  org: '${orgHandle.value || 'YOUR_ORG_HANDLE'}',
  project: '${projectSlug.value || 'YOUR_PROJECT_SLUG'}',
  // Alternative: initialize directly with project ID
  // projectId: '${projectId.value || 'YOUR_PROJECT_ID'}'
});

// Fetch all posts/pages
const posts = await repo.getPosts();

// Get a specific page by slug
const page = await repo.getPost('about');

// Search content
const results = await repo.search('query term');

// Access media
const mediaUrl = repo.getMediaUrl('image.jpg');

// Get embedded content relationships
const graph = await repo.getGraph();`;

// Create refs for input fields
const projectIdInput = ref('');
const cdnBaseUrlInput = ref('');

// Update input values when computed values change
watch(projectId, (newValue) => {
  projectIdInput.value = newValue;
}, { immediate: true });

watch(cdnBaseUrl, (newValue) => {
  cdnBaseUrlInput.value = newValue;
}, { immediate: true });

// Copy to clipboard with toast notification
const copyToClipboard = (text, message) => {
  navigator.clipboard.writeText(text);
  toast({
    title: "Copied",
    description: message || "Copied to clipboard",
    duration: 3000,
  });
};

// Copy project ID to clipboard
const copyProjectId = () => {
  copyToClipboard(projectId.value, "Project ID copied to clipboard");
};

// Copy CDN URL to clipboard
const copyCdnUrl = () => {
  copyToClipboard(cdnBaseUrl.value, "CDN URL copied to clipboard");
};

// Copy JSON API URL to clipboard
const copyJsonUrl = () => {
  copyToClipboard(jsonAPIUrl.value, "JSON API URL copied to clipboard");
};

// Copy specific JSON endpoint
const copyJsonEndpoint = (endpoint) => {
  const url = `${cdnBaseUrl.value}${endpoint.url}`;
  copyToClipboard(url, `${endpoint.name} URL copied to clipboard`);
};

// Copy SDK code
const copySdkCode = () => {
  copyToClipboard(jsSdkExample, "JavaScript SDK example copied to clipboard");
};
</script>

<template>
  <PageHeadingBar title="API" subtitle="Connect your content to anything">
    <template #actions>
      <div class="flex gap-2">
        <Button
          :to="'/docs'"
          variant="outline"
          class="flex items-center gap-1"
        >
          <FileText class="w-4 h-4" />
          <span>Documentation</span>
        </Button>
      </div>
    </template>
  </PageHeadingBar>

  <div class="container px-4 py-6">
    <!-- Essential Info Card -->
    <Card className="mb-6">
      <CardHeader>
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <Database class="h-5 w-5 text-primary" />
            <CardTitle>API Credentials</CardTitle>
          </div>
        </div>
        <CardDescription>Essential information for connecting to your content</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-6">
          <!-- Project ID -->
          <div>
            <h3 class="text-sm font-medium text-muted-foreground mb-2">Project ID</h3>
            <div class="flex items-center">
              <Input v-model="projectIdInput" class="font-mono text-sm flex-1" disabled />
              <Button variant="outline" class="ml-2" @click="copyProjectId">
                <ClipboardCopy class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <!-- Base CDN URL -->
          <div>
            <h3 class="text-sm font-medium text-muted-foreground mb-2">Content Delivery URL</h3>
            <div class="flex items-center">
              <Input v-model="cdnBaseUrlInput" class="font-mono text-sm flex-1" disabled />
              <Button variant="outline" class="ml-2" @click="copyCdnUrl">
                <ClipboardCopy class="h-4 w-4" />
              </Button>
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              Base URL for accessing static content and JSON files
            </p>
          </div>

          <div class="bg-primary/5 p-3 rounded-md flex items-center gap-2 text-sm mt-4">
            <LinkIcon class="h-4 w-4 text-primary flex-shrink-0" />
            <span>All API requests are public by default. Configure access control in the security settings.</span>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- API Access Methods -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <!-- JavaScript SDK Card -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <Code class="h-5 w-5 text-primary" />
            <CardTitle>JavaScript SDK</CardTitle>
          </div>
          <CardDescription>Easily integrate with your project using our JavaScript SDK</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div class="flex items-start gap-2">
              <Package class="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 class="font-medium">NPM Package</h3>
                <p class="text-sm text-muted-foreground">Install our official SDK for the simplest integration</p>
                <code class="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">npm install repo-md</code>
              </div>
            </div>
            
            <div class="bg-muted p-4 rounded-md mt-4 max-h-80 overflow-auto">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium">Example Usage</h4>
                <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="copySdkCode">
                  <ClipboardCopy class="h-4 w-4" />
                </Button>
              </div>
              <pre class="text-xs overflow-x-auto p-2 bg-card rounded-md border">{{ jsSdkExample }}</pre>
            </div>
            
            <Button 
              :to="'/docs/js'"
              variant="outline" 
              size="sm" 
              class="mt-2 flex items-center gap-1"
            >
              <FileCode class="h-4 w-4" />
              <span>SDK Documentation</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Static JSON Card -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <FileJson class="h-5 w-5 text-primary" />
            <CardTitle>Static JSON</CardTitle>
          </div>
          <CardDescription>Access raw JSON files directly via CDN</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <p class="text-sm text-muted-foreground">
              All your content is available as static JSON files that you can directly access or integrate with any programming language.
            </p>
            
            <div class="bg-muted rounded-md overflow-hidden">
              <div class="p-3 border-b border-muted-foreground/10 flex items-center justify-between">
                <h4 class="text-sm font-medium">Available JSON Files</h4>
              </div>

              <!-- Core content files section -->
              <div class="p-2 bg-muted-foreground/5 border-b border-muted-foreground/10">
                <h5 class="text-xs uppercase font-semibold ml-2 mb-1 text-muted-foreground">Core Content</h5>
              </div>
              <div class="divide-y divide-muted-foreground/10">
                <div v-for="endpoint in jsonEndpoints.slice(0, 4)" :key="endpoint.name"
                     class="p-3 flex justify-between items-center">
                  <div>
                    <p class="font-medium text-sm">{{ endpoint.name }}</p>
                    <p class="text-xs text-muted-foreground">{{ endpoint.description }}</p>
                  </div>
                  <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="() => copyJsonEndpoint(endpoint)">
                    <ClipboardCopy class="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <!-- Content by slug section -->
              <div class="p-2 bg-muted-foreground/5 border-b border-muted-foreground/10 border-t">
                <h5 class="text-xs uppercase font-semibold ml-2 mb-1 text-muted-foreground">Content by Slug</h5>
              </div>
              <div class="divide-y divide-muted-foreground/10">
                <div class="p-3 flex justify-between items-center">
                  <div>
                    <p class="font-medium text-sm">{{ jsonEndpoints[4].name }}</p>
                    <p class="text-xs text-muted-foreground">{{ jsonEndpoints[4].description }}</p>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <span class="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">about.json</span>
                      <span class="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">contact.json</span>
                      <span class="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">index.json</span>
                      <span class="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">cats.json</span>
                      <span class="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">...</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="() => copyJsonEndpoint(jsonEndpoints[4])">
                    <ClipboardCopy class="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <!-- Mapping files section -->
              <div class="p-2 bg-muted-foreground/5 border-b border-muted-foreground/10 border-t">
                <h5 class="text-xs uppercase font-semibold ml-2 mb-1 text-muted-foreground">Maps & References</h5>
              </div>
              <div class="divide-y divide-muted-foreground/10 max-h-48 overflow-y-auto">
                <div v-for="endpoint in jsonEndpoints.slice(5)" :key="endpoint.name"
                     class="p-3 flex justify-between items-center">
                  <div>
                    <p class="font-medium text-sm">{{ endpoint.name }}</p>
                    <p class="text-xs text-muted-foreground">{{ endpoint.description }}</p>
                  </div>
                  <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="() => copyJsonEndpoint(endpoint)">
                    <ClipboardCopy class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <Button
              :to="'/docs/json-api'"
              variant="outline"
              size="sm"
              class="mt-2 flex items-center gap-1"
            >
              <Braces class="h-4 w-4" />
              <span>JSON API Documentation</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Other Languages Note -->
    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <Puzzle class="h-5 w-5 text-primary" />
          <CardTitle>Additional SDKs</CardTitle>
        </div>
        <CardDescription>Integration options for other programming languages</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="border rounded-md p-3 flex flex-col gap-2">
            <h3 class="font-medium text-sm">Python SDK</h3>
            <p class="text-xs text-muted-foreground">Simple Python interface to work with repo.md content</p>
            <Button variant="ghost" size="sm" class="mt-auto text-xs">
              Coming Soon
            </Button>
          </div>
          
          <div class="border rounded-md p-3 flex flex-col gap-2">
            <h3 class="font-medium text-sm">PHP SDK</h3>
            <p class="text-xs text-muted-foreground">Integrate repo.md with WordPress or other PHP applications</p>
            <Button variant="ghost" size="sm" class="mt-auto text-xs">
              Coming Soon
            </Button>
          </div>
          
          <div class="border rounded-md p-3 flex flex-col gap-2">
            <h3 class="font-medium text-sm">Ruby SDK</h3>
            <p class="text-xs text-muted-foreground">Content integration for Ruby applications</p>
            <Button variant="ghost" size="sm" class="mt-auto text-xs">
              Coming Soon
            </Button>
          </div>
        </div>
        
        <div class="text-center mt-6">
          <p class="text-sm text-muted-foreground mb-4">
            Don't see your preferred language? Our static JSON API works with any programming language capable of making HTTP requests.
          </p>
          <Button
            :to="'/docs/integrations'"
            variant="outline"
            size="sm"
            class="flex items-center gap-1 mx-auto"
          >
            <ExternalLink class="h-4 w-4" />
            <span>View Integration Guides</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
/* Additional styling can be added here if needed */
</style>