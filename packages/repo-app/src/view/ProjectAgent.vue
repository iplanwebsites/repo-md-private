<script setup>
import { ref, computed } from "vue";
import { useOrgStore } from "@/store/orgStore";
import { useRouter, useRoute } from "vue-router";
import { getAgentUrl, getMCPServerUrl, getA2AServerUrl } from "@/lib/utils/repoUrlUtils";
import {
  Search,
  MessagesSquare,
  Bot,
  Cpu,
  Plug,
  Code,
  Braces,
  ExternalLink,
  MessageCircle,
  PlusCircle,
  Sparkles,
  Github,
  Puzzle,
  Compass,
  Layers,
  Brain,
  Settings,
  ClipboardCopy,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast/use-toast";
import PageHeadingBar from "@/components/PageHeadingBar.vue";

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();
const route = useRoute();
const { toast } = useToast();

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);

// Props
const props = defineProps({
  project: {
    type: Object,
    required: true
  }
});

// Agent URL
const agentUrl = computed(() => {
  return getAgentUrl(props.project?._id);
});

// MCP URL
const mcpUrl = computed(() => {
  console.log('ProjectAgent - project prop:', props.project);
  console.log('ProjectAgent - project._id:', props.project?._id);
  const url = getMCPServerUrl(props.project?._id);
  console.log('ProjectAgent - generated MCP URL:', url);
  return url;
});

// A2A URL
const a2aUrl = computed(() => {
  return getA2AServerUrl(props.project?._id);
});

// Copy Agent URL to clipboard
const copyAgentUrl = () => {
  navigator.clipboard.writeText(agentUrl.value);
  toast({
    title: "Copied",
    description: "Agent URL copied to clipboard",
    duration: 3000,
  });
};

// Copy MCP URL to clipboard
const copyMcpUrl = () => {
  navigator.clipboard.writeText(mcpUrl.value);
  toast({
    title: "Copied",
    description: "MCP URL copied to clipboard",
    duration: 3000,
  });
};

// Open Agent in new tab
const openAgent = () => {
  window.open(agentUrl.value, '_blank');
};

// Integration code snippets
const openaiIntegrationSnippet = `// Using OpenAI with repo.md MCP
// First install the OpenAI SDK
// npm install openai

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'your-openai-api-key'
});

// Use repo.md MCP URL as a retrieval tool
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "system", 
      content: "You are a helpful assistant that answers questions about documentation."
    },
    {
      role: "user",
      content: "How do I implement the feature described in the docs?"
    }
  ],
  tools: [{
    type: "retrieval",
    retrieval: {
      source: "${mcpUrl.value || 'https://mcp.repo.md/project/id/YOUR_PROJECT_ID'}"
    }
  }]
});
`;

const claudeIntegrationSnippet = `// Using Claude with repo.md A2A
// First install the Anthropic SDK
// npm install @anthropic-ai/sdk

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: 'your-anthropic-api-key'
});

// Use repo.md A2A for augmented contexts
const message = await anthropic.messages.create({
  model: "claude-3-opus-20240229",
  system: "You are a helpful assistant that answers questions about documentation.",
  messages: [{
    role: "user",
    content: "How do I implement the feature described in the docs?"
  }],
  tools: [{
    name: "repo_md_context",
    description: "Fetch context from repository documentation",
    input_schema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          enum: ["${a2aUrl.value || 'https://a2a.repo.md/project/id/YOUR_PROJECT_ID'}"]
        },
        query: { type: "string" }
      },
      required: ["endpoint", "query"]
    }
  }]
});
`;

const customAgentSnippet = `// Create a custom agent with repo.md MCP and A2A
// First install necessary packages
// npm install openai express cors

import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: 'your-openai-api-key'
});

// Define your agent endpoint
app.post('/agent', async (req, res) => {
  const { message } = req.body;
  
  // Fetch context from repo.md
  const response = await fetch('${mcpUrl.value || 'https://mcp.repo.md/project/id/YOUR_PROJECT_ID'}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: message })
  });
  
  const context = await response.json();
  
  // Use OpenAI to create a response with context
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that answers questions about the project. Use the provided context."
      },
      {
        role: "user",
        content: \`Context: \${JSON.stringify(context)}\nQuestion: \${message}\`
      }
    ]
  });
  
  res.json({ response: completion.choices[0].message.content });
});

app.listen(3000, () => {
  console.log('Custom agent running on port 3000');
});
`;
</script>

<template>
  <PageHeadingBar title="AI Agent" subtitle="Interact with your content through conversational AI">
    <template #actions>
      <div class="flex gap-2">
   
     
          <Button :to="`/${route.params.orgId}/${route.params.projectId}/settings/ai`" variant="outline" class="flex items-center gap-1">
            <Settings class="w-4 h-4" />
            <span> Settings</span>
          </Button>
      
        <Button variant="" class="flex items-center gap-1" @click="openAgent">
          <MessageCircle class="w-4 h-4" />
          <span>Talk with Agent</span>
        </Button>
      </div>
    </template>
  </PageHeadingBar>

  <div class="container px-4 py-6">
    <div class="mb-8 bg-white p-6 rounded-lg shadow-sm">
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Conversational AI for Your Content</h2>
        <p class="text-muted-foreground">
          Repo.md AI agents allow users to interact with your content through natural language conversations.
          Our agents understand your content's context and can provide accurate, helpful responses based on your project's documentation, articles, or any other content.
        </p>
      </div>
    </div>

    <!-- Your Public Agent Section and Preview -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
      <!-- Agent Info Card -->
      <Card>
        <CardHeader>
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <MessagesSquare class="h-5 w-5 text-primary" />
              <CardTitle>Your Public Agent</CardTitle>
            </div>
            <Button variant="outline" size="sm" @click="openAgent" class="flex items-center gap-1">
              <ExternalLink class="h-4 w-4" />
              <span>Open Agent</span>
            </Button>
          </div>
          <CardDescription>Anyone can chat with your content through this public URL</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-6">
            <!-- URL Link -->
            <div class="flex justify-between items-center">
              <div class="flex-1">
                <h3 class="text-sm font-medium text-muted-foreground mb-2">Public URL</h3>
                <a
                  :href="agentUrl"
                  target="_blank"
                  class=" hover:underline text-blue-600 flex items-center gap-1 font-medium"
                >
                  {{ agentUrl }}
                  <ExternalLink class="h-3.5 w-3.5 ml-1" />
                </a>
              </div>
              <Button variant="outline" size="sm" @click="copyAgentUrl" class="flex items-center gap-1">
                <ClipboardCopy class="h-4 w-4" />
                <span>Copy</span>
              </Button>
            </div>

            <!-- Settings Properties -->
            <div class="grid grid-cols-2 gap-4 mt-4">
              <div class="space-y-1">
                <h4 class="text-sm font-medium text-muted-foreground">UI Style</h4>
                <p class="font-medium">Conversational (ChatGPT)</p>
              </div>
              <div class="space-y-1">
                <h4 class="text-sm font-medium text-muted-foreground">Model</h4>
                <p class="font-medium">GPT-4o</p>
              </div>
            </div>

            <div class="space-y-1">
            <h4 class="text-sm font-medium text-muted-foreground">Personality</h4>
            <p class="font-medium">Agressively helpful</p>
        </div>
            <!-- Help Note -->
            <div class="mt-2 bg-primary/5 p-3 rounded-md flex items-center gap-2 text-sm">
              <Sparkles class="h-4 w-4 text-primary flex-shrink-0" />
              <span>Share this URL with anyone who needs to chat with your content. No login required!</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Search-like UI Preview -->
      <div class="border rounded-lg overflow-hidden">
        <div class="bg-red-500 p-4">
          <div class="flex items-center justify-between mb-4">
            <div class="h-6 w-24 bg-white/30 rounded"></div>
            <div class="h-6 w-6 bg-white/30 rounded-full"></div>
          </div>

          <!-- Search Box -->
          <div class="bg-white rounded-lg p-3 w-full mb-4 flex items-center justify-between">
            <div class="h-5 w-36 bg-gray-100 rounded"></div>
            <Search class="h-5 w-5 text-gray-400" />
          </div>

          <!-- Result bars -->
          <div class="space-y-3">
            <div class="h-4 w-full bg-white/20 rounded"></div>
            <div class="h-4 w-5/6 bg-white/20 rounded"></div>
            <div class="h-4 w-4/6 bg-white/20 rounded"></div>
            <div class="h-4 w-3/4 bg-white/20 rounded"></div>
          </div>
        </div>

        <div class="p-4 bg-white">
          <div class="space-y-4">
            <!-- Result sections -->
            <div>
              <div class="h-5 w-36 bg-gray-200 rounded mb-2"></div>
              <div class="space-y-1">
                <div class="h-3 w-full bg-gray-100 rounded"></div>
                <div class="h-3 w-11/12 bg-gray-100 rounded"></div>
                <div class="h-3 w-5/6 bg-gray-100 rounded"></div>
              </div>
            </div>

            <div>
              <div class="h-5 w-44 bg-gray-200 rounded mb-2"></div>
              <div class="space-y-1">
                <div class="h-3 w-full bg-gray-100 rounded"></div>
                <div class="h-3 w-4/5 bg-gray-100 rounded"></div>
                <div class="h-3 w-3/4 bg-gray-100 rounded"></div>
              </div>
            </div>

            <div>
              <div class="h-5 w-40 bg-gray-200 rounded mb-2"></div>
              <div class="space-y-1">
                <div class="h-3 w-11/12 bg-gray-100 rounded"></div>
                <div class="h-3 w-full bg-gray-100 rounded"></div>
                <div class="h-3 w-2/3 bg-gray-100 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Claude MCP Configuration Section -->
    <div class="mb-10">
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <Brain class="h-5 w-5 text-primary" />
            <CardTitle>Configure Claude Integration</CardTitle>
          </div>
          <CardDescription>Connect Claude to your repository using MCP (Model Context Protocol)</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <!-- MCP URL Display -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-center gap-2 mb-2">
                <Settings class="h-4 w-4 text-blue-600" />
                <h3 class="font-medium text-blue-900">MCP Server URL</h3>
              </div>
              <div class="bg-white border rounded p-3 font-mono text-sm break-all">
                {{ mcpUrl }}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                class="mt-2" 
                @click="copyMcpUrl"
              >
                <ClipboardCopy class="h-4 w-4 mr-1" />
                Copy URL
              </Button>
            </div>
            
            <!-- Configuration Steps -->
            <div class="space-y-3">
              <h4 class="font-medium">Configuration Steps:</h4>
              <ol class="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Open Claude and go to <a href="https://claude.ai/settings/integrations" target="_blank" class="text-blue-600 hover:underline font-medium">Settings → Integrations</a></li>
                <li>Add a new MCP server integration</li>
                <li>Paste the MCP URL above</li>
                <li>Claude will now have access to your repository content</li>
              </ol>
            </div>
            
            <!-- Benefits -->
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <div class="flex items-center gap-2 mb-2">
                <Sparkles class="h-4 w-4 text-green-600" />
                <h4 class="font-medium text-green-900">What this enables:</h4>
              </div>
              <ul class="text-sm text-green-800 space-y-1">
                <li>• Claude can read and understand your repository content</li>
                <li>• Ask questions about your codebase, documentation, or files</li>
                <li>• Get contextual answers based on your actual project</li>
                <li>• No need to copy-paste code or docs into conversations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
      <!-- Connect Card -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <Plug class="h-5 w-5 text-primary" />
            <CardTitle>Connect with AI Tools</CardTitle>
          </div>
          <CardDescription>Integrate with ChatGPT, Claude, or other AI platforms</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div class="flex items-start gap-2">
              <Cpu class="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 class="font-medium">MCP & A2A Integration</h3>
                <p class="text-sm text-muted-foreground">Use our Model Context Protocol and Agent-to-Agent communication protocols</p>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <Compass class="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 class="font-medium">Seamless Knowledge Access</h3>
                <p class="text-sm text-muted-foreground">Let major AI models access your content directly</p>
              </div>
            </div>
            <div class="bg-muted p-4 rounded-md mt-4 max-h-60 overflow-auto">
              <div class="mb-2">
                <h4 class="text-sm font-medium">OpenAI Integration</h4>
              </div>
              <pre class="text-xs overflow-x-auto p-2 bg-card rounded-md border">{{ openaiIntegrationSnippet }}</pre>
            </div>
            <div class="bg-muted p-4 rounded-md mt-4 max-h-60 overflow-auto">
              <div class="mb-2">
                <h4 class="text-sm font-medium">Claude Integration</h4>
              </div>
              <pre class="text-xs overflow-x-auto p-2 bg-card rounded-md border">{{ claudeIntegrationSnippet }}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Custom Agent Card -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <Sparkles class="h-5 w-5 text-primary" />
            <CardTitle>Build Custom Agents</CardTitle>
          </div>
          <CardDescription>Create completely custom AI experiences for your users</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div class="flex items-start gap-2">
              <Puzzle class="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 class="font-medium">Flexible Implementation</h3>
                <p class="text-sm text-muted-foreground">Build agents tailored to your specific needs and use cases</p>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <Layers class="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 class="font-medium">Endless Possibilities</h3>
                <p class="text-sm text-muted-foreground">Create specialized agents for different parts of your content</p>
              </div>
            </div>
            <div class="bg-muted p-4 rounded-md mt-4 max-h-60 overflow-auto">
              <div class="mb-2">
                <h4 class="text-sm font-medium">Custom Agent Example</h4>
              </div>
              <pre class="text-xs overflow-x-auto p-2 bg-card rounded-md border">{{ customAgentSnippet }}</pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Coming Soon Section -->
    <div class="bg-white p-6 rounded-lg shadow-sm">
      <div class="flex items-center gap-2 mb-4">
        <PlusCircle class="w-5 h-5 text-primary" />
        <h2 class="text-lg font-semibold">Coming Soon: Agent Templates</h2>
      </div>
      <p class="text-muted-foreground mb-4">
        We're working on a library of agent templates for common use cases. These templates will make it even easier 
        to create specialized agents like technical support assistants, product experts, learning guides, and more.
        Stay tuned for updates!
      </p>
      <div class="flex items-center gap-2 mt-6">
        <Github class="w-4 h-4" />
        <a href="https://github.com/repo-md" class="text-primary text-sm hover:underline">Follow our GitHub for updates</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styling can be added here if needed */
</style>