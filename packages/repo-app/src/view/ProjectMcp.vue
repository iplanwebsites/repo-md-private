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
	Code,
	Settings,
	Terminal,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useRoute } from "vue-router";
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

// UI state
const activeTab = ref("playground");

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);
const projectId = computed(() => props.project?._id || route.params.projectId);
const projectSlug = computed(
	() => props.project?.slug || route.params.projectId,
);
const projectName = computed(() => props.project?.name || projectSlug.value);
const orgHandle = computed(() => route.params.orgId);

// MCP endpoint
const mcpEndpoint = computed(
	() => `https://mcp.repo.md/api/${orgHandle.value}/${projectSlug.value}`,
);

// Copy to clipboard
const copyToClipboard = (text) => {
	navigator.clipboard.writeText(text);
	// You could add a toast notification here
};

// Available models
const availableModels = ref([
	{
		id: "claude-3-opus-20240229",
		name: "Claude 3 Opus",
		description: "Most powerful model for complex tasks",
	},
	{
		id: "claude-3-sonnet-20240229",
		name: "Claude 3 Sonnet",
		description: "Balanced performance and speed",
	},
	{
		id: "claude-3-haiku-20240307",
		name: "Claude 3 Haiku",
		description: "Fast responses for simple interactions",
	},
	{
		id: "gpt-4-turbo",
		name: "GPT-4 Turbo",
		description: "Advanced reasoning capabilities",
	},
]);

// Selected model
const selectedModel = ref("claude-3-sonnet-20240229");

// Set active tab
const setActiveTab = (tab) => {
	activeTab.value = tab;
};
</script>

<template>
  <PageHeadingBar
    title="MCP Server"
    subtitle="Interact with your content using AI models"
  >
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

  <div class="container p-6">
    <!-- Tabs -->
    <div class="flex space-x-4 border-b mb-6">
      <button 
        class="px-4 py-2 focus:outline-none"
        :class="activeTab === 'playground' ? 'border-b-2 border-primary font-medium' : 'text-gray-500 hover:text-gray-700'"
        @click="setActiveTab('playground')"
      >
        <span class="flex items-center">
          <Terminal class="h-4 w-4 mr-2" />
          Playground
        </span>
      </button>
      <button 
        class="px-4 py-2 focus:outline-none"
        :class="activeTab === 'integration' ? 'border-b-2 border-primary font-medium' : 'text-gray-500 hover:text-gray-700'"
        @click="setActiveTab('integration')"
      >
        <span class="flex items-center">
          <Code class="h-4 w-4 mr-2" />
          Integration
        </span>
      </button>
      <button 
        class="px-4 py-2 focus:outline-none"
        :class="activeTab === 'settings' ? 'border-b-2 border-primary font-medium' : 'text-gray-500 hover:text-gray-700'"
        @click="setActiveTab('settings')"
      >
        <span class="flex items-center">
          <Settings class="h-4 w-4 mr-2" />
          Settings
        </span>
      </button>
    </div>

    <!-- Tab content -->
    <div v-if="activeTab === 'playground'" class="space-y-6">
      <div class="bg-white rounded-lg border shadow-sm p-6">
        <h2 class="text-lg font-semibold mb-4">MCP Playground</h2>
        <p class="text-sm text-gray-600 mb-6">
          Test your MCP configuration by interacting with your content using AI models.
        </p>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Select Model</label>
          <select 
            v-model="selectedModel"
            class="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option v-for="model in availableModels" :key="model.id" :value="model.id">
              {{ model.name }} - {{ model.description }}
            </option>
          </select>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Your Question</label>
          <textarea 
            class="w-full px-3 py-2 border rounded-md text-sm h-32"
            placeholder="Ask a question about your content..."
          ></textarea>
        </div>
        
        <div class="flex justify-end">
          <Button>Send Request</Button>
        </div>
      </div>
      
      <div class="bg-white rounded-lg border shadow-sm p-6">
        <h2 class="text-lg font-semibold mb-4">Response</h2>
        <div class="bg-gray-50 border rounded-md p-4 min-h-32 text-sm">
          The response will appear here...
        </div>
      </div>
    </div>
    
    <div v-else-if="activeTab === 'integration'" class="space-y-6">
      <div class="bg-white rounded-lg border shadow-sm p-6">
        <h2 class="text-lg font-semibold mb-4">API Integration</h2>
        <p class="text-sm text-gray-600 mb-6">
          Use the following endpoint to integrate MCP with your application.
        </p>
        
        <div>
          <h3 class="text-sm font-medium mb-2">MCP Endpoint</h3>
          <div class="flex items-center max-w-lg">
            <Input :value="mcpEndpoint" class="font-mono text-sm" disabled />
            <Button variant="outline" class="ml-2" @click="() => copyToClipboard(mcpEndpoint)">
              <ClipboardCopy class="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div class="mt-6">
          <h3 class="text-sm font-medium mb-2">Example Request</h3>
          <div class="bg-gray-50 p-4 rounded-md">
            <pre class="text-xs overflow-x-auto">
fetch("{{ mcpEndpoint }}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    model: "{{ selectedModel }}",
    messages: [
      {
        role: "user",
        content: "What's in this repository?"
      }
    ]
  })
})
.then(response => response.json())
.then(data => console.log(data));</pre>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else-if="activeTab === 'settings'" class="space-y-6">
      <div class="bg-white rounded-lg border shadow-sm p-6">
        <h2 class="text-lg font-semibold mb-4">MCP Settings</h2>
        <p class="text-sm text-gray-600 mb-6">
          Configure your MCP settings for this project.
        </p>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Default Model</label>
            <select class="w-full px-3 py-2 border rounded-md text-sm">
              <option v-for="model in availableModels" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">Model Context Window</label>
            <div class="flex items-center space-x-2">
              <input type="range" min="1000" max="100000" step="1000" value="15000" class="w-full" />
              <span class="text-sm">15k</span>
            </div>
          </div>
          
          <div>
            <label class="flex items-center space-x-2">
              <input type="checkbox" class="rounded text-primary" />
              <span class="text-sm">Enable content search</span>
            </label>
          </div>
          
          <div>
            <label class="flex items-center space-x-2">
              <input type="checkbox" class="rounded text-primary" />
              <span class="text-sm">Enable image analysis</span>
            </label>
          </div>
          
          <div>
            <label class="flex items-center space-x-2">
              <input type="checkbox" class="rounded text-primary" />
              <span class="text-sm">Enable code execution</span>
            </label>
          </div>
          
          <div class="pt-4">
            <Button>Save Settings</Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styling can be added here if needed */
</style>
