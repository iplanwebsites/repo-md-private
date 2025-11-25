<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useOrgStore } from '@/store/orgStore'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { FolderIcon, GitBranchIcon, Calendar as CalendarIcon } from 'lucide-vue-next'
import DiffNums from '@/components/ui/DiffNums.vue'
import { useToast } from '@/components/ui/toast/use-toast'
import { supabase } from '@/lib/supabaseClient'
import trpc from '@/trpc'
import JsonDebug from '@/components/JsonDebug.vue'
import NewEditorChat from '@/components/chat/NewEditorChat.vue'
import TaskList from '@/components/chat/TaskList.vue'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const route = useRoute()
const router = useRouter()
const { toast } = useToast()

const orgId = computed(() => route.params.orgId)
const projectId = computed(() => route.params.projectId)

const activeTab = ref('tasks')
const selectedRepository = ref('')
const selectedBranch = ref('main')
const searchQuery = ref('')
const newEditorChatRef = ref(null)
const selectedDate = ref(new Date())

// Task management state
const tasks = ref([])
const loadingTasks = ref(false)
const creatingTask = ref(false)
const lastApiResponse = ref(null) // For debugging

// User state
const currentUser = ref(null)

// Project state
const currentProject = ref(null)
const projectObjectId = computed(() => currentProject.value?._id || null)

// Transform tasks to include route
const tasksWithRoutes = computed(() => {
  return tasks.value.map(task => ({
    ...task,
    route: `/${orgId.value}/${projectId.value}/chat/${task.id}`
  }))
})

// Get tasks for the selected date
const tasksForSelectedDate = computed(() => {
  if (!selectedDate.value) return []
  
  const selectedDateStr = selectedDate.value.toDateString()
  
  return tasksWithRoutes.value.filter(task => {
    if (!task.createdAt) return false
    const taskDate = new Date(task.createdAt)
    return taskDate.toDateString() === selectedDateStr
  })
})

// Get all dates that have tasks
const datesWithTasks = computed(() => {
  const dates = new Set()
  
  tasks.value.forEach(task => {
    if (task.createdAt) {
      const date = new Date(task.createdAt)
      dates.add(date.toDateString())
    }
  })
  
  return Array.from(dates).map(dateStr => new Date(dateStr))
})

// Format date for display
const formatDateHeader = (date) => {
  if (!date) return ''
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Check if a date has tasks
const dateHasTasks = (date) => {
  if (!date) return false
  const dateStr = date.toDateString()
  return tasks.value.some(task => {
    if (!task.createdAt) return false
    return new Date(task.createdAt).toDateString() === dateStr
  })
}

// Get task count for a date
const getTaskCountForDate = (date) => {
  if (!date) return 0
  const dateStr = date.toDateString()
  return tasks.value.filter(task => {
    if (!task.createdAt) return false
    return new Date(task.createdAt).toDateString() === dateStr
  }).length
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

// Load project data to get the ObjectId
const loadProjectData = async () => {
  try {
    // Try to get project from org store first
    const orgStore = useOrgStore()
    const projects = orgStore.currentOrgProjects || []
    
    // Find project by handle/slug
    currentProject.value = projects.find(p => 
      p.handle === projectId.value || 
      p.slug === projectId.value || 
      p.name === projectId.value
    )
    
    if (!currentProject.value) {
      // If not found in store, we might need to fetch it
      // For now, log warning
      console.warn(`Project not found for handle: ${projectId.value}`)
    }
  } catch (error) {
    console.error('Error loading project data:', error)
  }
}

// Format time ago helper
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

// Load tasks from API
const loadTasks = async () => {
  // Wait for project data if not loaded
  if (!currentProject.value && !projectObjectId.value) {
    await loadProjectData()
  }
  
  loadingTasks.value = true
  try {
    // Use editorChat.list with orgId and projectObjectId for proper filtering
    const result = await trpc.editorChat.list.query({
      orgId: orgId.value,
      projectId: projectObjectId.value, // Use the ObjectId from project data
      status: activeTab.value === 'tasks' ? 'active' : 'archived',
      limit: 50,
      skip: 0
    })
    
    lastApiResponse.value = result // Store for debugging
    
    if (result.chats) {
      // Transform chats to match our task display format
      tasks.value = result.chats.map(chat => ({
        id: chat.id || chat._id,
        title: chat.title || 'Untitled Chat',
        timeAgo: formatTimeAgo(chat.createdAt),
        createdAt: chat.createdAt, // Keep the original date for calendar
        project: chat.project?.name || 'Organization',
        projectId: chat.project?._id || chat.projectId || null,
        projectSlug: chat.project?.handle || chat.projectSlug || projectId.value,
        repository: chat.project?.repository || null,
        status: chat.status === 'active' ? 'Open' : chat.status === 'completed' ? 'Completed' : 'Archived',
        model: chat.model || 'gpt-4o',
        temperature: chat.temperature || 0.7,
        messagesCount: chat.messages?.length || 0,
        tokensUsed: chat.tokensUsed || 0
      }))
    }
  } catch (error) {
    console.error('Error loading tasks:', error)
    tasks.value = []
    
    // Show error toast
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please check your connection and try again.",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Error loading tasks",
        description: error.message || "Failed to load tasks. Please try again.",
        variant: "destructive",
      })
    }
  } finally {
    loadingTasks.value = false
  }
}

// Create a new task
const createTask = async (data) => {
  const { query, branch } = data
  
  if (!query.trim()) return
  
  // Ensure we have project data
  if (!currentProject.value && !projectObjectId.value) {
    await loadProjectData()
  }
  
  creatingTask.value = true
  try {
    // Create editorChat with orgId, projectObjectId, and title
    const result = await trpc.editorChat.create.mutate({
      orgId: orgId.value,
      projectId: projectObjectId.value, // Use the ObjectId from project data
      title: query,
      model: 'gpt-4o',
      temperature: 0.7
    })
    
    lastApiResponse.value = result // Store for debugging
    
    if (result.id || result._id) {
      // Show success toast
      toast({
        title: "Chat Created",
        description: "Your chat has been created successfully",
        duration: 3000,
      })
      
      // Clear the input
      newEditorChatRef.value?.clearQuery()
      
      // Reload tasks to show the new chat
      await loadTasks()
      
      // Navigate to the new chat with initial message
      const chatId = result.id || result._id
      router.push({
        path: `/${orgId.value}/${projectId.value}/chat/${chatId}`,
        query: { initialMessage: query }
      })
    }
  } catch (error) {
    console.error('Error creating task:', error)
    
    // Show error toast
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please check your connection and try again.",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Error creating chat",
        description: error.message || "Failed to create chat. Please try again.",
        variant: "destructive",
      })
    }
  } finally {
    creatingTask.value = false
  }
}

// Handle branch change from child component
const handleBranchChange = (newBranch) => {
  selectedBranch.value = newBranch
}

// Handle query change from child component
const handleQueryChange = (newQuery) => {
  searchQuery.value = newQuery
}

// Load data on mount
onMounted(async () => {
  await getCurrentUser()
  await loadProjectData()
  loadTasks()
})

// Reload tasks when tab changes
watch(activeTab, () => {
  // Only reload for tasks and archive tabs since calendar uses the same data
  if (activeTab.value === 'tasks' || activeTab.value === 'archive') {
    loadTasks()
  }
})
</script>

<template>
  <div class="min-h-screen bg-muted/40 p-6">
    <!-- Header -->
    <div class="max-w-6xl mx-auto mb-8">
      <h1 class="text-3xl font-semibold text-foreground">What should we write next?</h1>
    </div>

    <!-- Search/Input Bar -->
    <div class="max-w-6xl mx-auto mb-6">
      <NewEditorChat
        ref="newEditorChatRef"
        placeholder="Write a comprehensive guide on sea turtle conservation efforts in the Pacific Ocean, including recent research findings and practical ways readers can help"
        submit-button-text="Write"
        :show-project-selector="false"
        :branches="[
          { value: 'main', label: 'main' },
          { value: 'develop', label: 'develop' },
          { value: 'feature', label: 'feature' }
        ]"
        :show-branch-selector="true"
        :creating="creatingTask"
        @submit="createTask"
        @update:selectedBranch="handleBranchChange"
        @update:query="handleQueryChange"
      />
    </div>

    <!-- Tabs -->
    <div class="max-w-6xl mx-auto">
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid w-full grid-cols-3 max-w-[300px]">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>

        <!-- Task List -->
        <TabsContent value="tasks" class="mt-6 space-y-4">
          <!-- Debug info -->
          <JsonDebug 
            :data="{ 
              tasks: tasks,
              loadingTasks: loadingTasks,
              orgId: orgId,
              projectId: projectId,
              projectObjectId: projectObjectId,
              currentProject: currentProject,
              activeTab: activeTab,
              lastApiResponse: lastApiResponse,
              apiParams: {
                create: { orgId: orgId, projectId: projectObjectId, title: 'example', model: 'gpt-4o', temperature: 0.7 },
                list: { orgId: orgId, projectId: projectObjectId, status: activeTab, limit: 50, skip: 0 },
                get: { chatId: 'chat-id' },
                delete: { chatId: 'chat-id' }
              }
            }" 
            title="EditorChat List Debug" 
          />
          
          <TaskList
            :tasks="tasksWithRoutes"
            :loading="loadingTasks"
            loading-message="Loading tasks..."
            empty-message="No tasks yet. Create your first task above!"
            :show-project="false"
            :show-diff-nums="false"
            :is-archive="false"
          />
        </TabsContent>

        <!-- Calendar View -->
        <TabsContent value="calendar" class="mt-6">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Calendar -->
            <div class="lg:col-span-1">
              <Card class="p-4">
                <div class="mb-4">
                  <h3 class="text-lg font-medium">Task Calendar</h3>
                  <p class="text-sm text-muted-foreground">
                    {{ tasks.length }} total task{{ tasks.length !== 1 ? 's' : '' }}
                  </p>
                </div>
                <Calendar 
                  v-model="selectedDate"
                  :mode="'single'"
                  class="rounded-md border"
                />
              </Card>
              
              <!-- Quick Stats -->
              <Card class="p-4 mt-4">
                <h4 class="text-sm font-medium mb-3">This Month</h4>
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">Total Tasks</span>
                    <span class="font-medium">{{ tasks.filter(t => {
                      const d = new Date(t.createdAt)
                      return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()
                    }).length }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">Completed</span>
                    <span class="font-medium">{{ tasks.filter(t => {
                      const d = new Date(t.createdAt)
                      return t.status === 'Completed' && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()
                    }).length }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">Open</span>
                    <span class="font-medium">{{ tasks.filter(t => {
                      const d = new Date(t.createdAt)
                      return t.status === 'Open' && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()
                    }).length }}</span>
                  </div>
                </div>
              </Card>
            </div>
            
            <!-- Tasks for Selected Date -->
            <div class="lg:col-span-2">
              <Card class="p-6">
                <div class="mb-4">
                  <h3 class="text-lg font-medium">{{ formatDateHeader(selectedDate) }}</h3>
                  <p class="text-sm text-muted-foreground mt-1">
                    {{ tasksForSelectedDate.length }} task{{ tasksForSelectedDate.length !== 1 ? 's' : '' }}
                  </p>
                </div>
                
                <div v-if="loadingTasks" class="text-center py-8">
                  <div class="text-muted-foreground">Loading tasks...</div>
                </div>
                
                <div v-else-if="tasksForSelectedDate.length === 0" class="text-center py-8">
                  <CalendarIcon class="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p class="text-muted-foreground">No tasks on this date</p>
                </div>
                
                <div v-else class="space-y-3">
                  <RouterLink
                    v-for="task in tasksForSelectedDate"
                    :key="task.id"
                    :to="task.route"
                    class="block no-underline"
                  >
                    <div class="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div class="flex items-start justify-between">
                        <div>
                          <h4 class="font-medium text-foreground">{{ task.title }}</h4>
                          <div class="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>{{ task.timeAgo }}</span>
                            <span v-if="task.repository">· {{ task.repository }}</span>
                            <span v-if="task.messagesCount">· {{ task.messagesCount }} messages</span>
                          </div>
                        </div>
                        <Badge :variant="task.status === 'Open' ? 'default' : 'secondary'">
                          {{ task.status }}
                        </Badge>
                      </div>
                    </div>
                  </RouterLink>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="archive" class="mt-6 space-y-4">
          <!-- Debug info -->
          <JsonDebug 
            :data="{ 
              tasks: tasks,
              loadingTasks: loadingTasks,
              orgId: orgId,
              projectId: projectId,
              activeTab: activeTab
            }" 
            title="EditorChat Archive Debug" 
          />
          
          <TaskList
            :tasks="tasksWithRoutes"
            :loading="loadingTasks"
            loading-message="Loading archived chats..."
            empty-message="No archived chats yet"
            :show-project="false"
            :show-diff-nums="false"
            :is-archive="true"
          />
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>