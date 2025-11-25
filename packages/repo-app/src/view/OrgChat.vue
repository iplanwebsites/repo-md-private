<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useOrgStore } from '@/store/orgStore'
import { supabase } from '@/lib/supabaseClient'
import trpc from '@/trpc'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { FolderIcon, GitBranchIcon, Globe, Hash, Terminal, Plug } from 'lucide-vue-next'
import DiffNums from '@/components/ui/DiffNums.vue'
import PageHeadingBar from '@/components/PageHeadingBar.vue'
import { useToast } from '@/components/ui/toast/use-toast'
import NewEditorChat from '@/components/chat/NewEditorChat.vue'
import TaskList from '@/components/chat/TaskList.vue'

// Feature flag for using dummy data vs real backend
const USE_DUMMY_DATA = false

// Initialize toast
const { toast } = useToast()

const route = useRoute()
const router = useRouter()
const orgStore = useOrgStore()
const orgId = computed(() => route.params.orgId)

// User state
const currentUser = ref(null)
const userId = computed(() => currentUser.value?.id)

const activeTab = ref('tasks')
const selectedProject = ref('all-projects')
const selectedBranch = ref('main')
const searchQuery = ref('')
const newEditorChatRef = ref(null)

// Branch management state
const branches = ref([])
const loadingBranches = ref(false)
const showBranchSelector = ref(false)

// Get projects from the org store
const currentOrg = computed(() => orgStore.currentOrg)
const projects = computed(() => {
  const orgProjects = orgStore.currentOrgProjects || []
  // Sort by modified date (most recent first)
  return [...orgProjects].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0)
    const dateB = new Date(b.updatedAt || b.createdAt || 0)
    return dateB - dateA
  })
})

// Project selector options
const projectOptions = computed(() => {
  const options = [
    { value: 'all-projects', label: 'All Projects', repository: 'all-projects' }
  ]
  
  // Add individual projects
  for (const project of projects.value) {
    options.push({
      value: project._id,
      label: project.name,
      repository: project.repository?.name || project.name
    })
  }
  
  return options
})

// Get selected project info
const selectedProjectInfo = computed(() => {
  return projectOptions.value.find(p => p.value === selectedProject.value) || projectOptions.value[0]
})

// Load branches for the selected project
const loadBranches = async (projectId) => {
  if (!projectId || projectId === 'all-projects' || loadingBranches.value) {
    branches.value = []
    showBranchSelector.value = false
    return
  }
  
  loadingBranches.value = true
  try {
    const result = await trpc.projects.listGitHubBranches.query({
      projectId: projectId
    })
    
    if (result.success && result.branches && result.branches.length > 0) {
      branches.value = result.branches.map(branch => ({
        value: branch.name,
        label: branch.name,
        protected: branch.protected
      }))
      
      // Show branch selector only if there are multiple branches
      showBranchSelector.value = result.branches.length > 1
      
      // Set default branch if current selection is not valid
      if (!branches.value.find(b => b.value === selectedBranch.value)) {
        selectedBranch.value = result.branches[0].name
      }
    } else {
      branches.value = []
      showBranchSelector.value = false
    }
  } catch (error) {
    console.error('Error loading branches:', error)
    branches.value = []
    showBranchSelector.value = false
  } finally {
    loadingBranches.value = false
  }
}

// Transform tasks to include route
const tasksWithRoutes = computed(() => {
  return tasks.value.map(task => {
    // If task has a projectId, find the project slug and use project-specific URL
    if (task.projectId) {
      const project = projects.value.find(p => p._id === task.projectId)
      if (project && project.slug) {
        return {
          ...task,
          route: `/${orgId.value}/${project.slug}/chat/${task.id}`
        }
      }
    }
    
    // Default to org-level chat URL
    return {
      ...task,
      route: `/${orgId.value}/~/chat/${task.id}`
    }
  })
})

// Watch for project selection changes to load branches
watch(selectedProject, (newProjectId) => {
  if (newProjectId && newProjectId !== 'all-projects') {
    loadBranches(newProjectId)
  } else {
    branches.value = []
    showBranchSelector.value = false
  }
}, { immediate: false })

// Task management state
const tasks = ref([])
const loadingTasks = ref(false)
const creatingTask = ref(false)

// Static dummy data for development
const DUMMY_TASKS = [
  {
    id: '1',
    title: 'Create organization-wide style guide for all projects',
    timeAgo: '2 hours ago',
    repository: 'brand-guidelines',
    project: 'Brand Guidelines',
    projectId: null,
    status: 'Open',
    changes: null,
    model: 'gpt-4o',
    temperature: 0.7,
    messagesCount: 12,
    tokensUsed: 4532
  },
  {
    id: '2',
    title: 'Set up automated testing workflow across all repositories',
    timeAgo: '5 hours ago',
    repository: 'ci-templates',
    project: 'CI Templates',
    projectId: null,
    status: 'Open',
    changes: null,
    model: 'gpt-4o',
    temperature: 0.7,
    messagesCount: 8,
    tokensUsed: 3210
  },
  {
    id: '3',
    title: 'Draft quarterly development roadmap and resource allocation',
    timeAgo: '1 day ago',
    repository: 'planning-docs',
    project: 'Planning Docs',
    projectId: null,
    status: 'Completed',
    changes: null,
    model: 'gpt-4o',
    temperature: 0.7,
    messagesCount: 24,
    tokensUsed: 8765
  },
  {
    id: '4',
    title: 'Update security policies and access controls across organization',
    timeAgo: '2 days ago',
    repository: 'security-policies',
    project: 'Security Policies',
    projectId: null,
    status: 'Archived',
    changes: null,
    model: 'gpt-4o',
    temperature: 0.7,
    messagesCount: 16,
    tokensUsed: 5432
  }
]

// Load tasks (dummy or from backend)
const loadTasks = async () => {
  if (USE_DUMMY_DATA) {
    tasks.value = DUMMY_TASKS
    return
  }

  loadingTasks.value = true
  try {
    // Use the real editorChat.list endpoint
    const result = await trpc.editorChat.list.query({
      orgId: orgId.value,  // Required parameter
      projectId: selectedProject.value !== 'all-projects' ? selectedProject.value : undefined,
      status: activeTab.value === 'tasks' ? 'active' : 'archived',
      limit: 50,
      skip: 0
    })
    
    if (result.chats) {
      // Transform chats to match our task display format
      tasks.value = result.chats.map(chat => ({
        id: chat.id,
        title: chat.title || 'Untitled Chat',
        timeAgo: formatTimeAgo(chat.createdAt),
        project: chat.project?.name || 'Organization',
        projectId: chat.project?.id || null,
        repository: chat.project?.repository || null,
        status: chat.status === 'active' ? 'Open' : chat.status === 'completed' ? 'Completed' : 'Archived',
        changes: null, // Chats don't have changes like PRs
        model: chat.model,
        temperature: chat.temperature,
        messagesCount: chat.messages?.length || 0,
        tokensUsed: chat.tokensUsed || 0,
        source: chat.source || 'web' // Include source property with default 'web'
      }))
    }
  } catch (error) {
    console.error('Error loading tasks:', error)
    
    // Only fallback to dummy data if USE_DUMMY_DATA is true
    if (USE_DUMMY_DATA) {
      tasks.value = DUMMY_TASKS
    } else {
      // Keep tasks empty on error when using real backend
      tasks.value = []
      
      // Show error toast for connection issues
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
    }
  } finally {
    loadingTasks.value = false
  }
}

// Create a new task
const createTask = async (data) => {
  const { query, project, branch } = data
  
  if (!query.trim()) return
  
  if (USE_DUMMY_DATA) {
    // Add to dummy data
    const selectedProjectInfo = projectOptions.value.find(p => p.value === project)
    const newTask = {
      id: String(Date.now()),
      title: query,
      timeAgo: 'just now',
      repository: selectedProjectInfo?.repository,
      project: selectedProjectInfo?.label,
      projectId: project !== 'all-projects' ? project : null,
      status: 'Open',
      changes: null,
      model: 'gpt-4o',
      temperature: 0.7,
      messagesCount: 0,
      tokensUsed: 0
    }
    tasks.value.unshift(newTask)
    newEditorChatRef.value?.clearQuery()
    // Navigate to the new chat with initial message
    if (project !== 'all-projects' && project) {
      // Find the project to get its slug
      const projectData = projects.value.find(p => p._id === project)
      const projectSlug = projectData?.slug || project
      router.push({
        path: `/${orgId.value}/${projectSlug}/chat/${newTask.id}`,
        query: { initialMessage: query }
      })
    } else {
      router.push({
        path: `/${orgId.value}/~/chat/${newTask.id}`,
        query: { initialMessage: query }
      })
    }
    return
  }

  creatingTask.value = true
  try {
    // Use the real editorChat.create endpoint
    const result = await trpc.editorChat.create.mutate({
      orgId: orgId.value,  // Required parameter
      projectId: project !== 'all-projects' ? project : undefined,
      title: query,
      model: 'gpt-4o',  // Default model
      temperature: 0.7   // Default temperature
    })
    
    if (result.id) {
      // Show success toast
      toast({
        title: "Chat Created",
        description: "Your chat has been created successfully",
        duration: 3000,
      })
      
      // Clear the input
      newEditorChatRef.value?.clearQuery()
      
      // Navigate to the new chat with initial message
      if (project !== 'all-projects' && project) {
        // Find the project to get its slug
        const projectData = projects.value.find(p => p._id === project)
        const projectSlug = projectData?.slug || project
        router.push({
          path: `/${orgId.value}/${projectSlug}/chat/${result.id}`,
          query: { initialMessage: query }
        })
      } else {
        router.push({
          path: `/${orgId.value}/~/chat/${result.id}`,
          query: { initialMessage: query }
        })
      }
    } else {
      // Handle unexpected response
      toast({
        title: "Error creating chat",
        description: "Unexpected response from server. Please try again.",
        variant: "destructive",
      })
    }
  } catch (error) {
    console.error('Error creating task:', error)
    
    // Show error toast for connection issues
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please check your connection and try again.",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Error creating task",
        description: error.message || "Failed to create task. Please try again.",
        variant: "destructive",
      })
    }
  } finally {
    creatingTask.value = false
  }
}

// Handle project change from child component
const handleProjectChange = (newProjectId) => {
  selectedProject.value = newProjectId
}

// Handle branch change from child component
const handleBranchChange = (newBranch) => {
  selectedBranch.value = newBranch
}

// Handle query change from child component
const handleQueryChange = (newQuery) => {
  searchQuery.value = newQuery
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

// Load tasks when component mounts or when filters change
onMounted(async () => {
  await getCurrentUser()
  loadTasks()
})

// Reload tasks when project selection or tab changes
watch([selectedProject, selectedBranch, activeTab], () => {
  loadTasks()
})
</script>

<template>
  <div class="min-h-screen bg-muted/40 p-6">
    <!-- Page Header -->
    <PageHeadingBar 
      title="Organization Chat"
      subtitle="Collaborate across all projects in your organization"
    />

    <json-debug :data=" tasks" />
    <!-- Search/Input Bar -->
    <div class="max-w-6xl mx-auto mb-6">
      <NewEditorChat
        ref="newEditorChatRef"
        placeholder="Create a comprehensive documentation system for all our projects, including setup guides, API references, and deployment procedures"
        submit-button-text="Create Task"
        :show-project-selector="true"
        :project-options="projectOptions"
        :branches="branches"
        :show-branch-selector="showBranchSelector"
        :loading-branches="loadingBranches"
        :creating="creatingTask"
        @submit="createTask"
        @update:selectedProject="handleProjectChange"
        @update:selectedBranch="handleBranchChange"
        @update:query="handleQueryChange"
      />
    </div>

    <!-- Tabs -->
    <div class="max-w-6xl mx-auto">
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid w-full grid-cols-2 max-w-[200px]">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>

        <!-- Task List -->
        <TabsContent value="tasks" class="mt-6 space-y-4">
          <TaskList
            :tasks="tasksWithRoutes"
            :loading="loadingTasks"
            loading-message="Loading tasks..."
            empty-message="No tasks yet. Create your first task above!"
            :show-project="true"
            :show-diff-nums="true"
            :is-archive="false"
          />
        </TabsContent>

        <TabsContent value="archive" class="mt-6 space-y-4">
          <TaskList
            :tasks="tasksWithRoutes"
            :loading="loadingTasks"
            loading-message="Loading archived chats..."
            empty-message="No archived chats yet"
            :show-project="true"
            :show-diff-nums="false"
            :is-archive="true"
          />
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>