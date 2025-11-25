<script setup>
import { ref, computed } from "vue";
import { useOrgStore } from "@/store/orgStore";
import {
  Search,
  User,
  CreditCard,
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
  Globe,
  PencilRuler,
  Sparkles,
  PlusCircle,
  Settings,
  Code,
  Palette,
  Laptop,
  Pencil,
  Bot,
  Copy,
  Eye,} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "vue-router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);

// Props
defineProps({
  project: {
    type: Object,
    required: true
  }
});

// Sample data (in a real app, this would come from API)
const websiteInfo = ref({
  template: "Modern Blog",
  domains: [
    { name: "example.pushmd.app", isPrimary: true, status: "active" },
    { name: "blog.example.com", isPrimary: false, status: "inactive" }
  ],
  theme: "Light Modern",
  lastUpdated: "2 hours ago"
});

// Sample starter prompt for AI
const aiStarterPrompt = `Create a modern, responsive blog website using repo.md for the content API with the following features:
- Homepage with featured posts and categories
- Article pages with rich content support (markdown, code blocks, images)
- About page and contact form
- Dark/light mode toggle 
- RSS feed
- Search functionality

The blog should have a clean, minimalist design with good typography and reading experience.`;

// Copy prompt to clipboard
const copyPrompt = () => {
  navigator.clipboard.writeText(aiStarterPrompt);
  // In a real app, you would add a toast notification here
};

const route=useRoute();
</script>

<template>
  <PageHeadingBar title="Site" subtitle="Your auto-generated website">
   
    <template #actions>          
      <div class="flex gap-2">
   
     
   <Button :to="`/${route.params.orgId}/${route.params.projectId}/settings/theme`" variant="outline" class="flex items-center gap-1">
     <Settings class="w-4 h-4" />
     <span> Settings</span>
   </Button>

      <Button variant="" class="flex items-center gap-2">
      
        Visit Site
        <ExternalLink class="w-4 h-4 ml-2" />
      </Button>
      </div>
  </template> 
  </PageHeadingBar>

  <div class="container px-4 py-6">
    <div class="mb-8 bg-white p-6 rounded-lg shadow-sm">
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Simple Website Hosting</h2>
        <p class="text-muted-foreground">
          Launch and host simple website templates that automatically update when you edit your content.
          One of the simplest blogging engines and ways to publish content online.
        </p>
      </div>
    </div>

    <!-- Website Template Info -->
    <Card className="mb-6">
      <CardHeader>
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <Globe class="h-5 w-5 text-primary" />
            <CardTitle>Website Details</CardTitle>
          </div>
          <Button size="sm" variant="outline" class="flex items-center gap-1">
            <Settings class="h-4 w-4" />
            <span>Site Settings</span>
          </Button>
        </div>
        <CardDescription>Current website configuration</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-6">
          <!-- Template Info -->
          <div class="flex justify-between items-start">
            <div class="space-y-1">
              <h3 class="text-sm font-medium text-muted-foreground">Template</h3>
              <p class="font-medium">{{ websiteInfo.template }}</p>
            </div>
            <Button size="sm" variant="outline" class="flex items-center gap-1">
              <Palette class="h-4 w-4" />
              <span>Change Theme</span>
            </Button>
          </div>

          <!-- Domain Info -->
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <h3 class="text-sm font-medium text-muted-foreground">Domains</h3>
              <Button size="sm" variant="outline" class="flex items-center gap-1">
                <PlusCircle class="h-4 w-4" />
                <span>Add Domain</span>
              </Button>
            </div>

            <div class="bg-muted rounded-md p-3 space-y-2">
              <div v-for="(domain, index) in websiteInfo.domains" :key="index"
                   class="flex justify-between items-center py-2 px-1 border-b last:border-0 border-muted-foreground/20">
                <div class="flex items-center gap-2">
                  <Link class="h-4 w-4 text-primary" />
                  <span class="font-medium">{{ domain.name }}</span>
                  <span v-if="domain.isPrimary"
                        class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Primary</span>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full"
                      :class="domain.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">
                  {{ domain.status }}
                </span>
              </div>
            </div>
          </div>

          <div class="bg-primary/5 p-3 rounded-md flex items-center gap-2 text-sm">
            <Sparkles class="h-4 w-4 text-primary flex-shrink-0" />
            <span>Content updates automatically publish to your site when you make changes to your repository.</span>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Custom Sites Info -->
    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <PencilRuler class="h-5 w-5 text-primary" />
          <CardTitle>Custom Sites</CardTitle>
        </div>
        <CardDescription>Build your own custom website using our content</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-6">
          <p class="text-muted-foreground">
            It's easy to start from one of our templates or generate a new site from scratch using AI code generators.
            You can create your own custom design while still leveraging our content management.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div class="border rounded-md p-4 flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <Laptop class="h-5 w-5 text-primary" />
                <h3 class="font-medium">Start from Template</h3>
              </div>
              <p class="text-sm text-muted-foreground">
                Customize one of our existing templates to match your brand and needs.
              </p>
              <Button size="sm" variant="outline" class="mt-auto w-full sm:w-auto">
                Browse Templates
              </Button>
            </div>

            <div class="border rounded-md p-4 flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <Bot class="h-5 w-5 text-primary" />
                <h3 class="font-medium">AI Generated Site</h3>
              </div>
              <p class="text-sm text-muted-foreground">
                Use AI to generate a custom site from scratch with chatGPT or bolt.new.
              </p>
              <Button size="sm" variant="outline" class="mt-auto w-full sm:w-auto">
                Try AI Builder
              </Button>
            </div>
          </div>

          <!-- AI Starter Prompt -->
          <div class="mt-6 border rounded-md overflow-hidden">
            <div class="bg-muted p-3 flex justify-between items-center">
              <div class="flex items-center gap-2">
                <Code class="h-4 w-4" />
                <h3 class="text-sm font-medium">Starter Prompt for AI</h3>
              </div>
              <Button variant="ghost" size="sm" class="h-8 flex items-center gap-1" @click="copyPrompt">
                <Copy class="h-4 w-4" />
                <span>Copy</span>
              </Button>
            </div>
            <div class="p-3 bg-card border-t">
              <pre class="text-xs whitespace-pre-wrap">{{ aiStarterPrompt }}</pre>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
/* Additional styling can be added here if needed */
</style>
