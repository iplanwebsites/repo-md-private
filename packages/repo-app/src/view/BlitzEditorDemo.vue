<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { githubRepoService } from '@/lib/githubRepoService'
import PageHeadingBar from '@/components/PageHeadingBar.vue'
import trpc from '@/trpc'
import { 
  Play, 
  Download, 
  Github, 
  Loader2, 
  FileText,
  Eye,
  Code,
  Trash2,
  RefreshCw,
  Copy,
  Key
} from 'lucide-vue-next'

// StackBlitz SDK will be loaded dynamically
let sdk = null

// Example repositories for demo
const exampleRepos = [
  { id: 'vue-docs', owner: 'vuejs', repo: 'docs', branch: 'main', label: 'Vue.js Documentation', openFile: 'package.json' },
  { id: 'astro-docs', owner: 'withastro', repo: 'docs', branch: 'main', label: 'Astro Documentation', openFile: 'package.json' },
  { id: 'react-starter', owner: 'stackblitz', repo: 'react-starter', branch: 'main', label: 'React Starter' },
  { id: 'vue3-starter', owner: 'stackblitz', repo: 'vue3-starter', branch: 'main', label: 'Vue 3 Starter' },
  { id: 'angular-starter', owner: 'stackblitz', repo: 'angular-starter', branch: 'main', label: 'Angular Starter' },
  { id: 'nextjs-starter', owner: 'vercel', repo: 'next.js', branch: 'canary', label: 'Next.js Example' },
  { id: 'custom', owner: '', repo: '', branch: 'main', label: 'Custom Repository' }
]

// State management
const selectedRepoId = ref('vue-docs')
const customRepo = ref({ owner: '', repo: '', branch: 'main' })
const isLoading = ref(false)
const error = ref(null)
const eventLog = ref([])
const vm = ref(null)
const iframeRef = ref(null)
const projectFiles = ref({})
const currentFile = ref('')
const previewUrl = ref('')
const useStackBlitzGitHub = ref(true) // Use StackBlitz's GitHub integration

// GitHub authentication state
const githubAuth = ref({
  token: null,
  hasPersonalToken: false,
  tokenUpdatedAt: null,
  loading: false,
  error: null
})

// Computed
const selectedRepo = computed(() => {
  const repo = exampleRepos.find(r => r.id === selectedRepoId.value)
  if (repo?.id === 'custom') {
    return {
      ...repo,
      owner: customRepo.value.owner,
      repo: customRepo.value.repo,
      branch: customRepo.value.branch
    }
  }
  return repo
})

const isCustomRepo = computed(() => selectedRepoId.value === 'custom')

const canLoadRepo = computed(() => {
  const repo = selectedRepo.value
  return repo && repo.owner && repo.repo && repo.branch
})

// Event logging
const logEvent = (type, message, data = {}) => {
  const timestamp = new Date().toISOString()
  eventLog.value.unshift({
    id: Date.now(),
    timestamp,
    type,
    message,
    data
  })
  
  // Keep only last 100 events
  if (eventLog.value.length > 100) {
    eventLog.value = eventLog.value.slice(0, 100)
  }
}

// Fetch GitHub token from tRPC
const fetchGitHubToken = async () => {
  try {
    githubAuth.value.loading = true
    githubAuth.value.error = null
    
    logEvent('info', 'Fetching GitHub token...')
    const tokenResponse = await trpc.github.getGithubToken.query()
    
    logEvent('info', 'GitHub token fetched', {
      hasToken: !!tokenResponse.token,
      hasPersonalToken: tokenResponse.hasPersonalToken
    })
    
    githubAuth.value.token = tokenResponse.token
    githubAuth.value.hasPersonalToken = tokenResponse.hasPersonalToken
    githubAuth.value.tokenUpdatedAt = tokenResponse.tokenUpdatedAt
    
    // Set the token in the GitHub service
    if (tokenResponse.token) {
      githubRepoService.setAuthToken(tokenResponse.token)
      logEvent('success', 'GitHub token configured')
    } else {
      logEvent('warning', 'No GitHub token available')
    }
    
    return tokenResponse.token
    
  } catch (error) {
    logEvent('error', `Error fetching GitHub token: ${error.message}`)
    githubAuth.value.error = error.message
    return null
  } finally {
    githubAuth.value.loading = false
  }
}

// Load StackBlitz SDK
const loadStackBlitzSDK = async () => {
  if (sdk) return sdk
  
  try {
    logEvent('info', 'Loading StackBlitz SDK...')
    const module = await import('@stackblitz/sdk')
    sdk = module.default
    logEvent('success', 'StackBlitz SDK loaded')
    return sdk
  } catch (err) {
    logEvent('error', 'Failed to load StackBlitz SDK', { error: err.message })
    throw err
  }
}

// Fetch GitHub repository files
const fetchGitHubFiles = async () => {
  const repo = selectedRepo.value
  if (!repo || !repo.owner || !repo.repo) return null
  
  try {
    logEvent('info', `Fetching files from ${repo.owner}/${repo.repo}...`)
    
    // Check if we have a GitHub token
    const hasToken = !!githubRepoService.authToken
    logEvent('info', `GitHub token status: ${hasToken ? 'available' : 'not available'}`)
    
    // Try to fetch repo info first
    let repoInfo = null
    let defaultBranch = repo.branch || 'main'
    
    try {
      repoInfo = await githubRepoService.fetchRepoInfo(repo.owner, repo.repo)
      defaultBranch = repo.branch || repoInfo.default_branch
      logEvent('info', 'Repository info fetched', { 
        size: repoInfo.size, 
        default_branch: repoInfo.default_branch 
      })
    } catch (infoErr) {
      logEvent('warning', `Could not fetch repo info, using default branch: ${defaultBranch}`)
    }
    
    // Try different methods to fetch the repository
    let files = null
    
    // Method 1: Try zipball (might fail due to CORS)
    try {
      const zipBuffer = await githubRepoService.fetchRepoZipball(
        repo.owner, 
        repo.repo, 
        defaultBranch
      )
      
      files = await githubRepoService.extractZipToFiles(zipBuffer, (progress) => {
        logEvent('progress', `Extracting: ${progress.currentFile}`, {
          processed: progress.processed,
          total: progress.total
        })
      })
    } catch (zipErr) {
      logEvent('warning', 'Zipball method failed, trying contents API...', { error: zipErr.message })
      
      // Method 2: Try contents API (already implemented in githubRepoService)
      try {
        const contentsResult = await githubRepoService.fetchRepoViaContentsAPI(
          repo.owner,
          repo.repo,
          defaultBranch
        )
        files = contentsResult.files || contentsResult
      } catch (contentsErr) {
        logEvent('error', 'Contents API also failed', { error: contentsErr.message })
        throw new Error(`Unable to fetch repository. This might be due to CORS restrictions or rate limiting. ${contentsErr.message}`)
      }
    }
    
    if (!files || Object.keys(files).length === 0) {
      throw new Error('No files retrieved from repository')
    }
    
    // Convert to StackBlitz format
    const projectFiles = {}
    for (const [path, content] of Object.entries(files)) {
      try {
        // Try to decode as text
        let textContent
        if (typeof content === 'string') {
          textContent = content
        } else if (content instanceof Uint8Array) {
          textContent = new TextDecoder('utf-8', { fatal: true }).decode(content)
        } else {
          textContent = String(content)
        }
        projectFiles[path] = textContent
      } catch (err) {
        // Skip binary files for StackBlitz
        logEvent('warning', `Skipping binary file: ${path}`)
      }
    }
    
    logEvent('success', `Fetched ${Object.keys(projectFiles).length} files`)
    return projectFiles
    
  } catch (err) {
    logEvent('error', `Failed to fetch repository: ${err.message}`)
    throw err
  }
}

// Load repository into StackBlitz
const loadRepository = async () => {
  if (!canLoadRepo.value) {
    error.value = 'Please select a repository or enter custom repository details'
    return
  }
  
  isLoading.value = true
  error.value = null
  
  try {
    // Fetch GitHub token first (for manual method)
    if (!useStackBlitzGitHub.value) {
      await fetchGitHubToken()
    }
    
    // Load SDK if not already loaded
    await loadStackBlitzSDK()
    
    const repo = selectedRepo.value
    
    if (useStackBlitzGitHub.value) {
      // Use StackBlitz's native GitHub integration
      logEvent('info', `Using StackBlitz GitHub integration for ${repo.owner}/${repo.repo}...`)
      
      try {
        // Use embedGithubProject which handles GitHub repos natively
        vm.value = await sdk.embedGithubProject('stackblitz-demo', `${repo.owner}/${repo.repo}`, {
          openFile: repo.openFile || 'package.json',
          view: 'default', // Show both editor and preview
          height: 600,
          hideNavigation: false,
          hideDevTools: false,
          theme: 'dark',
          clickToLoad: false,
          startScript: 'dev' // Try to run dev script
        })
        
        // Set up VM event listeners
        setupVMListeners()
        
        logEvent('success', 'Project loaded successfully using StackBlitz GitHub integration')
        
      } catch (sbErr) {
        logEvent('warning', 'StackBlitz GitHub method failed, trying manual fetch...', { error: sbErr.message })
        // Fall back to manual method
        useStackBlitzGitHub.value = false
        await loadRepositoryManual()
      }
    } else {
      await loadRepositoryManual()
    }
    
  } catch (err) {
    error.value = err.message
    logEvent('error', 'Failed to load repository', { error: err.message })
  } finally {
    isLoading.value = false
  }
}

// Manual repository loading (original method)
const loadRepositoryManual = async () => {
  // Fetch repository files
  const files = await fetchGitHubFiles()
  if (!files) {
    throw new Error('No files fetched from repository')
  }
  
  projectFiles.value = files
  
  // Determine project configuration
  const hasPackageJson = 'package.json' in files
  const packageJson = hasPackageJson ? JSON.parse(files['package.json']) : {}
  
  // Create StackBlitz project configuration
  const project = {
    files,
    title: `${selectedRepo.value.owner}/${selectedRepo.value.repo}`,
    description: packageJson.description || `Loaded from GitHub: ${selectedRepo.value.owner}/${selectedRepo.value.repo}`,
    template: detectTemplate(files, packageJson),
    dependencies: packageJson.dependencies || {},
    devDependencies: packageJson.devDependencies || {},
    settings: {
      compile: {
        trigger: 'auto',
        action: 'refresh',
        clearConsole: false
      }
    }
  }
  
  logEvent('info', 'Embedding project in StackBlitz...', { 
    template: project.template,
    fileCount: Object.keys(files).length 
  })
  
  // Embed the project
  vm.value = await sdk.embedProject('stackblitz-demo', project, {
    openFile: selectedRepo.value.openFile || findMainFile(files),
    view: 'default', // Show both editor and preview
    height: 600,
    hideNavigation: false,
    hideDevTools: false,
    theme: 'dark',
    clickToLoad: false,
    startScript: packageJson.scripts?.dev ? 'dev' : (packageJson.scripts?.start ? 'start' : undefined)
  })
  
  // Set up VM event listeners
  setupVMListeners()
  
  logEvent('success', 'Project loaded successfully using manual method')
}

// Detect project template based on files
const detectTemplate = (files, packageJson) => {
  if (packageJson.dependencies) {
    if (packageJson.dependencies.react) return 'create-react-app'
    if (packageJson.dependencies.vue) return 'vue'
    if (packageJson.dependencies['@angular/core']) return 'angular-cli'
    if (packageJson.dependencies.next) return 'nextjs'
  }
  
  // Fallback detection based on files
  if (files['app.tsx'] || files['App.tsx'] || files['index.tsx']) return 'create-react-app'
  if (files['app.vue'] || files['App.vue']) return 'vue'
  if (files['angular.json']) return 'angular-cli'
  
  return 'node' // Default fallback
}

// Find the main file to open
const findMainFile = (files) => {
  const candidates = [
    'src/App.tsx', 'src/App.jsx', 'src/App.vue', 'src/app.component.ts',
    'pages/index.tsx', 'pages/index.jsx', 
    'index.tsx', 'index.jsx', 'index.js', 'index.html',
    'src/main.tsx', 'src/main.jsx', 'src/main.js'
  ]
  
  for (const candidate of candidates) {
    if (files[candidate]) return candidate
  }
  
  // Return first non-config file
  const firstFile = Object.keys(files).find(f => 
    !f.includes('node_modules') && 
    !f.startsWith('.') && 
    !f.endsWith('.json') &&
    !f.endsWith('.lock')
  )
  
  return firstFile || 'index.js'
}

// Set up VM event listeners
const setupVMListeners = () => {
  if (!vm.value) return
  
  // Get iframe reference for additional control
  const iframe = document.getElementById('stackblitz-demo')
  if (iframe) {
    iframeRef.value = iframe
    logEvent('info', 'StackBlitz iframe connected')
    
    // Try to get preview URL after a short delay
    setTimeout(async () => {
      try {
        if (vm.value.preview) {
          const url = await vm.value.preview.getUrl()
          if (url) {
            previewUrl.value = url
            logEvent('info', `Preview URL available: ${url}`)
          }
        }
      } catch (err) {
        logEvent('warning', 'Could not get preview URL', { error: err.message })
      }
    }, 3000)
  }
}

// VM Control Methods
const openFile = async (path) => {
  if (!vm.value) return
  
  try {
    await vm.value.editor.openFile(path)
    currentFile.value = path
    logEvent('action', `Opened file: ${path}`)
  } catch (err) {
    logEvent('error', `Failed to open file: ${err.message}`)
  }
}

const setEditorTheme = async (theme) => {
  if (!vm.value) return
  
  try {
    await vm.value.editor.setTheme(theme)
    logEvent('action', `Changed theme to: ${theme}`)
  } catch (err) {
    logEvent('error', `Failed to set theme: ${err.message}`)
  }
}

const setView = async (view) => {
  if (!vm.value) return
  
  try {
    await vm.value.editor.setView(view)
    logEvent('action', `Changed view to: ${view}`)
  } catch (err) {
    logEvent('error', `Failed to set view: ${err.message}`)
  }
}

const getPreviewUrl = async () => {
  if (!vm.value) return
  
  try {
    const url = await vm.value.preview.getUrl()
    previewUrl.value = url || ''
    logEvent('info', `Preview URL: ${url}`)
    return url
  } catch (err) {
    logEvent('error', `Failed to get preview URL: ${err.message}`)
  }
}

const getDependencies = async () => {
  if (!vm.value) return
  
  try {
    const deps = await vm.value.getDependencies()
    logEvent('info', 'Retrieved dependencies', deps)
    return deps
  } catch (err) {
    logEvent('error', `Failed to get dependencies: ${err.message}`)
  }
}

const getFsSnapshot = async () => {
  if (!vm.value) return
  
  try {
    const snapshot = await vm.value.getFsSnapshot()
    logEvent('info', `Retrieved file snapshot (${Object.keys(snapshot).length} files)`)
    return snapshot
  } catch (err) {
    logEvent('error', `Failed to get file snapshot: ${err.message}`)
  }
}

// Export functions
const exportState = async () => {
  const state = {
    timestamp: new Date().toISOString(),
    repository: {
      owner: selectedRepo.value.owner,
      repo: selectedRepo.value.repo,
      branch: selectedRepo.value.branch
    },
    eventLog: eventLog.value,
    currentFile: currentFile.value,
    previewUrl: previewUrl.value
  }
  
  // Try to get current file system state
  if (vm.value) {
    try {
      state.files = await getFsSnapshot()
      state.dependencies = await getDependencies()
    } catch (err) {
      console.error('Failed to get VM state:', err)
    }
  }
  
  // Create download
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stackblitz-demo-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  
  logEvent('action', 'Exported state to file')
}

const copyEventLog = () => {
  const logText = eventLog.value
    .map(e => `[${e.timestamp}] ${e.type.toUpperCase()}: ${e.message}`)
    .join('\n')
  
  navigator.clipboard.writeText(logText)
  logEvent('action', 'Copied event log to clipboard')
}

const clearEventLog = () => {
  eventLog.value = []
  logEvent('action', 'Event log cleared')
}

// Initialize
onMounted(async () => {
  logEvent('info', 'BlitzEditorDemo initialized')
  // Fetch GitHub token on mount
  await fetchGitHubToken()
})
</script>

<template>
  <div class="min-h-screen bg-background">
    <PageHeadingBar 
      title="StackBlitz Editor Demo"
      :breadcrumbs="[
        { label: 'Home', to: '/' },
        { label: 'StackBlitz Demo' }
      ]"
    />
    
    <div class="container mx-auto p-6 space-y-6">
      <!-- Repository Selection -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Github class="w-5 h-5" />
            Repository Selection
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Example Repositories</Label>
              <Select v-model="selectedRepoId">
                <SelectTrigger>
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="repo in exampleRepos" :key="repo.id" :value="repo.id">
                    {{ repo.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div v-if="isCustomRepo" class="space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <Label>Owner</Label>
                  <Input v-model="customRepo.owner" placeholder="username/org" />
                </div>
                <div>
                  <Label>Repository</Label>
                  <Input v-model="customRepo.repo" placeholder="repo-name" />
                </div>
              </div>
              <div>
                <Label>Branch</Label>
                <Input v-model="customRepo.branch" placeholder="main" />
              </div>
            </div>
          </div>
          
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <Key class="w-4 h-4" />
              <span v-if="githubAuth.loading">Loading GitHub token...</span>
              <span v-else-if="githubAuth.token" class="text-green-600">
                GitHub token active {{ githubAuth.hasPersonalToken ? '(personal)' : '(app)' }}
              </span>
              <span v-else class="text-yellow-600">
                No GitHub token (API rate limited)
              </span>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <Button 
              @click="loadRepository" 
              :disabled="!canLoadRepo || isLoading"
              class="flex items-center gap-2"
            >
              <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
              <Play v-else class="w-4 h-4" />
              Load Repository
            </Button>
            
            <Button 
              v-if="vm"
              @click="getPreviewUrl"
              variant="outline"
              class="flex items-center gap-2"
            >
              <Eye class="w-4 h-4" />
              Get Preview URL
            </Button>
          </div>
          
          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>
          
          <div class="flex items-center space-x-2">
            <Checkbox 
              id="use-stackblitz-github" 
              v-model:checked="useStackBlitzGitHub" 
            />
            <Label for="use-stackblitz-github" class="text-sm">
              Use StackBlitz's native GitHub integration (recommended)
            </Label>
          </div>
          
          <Alert v-if="!error">
            <AlertDescription>
              <strong>Note:</strong> If using manual fetch, GitHub API requests may fail due to CORS restrictions or rate limiting. 
              The StackBlitz native integration (checkbox above) usually works better.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      
      <!-- StackBlitz Editor -->
      <Card v-if="vm || isLoading">
        <CardHeader>
          <CardTitle class="flex items-center justify-between">
            <span class="flex items-center gap-2">
              <Code class="w-5 h-5" />
              StackBlitz Editor
            </span>
            <div class="flex items-center gap-4">
              <div v-if="previewUrl" class="text-sm text-green-600 flex items-center gap-2">
                <div class="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                Preview running
              </div>
              <div class="flex items-center gap-2">
                <Button 
                  @click="setView('editor')"
                  variant="outline"
                  size="sm"
                >
                  Editor
                </Button>
                <Button 
                  @click="setView('preview')"
                  variant="outline"
                  size="sm"
                >
                  Preview
                </Button>
                <Button 
                  @click="setView('default')"
                  variant="outline"
                  size="sm"
                >
                  Both
                </Button>
                <Button 
                  @click="setEditorTheme('light')"
                  variant="outline"
                  size="sm"
                >
                  Light
                </Button>
                <Button 
                  @click="setEditorTheme('dark')"
                  variant="outline"
                  size="sm"
                >
                  Dark
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent class="relative">
          <div id="stackblitz-demo" class="w-full h-[600px] border rounded-lg overflow-hidden bg-gray-50" />
          <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
            <div class="text-center">
              <Loader2 class="w-8 h-8 animate-spin mx-auto mb-4" />
              <p class="text-sm text-muted-foreground">Loading project...</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <!-- Event Log -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center justify-between">
            <span class="flex items-center gap-2">
              <FileText class="w-5 h-5" />
              Event Log ({{ eventLog.length }} events)
            </span>
            <div class="flex items-center gap-2">
              <Button 
                @click="copyEventLog"
                variant="outline"
                size="sm"
                class="flex items-center gap-2"
              >
                <Copy class="w-4 h-4" />
                Copy
              </Button>
              <Button 
                @click="clearEventLog"
                variant="outline"
                size="sm"
                class="flex items-center gap-2"
              >
                <Trash2 class="w-4 h-4" />
                Clear
              </Button>
              <Button 
                @click="exportState"
                variant="outline"
                size="sm"
                class="flex items-center gap-2"
              >
                <Download class="w-4 h-4" />
                Export State
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea class="h-[300px] w-full rounded-md border p-4">
            <div class="space-y-2 font-mono text-sm">
              <div 
                v-for="event in eventLog" 
                :key="event.id"
                class="flex gap-2"
                :class="{
                  'text-green-600': event.type === 'success',
                  'text-red-600': event.type === 'error',
                  'text-yellow-600': event.type === 'warning',
                  'text-blue-600': event.type === 'info',
                  'text-purple-600': event.type === 'action',
                  'text-gray-600': event.type === 'progress'
                }"
              >
                <span class="text-xs text-gray-400">{{ new Date(event.timestamp).toLocaleTimeString() }}</span>
                <span class="font-semibold">[{{ event.type.toUpperCase() }}]</span>
                <span>{{ event.message }}</span>
                <span v-if="event.data && Object.keys(event.data).length > 0" class="text-xs text-gray-500">
                  {{ JSON.stringify(event.data) }}
                </span>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  </div>
</template>