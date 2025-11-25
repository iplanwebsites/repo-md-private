<script setup>
import { ref, computed } from "vue";
import { useOrgStore } from "@/store/orgStore";
import {
  Search,
  Database,
  Table,
  FileText,
  Server,
  ExternalLink,
  LayoutGrid,
  Network,
  Code,
  Filter,
  Compass,
  FileJson,
  Github,
  ClipboardCopy,
  CheckCircle,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useRoute } from "vue-router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();
const route = useRoute();

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);

// Props
const props = defineProps({
  project: {
    type: Object,
    required: true
  }
});

// Track if URL was copied
const copiedUrl = ref(false);

// Copy to clipboard function
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
  copiedUrl.value = true;
  setTimeout(() => {
    copiedUrl.value = false;
  }, 2000);
};

// Code snippets
const sqliteCodeSnippet = `// Install repo-md package first
// npm install repo-md

import { RepoMD } from '@repo-md/client';

// Initialize with your project details
const repo = new RepoMD({
  org: 'your-org',
  project: 'your-project'
});

// Get SQLite database URL
const sqliteUrl = await repo.getSqliteUrl();
console.log(sqliteUrl);
`;

const helixCodeSnippet = `// Install repo-md package first
// npm install repo-md

import { RepoMD } from '@repo-md/client';

// Initialize with your project details
const repo = new RepoMD({
  org: 'your-org',
  project: 'your-project'
});

// Get Helix database URL
const helixUrl = await repo.getHelixUrl();
console.log(helixUrl);
`;
</script>

<template>
  <PageHeadingBar title="Database" subtitle="Access and search your content using database">
    <template #actions>
        <router-link
              v-if="props.project.activeRev"
              :to="`/${route.params.orgId}/${route.params.projectId}/${props.project.activeRev}/sqlite`"
            >
              <Button
                variant="outline"
                size="sm"
                class="shrink-0"
              >
                <Database class="w-4 h-4" />
                <span class="ml-2">SQLite playground</span>
              </Button>
            </router-link>
            <Button v-else variant="outline" size="sm" class="shrink-0" disabled>
              <Database class="w-4 h-4" />
              <span class="ml-2">SQLite playground</span>
            </Button>
    </template>
    <!--
    <template #secondary>
      <div>
        <router-link :to="`/{currentOrg.handle}/~/settings`">
          <Button class="flex items-center" size="sm" variant="ghost">
            <CornerLeftUp class="w-4 h-4 mr-2" />
            Go to Team settings
          </Button>
        </router-link>
      </div>
    </template>-->
  </PageHeadingBar>

  <div class="container px-4 py-6">
    <div class="mb-8 bg-white p-6 rounded-lg shadow-sm">
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Content Database Solutions</h2>
        <p class="text-muted-foreground">
          We package your project content into two types of database, making it easy to do anything with the content.
          For basic use cases, we recommend using the direct JSON API—it's often the fastest and simplest way to load content.
          For similarity search or advanced filtering, you may find our database options more convenient.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <!-- SQLite Card -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <Database class="h-5 w-5 text-primary" />
            <CardTitle>SQLite Database</CardTitle>
          </div>
          <CardDescription>Lightweight, portable SQL database</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div class="flex items-start gap-2">
              <Table class="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 class="font-medium">Simple Queries</h3>
                <p class="text-sm text-muted-foreground">Perfect for standard filtering and sorting operations</p>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <FileJson class="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 class="font-medium">Structured Data</h3>
                <p class="text-sm text-muted-foreground">All your content in a structured, relational format</p>
              </div>
            </div>
            <div class="bg-muted p-4 rounded-md mt-4">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium">Get SQLite Database URL</h4>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <ClipboardCopy class="h-4 w-4" />
                </Button>
              </div>
              <pre class="text-xs overflow-x-auto p-2 bg-card rounded-md border">{{ sqliteCodeSnippet }}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Helix Card -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <Network class="h-5 w-5 text-primary" />
            <CardTitle>Helix Database</CardTitle>
          </div>
          <CardDescription>Graph + vector database for advanced scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div class="flex items-start gap-2">
              <Compass class="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 class="font-medium">Similarity Search</h3>
                <p class="text-sm text-muted-foreground">Find content based on semantic similarity</p>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <Filter class="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 class="font-medium">Advanced Filtering</h3>
                <p class="text-sm text-muted-foreground">Complex queries combining graph relationships and vector search</p>
              </div>
            </div>
            <div class="bg-muted p-4 rounded-md mt-4">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium">Get Helix Database URL</h4>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <ClipboardCopy class="h-4 w-4" />
                </Button>
              </div>
              <pre class="text-xs overflow-x-auto p-2 bg-card rounded-md border">{{ helixCodeSnippet }}</pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Additional Note -->
    <div class="bg-white p-6 rounded-lg shadow-sm">
      <div class="flex items-center gap-2 mb-4">
        <Code class="w-5 h-5 text-primary" />
        <h2 class="text-lg font-semibold">Alternative Approach</h2>
      </div>
      <p class="text-muted-foreground mb-4">
        You can also load embeddings and graph information directly from JSON and insert these into your own database if you prefer.
        This gives you complete flexibility in how you structure and query your data.
      </p>
      <div class="flex items-center gap-2 mt-6">
        <Github class="w-4 h-4" />
        <a href="#" class="text-primary text-sm hover:underline">View examples on GitHub</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styling can be added here if needed */
</style>