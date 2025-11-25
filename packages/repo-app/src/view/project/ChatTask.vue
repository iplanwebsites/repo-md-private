<script setup>
import { ref, computed, onBeforeUnmount, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  ArrowLeft, 
  Send, 
  User, 
  Bot, 
  FileEdit, 
  FilePlus, 
  GripVertical,
  Clock,
  CheckCircle,
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  FileCode,
  ChevronRight,
  Info,
  Search,
  Building2,
  FolderOpen,
  Globe,
  Hash,
  Terminal,
  Plug
} from 'lucide-vue-next'
import DiffNums from '@/components/ui/DiffNums.vue'
import { useToast } from '@/components/ui/toast/use-toast'
import { supabase } from '@/lib/supabaseClient'
import trpc from '@/trpc'
import { appConfigs } from '@/appConfigs'
import { useOrgStore } from '@/store/orgStore'

// Feature flag for using dummy data vs real backend
const USE_DUMMY_DATA = false

// Debug flag for SSE logging
const DEBUG = true

const router = useRouter()
const route = useRoute()
const { toast } = useToast()
const orgStore = useOrgStore()

// Get IDs from route
const orgId = computed(() => route.params.orgId)
const projectId = computed(() => route.params.projectId)
const chatId = computed(() => route.params.taskId)

// Context detection
const isOrgLevel = computed(() => route.name === 'OrgChatTask')
const isProjectLevel = computed(() => route.name === 'ProjectChatTask')

// Get org and project names from chat data or fallback to store/URL
const orgName = computed(() => {
  // First try to get from orgStore based on chat's orgId or URL
  const searchId = chat.value.orgId || orgId.value
  const org = orgStore.orgs.find(o => o.handle === searchId || o._id === searchId)
  return org?.name || searchId || 'Organization'
})

const projectName = computed(() => {
  // First try to get from chat's project data
  if (chat.value.project?.name) {
    return chat.value.project.name
  }
  // Fallback to store lookup
  if (!projectId.value) return null
  const project = orgStore.projects.find(
    p => p.slug === projectId.value || p.id === projectId.value
  )
  return project?.name || projectId.value
})

// Get project slug for routing
const projectSlug = computed(() => {
  // First try to get from chat's project data
  if (chat.value.project?.handle || chat.value.project?.slug) {
    return chat.value.project.handle || chat.value.project.slug
  }
  // Fallback to URL param
  return projectId.value
})

// Get org handle for routing
const orgHandle = computed(() => {
  // Try to get from store or use URL param
  const searchId = chat.value.orgId || orgId.value
  const org = orgStore.orgs.find(o => o.handle === searchId || o._id === searchId)
  return org?.handle || orgId.value
})

// Get source icon component
const sourceIcon = computed(() => {
  switch (chat.value.source) {
    case 'slack':
      return Hash
    case 'cli':
      return Terminal
    case 'mcp':
      return Plug
    case 'web':
    default:
      return Globe
  }
})

// Get source label for popover
const sourceLabel = computed(() => {
  switch (chat.value.source) {
    case 'slack':
      return 'Initiated via Slack'
    case 'cli':
      return 'Initiated via CLI'
    case 'mcp':
      return 'Initiated via MCP'
    case 'web':
    default:
      return 'Initiated via Web'
  }
})

// Customizable button configuration
const pushButtonLabel = computed(() => isOrgLevel.value ? 'Deploy' : 'Push')
const ellipsisMenuItems = computed(() => {
  const baseItems = [
    { label: 'View Changes', action: () => rightPanelTab.value = 'diff' },
    { label: 'View Logs', action: () => rightPanelTab.value = 'logs' },
    { label: 'Copy Task ID', action: () => copyTaskId() }
  ]
  
  if (isOrgLevel.value) {
    return [
      ...baseItems,
      { label: 'Share with Team', action: () => shareTask() },
      { label: 'Archive Task', action: () => archiveTask() }
    ]
  } else {
    return [
      ...baseItems,
      { label: 'Create PR', action: () => createPR() },
      { label: 'Clone Task', action: () => cloneTask() }
    ]
  }
})

// State
const currentMessage = ref('')
const isLoading = ref(false)
const chatMessages = ref([])
const selectedMessageId = ref(null)
const selectedFileChange = ref(null)
const showFiles = ref(true)
const loadingChat = ref(false)
const currentUser = ref(null)
const abortController = ref(null)
const chatContentRef = ref(null)
const sessionFileModifications = ref(new Map())
const isPushing = ref(false)

// LocalStorage key for message draft
const MESSAGE_DRAFT_KEY = computed(() => `chatTask_draft_${chatId.value}`)

// Refs for DOM elements
const messageInputRef = ref(null)

// Streaming state
const contentBuffer = ref('')
const updateTimer = ref(null)
const CONTENT_UPDATE_DELAY = 50 // ms

// Resizable panes state
const leftPaneWidth = ref(40)
const isDragging = ref(false)
const containerRef = ref(null)

// Tabs for right panel
const rightPanelTab = ref('diff')

// Tools display state
const expandedTools = ref({}) // Track which messages have expanded tools
const selectedTool = ref(null) // Tool detail to show in right panel

// Task/Chat data
const chat = ref({
  id: chatId.value,
  title: '',
  status: 'active',
  model: 'gpt-4o',
  temperature: 0.7,
  createdAt: null,
  updatedAt: null,
  messages: [],
  tasks: [],
  tokensUsed: 0,
  project: null,
  projectId: null,
  orgId: null,
  source: 'web' // Default source
})

// For backward compatibility
const task = computed(() => ({
  id: chat.value.id,
  title: chat.value.title,
  timeAgo: formatTimeAgo(chat.value.createdAt),
  repository: chat.value.project?.repository || '',
  status: chat.value.status === 'active' ? 'Open' : chat.value.status === 'completed' ? 'Completed' : 'Archived',
  changes: null
}))

// Sample messages for the task
const sampleMessages = [
  {
    id: 'msg_1',
    type: 'user',
    content: 'Write a comprehensive blog article about the migration patterns of loggerhead sea turtles in the Pacific Ocean, including recent research findings and conservation efforts.',
    timestamp: new Date(Date.now() - 3600000),
    status: 'sent'
  },
  {
    id: 'msg_2',
    type: 'agent',
    content: 'I\'ll help you create a comprehensive blog article about loggerhead sea turtle migration patterns. Let me research and write this content for you.',
    timestamp: new Date(Date.now() - 3590000),
    status: 'received',
    toolCalls: [
      { id: 'tool_1', name: 'research_topic', args: { query: 'loggerhead turtle migration Pacific' } },
      { id: 'tool_2', name: 'create_content', args: { type: 'blog_article' } }
    ],
    tools: [
      {
        toolName: 'getWeather',
        toolCallId: 'call_bP2DKCi1R7eXaMLfidHb598Y',
        args: { location: 'Pacific Ocean', units: 'celsius' },
        result: {
          success: true,
          message: 'Weather information retrieved',
          data: { temperature: '22°C', condition: 'Clear' }
        },
        timestamp: new Date(Date.now() - 3580000).toISOString()
      },
      {
        toolName: 'searchDocuments',
        toolCallId: 'call_xY3DKCi1R7eXaMLfidHb599Z',
        args: { query: 'loggerhead turtle migration patterns', limit: 10 },
        result: {
          success: true,
          documents: ['doc1', 'doc2', 'doc3']
        },
        timestamp: new Date(Date.now() - 3570000).toISOString()
      }
    ],
    fileChanges: [
      {
        id: 'file_1',
        type: 'created',
        path: 'content/blog/turtle-migration.md',
        content: `# Loggerhead Sea Turtle Migration Patterns

## Introduction

The loggerhead sea turtle (Caretta caretta) is one of the most fascinating marine creatures, known for its extraordinary long-distance migrations across the Pacific Ocean. These ancient mariners have been navigating our oceans for millions of years, following complex routes that scientists are only beginning to understand.

## Migration Routes

Loggerhead turtles in the Pacific follow several major migration corridors:

1. **North Pacific Gyre**: Young turtles often spend years in this circular current system
2. **Japan to California Route**: Adult females migrate between nesting beaches in Japan and feeding grounds along the California coast
3. **Australia to Peru Current**: Southern hemisphere populations follow the East Australian Current

## Recent Research Findings

Recent satellite tracking studies have revealed:
- Turtles can travel over 12,000 kilometers in a single journey
- They use magnetic fields for navigation
- Climate change is altering traditional migration patterns

## Conservation Efforts

Multiple international organizations are working to protect migration corridors through:
- Marine protected areas
- Fishing gear modifications
- International cooperation agreements

## How You Can Help

1. Support turtle-safe fishing practices
2. Reduce plastic waste
3. Participate in citizen science programs
4. Donate to conservation organizations

## Conclusion

Understanding and protecting loggerhead turtle migration patterns is crucial for their survival. By working together across borders, we can ensure these magnificent creatures continue their ancient journeys for generations to come.`
      },
      {
        id: 'file_2',
        type: 'created',
        path: 'content/blog/images/.gitkeep',
        content: '# Directory for turtle migration images'
      }
    ]
  }
]

// Helper function to scroll to bottom
const scrollToBottom = (smooth = false) => {
  if (chatContentRef.value) {
    nextTick(() => {
      if (smooth) {
        chatContentRef.value.scrollTo({
          top: chatContentRef.value.scrollHeight,
          behavior: 'smooth'
        })
      } else {
        chatContentRef.value.scrollTop = chatContentRef.value.scrollHeight
      }
    })
  }
}

// Debounced content update
const flushContentBuffer = (msgIndex) => {
  if (contentBuffer.value && msgIndex !== -1) {
    chatMessages.value[msgIndex].content += contentBuffer.value
    contentBuffer.value = ''
    
    // Auto-scroll to bottom
    scrollToBottom()
  }
}

const debouncedContentUpdate = (msgIndex, content) => {
  contentBuffer.value += content
  
  // Clear existing timer
  if (updateTimer.value) {
    clearTimeout(updateTimer.value)
  }
  
  // Set new timer
  updateTimer.value = setTimeout(() => {
    flushContentBuffer(msgIndex)
  }, CONTENT_UPDATE_DELAY)
}

// Helper functions
const formatTimeAgo = (date) => {
  if (!date) return 'Unknown'
  
  const now = new Date()
  const past = new Date(date)
  const diffMs = now - past
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  
  return past.toLocaleDateString()
}

// Get current user from Supabase
const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    currentUser.value = user
  } catch (error) {
    console.error('Error getting current user:', error)
  }
}

// Load chat detail from backend
const loadChatDetail = async () => {
  if (USE_DUMMY_DATA) {
    // Use dummy data
    chat.value = {
      id: chatId.value,
      title: 'Write a blog article about the migration patterns of loggerhead sea turtles',
      status: 'active',
      model: 'gpt-4o',
      temperature: 0.7,
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3600000),
      messages: sampleMessages,
      tasks: [],
      tokensUsed: 1245
    }
    chatMessages.value = sampleMessages
    return
  }

  loadingChat.value = true
  try {
    // Use get endpoint with chatId parameter
    const result = await trpc.editorChat.get.query({ 
      chatId: chatId.value 
    })
    
    if (result) {
      chat.value = result
      // Transform messages to match component's expected format
      chatMessages.value = (result.messages || []).map(msg => {
        // Basic message structure
        const transformedMsg = {
          id: msg.id,
          type: msg.role === 'assistant' ? 'agent' : msg.role, // Convert role to type
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          status: msg.role === 'user' ? 'sent' : 'received'
        }
        
        // Add tool calls if present
        if (msg.tool_calls) {
          transformedMsg.toolCalls = msg.tool_calls.map(tc => ({
            id: tc.id,
            name: tc.function?.name || tc.type,
            args: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {},
            status: 'completed'
          }))
        }
        
        // Add toolsUsed if present (new format from backend)
        if (msg.toolsUsed && msg.toolsUsed.length > 0) {
          transformedMsg.tools = msg.toolsUsed
          
          // Extract file changes from toolsUsed
          const fileChanges = []
          msg.toolsUsed.forEach(tool => {
            if (tool.result?.fileTracking) {
              fileChanges.push({
                id: `file_${tool.toolCallId}`,
                type: tool.result.type || tool.result.fileTracking.type,
                path: tool.result.path,
                branch: tool.result.branch || 'main',
                content: tool.result.content || '',
                originalContent: tool.result.originalContent || '',
                diff: tool.result.fileTracking.diff || '',
                stats: tool.result.fileTracking.stats || { additions: 0, deletions: 0, totalChanges: 0 }
              })
            }
          })
          
          if (fileChanges.length > 0) {
            transformedMsg.fileChanges = fileChanges
          }
        }
        
        // Legacy: Extract file changes from tool responses
        if (msg.role === 'tool' && msg.content) {
          try {
            const toolResponse = JSON.parse(msg.content)
            if (toolResponse.type && toolResponse.path) {
              // This is a file operation
              transformedMsg.fileChanges = [{
                id: `file_${msg.id}`,
                type: toolResponse.type,
                path: toolResponse.path,
                branch: toolResponse.branch,
                content: toolResponse.content || '',
                originalContent: toolResponse.originalContent || '',
                diff: toolResponse.fileTracking?.diff || '',
                stats: toolResponse.fileTracking?.stats || { additions: 0, deletions: 0, totalChanges: 0 }
              }]
            }
          } catch (e) {
            // Not JSON or not a file operation
          }
        }
        
        // Legacy: Aggregate file changes from related tool responses
        if (msg.role === 'assistant' && msg.tool_calls && !msg.toolsUsed) {
          const fileChanges = []
          // Look for tool responses in subsequent messages
          const msgIndex = result.messages.findIndex(m => m.id === msg.id)
          for (let i = msgIndex + 1; i < result.messages.length; i++) {
            const toolMsg = result.messages[i]
            if (toolMsg.role === 'tool' && msg.tool_calls.some(tc => tc.id === toolMsg.tool_call_id)) {
              try {
                const toolResponse = JSON.parse(toolMsg.content)
                if (toolResponse.type && toolResponse.path) {
                  fileChanges.push({
                    id: `file_${toolMsg.id}`,
                    type: toolResponse.type,
                    path: toolResponse.path,
                    branch: toolResponse.branch || 'main',
                    content: toolResponse.content || '',
                    originalContent: toolResponse.originalContent || '',
                    diff: toolResponse.fileTracking?.diff || '',
                    stats: toolResponse.fileTracking?.stats || { additions: 0, deletions: 0, totalChanges: 0 }
                  })
                }
              } catch (e) {
                // Not a file operation
              }
            } else if (toolMsg.role !== 'tool') {
              break // Stop when we hit a non-tool message
            }
          }
          if (fileChanges.length > 0) {
            transformedMsg.fileChanges = fileChanges
          }
        }
        
        return transformedMsg
      }).filter(msg => msg.type !== 'tool') // Filter out tool messages as they're embedded in assistant messages
      
      // Update session file modifications from loaded messages
      chatMessages.value.forEach(msg => {
        if (msg.fileChanges && msg.fileChanges.length > 0) {
          updateFileModifications(msg.fileChanges)
        }
      })
    }
  } catch (error) {
    console.error('Error loading chat:', error)
    
    // Show error toast
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please check your connection and try again.",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Error loading chat",
        description: error.message || "Failed to load chat details. Please try again.",
        variant: "destructive",
      })
    }
    
    // Fallback to dummy data on error if USE_DUMMY_DATA is true
    if (USE_DUMMY_DATA) {
      chat.value = {
        id: chatId.value,
        title: 'Write a blog article about the migration patterns of loggerhead sea turtles',
        status: 'active',
        model: 'gpt-4o',
        temperature: 0.7,
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(Date.now() - 3600000),
        messages: sampleMessages,
        tasks: [],
        tokensUsed: 1245
      }
      chatMessages.value = sampleMessages
    }
  } finally {
    loadingChat.value = false
  }
}

// Watch currentMessage and save to localStorage (max 1KB)
watch(currentMessage, (newValue) => {
  if (newValue && newValue.length < 1024) { // Less than 1KB (1024 chars)
    localStorage.setItem(MESSAGE_DRAFT_KEY.value, newValue)
  } else if (!newValue) {
    // Remove from localStorage if empty
    localStorage.removeItem(MESSAGE_DRAFT_KEY.value)
  }
})

// Initialize on mount
onMounted(async () => {
  if (DEBUG) {
    console.log('🎬 ChatTask Component Mounted', {
      chatId: chatId.value,
      orgId: orgId.value,
      projectId: projectId.value,
      isOrgLevel: isOrgLevel.value,
      isProjectLevel: isProjectLevel.value
    })
  }
  
  // Check for initial message from query params
  const initialMessage = route.query.initialMessage
  if (initialMessage) {
    currentMessage.value = initialMessage
    if (DEBUG) {
      console.log('📝 Found initial message in query params:', initialMessage)
    }
  } else {
    // Restore draft message from localStorage if no initial message
    const savedDraft = localStorage.getItem(MESSAGE_DRAFT_KEY.value)
    if (savedDraft) {
      currentMessage.value = savedDraft
      if (DEBUG) {
        console.log('📝 Restored draft message from localStorage:', savedDraft.length, 'chars')
      }
    }
  }
  
  await getCurrentUser()
  await loadChatDetail()
  
  // Load org and project data if needed
  if (orgStore.orgs.length === 0) {
    await orgStore.fetchOrgs()
  }
  
  if (orgId.value && projectId.value) {
    // Ensure we have project data for project-level chats
    await orgStore.fetchProjects(orgId.value)
  }
  
  // Scroll to bottom after loading chat messages
  scrollToBottom()
  
  // Auto-send the initial message if present
  if (initialMessage) {
    await nextTick() // Ensure DOM is ready
    if (DEBUG) {
      console.log('🚀 Auto-sending initial message')
    }
    await sendMessage()
    
    // Clear the query param after sending to avoid re-sending on refresh
    router.replace({
      path: route.path,
      query: { ...route.query, initialMessage: undefined }
    })
  }
})

// Send message
const sendMessage = async () => {
  if (!currentMessage.value.trim()) return
  
  const userMessage = {
    id: `msg_${Date.now()}`,
    type: 'user',
    content: currentMessage.value,
    timestamp: new Date(),
    status: 'sent'
  }
  
  if (USE_DUMMY_DATA) {
    // Add to local messages for dummy mode
    chatMessages.value.push(userMessage)
    currentMessage.value = ""
    
    // Clear the draft from localStorage after sending
    localStorage.removeItem(MESSAGE_DRAFT_KEY.value)
    
    scrollToBottom(true) // Use smooth scrolling for user messages
    
    isLoading.value = true
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const agentMessage = {
        id: `msg_${Date.now() + 1}`,
        type: 'agent',
        content: "I'll help you with that request. Let me analyze what needs to be done and make the necessary changes.",
        timestamp: new Date(),
        status: 'received',
        fileChanges: [
          {
            id: `file_${Date.now()}`,
            type: 'edited',
            path: 'content/blog/turtle-migration.md',
            content: '# Updated content based on your request...\n\nNew sections and improvements have been added.'
          }
        ]
      }
      
      chatMessages.value.push(agentMessage)
      scrollToBottom(true) // Smooth scroll for agent response
    } catch (error) {
      console.error('Error in dummy mode:', error)
    } finally {
      isLoading.value = false
    }
    return
  }
  
  // Real API mode - Use SSE streaming endpoint
  const messageContent = currentMessage.value
  currentMessage.value = ""
  
  // Clear the draft from localStorage after sending
  localStorage.removeItem(MESSAGE_DRAFT_KEY.value)
  
  // Keep focus on input
  nextTick(() => {
    messageInputRef.value?.$el?.focus()
  })
  
  // Add user message to chat immediately
  chatMessages.value.push(userMessage)
  scrollToBottom(true) // Use smooth scrolling for user messages
  
  isLoading.value = true
  
  // Create assistant message placeholder
  const assistantMessageId = `msg_${Date.now() + 1}`
  const assistantMessage = {
    id: assistantMessageId,
    type: 'agent',
    content: '',
    timestamp: new Date(),
    status: 'receiving',
    toolCalls: [],
    fileChanges: [],
    tools: []
  }
  chatMessages.value.push(assistantMessage)
  scrollToBottom()
  
  // Create abort controller for cancelling the request
  abortController.value = new AbortController()
  
  try {
    // Get auth token
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }
    
    // Send the message first to get the stream
    const url = `${appConfigs.apiUrl}/api/editorChat/stream/${chatId.value}`
    
    if (DEBUG) {
      console.log('🚀 SSE Request:', {
        url,
        method: 'POST',
        content: messageContent,
        model: chat.value.model || 'gpt-4.1-mini',
        temperature: chat.value.temperature || 0.7,
        attachments: []
      })
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        content: messageContent,
        model: chat.value.model || 'gpt-4o',
        temperature: chat.value.temperature || 0.7,
        attachments: []
      }),
      signal: abortController.value.signal
    })
    
    if (!response.ok) {
      if (DEBUG) console.error('❌ SSE Response Error:', response.status, response.statusText)
      throw new Error(`Failed to send message: ${response.statusText}`)
    }
    
    if (DEBUG) console.log('✅ SSE Connection Established')
    
    // Read the SSE stream from the response
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        if (DEBUG) console.log('🏁 SSE Stream Complete')
        isLoading.value = false
        
        // Update message status to received
        const msgIndex = chatMessages.value.findIndex(m => m.id === assistantMessageId)
        if (msgIndex !== -1) {
          chatMessages.value[msgIndex].status = 'received'
        }
        break
      }
      
      const chunk = decoder.decode(value, { stream: true })
      if (DEBUG && chunk.trim()) console.log('📥 SSE Chunk:', chunk)
      
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              if (DEBUG) console.log('🎯 SSE [DONE] Signal Received')
              isLoading.value = false
              
              // Flush any remaining content and update message status
              const msgIndex = chatMessages.value.findIndex(m => m.id === assistantMessageId)
              if (msgIndex !== -1) {
                flushContentBuffer(msgIndex)
                chatMessages.value[msgIndex].status = 'received'
              }
              continue
            }
            
            try {
              const parsed = JSON.parse(data)
              if (DEBUG) console.log('📦 SSE Parsed Data:', parsed)
              
              const msgIndex = chatMessages.value.findIndex(m => m.id === assistantMessageId)
              
              if (msgIndex !== -1) {
                switch (parsed.type) {
                  case 'content':
                    if (DEBUG) console.log('💬 SSE Content:', parsed.content)
                    // Use debounced update for smoother rendering
                    debouncedContentUpdate(msgIndex, parsed.content)
                    break
                    
                  case 'tool_call':
                    if (DEBUG) console.log('🔧 SSE Tool Call:', parsed.toolCall)
                    chatMessages.value[msgIndex].toolCalls.push(parsed.toolCall)
                    break
                    
                  case 'file_change':
                    if (DEBUG) console.log('📝 SSE File Change:', parsed.fileChange)
                    const fileChange = {
                      id: `file_${Date.now()}`,
                      type: parsed.fileChange.type,
                      path: parsed.fileChange.path,
                      content: parsed.fileChange.content || '',
                      originalContent: parsed.fileChange.originalContent || '',
                      branch: parsed.fileChange.branch || 'main',
                      diff: parsed.fileChange.diff || '',
                      stats: parsed.fileChange.stats || { additions: 0, deletions: 0, totalChanges: 0 }
                    }
                    chatMessages.value[msgIndex].fileChanges.push(fileChange)
                    updateFileModifications([fileChange])
                    break
                    
                  case 'error':
                    if (DEBUG) console.error('⚠️ SSE Error:', parsed.error)
                    toast({
                      title: "Error",
                      description: parsed.error,
                      variant: "destructive"
                    })
                    break
                    
                  case 'finish':
                  case 'done':
                  case 'complete':
                    if (DEBUG) console.log('🏆 SSE Finish:', parsed)
                    // Handle usage stats if needed
                    if (parsed.usage) {
                      chat.value.tokensUsed = (chat.value.tokensUsed || 0) + parsed.usage.total_tokens
                      if (DEBUG) console.log('📊 SSE Token Usage:', parsed.usage)
                    }
                    break
                    
                  case 'toolsUsed':
                    if (DEBUG) console.log('🔧 SSE Tools Used:', parsed.tools)
                    chatMessages.value[msgIndex].tools = parsed.tools || []
                    
                    // Extract file changes from toolsUsed
                    const fileChanges = []
                    parsed.tools?.forEach(tool => {
                      if (tool.result?.fileTracking) {
                        fileChanges.push({
                          id: `file_${tool.toolCallId}`,
                          type: tool.result.type || tool.result.fileTracking.type,
                          path: tool.result.path,
                          branch: tool.result.branch || 'main',
                          content: tool.result.content || '',
                          originalContent: tool.result.originalContent || '',
                          diff: tool.result.fileTracking.diff || '',
                          stats: tool.result.fileTracking.stats || { additions: 0, deletions: 0, totalChanges: 0 }
                        })
                      }
                    })
                    
                    if (fileChanges.length > 0) {
                      chatMessages.value[msgIndex].fileChanges = [
                        ...(chatMessages.value[msgIndex].fileChanges || []),
                        ...fileChanges
                      ]
                      updateFileModifications(fileChanges)
                    }
                    break
                    
                  default:
                    if (DEBUG) console.log('❓ SSE Unknown Type:', parsed)
                }
              }
            } catch (error) {
              if (DEBUG) console.error('🔥 SSE Parse Error:', error, 'Raw data:', data)
            }
          } else if (line.trim() && DEBUG) {
            console.log('🤔 SSE Non-data line:', line)
          }
      }
    }
    
  } catch (error) {
    if (DEBUG) console.error('💥 SSE Connection Error:', error)
    
    // Remove the empty assistant message on error
    const msgIndex = chatMessages.value.findIndex(m => m.id === assistantMessageId)
    if (msgIndex !== -1) {
      chatMessages.value.splice(msgIndex, 1)
    }
    
    // Show error toast
    toast({
      title: "Error sending message",
      description: error.message || "Failed to send message. Please try again.",
      variant: "destructive",
    })
    
    // Restore the message so user doesn't lose it
    currentMessage.value = messageContent
    
    // Remove the user message on error
    const userMsgIndex = chatMessages.value.findIndex(m => m.id === userMessage.id)
    if (userMsgIndex !== -1) {
      chatMessages.value.splice(userMsgIndex, 1)
    }
  } finally {
    isLoading.value = false
    abortController.value = null
  }
}

// Navigate back
const goBack = () => {
  if (isOrgLevel.value && orgId.value) {
    router.push(`/${orgId.value}/~/chat`)
  } else if (isProjectLevel.value && orgId.value && projectId.value) {
    router.push(`/${orgId.value}/${projectId.value}/chat`)
  } else {
    router.back()
  }
}

// Message selection
const selectMessage = (messageId) => {
  selectedMessageId.value = messageId
  selectedFileChange.value = null
}

// File change selection
const selectFileChange = (fileChange) => {
  selectedFileChange.value = fileChange
  selectedMessageId.value = null
}

// Handle key press in textarea
const handleKeyPress = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

// Resizable pane handlers
const startDragging = (e) => {
  isDragging.value = true
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDragging)
  e.preventDefault()
}

const handleDrag = (e) => {
  if (!isDragging.value || !containerRef.value) return
  
  const containerRect = containerRef.value.getBoundingClientRect()
  const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100
  
  // Limit the width between 30% and 70%
  leftPaneWidth.value = Math.min(Math.max(newLeftWidth, 30), 70)
}

const stopDragging = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDragging)
}


// Button action methods
const handlePushAction = async () => {
  if (isOrgLevel.value) {
    console.log('Deploy action for org-level task')
    // TODO: Implement org-level deploy logic
    toast({
      title: "Not implemented",
      description: "Org-level deployment is not yet implemented",
      variant: "default"
    })
    return
  }
  
  // Project-level push logic
  isPushing.value = true
  
  try {
    // Check if there are any file modifications to push
    if (sessionFileModifications.value.size === 0) {
      toast({
        title: "No changes to push",
        description: "No file modifications have been made in this chat session",
        variant: "default"
      })
      return
    }
    
    // Create deployment with the chat's file changes
    const deploymentData = {
      projectId: projectId.value,
      chatId: chatId.value,
      files: Array.from(sessionFileModifications.value.values()),
      message: `Deploy changes from chat: ${chat.value.title}`,
      branch: 'main' // Default to main branch
    }
    
    if (DEBUG) {
      console.log('🚀 Creating deployment:', deploymentData)
    }
    
    // Call the deployment API
    const deployResult = await trpc.projects.createDeployment.mutate(deploymentData)
    
    if (deployResult.success && deployResult.deploymentId) {
      // Update project's active revision
      const updateResult = await trpc.projects.updateSettings.mutate({
        projectId: projectId.value,
        settings: {
          activeRev: deployResult.deploymentId
        }
      })
      
      if (updateResult.success) {
        toast({
          title: "Changes pushed successfully",
          description: "Project has been updated with the new revision",
        })
        
        // Clear file modifications after successful push
        sessionFileModifications.value.clear()
        
        // Optionally redirect to deployment page
        setTimeout(() => {
          router.push(`/${orgId.value}/${projectId.value}/${deployResult.deploymentId}`)
        }, 1500)
      } else {
        throw new Error('Failed to update project revision')
      }
    } else {
      throw new Error(deployResult.error || 'Failed to create deployment')
    }
    
  } catch (error) {
    console.error('Error pushing changes:', error)
    toast({
      title: "Push failed",
      description: error.message || "Failed to push changes. Please try again.",
      variant: "destructive"
    })
  } finally {
    isPushing.value = false
  }
}

const copyTaskId = () => {
  navigator.clipboard.writeText(task.value.id)
  console.log('Task ID copied')
}

const shareTask = () => {
  console.log('Share task with team')
  // Implement share functionality
}

const archiveTask = () => {
  console.log('Archive task')
  // Implement archive functionality
}

const createPR = () => {
  console.log('Create pull request')
  // Implement PR creation
}

const cloneTask = () => {
  console.log('Clone task')
  // Implement task cloning
}

// Cancel streaming
const cancelStreaming = () => {
  if (abortController.value) {
    if (DEBUG) console.log('🛑 Cancelling SSE Stream')
    abortController.value.abort()
    abortController.value = null
    isLoading.value = false
  }
}

// Handle cleanup
onBeforeUnmount(() => {
  stopDragging()
  cancelStreaming()
  if (updateTimer.value) {
    clearTimeout(updateTimer.value)
  }
  
  // Optional: Clear draft if it's empty or just whitespace
  const draft = localStorage.getItem(MESSAGE_DRAFT_KEY.value)
  if (draft && !draft.trim()) {
    localStorage.removeItem(MESSAGE_DRAFT_KEY.value)
  }
})

// Parse unified diff format
const parseDiff = (diff) => {
  if (!diff) return []
  
  const lines = diff.split('\n')
  const diffLines = []
  let oldLineNum = 1
  let newLineNum = 1
  
  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++')) {
      // Skip file headers
      continue
    } else if (line.startsWith('@@')) {
      // Parse hunk header like "@@ -1,4 +1,6 @@"
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
      if (match) {
        oldLineNum = parseInt(match[1])
        newLineNum = parseInt(match[2])
      }
      diffLines.push({
        oldNum: null,
        newNum: null,
        content: line,
        type: 'hunk'
      })
    } else if (line.startsWith('-')) {
      diffLines.push({
        oldNum: oldLineNum++,
        newNum: null,
        content: line.substring(1),
        type: 'removed'
      })
    } else if (line.startsWith('+')) {
      diffLines.push({
        oldNum: null,
        newNum: newLineNum++,
        content: line.substring(1),
        type: 'added'
      })
    } else if (line.startsWith(' ')) {
      diffLines.push({
        oldNum: oldLineNum++,
        newNum: newLineNum++,
        content: line.substring(1),
        type: 'normal'
      })
    } else {
      // Context line without prefix
      diffLines.push({
        oldNum: oldLineNum++,
        newNum: newLineNum++,
        content: line,
        type: 'normal'
      })
    }
  }
  
  return diffLines
}

// Generate diff display (fallback for when there's no unified diff)
const generateDiffLines = (fileChange) => {
  // If we have a unified diff, use it
  if (fileChange.diff) {
    return parseDiff(fileChange.diff)
  }
  
  // Otherwise, generate a simple diff based on content
  if (fileChange.type === 'created') {
    const lines = fileChange.content.split('\n')
    return lines.map((line, index) => ({
      oldNum: null,
      newNum: index + 1,
      content: line,
      type: 'added'
    }))
  } else if (fileChange.type === 'deleted') {
    const lines = (fileChange.originalContent || fileChange.content).split('\n')
    return lines.map((line, index) => ({
      oldNum: index + 1,
      newNum: null,
      content: line,
      type: 'removed'
    }))
  } else {
    // For modifications without a diff, show the new content as added
    const lines = fileChange.content.split('\n')
    return lines.map((line, index) => ({
      oldNum: null,
      newNum: index + 1,
      content: line,
      type: 'added'
    }))
  }
}

// Get diff lines for selected file
const diffLines = computed(() => {
  if (!selectedFileChange.value) return []
  return generateDiffLines(selectedFileChange.value)
})

// Update session file modifications
const updateFileModifications = (fileChanges) => {
  if (!fileChanges || fileChanges.length === 0) return
  
  fileChanges.forEach(file => {
    sessionFileModifications.value.set(file.path, {
      ...file,
      timestamp: new Date().toISOString()
    })
  })
}

// Get file summary
const fileSummary = computed(() => {
  const fileChanges = chatMessages.value.flatMap(msg => msg.fileChanges || [])
  return fileChanges.map(file => ({
    ...file,
    changeType: file.type === 'created' ? 'New' : file.type === 'deleted' ? 'Deleted' : 'Modified'
  }))
})

// Get session file modifications summary
const fileModificationsSummary = computed(() => {
  const mods = Array.from(sessionFileModifications.value.values())
  const summary = {
    total: mods.length,
    created: mods.filter(m => m.type === 'created').length,
    modified: mods.filter(m => m.type === 'modified').length,
    deleted: mods.filter(m => m.type === 'deleted').length,
    totalAdditions: mods.reduce((sum, m) => sum + (m.stats?.additions || 0), 0),
    totalDeletions: mods.reduce((sum, m) => sum + (m.stats?.deletions || 0), 0),
    files: mods
  }
  return summary
})

// Toggle tools display for a message
const toggleToolsDisplay = (messageId) => {
  expandedTools.value[messageId] = !expandedTools.value[messageId]
}

// Format tool arguments for display
const formatToolArgs = (args) => {
  if (!args) return ''
  const keys = Object.keys(args)
  if (keys.length === 0) return 'No arguments'
  if (keys.length === 1) {
    return `${keys[0]}: ${JSON.stringify(args[keys[0]])}`.substring(0, 50) + '...'
  }
  return `${keys.length} arguments`
}

// Show tool detail in right panel
const showToolDetail = (tool) => {
  console.log('Tool Detail:', tool)
  selectedTool.value = tool
  rightPanelTab.value = 'tools'
}

// Copy file path to clipboard
const copyFilePath = () => {
  if (selectedFileChange.value?.path) {
    navigator.clipboard.writeText(selectedFileChange.value.path)
    toast({
      title: "Copied",
      description: "File path copied to clipboard",
    })
  }
}
</script>

<template>
  <div class="h-screen bg-muted/40 flex flex-col">
    <!-- Header -->
    <div class="bg-background border-b flex-shrink-0">
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="icon" @click="goBack">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div>
            <h1 class="text-lg font-medium">{{ task.title }}</h1>
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <!-- Project/Org context -->
              <div class="flex items-center gap-1">
                <component 
                  :is="isProjectLevel ? FolderOpen : Building2" 
                  class="h-3.5 w-3.5"
                />
                <RouterLink 
                  v-if="isProjectLevel && projectSlug"
                  :to="`/${orgHandle}/${projectSlug}`"
                  class="hover:underline"
                >
                  {{ projectName }}
                </RouterLink>
                <RouterLink 
                  v-else
                  :to="`/${orgHandle}`"
                  class="hover:underline"
                >
                  {{ orgName }}
                </RouterLink>
              </div>
              <span class="text-muted-foreground/50">•</span>
              <span>{{ task.timeAgo }}</span>
              <span v-if="task.repository" class="text-muted-foreground/50">•</span>
              <span v-if="task.repository">{{ task.repository }}</span>
              <!-- Source icon with tooltip -->
              <span class="text-muted-foreground/50">•</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <component 
                      :is="sourceIcon"
                      class="h-3.5 w-3.5"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p class="text-sm">{{ sourceLabel }}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DiffNums :changes="task.changes" />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button 
                  @click="handlePushAction" 
                  :disabled="isPushing || sessionFileModifications.size === 0"
                >
                  <Loader2 v-if="isPushing" class="mr-2 h-4 w-4 animate-spin" />
                  {{ isPushing ? 'Pushing...' : pushButtonLabel }}
                  <ChevronDown class="ml-2 h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent v-if="sessionFileModifications.size === 0">
                <p class="text-sm">No file changes to push</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon">
                <MoreHorizontal class="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                v-for="item in ellipsisMenuItems" 
                :key="item.label"
                @click="item.action"
              >
                {{ item.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden" ref="containerRef">
      <!-- Left Panel - Chat Thread -->
      <div 
        class="flex flex-col border-r border-gray-200 bg-white"
        :style="{ width: `${leftPaneWidth}%` }"
      >
        <!-- Chat Content Area -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6" ref="chatContentRef">
          <!-- Info Box -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <div class="flex items-start gap-3">
              <Info class="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div class="text-blue-900">
                <p>Chat messages below are for viewing history only. Use the tools and file sections to interact with your work.</p>
              </div>
            </div>
          </div>

          <!-- Files -->
          <div>
            <Button variant="ghost" @click="showFiles = !showFiles" class="w-full justify-between">
              <span class="font-medium">Files ({{ fileModificationsSummary.total }})</span>
              <ChevronDown :class="['h-4 w-4 transition-transform', showFiles && 'rotate-180']" />
            </Button>
            <div v-if="showFiles" class="mt-2">
              <!-- Summary stats -->
              <div v-if="fileModificationsSummary.total > 0" class="mb-3 p-2 bg-gray-50 rounded text-xs">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-gray-600">Total changes:</span>
                  <DiffNums 
                    :plus="fileModificationsSummary.totalAdditions" 
                    :minus="fileModificationsSummary.totalDeletions"
                  />
                </div>
                <div class="flex gap-4 text-gray-600">
                  <span v-if="fileModificationsSummary.created > 0">
                    <span class="text-green-600">{{ fileModificationsSummary.created }}</span> created
                  </span>
                  <span v-if="fileModificationsSummary.modified > 0">
                    <span class="text-blue-600">{{ fileModificationsSummary.modified }}</span> modified
                  </span>
                  <span v-if="fileModificationsSummary.deleted > 0">
                    <span class="text-red-600">{{ fileModificationsSummary.deleted }}</span> deleted
                  </span>
                </div>
              </div>
              
              <!-- File list -->
              <div class="space-y-1">
                <div 
                  v-for="file in fileModificationsSummary.files" 
                  :key="file.path"
                  class="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 p-2 rounded group"
                  @click="selectFileChange(file)"
                >
                  <div class="flex items-center flex-1 min-w-0">
                    <component 
                      :is="file.type === 'created' ? FilePlus : file.type === 'deleted' ? FileEdit : FileEdit" 
                      class="w-3 h-3 mr-2 flex-shrink-0 text-gray-400" 
                    />
                    <span class="truncate">{{ file.path }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <div v-if="file.stats && (file.stats.additions || file.stats.deletions)" class="text-xs">
                      <span class="text-green-600">+{{ file.stats.additions || 0 }}</span>
                      <span class="text-gray-400">/</span>
                      <span class="text-red-600">-{{ file.stats.deletions || 0 }}</span>
                    </div>
                    <Badge variant="secondary" class="text-xs">{{ file.type }}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Messages -->
          <div class="border-t pt-4 space-y-4">
            <h3 class="font-medium">Conversation</h3>
            <div 
              v-for="message in chatMessages" 
              :key="message.id"
              class="rounded-lg p-2"
            >
              <div :class="[
                'flex gap-3',
                message.type === 'user' ? 'justify-end' : 'justify-start'
              ]">
                <!-- Agent Avatar -->
                <div v-if="message.type === 'agent'" class="flex-shrink-0">
                  <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bot class="w-4 h-4 text-blue-600" />
                  </div>
                </div>

                <!-- Message Content -->
                <div class="flex-1 max-w-xs">
                  <div :class="[
                    'rounded-lg px-4 py-2',
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white ml-auto' 
                      : 'bg-gray-100 text-gray-900'
                  ]">
                    <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>
                    
                    <!-- Streaming indicator -->
                    <span v-if="message.status === 'receiving' && isLoading" class="inline-flex ml-1">
                      <span class="animate-pulse">▊</span>
                    </span>
                    
                    <!-- File Changes -->
                    <div v-if="message.fileChanges && message.fileChanges.length > 0" class="mt-2 pt-2 border-t border-gray-200">
                      <div class="space-y-1">
                        <Button
                          v-for="file in message.fileChanges"
                          :key="file.id"
                          size="sm"
                          variant="outline"
                          class="w-full justify-between text-xs group"
                          @click.stop="selectFileChange(file)"
                        >
                          <div class="flex items-center flex-1 min-w-0">
                            <component 
                              :is="file.type === 'created' ? FilePlus : file.type === 'deleted' ? FileEdit : FileEdit" 
                              class="w-3 h-3 mr-2 flex-shrink-0" 
                            />
                            <span class="truncate">{{ file.path }}</span>
                          </div>
                          <div v-if="file.stats && (file.stats.additions || file.stats.deletions)" class="flex items-center ml-2 text-xs">
                            <span class="text-green-600">+{{ file.stats.additions || 0 }}</span>
                            <span class="mx-1 text-gray-400">/</span>
                            <span class="text-red-600">-{{ file.stats.deletions || 0 }}</span>
                          </div>
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Tools Used -->
                  <div v-if="message.tools && message.tools.length > 0" class="mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      class="text-xs text-muted-foreground hover:text-foreground"
                      @click.stop="toggleToolsDisplay(message.id)"
                    >
                      <component :is="expandedTools[message.id] ? ChevronUp : ChevronDown" class="w-3 h-3 mr-1" />
                      {{ message.tools.length }} tool{{ message.tools.length === 1 ? '' : 's' }} used
                    </Button>
                    
                    <!-- Expanded Tools Display -->
                    <div v-if="expandedTools[message.id]" class="mt-2 pl-2 border-l border-gray-200 space-y-2">
                      <div 
                        v-for="(tool, index) in message.tools" 
                        :key="tool.toolCallId"
                        class="text-xs p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                        @click.stop="showToolDetail(tool)"
                      >
                        <div class="font-medium text-gray-700">{{ tool.toolName }}</div>
                        <div class="text-gray-500 truncate">{{ formatToolArgs(tool.args) }}</div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Timestamp -->
                  <div class="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <Clock class="w-3 h-3" />
                    <span>{{ new Date(message.timestamp).toLocaleTimeString() }}</span>
                  </div>
                </div>

                <!-- User Avatar -->
                <div v-if="message.type === 'user'" class="flex-shrink-0">
                  <div class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <User class="w-4 h-4 text-gray-600" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Loading indicator (removed - streaming is shown inline) -->
          </div>
        </div>

        <!-- Message Input -->
        <div class="border-t border-gray-200 p-4 bg-gray-50">
          <Textarea
            ref="messageInputRef"
            v-model="currentMessage"
            placeholder="Request changes or ask a question"
            @keydown="handleKeyPress"
            class="min-h-[80px] resize-none mb-2"
          />
          <div class="flex justify-end">
            <Button 
              @click="sendMessage" 
              :disabled="!currentMessage.trim() || isLoading"
              size="sm"
            >
              <Send class="w-4 h-4 mr-2" />
              Send
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

      <!-- Right Panel - Code Diff/Logs -->
      <div 
        class="flex-1 overflow-hidden"
        :style="{ width: `${100 - leftPaneWidth}%` }"
      >
        <Tabs v-model="rightPanelTab" class="h-full flex flex-col">
          <div class="p-4 border-b">
            <TabsList class="grid w-full grid-cols-3 max-w-[300px]">
              <TabsTrigger value="diff">Diff</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
            </TabsList>
          </div>

          <!-- Diff Tab -->
          <TabsContent value="diff" class="flex-1 mt-0 overflow-hidden">
            <div v-if="selectedFileChange" class="h-full bg-gray-900">
              <div class="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                <div class="flex items-center gap-2 text-sm text-gray-400">
                  <ChevronDown class="h-4 w-4" />
                  <span>{{ selectedFileChange.path }}</span>
                  <Badge v-if="selectedFileChange.type" variant="secondary" class="text-xs ml-2">
                    {{ selectedFileChange.type }}
                  </Badge>
                  <Button variant="ghost" size="sm" class="h-auto p-0 text-gray-400 hover:text-gray-200" @click="copyFilePath">
                    <Copy class="h-3 w-3" />
                  </Button>
                </div>
                <DiffNums 
                  :plus="selectedFileChange.stats?.additions || 0" 
                  :minus="selectedFileChange.stats?.deletions || 0" 
                />
              </div>

              <div class="overflow-auto h-[calc(100%-48px)]">
                <div class="font-mono text-sm">
                  <div v-for="(line, index) in diffLines" :key="index" 
                       :class="[
                         'px-4 py-0.5',
                         line.type === 'added' && 'bg-green-900/30 text-green-300',
                         line.type === 'removed' && 'bg-red-900/30 text-red-300',
                         line.type === 'normal' && 'text-gray-300',
                         line.type === 'hunk' && 'bg-blue-900/20 text-blue-400 font-bold'
                       ]">
                    <template v-if="line.type === 'hunk'">
                      <span class="text-blue-400">{{ line.content }}</span>
                    </template>
                    <template v-else>
                      <span class="inline-block w-12 text-right pr-4 select-none text-gray-500">{{ line.oldNum || '' }}</span>
                      <span class="inline-block w-12 text-right pr-4 select-none text-gray-500">{{ line.newNum || '' }}</span>
                      <span class="inline-block w-8 text-center select-none">
                        {{ line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ' }}
                      </span>
                      <span>{{ line.content }}</span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="h-full flex items-center justify-center text-gray-500">
              <div class="text-center">
                <FileCode class="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p class="text-sm">Select a file to view changes</p>
              </div>
            </div>
          </TabsContent>

          <!-- Logs Tab -->
          <TabsContent value="logs" class="flex-1 mt-0 overflow-hidden">
            <div class="p-4 h-full overflow-auto">
              <div class="font-mono text-sm space-y-1">
                <div class="text-muted-foreground">[{{ new Date().toLocaleString() }}] Starting content generation...</div>
                <div class="text-blue-600">[{{ new Date().toLocaleString() }}] Researching topic: loggerhead turtle migration</div>
                <div class="text-green-600">[{{ new Date().toLocaleString() }}] Created file: content/blog/turtle-migration.md</div>
                <div class="text-muted-foreground">[{{ new Date().toLocaleString() }}] Created file: content/blog/images/.gitkeep</div>
                <div class="text-muted-foreground">[{{ new Date().toLocaleString() }}] Generated 1,245 words of content</div>
                <div class="text-yellow-600">[{{ new Date().toLocaleString() }}] Running preview build...</div>
                <div class="text-green-600">[{{ new Date().toLocaleString() }}] Preview build successful</div>
                <div class="text-muted-foreground">[{{ new Date().toLocaleString() }}] Task completed in 3m 13s</div>
              </div>
            </div>
          </TabsContent>
          
          <!-- Tools Tab -->
          <TabsContent value="tools" class="flex-1 mt-0 overflow-hidden p-4">
            <div v-if="selectedTool" class="space-y-4">
              <div>
                <h3 class="text-lg font-semibold mb-2">Tool: {{ selectedTool.toolName }}</h3>
                <p class="text-sm text-muted-foreground mb-4">ID: {{ selectedTool.toolCallId }}</p>
              </div>
              
              <div v-if="selectedTool.args">
                <h4 class="font-medium mb-2">Arguments</h4>
                <pre class="bg-gray-100 p-3 rounded text-sm overflow-auto">{{ JSON.stringify(selectedTool.args, null, 2) }}</pre>
              </div>
              
              <div v-if="selectedTool.result">
                <h4 class="font-medium mb-2">Result</h4>
                
                <!-- File tracking section if present -->
                <div v-if="selectedTool.result.fileTracking" class="mb-4">
                  <div class="bg-gray-50 p-3 rounded mb-2">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-medium">File: {{ selectedTool.result.path }}</span>
                      <Badge :variant="selectedTool.result.fileTracking.type === 'created' ? 'default' : selectedTool.result.fileTracking.type === 'deleted' ? 'destructive' : 'secondary'">
                        {{ selectedTool.result.fileTracking.type }}
                      </Badge>
                    </div>
                    <div v-if="selectedTool.result.fileTracking.stats" class="text-sm">
                      <DiffNums 
                        :plus="selectedTool.result.fileTracking.stats.additions" 
                        :minus="selectedTool.result.fileTracking.stats.deletions"
                      />
                      <span class="text-muted-foreground ml-2">({{ selectedTool.result.fileTracking.stats.totalChanges }} changes)</span>
                    </div>
                  </div>
                  
                  <!-- Show diff preview if available -->
                  <div v-if="selectedTool.result.fileTracking.diff" class="mb-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      @click="() => { selectedFileChange = { ...selectedTool.result, stats: selectedTool.result.fileTracking.stats }; rightPanelTab = 'diff' }"
                    >
                      View Diff
                    </Button>
                  </div>
                </div>
                
                <!-- Full result JSON -->
                <details class="group">
                  <summary class="cursor-pointer text-sm text-muted-foreground hover:text-foreground mb-2">
                    Show raw result
                  </summary>
                  <pre class="bg-gray-100 p-3 rounded text-sm overflow-auto">{{ JSON.stringify(selectedTool.result, null, 2) }}</pre>
                </details>
              </div>
              
              <div v-if="selectedTool.timestamp">
                <h4 class="font-medium mb-2">Timestamp</h4>
                <p class="text-sm">{{ new Date(selectedTool.timestamp).toLocaleString() }}</p>
              </div>
            </div>
            <div v-else class="h-full flex items-center justify-center text-gray-500">
              <div class="text-center">
                <Info class="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p class="text-sm">Select a tool to view details</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
</template>