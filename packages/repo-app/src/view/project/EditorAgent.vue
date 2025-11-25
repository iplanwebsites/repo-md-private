<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";
import {
  MessageCircle,
  Send,
  Bot,
  User,
  RotateCw,
  Settings,
  FileText,
  Wand2,
  History,
  Plus,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Wrench,
  FileEdit,
  FilePlus,
  GripVertical,
  Code,
  FileCode,
  Eye,
  X,
  Minimize2,
  ExternalLink,
} from "lucide-vue-next";

// Props for project data passed from parent
const props = defineProps({
  project: {
    type: Object,
    default: null,
  },
});

// Route and router
const route = useRoute();
const router = useRouter();
const { toast } = useToast();

// Reactive state
const isLoading = ref(false);
const hasActiveSession = ref(false);
const currentMessage = ref("");
const chatMessages = ref([]);
const selectedMessageId = ref(null);
const sessionId = ref(null);
const selectedFileChange = ref(null);

// Resizable panes state
const leftPaneWidth = ref(50);
const isDragging = ref(false);
const containerRef = ref(null);

// Layout state
const showTwoColumnLayout = computed(() => hasActiveSession.value && chatMessages.value.length > 0);

// Project domain
const projectDomain = computed(() => {
  return props.project?.domain || `${props.project?.slug || route.params.projectId}.api.repo.md`;
});

// Message input handling
const sendMessage = async () => {
  if (!currentMessage.value.trim()) return;
  
  const userMessage = {
    id: Date.now().toString(),
    type: 'user',
    content: currentMessage.value,
    timestamp: new Date(),
    status: 'sent'
  };
  
  chatMessages.value.push(userMessage);
  const messageContent = currentMessage.value;
  currentMessage.value = "";
  
  // Switch to two-column layout
  hasActiveSession.value = true;
  
  // Simulate API call to editor agent
  isLoading.value = true;
  
  try {
    // Mock API call for now - replace with actual tRPC call when endpoint is ready
    // const response = await trpc.agent.chat.mutate({
    //   projectId: props.project?._id,
    //   message: messageContent,
    //   sessionId: sessionId.value
    // });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Mock response for demonstration
    const mockResponse = {
      message: generateMockResponse(messageContent),
      sessionId: sessionId.value || `session_${Date.now()}`,
      actions: [
        { id: 'edit', label: 'Edit Content', icon: 'Edit' },
        { id: 'improve', label: 'Improve SEO', icon: 'TrendingUp' }
      ],
      toolCalls: Math.random() > 0.5 ? [
        { id: 'tool1', name: 'read_file', args: { path: '/src/content/blog.md' } },
        { id: 'tool2', name: 'analyze_content', args: { type: 'seo' } }
      ] : [],
      fileChanges: Math.random() > 0.3 ? [
        { id: 'file1', path: '/src/content/new-post.md', type: 'created', content: '# New Blog Post\n\nThis is the content of the new blog post...' },
        { id: 'file2', path: '/src/content/existing.md', type: 'edited', content: '# Updated Content\n\nThis content has been improved...' }
      ] : []
    };
    
    const agentMessage = {
      id: (Date.now() + 1).toString(),
      type: 'agent',
      content: mockResponse.message,
      timestamp: new Date(),
      status: 'received',
      actions: mockResponse.actions,
      toolCalls: mockResponse.toolCalls,
      fileChanges: mockResponse.fileChanges
    };
    
    chatMessages.value.push(agentMessage);
    sessionId.value = mockResponse.sessionId;
    
  } catch (error) {
    console.error('Error sending message:', error);
    toast({
      title: "Error",
      description: "Failed to send message to Editor Agent",
      variant: "destructive",
    });
    
    // Add error message to chat
    const errorMessage = {
      id: (Date.now() + 1).toString(),
      type: 'agent',
      content: "Sorry, I'm having trouble processing your request right now. Please try again later.",
      timestamp: new Date(),
      status: 'error'
    };
    
    chatMessages.value.push(errorMessage);
  } finally {
    isLoading.value = false;
  }
};

// Mock response generator
const generateMockResponse = (userMessage) => {
  const responses = [
    "I can help you with that! Let me analyze your request and provide some suggestions.",
    "Great idea! I'll help you create engaging content that resonates with your audience.",
    "I understand what you're looking for. Let me break this down into actionable steps.",
    "Perfect! I can assist with content creation, editing, and optimization. Here's my approach:",
    "I'm ready to help you improve your content strategy. Let me provide some recommendations.",
  ];
  
  if (userMessage.toLowerCase().includes('blog')) {
    return "I'll help you create a compelling blog post. What's your target audience and main topic?";
  } else if (userMessage.toLowerCase().includes('seo')) {
    return "Great! I can optimize your content for search engines. Let me analyze your current approach and suggest improvements.";
  } else if (userMessage.toLowerCase().includes('edit') || userMessage.toLowerCase().includes('improve')) {
    return "I'll review and enhance your content. Please share what you'd like me to focus on - structure, tone, clarity, or engagement?";
  } else {
    return responses[Math.floor(Math.random() * responses.length)];
  }
};

// Continue previous session
const continuePreviousSession = async () => {
  isLoading.value = true;
  
  try {
    // Mock previous session data - replace with actual tRPC call when endpoint is ready
    // const response = await trpc.agent.getSession.query({
    //   projectId: props.project?._id
    // });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock previous session data
    const mockPreviousMessages = [
      {
        id: 'prev_1',
        type: 'user',
        content: 'Help me create a blog post about sustainable technology',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        status: 'sent'
      },
      {
        id: 'prev_2',
        type: 'agent',
        content: 'I\'d be happy to help you create a blog post about sustainable technology! This is a timely and important topic. Let me suggest a structure that will engage your readers and provide valuable insights.',
        timestamp: new Date(Date.now() - 3590000),
        status: 'received',
        actions: [
          { id: 'outline', label: 'Create Outline', icon: 'FileText' },
          { id: 'research', label: 'Research Topics', icon: 'Search' }
        ]
      }
    ];
    
    if (Math.random() > 0.3) { // 70% chance of having previous session
      chatMessages.value = mockPreviousMessages;
      sessionId.value = `session_${Date.now() - 3600000}`;
      hasActiveSession.value = true;
      
      toast({
        title: "Session Restored",
        description: "Previous conversation has been loaded",
      });
    } else {
      toast({
        title: "No Previous Session",
        description: "No previous conversation found",
        variant: "destructive",
      });
    }
  } catch (error) {
    console.error('Error loading previous session:', error);
    toast({
      title: "Error",
      description: "Failed to load previous session",
      variant: "destructive",
    });
  } finally {
    isLoading.value = false;
  }
};

// Message selection
const selectMessage = (messageId) => {
  selectedMessageId.value = messageId;
  selectedFileChange.value = null; // Clear file selection when selecting a message
};

// Get selected message details
const selectedMessage = computed(() => {
  if (!selectedMessageId.value) return null;
  return chatMessages.value.find(msg => msg.id === selectedMessageId.value);
});

// Handle key press in textarea
const handleKeyPress = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};

// Clear conversation
const clearConversation = () => {
  chatMessages.value = [];
  hasActiveSession.value = false;
  selectedMessageId.value = null;
  sessionId.value = null;
};

// Starter prompts
const starterPrompts = [
  "Create a new blog post about...",
  "Review and improve this content",
  "Generate SEO metadata",
  "Plan a content roadmap",
  "Write product documentation",
  "Create marketing copy",
  "Generate a landing page",
  "Write API documentation",
  "Create email templates",
  "Draft social media posts",
  "Write release notes",
  "Create FAQ content"
];

const useStarterPrompt = (prompt) => {
  currentMessage.value = prompt;
};

// Resizable pane handlers
const startDragging = (e) => {
  isDragging.value = true;
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDragging);
  e.preventDefault();
};

const handleDrag = (e) => {
  if (!isDragging.value || !containerRef.value) return;
  
  const containerRect = containerRef.value.getBoundingClientRect();
  const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
  
  // Limit the width between 30% and 70%
  leftPaneWidth.value = Math.min(Math.max(newLeftWidth, 30), 70);
};

const stopDragging = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDragging);
};

// File change selection
const selectFileChange = (fileChange) => {
  selectedFileChange.value = fileChange;
  selectedMessageId.value = null;
};

// Handle cleanup
onBeforeUnmount(() => {
  stopDragging();
});
</script>

<template>
  <div class="bg-slate-50">
    <!-- Page Header - Only show when not in chat mode -->
    <PageHeadingBar 
      v-if="!showTwoColumnLayout"
      title="Editor Agent"
      subtitle="AI-powered content creation and editing assistant"
      :pad="false"
    >
      <template #actions>
        <div class="flex gap-2">
          <Button 
            variant="outline"
            @click="$router.push(`/${route.params.orgId}/${route.params.projectId}/settings`)"
          >
            <Settings class="w-4 h-4 mr-2" />
            Settings
          </Button>
          <a 
            :href="`https://${projectDomain}`" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button variant="default">
              Visit Site
              <ExternalLink class="w-4 h-4 ml-2" />
            </Button>
          </a>
        </div>
      </template>
    </PageHeadingBar>

    <!-- Initial State - Single column layout -->
    <div v-if="!showTwoColumnLayout" class="container mx-auto p-6 max-w-4xl">
      <div class="space-y-6">
        <!-- Welcome Card -->
        <Card class="border-none shadow-sm">
          <CardHeader class="text-center pb-4">
            <div class="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Bot class="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle class="text-2xl font-medium">Welcome to Editor Agent</CardTitle>
            <CardDescription class="text-base">
              Your AI assistant for content creation, editing, and SEO optimization
            </CardDescription>
          </CardHeader>
        </Card>

        <!-- Message Input Card -->
        <Card class="border-none shadow-sm">
          <CardHeader>
            <CardTitle class="text-lg">Ask Editor Agent to help you</CardTitle>
            <CardDescription>
              Describe what you'd like to create, edit, or improve
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <!-- Starter Prompts -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              <Button 
                v-for="prompt in starterPrompts" 
                :key="prompt"
                variant="outline" 
                size="sm"
                class="justify-start text-left h-auto py-2 px-3"
                @click="useStarterPrompt(prompt)"
              >
                <Wand2 class="w-4 h-4 mr-2 flex-shrink-0" />
                <span class="truncate">{{ prompt }}</span>
              </Button>
            </div>

            <!-- Message Input -->
            <div class="space-y-3">
              <Textarea
                v-model="currentMessage"
                placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
                @keydown="handleKeyPress"
                class="min-h-[120px] resize-none"
                :disabled="isLoading"
              />
              <div class="flex gap-2">
                <Button 
                  @click="sendMessage" 
                  :disabled="!currentMessage.trim() || isLoading"
                  class="flex-1"
                >
                  <Send class="w-4 h-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Continue Previous Session -->
        <Card class="border-none shadow-sm">
          <CardContent class="pt-6">
            <div class="text-center">
              <Button 
                variant="outline" 
                @click="continuePreviousSession"
                :disabled="isLoading"
              >
                <History class="w-4 h-4 mr-2" />
                Continue Previous Session
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Two Column Layout - Chat Thread + Detail Pane -->
    <div v-else class="flex" ref="containerRef">
      <!-- Left Column - Chat Thread -->
      <div 
        class="flex flex-col border-r border-gray-200 bg-white"
        :style="{ width: `${leftPaneWidth}%` }"
      >
        <!-- Chat Header -->
        <div class="border-b border-gray-200 p-4 bg-gray-50">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Bot class="w-6 h-6 text-blue-600" />
              <div>
                <h3 class="font-medium">Editor Agent</h3>
                <p class="text-sm text-gray-500">{{ props.project?.name || 'Project' }}</p>
              </div>
            </div>
            <div class="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                @click="clearConversation"
                title="Clear conversation"
              >
                <Trash2 class="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                title="Settings"
              >
                <Settings class="w-4 h-4" />
              </Button>
              <a 
                :href="`https://${projectDomain}`" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button 
                  size="sm" 
                  variant="default"
                  title="Visit your website"
                >
                  Visit Site
                  <ExternalLink class="w-4 h-4 ml-2" />
                </Button>
              </a>
              <Button 
                size="sm" 
                variant="outline" 
                @click="hasActiveSession = false"
                title="Exit chat"
              >
                <X class="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div
            v-for="message in chatMessages"
            :key="message.id"
            :class="[
              'flex gap-3 cursor-pointer rounded-lg p-3 transition-colors',
              message.type === 'user' ? 'justify-end' : 'justify-start',
              selectedMessageId === message.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
            ]"
            @click="selectMessage(message.id)"
          >
            <!-- Message Avatar -->
            <div v-if="message.type === 'agent'" class="flex-shrink-0">
              <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot class="w-4 h-4 text-blue-600" />
              </div>
            </div>

            <!-- Message Content -->
            <div class="flex-1 max-w-xs md:max-w-md lg:max-w-lg">
              <div :class="[
                'rounded-lg px-4 py-2',
                message.type === 'user' 
                  ? 'bg-blue-600 text-white ml-auto' 
                  : 'bg-gray-100 text-gray-900'
              ]">
                <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>
                
                <!-- Tool Calls (for agent messages) -->
                <div v-if="message.toolCalls && message.toolCalls.length > 0" class="mt-2 pt-2 border-t border-gray-200">
                  <div class="space-y-1">
                    <div v-for="tool in message.toolCalls" :key="tool.id" class="flex items-center gap-2 text-xs">
                      <Wrench class="w-3 h-3 text-gray-500" />
                      <span class="font-medium text-gray-700">{{ tool.name }}</span>
                      <span class="text-gray-500">{{ JSON.stringify(tool.args) }}</span>
                    </div>
                  </div>
                </div>
                
                <!-- File Changes (for agent messages) -->
                <div v-if="message.fileChanges && message.fileChanges.length > 0" class="mt-2 pt-2 border-t border-gray-200">
                  <div class="space-y-1">
                    <Button
                      v-for="file in message.fileChanges"
                      :key="file.id"
                      size="sm"
                      variant="outline"
                      class="w-full justify-start text-xs"
                      @click.stop="selectFileChange(file)"
                    >
                      <component :is="file.type === 'created' ? FilePlus : FileEdit" class="w-3 h-3 mr-2" />
                      <span class="font-medium mr-2">{{ file.type === 'created' ? 'Created' : 'Edited' }}</span>
                      <span class="truncate text-gray-600">{{ file.path }}</span>
                    </Button>
                  </div>
                </div>
                
                <!-- Message Actions (for agent messages) -->
                <div v-if="message.actions && message.actions.length > 0" class="mt-2 pt-2 border-t border-gray-200">
                  <div class="flex flex-wrap gap-1">
                    <Button
                      v-for="action in message.actions"
                      :key="action.id"
                      size="sm"
                      variant="secondary"
                      class="text-xs"
                    >
                      {{ action.label }}
                    </Button>
                  </div>
                </div>
              </div>
              
              <!-- Message Timestamp & Status -->
              <div class="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <Clock class="w-3 h-3" />
                <span>{{ message.timestamp.toLocaleTimeString() }}</span>
                <CheckCircle 
                  v-if="message.status === 'sent' || message.status === 'received'" 
                  class="w-3 h-3 text-green-500" 
                />
                <AlertCircle 
                  v-if="message.status === 'error'" 
                  class="w-3 h-3 text-red-500" 
                />
              </div>
            </div>

            <!-- User Avatar -->
            <div v-if="message.type === 'user'" class="flex-shrink-0">
              <div class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <User class="w-4 h-4 text-gray-600" />
              </div>
            </div>
          </div>

          <!-- Loading indicator -->
          <div v-if="isLoading" class="flex gap-3 justify-start">
            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Bot class="w-4 h-4 text-blue-600" />
            </div>
            <div class="bg-gray-100 rounded-lg px-4 py-2">
              <div class="flex items-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                <span class="text-sm text-gray-600">Editor Agent is thinking...</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Message Input -->
        <div class="border-t border-gray-200 p-4 bg-gray-50">
          <div class="flex gap-2">
            <Textarea
              v-model="currentMessage"
              placeholder="Type your message..."
              @keydown="handleKeyPress"
              class="flex-1 min-h-[50px] max-h-[120px] resize-none"
              :disabled="isLoading"
            />
            <Button 
              @click="sendMessage" 
              :disabled="!currentMessage.trim() || isLoading"
              size="sm"
              class="self-end"
            >
              <Send class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- Resizable Divider -->
      <div
        class="w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors relative"
        @mousedown="startDragging"
      >
        <div class="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-6 flex items-center justify-center">
          <GripVertical class="w-4 h-4 text-gray-500" />
        </div>
      </div>

      <!-- Right Column - Detail Pane -->
      <div 
        class="bg-gray-50 border-l border-gray-200"
        :style="{ width: `${100 - leftPaneWidth}%` }"
      >
        <div class="h-full flex flex-col">
          <!-- Detail Header -->
          <div class="border-b border-gray-200 p-4 bg-white">
            <h3 class="font-medium">Details</h3>
            <p class="text-sm text-gray-500 mt-1">Selected message information</p>
          </div>

          <!-- Detail Content -->
          <div class="flex-1 overflow-y-auto p-4">
            <!-- File Change View -->
            <div v-if="selectedFileChange" class="space-y-4">
              <Card class="border-none shadow-sm">
                <CardHeader class="pb-3">
                  <CardTitle class="text-sm font-medium flex items-center gap-2">
                    <component 
                      :is="selectedFileChange.type === 'created' ? FilePlus : FileEdit" 
                      class="w-4 h-4"
                    />
                    {{ selectedFileChange.type === 'created' ? 'File Created' : 'File Edited' }}
                  </CardTitle>
                  <CardDescription class="mt-1">
                    {{ selectedFileChange.path }}
                  </CardDescription>
                </CardHeader>
                <CardContent class="pt-0">
                  <div class="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre class="text-sm text-gray-100"><code>{{ selectedFileChange.content }}</code></pre>
                  </div>
                  <div class="mt-4 flex gap-2">
                    <Button size="sm" variant="outline">
                      <Eye class="w-4 h-4 mr-2" />
                      View in Editor
                    </Button>
                    <Button size="sm" variant="outline">
                      <Code class="w-4 h-4 mr-2" />
                      Copy Code
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Button 
                variant="ghost" 
                size="sm" 
                @click="selectedFileChange = null; selectedMessageId = chatMessages.find(m => m.fileChanges?.some(f => f.id === selectedFileChange.id))?.id"
              >
                ← Back to Message
              </Button>
            </div>
            
            <!-- Message View -->
            <div v-else-if="selectedMessage" class="space-y-4">
              <!-- Message Info -->
              <Card class="border-none shadow-sm">
                <CardHeader class="pb-3">
                  <CardTitle class="text-sm font-medium flex items-center gap-2">
                    <component 
                      :is="selectedMessage.type === 'user' ? User : Bot" 
                      class="w-4 h-4"
                    />
                    {{ selectedMessage.type === 'user' ? 'Your Message' : 'Agent Response' }}
                  </CardTitle>
                </CardHeader>
                <CardContent class="pt-0 space-y-3">
                  <div>
                    <label class="text-xs font-medium text-gray-700">Content</label>
                    <p class="text-sm text-gray-900 mt-1 p-2 bg-gray-100 rounded">
                      {{ selectedMessage.content }}
                    </p>
                  </div>
                  <div>
                    <label class="text-xs font-medium text-gray-700">Timestamp</label>
                    <p class="text-sm text-gray-900 mt-1">
                      {{ selectedMessage.timestamp.toLocaleString() }}
                    </p>
                  </div>
                  <div>
                    <label class="text-xs font-medium text-gray-700">Status</label>
                    <div class="flex items-center gap-2 mt-1">
                      <component 
                        :is="selectedMessage.status === 'error' ? AlertCircle : CheckCircle"
                        :class="[
                          'w-4 h-4',
                          selectedMessage.status === 'error' ? 'text-red-500' : 'text-green-500'
                        ]"
                      />
                      <span class="text-sm capitalize">{{ selectedMessage.status }}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <!-- Actions (if any) -->
              <Card v-if="selectedMessage.actions && selectedMessage.actions.length > 0" class="border-none shadow-sm">
                <CardHeader class="pb-3">
                  <CardTitle class="text-sm font-medium">Available Actions</CardTitle>
                </CardHeader>
                <CardContent class="pt-0">
                  <div class="space-y-2">
                    <Button
                      v-for="action in selectedMessage.actions"
                      :key="action.id"
                      variant="outline"
                      size="sm"
                      class="w-full justify-start"
                    >
                      <component :is="action.icon || Edit" class="w-4 h-4 mr-2" />
                      {{ action.label }}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <!-- Tool Calls (if any) -->
              <Card v-if="selectedMessage.toolCalls && selectedMessage.toolCalls.length > 0" class="border-none shadow-sm">
                <CardHeader class="pb-3">
                  <CardTitle class="text-sm font-medium flex items-center gap-2">
                    <Wrench class="w-4 h-4" />
                    Tool Calls
                  </CardTitle>
                </CardHeader>
                <CardContent class="pt-0">
                  <div class="space-y-2">
                    <div 
                      v-for="tool in selectedMessage.toolCalls" 
                      :key="tool.id"
                      class="p-2 bg-gray-100 rounded text-sm"
                    >
                      <div class="font-medium text-gray-700">{{ tool.name }}</div>
                      <div class="text-xs text-gray-600 mt-1">
                        <pre>{{ JSON.stringify(tool.args, null, 2) }}</pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <!-- File Changes (if any) -->
              <Card v-if="selectedMessage.fileChanges && selectedMessage.fileChanges.length > 0" class="border-none shadow-sm">
                <CardHeader class="pb-3">
                  <CardTitle class="text-sm font-medium flex items-center gap-2">
                    <FileCode class="w-4 h-4" />
                    File Changes
                  </CardTitle>
                </CardHeader>
                <CardContent class="pt-0">
                  <div class="space-y-2">
                    <Button
                      v-for="file in selectedMessage.fileChanges"
                      :key="file.id"
                      variant="outline"
                      size="sm"
                      class="w-full justify-start"
                      @click="selectFileChange(file)"
                    >
                      <component :is="file.type === 'created' ? FilePlus : FileEdit" class="w-4 h-4 mr-2" />
                      <span class="font-medium mr-2">{{ file.type === 'created' ? 'Created' : 'Edited' }}</span>
                      <span class="text-xs text-gray-600 truncate">{{ file.path }}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <!-- No selection state -->
            <div v-else class="text-center text-gray-500 mt-8">
              <MessageCircle class="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p class="text-sm">Select a message to view details</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>