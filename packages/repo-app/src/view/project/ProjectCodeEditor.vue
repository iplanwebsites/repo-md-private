<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { githubRepoService } from '@/lib/githubRepoService'
import { fileChangeTracker } from '@/lib/fileChangeTracker'
import WebContainerFileBrowser from '@/components/webcontainer/WebContainerFileBrowser.vue'
import CodeEditor from '@/components/webcontainer/CodeEditor.vue'
import DiffViewer from '@/components/webcontainer/DiffViewer.vue'
import ConsoleOutput from '@/components/webcontainer/ConsoleOutput.vue'
import PageHeadingBar from '@/components/PageHeadingBar.vue'
import trpc from '@/trpc'
import { 
  Download, 
  Play, 
  Square, 
  Terminal, 
  Globe, 
  Code, 
  Github, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Save,
  FileText,
  Eye,
  Wrench,
  TestTube,
  Package,
  RefreshCw,
  Layout,
  BookOpen
} from 'lucide-vue-next'

const props = defineProps({
  project: {
    type: Object,
    default: null,
  },
})

const route = useRoute()

// Route computed properties
const orgHandle = computed(() => route.params.orgId)
const projectSlug = computed(() => route.params.projectId)

// Main state
const state = ref({
  loading: false,
  error: null,
  progress: null,
  result: null,
  serverUrl: null,
  webContainer: null,
  terminalOutput: []
})

// GitHub authentication state
const githubAuth = ref({
  token: null,
  hasPersonalToken: false,
  tokenUpdatedAt: null,
  loading: false,
  error: null
})

// GitHub repository form
const repoForm = ref({
  url: '',
  branch: 'main',
  autoInstall: true,
  autoStart: false
})

// File editing state
const selectedFile = ref('')
const changedFiles = ref(new Set())
const fileChangeStats = ref({ totalFiles: 0, changedFiles: 0 })

// UI state
const activeTab = ref('import')
const leftPanelWidth = ref(300)
const bottomPanelHeight = ref(300)
const isResizing = ref(false)
const showDiffPanel = ref(false)
const showPreviewOutput = ref(true)

// Container controls
const containerStatus = ref({
  running: false,
  installing: false,
  serving: false,
  testing: false,
  building: false,
  port: null
})

// Dev server state
const devServerState = ref({
  running: false,
  port: null,
  url: null,
  output: [],
  process: null,
  startCommand: 'npm run dev',
  availableCommands: []
})

// Centralized process management
const processManager = ref({
  processes: new Map(), // processId -> process info
  activeCount: 0,
  devServerProcessId: null
})

// Process info structure:
// {
//   id: string,
//   command: string,
//   type: 'dev' | 'build' | 'test' | 'install' | 'script' | 'custom',
//   status: 'running' | 'completed' | 'failed' | 'killed',
//   startTime: Date,
//   endTime: Date | null,
//   exitCode: number | null,
//   output: Array<{timestamp, text, type}>,
//   process: WebContainerProcess | null,
//   port: number | null,
//   url: string | null
// }

// Search and replace
const branches = ref([])
const searchResults = ref([])
const searchQuery = ref('')

// Package.json info
const packageInfo = ref(null)
const npmInstallOutput = ref([])
const showPackageJson = ref(true)

// Component refs
const fileBrowserRef = ref(null)
const consoleRef = ref(null)

// Computed properties
const isValidGitHubUrl = computed(() => {
  return /github\.com\/[^\/]+\/[^\/]+/.test(repoForm.value.url)
})

const parsedRepo = computed(() => {
  const match = repoForm.value.url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, '')
    }
  }
  return null
})

const progressPercentage = computed(() => {
  if (!state.value.progress?.progress) return 0
  return Math.round(state.value.progress.progress * 100)
})

const currentFileDiff = computed(() => {
  if (!selectedFile.value) return null
  return fileChangeTracker.getFileDiff(selectedFile.value)
})

const hasUnsavedChanges = computed(() => {
  return fileChangeStats.value.changedFiles > 0
})

const hasActiveProcesses = computed(() => {
  return state.value.loading || 
         containerStatus.value.installing || 
         containerStatus.value.building || 
         containerStatus.value.testing ||
         devServerState.value.running ||
         processManager.value.activeCount > 0
})

// Computed process lists
const runningProcesses = computed(() => {
  return Array.from(processManager.value.processes.values())
    .filter(p => p.status === 'running')
})

const allProcesses = computed(() => {
  return Array.from(processManager.value.processes.values())
    .sort((a, b) => b.startTime - a.startTime)
})

const currentDevProcess = computed(() => {
  if (processManager.value.devServerProcessId) {
    return processManager.value.processes.get(processManager.value.devServerProcessId)
  }
  return null
})

// Debug watcher for dev server state changes
watch(() => devServerState.value, (newState, oldState) => {
  console.log('🔄 devServerState changed:', {
    old: oldState,
    new: newState,
    urlChanged: oldState?.url !== newState?.url,
    runningChanged: oldState?.running !== newState?.running
  })
}, { deep: true })

// Debug watcher for state.serverUrl changes
watch(() => state.value.serverUrl, (newUrl, oldUrl) => {
  console.log('🔄 state.serverUrl changed:', {
    from: oldUrl,
    to: newUrl
  })
})

// Fetch GitHub token from tRPC
const fetchGitHubToken = async () => {
  try {
    githubAuth.value.loading = true
    githubAuth.value.error = null
    
    console.log('🔑 Fetching GitHub token via tRPC...')
    const tokenResponse = await trpc.github.getGithubToken.query()
    
    console.log('✅ GitHub token fetched:', {
      hasToken: !!tokenResponse.token,
      hasPersonalToken: tokenResponse.hasPersonalToken,
      tokenUpdatedAt: tokenResponse.tokenUpdatedAt
    })
    
    githubAuth.value.token = tokenResponse.token
    githubAuth.value.hasPersonalToken = tokenResponse.hasPersonalToken
    githubAuth.value.tokenUpdatedAt = tokenResponse.tokenUpdatedAt
    
    // Set the token in the GitHub service
    if (tokenResponse.token) {
      githubRepoService.setAuthToken(tokenResponse.token)
      console.log('🔧 GitHub token set in service')
    } else {
      console.warn('⚠️ No GitHub token available')
    }
    
  } catch (error) {
    console.error('💥 Error fetching GitHub token:', error)
    githubAuth.value.error = error.message
  } finally {
    githubAuth.value.loading = false
  }
}

// Initialize GitHub service
const initializeGitHubService = async () => {
  // First try the new tRPC method
  await fetchGitHubToken()
  
  // Fallback to project props if tRPC fails
  if (!githubAuth.value.token && (props.project?.githubToken || props.project?.integrations?.github?.token)) {
    console.log('🔄 Using fallback GitHub token from project props')
    const token = props.project.githubToken || props.project.integrations.github.token
    githubRepoService.setAuthToken(token)
    githubAuth.value.token = token
    githubAuth.value.hasPersonalToken = false
  }
}

// Fetch repository branches
const fetchBranches = async () => {
  if (!parsedRepo.value) return
  
  try {
    const branchList = await githubRepoService.getRepoBranches(parsedRepo.value.owner, parsedRepo.value.repo)
    branches.value = branchList
    repoForm.value.branch = branchList.includes('main') ? 'main' : branchList[0] || 'main'
  } catch (error) {
    console.error('Error fetching branches:', error)
    state.value.error = `Failed to fetch branches: ${error.message}`
  }
}

// Search repositories
const searchRepositories = async () => {
  if (!searchQuery.value.trim()) return
  
  try {
    const results = await githubRepoService.searchRepos(searchQuery.value, {
      per_page: 10
    })
    searchResults.value = results.items.map(repo => ({
      name: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      stars: repo.stargazers_count,
      language: repo.language
    }))
  } catch (error) {
    console.error('Error searching repositories:', error)
    state.value.error = `Search failed: ${error.message}`
  }
}

// Select repository from search
const selectRepository = (repo) => {
  repoForm.value.url = repo.url
  searchResults.value = []
  searchQuery.value = ''
  fetchBranches()
}

// Clone and setup repository
const cloneRepository = async () => {
  if (!parsedRepo.value) {
    state.value.error = 'Invalid GitHub URL'
    return
  }

  state.value.loading = true
  state.value.error = null
  state.value.progress = null
  state.value.result = null
  state.value.serverUrl = null

  // Prevent page navigation during installation
  const preventNavigation = (event) => {
    event.preventDefault()
    event.returnValue = 'Repository installation in progress. Are you sure you want to leave?'
    return event.returnValue
  }
  
  window.addEventListener('beforeunload', preventNavigation)

  try {
    const result = await githubRepoService.setupWebContainerWithRepo(
      parsedRepo.value.owner,
      parsedRepo.value.repo,
      repoForm.value.branch,
      {
        autoInstall: repoForm.value.autoInstall,
        autoStart: repoForm.value.autoStart,
        onProgress: (progress) => {
          try {
            state.value.progress = progress
            
            // Update container status based on progress stage
            if (progress.stage === 'installing') {
              containerStatus.value.installing = true
            } else if (progress.stage === 'starting') {
              containerStatus.value.installing = false
            } else if (progress.stage === 'ready') {
              containerStatus.value.installing = false
            }
            
            // Relay npm install and dev server output to console and dependencies tab
            if (progress.output && consoleRef.value) {
              const outputType = progress.stage === 'installing' ? 'stdout' : 'stdout'
              const command = progress.stage === 'installing' ? 'npm install' : 'npm run dev'
              consoleRef.value.addOutputLine?.(progress.output, outputType, command)
              
              // Also capture npm install output for dependencies tab
              if (progress.stage === 'installing') {
                console.log('📦 Capturing npm install output:', {
                  stage: progress.stage,
                  output: progress.output,
                  currentLength: npmInstallOutput.value.length
                })
                
                npmInstallOutput.value.push({
                  timestamp: new Date().toISOString(),
                  text: progress.output,
                  type: 'install'
                })
                
                console.log('📦 npm install output array updated:', {
                  newLength: npmInstallOutput.value.length,
                  latestEntry: npmInstallOutput.value[npmInstallOutput.value.length - 1]
                })
              }
              
              // Capture dev server output for preview tab
              if (progress.stage === 'starting') {
                devServerState.value.output.push({
                  timestamp: new Date().toISOString(),
                  text: progress.output,
                  type: 'dev-server'
                })
              }
            }
            
            if (progress.stage === 'ready' && progress.url) {
              state.value.serverUrl = progress.url
              containerStatus.value.serving = true
              containerStatus.value.port = progress.port
              
              // Update dev server state
              devServerState.value.running = true
              devServerState.value.url = progress.url
              devServerState.value.port = progress.port
            }
          } catch (progressError) {
            console.error('Progress callback error:', progressError)
            // Don't let progress errors break the installation
          }
        },
        onComplete: async (result) => {
          try {
            console.log('✅ Repository setup completed:', result)
            console.log('📦 Final npm install output state:', {
              totalLines: npmInstallOutput.value.length,
              sampleLines: npmInstallOutput.value.slice(0, 3),
              lastLines: npmInstallOutput.value.slice(-3)
            })
            state.value.result = result
            state.value.loading = false
            state.value.webContainer = result.webContainer
            containerStatus.value.running = true
            containerStatus.value.installing = false
            
            // Initialize file tracking
            try {
              await initializeFileTracking()
            } catch (trackingError) {
              console.error('File tracking initialization error:', trackingError)
            }
            
            // Load package.json info
            try {
              await loadPackageInfo()
            } catch (packageError) {
              console.error('Package info loading error:', packageError)
            }
            
            // Note: File browser will automatically refresh via watchers
            // No need to manually refresh here as it can cause loops
            
            // Switch to editor tab
            activeTab.value = 'editor'
          } catch (completionError) {
            console.error('onComplete callback error:', completionError)
            state.value.error = 'Setup completed with some errors: ' + completionError.message
          } finally {
            // Remove navigation prevention on completion
            window.removeEventListener('beforeunload', preventNavigation)
          }
        },
        onError: (error) => {
          try {
            state.value.error = error.error || error.message
            state.value.loading = false
            containerStatus.value.installing = false
          } finally {
            // Remove navigation prevention on error
            window.removeEventListener('beforeunload', preventNavigation)
          }
        }
      }
    )

  } catch (error) {
    state.value.error = error.message
    state.value.loading = false
    containerStatus.value.installing = false
  } finally {
    // Always remove the navigation prevention
    window.removeEventListener('beforeunload', preventNavigation)
  }
}

// Initialize file change tracking
const initializeFileTracking = async () => {
  if (!state.value.webContainer) return
  
  try {
    // Start from the project directory if available
    const startDir = state.value.result?.repo ? `/${state.value.result.repo}` : '/'
    console.log('🔍 Initializing file tracking from directory:', startDir)
    
    // Get all files and initialize tracking
    const files = await getAllFiles(startDir)
    const fileContents = {}
    
    for (const filePath of files) {
      try {
        const content = await state.value.webContainer.fs.readFile(filePath, 'utf-8')
        fileContents[filePath] = content
      } catch (err) {
        // Skip binary files or files we can't read
        console.warn(`Could not read file ${filePath}:`, err)
      }
    }
    
    fileChangeTracker.initializeFiles(fileContents)
    
    // Listen for changes
    fileChangeTracker.addListener((changes) => {
      changedFiles.value = new Set(changes.changedFiles)
      fileChangeStats.value = changes.stats
    })
    
  } catch (error) {
    console.error('Error initializing file tracking:', error)
  }
}

// Get all files recursively (excluding node_modules and other generated files)
const getAllFiles = async (dirPath) => {
  const files = []
  
  // Directories to exclude from file tracking
  const excludedDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.cache', '.temp', '.tmp']
  
  try {
    const entries = await state.value.webContainer.fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = dirPath === '/' ? entry.name : `${dirPath}/${entry.name}`
      
      // Skip excluded directories and hidden files
      if (entry.name.startsWith('.') || excludedDirs.includes(entry.name)) {
        continue
      }
      
      if (entry.isFile()) {
        // Only track source files, not generated/temporary files
        if (shouldTrackFile(entry.name)) {
          files.push(fullPath.startsWith('/') ? fullPath.slice(1) : fullPath)
        }
      } else if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath)
        files.push(...subFiles)
      }
    }
  } catch (err) {
    console.warn(`Could not read directory ${dirPath}:`, err)
  }
  
  return files
}

// Check if file should be tracked for changes
const shouldTrackFile = (filename) => {
  const trackableExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
    '.html', '.css', '.scss', '.sass', '.less',
    '.json', '.md', '.mdx', '.txt', '.yml', '.yaml',
    '.toml', '.ini', '.env', '.config'
  ]
  
  const excludePatterns = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.DS_Store',
    'Thumbs.db'
  ]
  
  // Skip files we don't want to track
  if (excludePatterns.some(pattern => filename.includes(pattern))) {
    return false
  }
  
  // Only track files with trackable extensions
  return trackableExtensions.some(ext => filename.endsWith(ext))
}

// Load package.json information
const loadPackageInfo = async () => {
  if (!state.value.webContainer) return
  
  try {
    // Try to find package.json in the project directory
    let packageJsonPath = '/package.json'
    
    if (state.value.result?.repo) {
      // If we have repo info, look in the project subdirectory
      packageJsonPath = `/${state.value.result.repo}/package.json`
    }
    
    console.log('📦 Looking for package.json at:', packageJsonPath)
    const content = await state.value.webContainer.fs.readFile(packageJsonPath, 'utf-8')
    packageInfo.value = JSON.parse(content)
    console.log('✅ package.json loaded:', packageInfo.value.name)
    
    // Auto-detect dev commands
    detectDevCommands()
  } catch (error) {
    // Try alternative locations
    const alternativePaths = ['/package.json', '/src/package.json']
    
    for (const altPath of alternativePaths) {
      try {
        console.log('📦 Trying alternative path:', altPath)
        const content = await state.value.webContainer.fs.readFile(altPath, 'utf-8')
        packageInfo.value = JSON.parse(content)
        console.log('✅ package.json found at:', altPath)
        
        // Auto-detect dev commands
        detectDevCommands()
        return
      } catch (altError) {
        // Continue to next alternative
      }
    }
    
    console.warn('⚠️ Could not load package.json from any location:', error)
  }
}

// File operations
const onFileSelected = (filePath) => {
  selectedFile.value = filePath
  showDiffPanel.value = false
}

const onFileChanged = (event) => {
  fileChangeTracker.updateFile(event.filePath, event.content)
}

const onFileSaved = (event) => {
  fileChangeTracker.saveFile(event.filePath, event.content)
}

const onRevertChanges = (filePath) => {
  const original = fileChangeTracker.revertFile(filePath)
  return original
}

// Container operations
const runNpmScript = async (scriptName) => {
  if (!state.value.webContainer) return
  
  const command = `npm run ${scriptName}`
  let type = 'script'
  
  // Determine process type for better tracking
  if (scriptName === 'dev' || scriptName === 'start' || scriptName === 'serve') {
    type = 'dev'
  } else if (scriptName === 'build') {
    type = 'build'
    containerStatus.value.building = true
  } else if (scriptName === 'test') {
    type = 'test'
    containerStatus.value.testing = true
  }
  
  console.log(`🚀 Starting ${scriptName} script via managed process`)
  const processId = await startManagedProcess(command, type)
  
  // Switch to console tab to show output
  activeTab.value = 'console'
  
  return processId
}

const stopAllProcesses = () => {
  containerStatus.value.serving = false
  containerStatus.value.testing = false
  containerStatus.value.building = false
  containerStatus.value.installing = false
  state.value.serverUrl = null
  
  // Stop all managed processes
  for (const processId of processManager.value.processes.keys()) {
    killProcess(processId)
  }
  
  // Stop dev server
  stopDevServer()
}

// Bridge function for console component to register processes
const registerConsoleProcess = (command, webContainerProcess) => {
  let type = 'custom'
  
  // Auto-detect process type
  if (command.includes('npm run dev') || command.includes('npm run start') || command.includes('npm run serve')) {
    type = 'dev'
  } else if (command.includes('npm run build')) {
    type = 'build'
  } else if (command.includes('npm run test')) {
    type = 'test'
  } else if (command.includes('npm install')) {
    type = 'install'
  }
  
  const processId = createProcess(command, type)
  const processInfo = processManager.value.processes.get(processId)
  processInfo.process = webContainerProcess
  
  console.log(`🔗 Registered console process: ${processId} (${command})`)
  
  // Set up server-ready listener for dev processes started from console
  if (type === 'dev') {
    const serverReadyHandler = (port, url) => {
      console.log(`🌐 WebContainer server-ready event from console process: ${url} (port ${port})`)
      
      // Update process info
      processInfo.port = port
      processInfo.url = url
      
      // Update dev server state
      devServerState.value.port = port
      devServerState.value.url = url
      devServerState.value.running = true
      containerStatus.value.serving = true
      state.value.serverUrl = url
      processManager.value.devServerProcessId = processId
      
      addProcessOutput(processId, `🚀 Dev server ready at ${url}`, 'system')
      
      // Remove the listener after first trigger to avoid duplicates
      state.value.webContainer.removeEventListener('server-ready', serverReadyHandler)
    }
    
    state.value.webContainer.on('server-ready', serverReadyHandler)
    console.log(`🔊 Set up server-ready listener for console process ${processId}`)
  }
  
  // Monitor the process for completion
  webContainerProcess.exit.then(exitCode => {
    const status = exitCode === 0 ? 'completed' : 'failed'
    updateProcessStatus(processId, status, exitCode)
  }).catch(error => {
    updateProcessStatus(processId, 'failed', -1)
  })
  
  return processId
}

// Dev server control functions
const startDevServer = async (command = null) => {
  console.log('🚀 startDevServer called from preview tab', {
    command,
    hasWebContainer: !!state.value.webContainer,
    currentDevServerState: devServerState.value,
    defaultStartCommand: devServerState.value.startCommand
  })
  
  if (!state.value.webContainer) {
    console.error('❌ No WebContainer available for starting dev server')
    return
  }
  
  const startCommand = command || devServerState.value.startCommand
  let [cmd, ...args] = startCommand.split(' ')
  
  console.log('🔧 Starting dev server with command:', { cmd, args, startCommand })
  
  // If it's a Vite dev server, add --host 0.0.0.0 to make it accessible
  if (args.includes('dev') && packageInfo.value) {
    const hasVite = packageInfo.value.dependencies?.vite || 
                   packageInfo.value.devDependencies?.vite ||
                   packageInfo.value.dependencies?.['@vitejs/plugin-vue'] ||
                   packageInfo.value.devDependencies?.['@vitejs/plugin-vue']
    
    if (hasVite && !args.includes('--host')) {
      args.push('--host', '0.0.0.0')
      console.log('🔧 Added --host 0.0.0.0 for Vite dev server')
    }
  }
  
  try {
    console.log('📝 Setting devServerState.running = true')
    devServerState.value.running = true
    devServerState.value.output = []
    
    // Get project directory
    const projectDir = state.value.result?.repo ? `/${state.value.result.repo}` : '/'
    console.log('📁 Project directory:', projectDir)
    
    // Set up server-ready listener
    const serverReadyHandler = (port, url) => {
      console.log('✅ Preview tab dev server ready:', { port, url })
      console.log('📝 Updating devServerState with URL:', url)
      
      devServerState.value.url = url
      devServerState.value.port = port
      state.value.serverUrl = url
      containerStatus.value.serving = true
      
      console.log('📊 Updated devServerState:', {
        url: devServerState.value.url,
        port: devServerState.value.port,
        running: devServerState.value.running,
        stateServerUrl: state.value.serverUrl
      })
      
      // Add to console output
      if (consoleRef.value) {
        consoleRef.value.addOutputLine(`🚀 Dev server ready at ${url}`, 'system', startCommand)
      }
      
      // Remove listener to prevent duplicates
      state.value.webContainer.off('server-ready', serverReadyHandler)
    }
    
    state.value.webContainer.on('server-ready', serverReadyHandler)
    console.log('🔊 Set up server-ready listener for preview tab')
    
    // Start the dev server process
    console.log('⚡ Spawning process:', { cmd, args, cwd: projectDir })
    const devProcess = await state.value.webContainer.spawn(cmd, args, {
      cwd: projectDir
    })
    
    console.log('✅ Process spawned successfully:', devProcess)
    devServerState.value.process = devProcess
    
    // Capture output
    if (devProcess.output) {
      const reader = devProcess.output.getReader()
      
      const readOutput = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            let text
            if (value instanceof Uint8Array) {
              text = new TextDecoder().decode(value)
            } else if (typeof value === 'string') {
              text = value
            } else {
              text = String(value)
            }
            
            // Clean output and add to dev server output
            const cleanText = text.replace(/\x1B\[[0-9;]*[mGKHf]/g, '').trim()
            if (cleanText) {
              devServerState.value.output.push({
                timestamp: new Date().toISOString(),
                text: cleanText,
                type: 'dev-server'
              })
              
              // Also add to console
              if (consoleRef.value) {
                consoleRef.value.addOutputLine(cleanText, 'stdout', startCommand)
              }
            }
          }
        } catch (error) {
          console.error('Dev server output error:', error)
        }
      }
      
      readOutput()
    }
    
  } catch (error) {
    console.error('❌ Error starting dev server from preview tab:', error)
    console.log('📝 Setting devServerState.running = false due to error')
    devServerState.value.running = false
    
    if (consoleRef.value) {
      consoleRef.value.addOutputLine(`Error starting dev server: ${error.message}`, 'stderr', startCommand)
    }
  }
}

const stopDevServer = () => {
  if (devServerState.value.process && devServerState.value.process.kill) {
    try {
      devServerState.value.process.kill()
      console.log('🛑 Dev server stopped')
      
      if (consoleRef.value) {
        consoleRef.value.addOutputLine('🛑 Dev server stopped', 'system')
      }
    } catch (error) {
      console.error('Error stopping dev server:', error)
    }
  }
  
  devServerState.value.running = false
  devServerState.value.process = null
  devServerState.value.url = null
  devServerState.value.port = null
  containerStatus.value.serving = false
  state.value.serverUrl = null
}

// Centralized process management functions
const createProcess = (command, type = 'custom', options = {}) => {
  const processId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  const processInfo = {
    id: processId,
    command,
    type,
    status: 'running',
    startTime: new Date(),
    endTime: null,
    exitCode: null,
    output: [],
    process: null,
    port: options.port || null,
    url: options.url || null,
    ...options
  }
  
  processManager.value.processes.set(processId, processInfo)
  processManager.value.activeCount++
  
  console.log(`🚀 Created process: ${processId} (${command})`)
  return processId
}

const updateProcessStatus = (processId, status, exitCode = null, error = null) => {
  const processInfo = processManager.value.processes.get(processId)
  if (!processInfo) return
  
  processInfo.status = status
  processInfo.endTime = new Date()
  processInfo.exitCode = exitCode
  
  if (status !== 'running') {
    processManager.value.activeCount = Math.max(0, processManager.value.activeCount - 1)
  }
  
  // Update container status based on process type
  if (processInfo.type === 'install') {
    containerStatus.value.installing = false
  } else if (processInfo.type === 'build') {
    containerStatus.value.building = false
  } else if (processInfo.type === 'test') {
    containerStatus.value.testing = false
  }
  
  console.log(`📊 Process ${processId} ${status}${exitCode !== null ? ` (exit: ${exitCode})` : ''}`)
}

const addProcessOutput = (processId, text, type = 'stdout') => {
  const processInfo = processManager.value.processes.get(processId)
  if (!processInfo) return
  
  const outputLine = {
    timestamp: new Date().toISOString(),
    text: text.trim(),
    type
  }
  
  processInfo.output.push(outputLine)
  
  // Also send to console
  if (consoleRef.value) {
    consoleRef.value.addOutputLine(text, type, processInfo.command)
  }
}

const killProcess = (processId) => {
  const processInfo = processManager.value.processes.get(processId)
  if (!processInfo) return
  
  if (processInfo.process && processInfo.process.kill) {
    try {
      processInfo.process.kill()
      updateProcessStatus(processId, 'killed')
      addProcessOutput(processId, 'Process killed by user', 'system')
    } catch (error) {
      console.error(`Error killing process ${processId}:`, error)
    }
  }
  
  // Special handling for dev server
  if (processId === processManager.value.devServerProcessId) {
    devServerState.value.running = false
    devServerState.value.process = null
    devServerState.value.url = null
    devServerState.value.port = null
    processManager.value.devServerProcessId = null
    containerStatus.value.serving = false
    state.value.serverUrl = null
  }
}

const startManagedProcess = async (command, type = 'custom', options = {}) => {
  if (!state.value.webContainer) {
    console.error('WebContainer not available')
    return null
  }
  
  const processId = createProcess(command, type, options)
  const processInfo = processManager.value.processes.get(processId)
  
  try {
    const [cmd, ...args] = command.split(' ')
    const projectDir = state.value.result?.repo ? `/${state.value.result.repo}` : '/'
    
    // Set up server-ready listener for dev processes BEFORE starting the process
    if (type === 'dev') {
      const serverReadyHandler = (port, url) => {
        console.log(`🌐 WebContainer server-ready event: ${url} (port ${port})`)
        
        // Update process info
        processInfo.port = port
        processInfo.url = url
        
        // Update dev server state
        devServerState.value.port = port
        devServerState.value.url = url
        devServerState.value.running = true
        containerStatus.value.serving = true
        state.value.serverUrl = url
        processManager.value.devServerProcessId = processId
        
        addProcessOutput(processId, `🚀 Dev server ready at ${url}`, 'system')
        
        // Remove the listener after first trigger to avoid duplicates
        state.value.webContainer.off('server-ready', serverReadyHandler)
      }
      
      state.value.webContainer.on('server-ready', serverReadyHandler)
      console.log(`🔊 Set up server-ready listener for process ${processId}`)
    }
    
    // Start the process
    const webContainerProcess = await state.value.webContainer.spawn(cmd, args, {
      cwd: projectDir
    })
    
    processInfo.process = webContainerProcess
    
    // Handle output
    if (webContainerProcess.output) {
      const reader = webContainerProcess.output.getReader()
      
      const readOutput = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            let text
            if (value instanceof Uint8Array) {
              text = new TextDecoder().decode(value)
            } else if (typeof value === 'string') {
              text = value
            } else {
              text = String(value)
            }
            
            const cleanText = text.replace(/\x1B\[[0-9;]*[mGKHf]/g, '').trim()
            if (cleanText) {
              addProcessOutput(processId, cleanText, 'stdout')
            }
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            addProcessOutput(processId, `Output error: ${error.message}`, 'stderr')
          }
        }
      }
      
      readOutput()
    }
    
    // Wait for process completion
    webContainerProcess.exit.then(exitCode => {
      const status = exitCode === 0 ? 'completed' : 'failed'
      updateProcessStatus(processId, status, exitCode)
      
      if (exitCode === 0) {
        addProcessOutput(processId, `Process completed successfully`, 'system')
      } else {
        addProcessOutput(processId, `Process failed with exit code ${exitCode}`, 'stderr')
      }
    }).catch(error => {
      updateProcessStatus(processId, 'failed', -1)
      addProcessOutput(processId, `Process error: ${error.message}`, 'stderr')
    })
    
    return processId
    
  } catch (error) {
    updateProcessStatus(processId, 'failed', -1)
    addProcessOutput(processId, `Failed to start: ${error.message}`, 'stderr')
    console.error(`Error starting process ${processId}:`, error)
    return processId
  }
}

// Auto-detect dev commands from package.json
const detectDevCommands = () => {
  if (!packageInfo.value?.scripts) return
  
  const scripts = packageInfo.value.scripts
  const devCommands = []
  
  // Common dev command patterns
  const devPatterns = ['dev', 'start', 'serve', 'preview']
  
  for (const [name, script] of Object.entries(scripts)) {
    if (devPatterns.some(pattern => name.includes(pattern))) {
      devCommands.push({
        name,
        command: `npm run ${name}`,
        script
      })
    }
  }
  
  devServerState.value.availableCommands = devCommands
  
  // Set default command (prefer 'dev', then 'start')
  if (scripts.dev) {
    devServerState.value.startCommand = 'npm run dev'
  } else if (scripts.start) {
    devServerState.value.startCommand = 'npm run start'
  } else if (devCommands.length > 0) {
    devServerState.value.startCommand = devCommands[0].command
  }
}

// Manual npm install
const runManualInstall = async () => {
  if (!state.value.webContainer) return
  
  containerStatus.value.installing = true
  npmInstallOutput.value = []
  
  try {
    const projectDir = state.value.result?.repo ? `/${state.value.result.repo}` : '/'
    
    // Add start message
    npmInstallOutput.value.push({
      timestamp: new Date().toISOString(),
      text: '🚀 Starting npm install...',
      type: 'install'
    })
    
    if (consoleRef.value) {
      consoleRef.value.addOutputLine('🚀 Starting manual npm install...', 'system', 'npm install')
    }
    
    const installProcess = await state.value.webContainer.spawn('npm', ['install'], {
      cwd: projectDir
    })
    
    // Capture output
    if (installProcess.output) {
      const reader = installProcess.output.getReader()
      
      const readOutput = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            let text
            if (value instanceof Uint8Array) {
              text = new TextDecoder().decode(value)
            } else if (typeof value === 'string') {
              text = value
            } else {
              text = String(value)
            }
            
            // Clean output
            const cleanText = text.replace(/\x1B\[[0-9;]*[mGKHf]/g, '').trim()
            if (cleanText && cleanText !== '\\' && cleanText !== '|' && cleanText !== '/' && cleanText !== '-') {
              npmInstallOutput.value.push({
                timestamp: new Date().toISOString(),
                text: cleanText,
                type: 'install'
              })
              
              // Also add to console
              if (consoleRef.value) {
                consoleRef.value.addOutputLine(cleanText, 'stdout', 'npm install')
              }
            }
          }
        } catch (error) {
          console.error('Install output error:', error)
        }
      }
      
      readOutput()
    }
    
    const exitCode = await installProcess.exit
    
    const exitMessage = exitCode === 0 
      ? '✅ npm install completed successfully'
      : `❌ npm install failed with exit code ${exitCode}`
    
    npmInstallOutput.value.push({
      timestamp: new Date().toISOString(),
      text: exitMessage,
      type: 'install'
    })
    
    if (consoleRef.value) {
      consoleRef.value.addOutputLine(exitMessage, exitCode === 0 ? 'system' : 'stderr', 'npm install')
    }
    
    // Reload package info after install
    if (exitCode === 0) {
      await loadPackageInfo()
    }
    
  } catch (error) {
    const errorMsg = `Error during npm install: ${error.message}`
    npmInstallOutput.value.push({
      timestamp: new Date().toISOString(),
      text: errorMsg,
      type: 'install'
    })
    
    if (consoleRef.value) {
      consoleRef.value.addOutputLine(errorMsg, 'stderr', 'npm install')
    }
  } finally {
    containerStatus.value.installing = false
  }
}

// Save all changes
const saveAllChanges = async () => {
  const changes = fileChangeTracker.getChangedFiles()
  
  for (const filePath of changes) {
    try {
      const content = fileChangeTracker.getCurrentContent(filePath)
      await state.value.webContainer.fs.writeFile(filePath, content, 'utf-8')
      fileChangeTracker.saveFile(filePath, content)
    } catch (error) {
      console.error(`Error saving ${filePath}:`, error)
    }
  }
}

// Export changes as diff
const exportChanges = () => {
  const diffs = fileChangeTracker.exportAllDiffs()
  const diffText = diffs.map(diff => diff.patch).join('\n\n')
  
  const blob = new Blob([diffText], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `changes-${Date.now()}.patch`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Toggle diff panel
const toggleDiffPanel = () => {
  showDiffPanel.value = !showDiffPanel.value
}

// Debounced refresh to prevent rapid successive calls
let refreshDebounceTimer = null
const refreshFiles = () => {
  console.log('🔄 Refreshing file browser...')
  
  // Clear any existing debounce timer
  if (refreshDebounceTimer) {
    clearTimeout(refreshDebounceTimer)
  }
  
  // Debounce the refresh call
  refreshDebounceTimer = setTimeout(() => {
    console.log('📁 Executing debounced refresh...')
    
    // Only refresh the file browser, don't reinitialize tracking
    if (fileBrowserRef.value) {
      fileBrowserRef.value.refresh()
    }
    
    refreshDebounceTimer = null
  }, 500) // 500ms debounce
}

// Pre-populate with project's GitHub repo if available
const initializeFromProject = () => {
  if (props.project?.github?.fullName || props.project?.gitHub?.fullName) {
    const repoName = props.project.github?.fullName || props.project.gitHub?.fullName
    repoForm.value.url = `https://github.com/${repoName}`
    fetchBranches()
  }
}

// Watch for URL changes
watch(() => repoForm.value.url, (newUrl) => {
  if (isValidGitHubUrl.value) {
    fetchBranches()
  }
})

// Watch for project changes
watch(() => props.project, () => {
  initializeGitHubService()
  initializeFromProject()
}, { immediate: true })

// Initialize
onMounted(async () => {
  await initializeGitHubService()
  initializeFromProject()
})

// Cleanup
onUnmounted(() => {
  fileChangeTracker.clear()
  if (state.value.webContainer) {
    stopAllProcesses()
  }
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Page Header -->
    <PageHeadingBar title="Code Editor">
      <template #description>
        Full-stack development environment with live preview
      </template>
      
      <div class="flex items-center space-x-2">
        <Badge v-if="containerStatus.running" variant="default" class="bg-green-100 text-green-800">
          <div class="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
          Running
        </Badge>
        <Badge v-if="hasUnsavedChanges" class="bg-orange-100 text-orange-800">
          {{ fileChangeStats.changedFiles }} unsaved
        </Badge>
        <Button 
          v-if="hasUnsavedChanges"
          @click="saveAllChanges"
          variant="default"
          size="sm"
        >
          <Save class="h-4 w-4 mr-2" />
          Save All
        </Button>
      </div>
    </PageHeadingBar>

    <!-- Container -->
    <div class="container flex-1 flex flex-col">
      <!-- Error Alert -->
      <Alert v-if="state.error" variant="destructive" class="mb-4">
        <AlertCircle class="h-4 w-4" />
        <AlertDescription>{{ state.error }}</AlertDescription>
      </Alert>

      <!-- Main Content -->
      <div class="flex-1 flex">
        <!-- Main Tab Content -->
        <Tabs v-model="activeTab" class="flex-1 flex flex-col">
          <!-- Activity Banner -->
          <div v-if="hasActiveProcesses" class="bg-blue-50 border-b border-blue-200 px-4 py-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <!-- Repository Import -->
                <div v-if="state.loading" class="flex items-center space-x-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span class="text-sm font-medium text-blue-700">
                    {{ state.progress?.message || 'Importing repository...' }}
                  </span>
                  <Badge v-if="state.progress?.progress" variant="outline" class="text-xs">
                    {{ Math.round(state.progress.progress * 100) }}%
                  </Badge>
                </div>
                
                <!-- NPM Install -->
                <div v-if="containerStatus.installing" class="flex items-center space-x-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                  <span class="text-sm font-medium text-green-700">Installing dependencies...</span>
                  <Badge variant="outline" class="text-xs bg-green-100 text-green-800">npm install</Badge>
                </div>
                
                <!-- Running Processes from Process Manager -->
                <div v-for="process in runningProcesses" :key="process.id" class="flex items-center space-x-2">
                  <div v-if="process.type === 'dev'" class="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                  <div v-else-if="process.type === 'build'" class="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                  <div v-else-if="process.type === 'test'" class="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                  <div v-else-if="process.type === 'install'" class="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                  <div v-else class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  
                  <span class="text-sm font-medium" :class="{
                    'text-green-700': process.type === 'dev' || process.type === 'install',
                    'text-orange-700': process.type === 'build',
                    'text-purple-700': process.type === 'test',
                    'text-blue-700': process.type === 'custom'
                  }">
                    {{ process.type === 'dev' ? 'Dev server' : process.type === 'build' ? 'Building' : process.type === 'test' ? 'Testing' : process.type === 'install' ? 'Installing' : 'Running' }}
                  </span>
                  
                  <Badge variant="outline" class="text-xs" :class="{
                    'bg-green-100 text-green-800': process.type === 'dev' || process.type === 'install',
                    'bg-orange-100 text-orange-800': process.type === 'build',
                    'bg-purple-100 text-purple-800': process.type === 'test',
                    'bg-blue-100 text-blue-800': process.type === 'custom'
                  }">
                    {{ process.port ? `Port ${process.port}` : process.command.split(' ').slice(0, 2).join(' ') }}
                  </Badge>
                  
                  <Button 
                    @click="killProcess(process.id)"
                    variant="outline"
                    size="sm"
                    class="h-6 px-2 text-xs"
                  >
                    Stop
                  </Button>
                </div>
                
                <!-- Legacy Dev Server (fallback) -->
                <div v-if="devServerState.running && !processManager.devServerProcessId" class="flex items-center space-x-2">
                  <div class="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                  <span class="text-sm font-medium text-green-700">Dev server (legacy)</span>
                  <Badge variant="outline" class="text-xs bg-green-100 text-green-800">
                    Port {{ devServerState.port || '...' }}
                  </Badge>
                  <Button 
                    @click="stopDevServer()"
                    variant="outline"
                    size="sm"
                    class="h-6 px-2 text-xs"
                  >
                    Stop
                  </Button>
                </div>
                
                <!-- Other Active Processes -->
                <div v-if="containerStatus.building" class="flex items-center space-x-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                  <span class="text-sm font-medium text-orange-700">Building...</span>
                  <Badge variant="outline" class="text-xs bg-orange-100 text-orange-800">npm run build</Badge>
                </div>
                
                <div v-if="containerStatus.testing" class="flex items-center space-x-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                  <span class="text-sm font-medium text-purple-700">Running tests...</span>
                  <Badge variant="outline" class="text-xs bg-purple-100 text-purple-800">npm test</Badge>
                </div>
              </div>
              
              <!-- Quick Actions -->
              <div class="flex items-center space-x-2">
                <Button 
                  v-if="(containerStatus.installing || containerStatus.building || containerStatus.testing)"
                  @click="stopAllProcesses()"
                  variant="destructive"
                  size="sm"
                  class="h-6 px-3 text-xs"
                >
                  <Square class="h-3 w-3 mr-1" />
                  Stop All
                </Button>
                
                <Button 
                  @click="activeTab = 'console'"
                  variant="outline"
                  size="sm"
                  class="h-6 px-3 text-xs"
                >
                  <Terminal class="h-3 w-3 mr-1" />
                  Console
                </Button>
              </div>
            </div>
          </div>
          
          <TabsList class="w-full justify-start rounded-none border-b">
            <TabsTrigger value="import">
              <Download class="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
            <TabsTrigger value="editor" :disabled="!state.webContainer">
              <Code class="h-4 w-4 mr-2" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="preview" :disabled="!state.webContainer">
              <Eye class="h-4 w-4 mr-2" />
              Preview
              <Badge v-if="devServerState.url" class="ml-2 h-4 w-4 p-0 text-xs bg-green-100 text-green-800">●</Badge>
            </TabsTrigger>
            <TabsTrigger value="console" :disabled="!state.webContainer">
              <Terminal class="h-4 w-4 mr-2" />
              Console
              <Badge v-if="runningProcesses.length > 0" class="ml-2 h-4 w-4 p-0 text-xs">{{ runningProcesses.length }}</Badge>
            </TabsTrigger>
            <TabsTrigger value="processes" :disabled="!state.webContainer">
              <Layout class="h-4 w-4 mr-2" />
              Processes
              <Badge v-if="allProcesses.length > 0" class="ml-2 h-4 w-4 p-0 text-xs">{{ allProcesses.length }}</Badge>
            </TabsTrigger>
            <TabsTrigger value="dependencies" :disabled="!state.webContainer">
              <Package class="h-4 w-4 mr-2" />
              Dependencies
            </TabsTrigger>
            <TabsTrigger value="tools" :disabled="!state.webContainer">
              <Wrench class="h-4 w-4 mr-2" />
              Tools
            </TabsTrigger>
          </TabsList>

          <!-- Import Tab -->
          <TabsContent value="import" class="flex-1 p-6">
            <div class="max-w-2xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle class="flex items-center space-x-2">
                    <Github class="h-5 w-5" />
                    <span>Import Repository</span>
                  </CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                  <!-- GitHub Authentication Status -->
                  <div class="p-3 border rounded-lg" :class="{
                    'bg-green-50 border-green-200': githubAuth.token && !githubAuth.loading,
                    'bg-yellow-50 border-yellow-200': !githubAuth.token && !githubAuth.loading && !githubAuth.error,
                    'bg-red-50 border-red-200': githubAuth.error,
                    'bg-gray-50 border-gray-200': githubAuth.loading
                  }">
                    <div class="flex items-center space-x-2">
                      <Loader2 v-if="githubAuth.loading" class="h-4 w-4 animate-spin text-gray-600" />
                      <CheckCircle v-else-if="githubAuth.token" class="h-4 w-4 text-green-600" />
                      <AlertCircle v-else-if="githubAuth.error" class="h-4 w-4 text-red-600" />
                      <AlertCircle v-else class="h-4 w-4 text-yellow-600" />
                      
                      <span class="font-medium" :class="{
                        'text-green-800': githubAuth.token && !githubAuth.loading,
                        'text-yellow-800': !githubAuth.token && !githubAuth.loading && !githubAuth.error,
                        'text-red-800': githubAuth.error,
                        'text-gray-600': githubAuth.loading
                      }">
                        <span v-if="githubAuth.loading">Loading GitHub token...</span>
                        <span v-else-if="githubAuth.token">
                          GitHub {{ githubAuth.hasPersonalToken ? 'Personal' : 'System' }} Token Active
                        </span>
                        <span v-else-if="githubAuth.error">GitHub Token Error</span>
                        <span v-else>No GitHub Token</span>
                      </span>
                    </div>
                    
                    <p class="text-sm mt-1" :class="{
                      'text-green-700': githubAuth.token && !githubAuth.loading,
                      'text-yellow-700': !githubAuth.token && !githubAuth.loading && !githubAuth.error,
                      'text-red-700': githubAuth.error,
                      'text-gray-600': githubAuth.loading
                    }">
                      <span v-if="githubAuth.loading">Fetching authentication credentials...</span>
                      <span v-else-if="githubAuth.token">
                        {{ githubAuth.hasPersonalToken ? 'Using your personal GitHub token for full access' : 'Using system token with limited access' }}
                        <span v-if="githubAuth.tokenUpdatedAt" class="block">
                          Updated: {{ new Date(githubAuth.tokenUpdatedAt).toLocaleDateString() }}
                        </span>
                      </span>
                      <span v-else-if="githubAuth.error">{{ githubAuth.error }}</span>
                      <span v-else>
                        GitHub token required for private repositories and higher rate limits.
                        <Button variant="link" class="p-0 h-auto text-yellow-700 underline" @click="fetchGitHubToken">
                          Retry
                        </Button>
                      </span>
                    </p>
                  </div>
                  <!-- Project Repository Auto-fill -->
                  <div v-if="props.project?.github?.fullName || props.project?.gitHub?.fullName" class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div class="flex items-center space-x-2">
                      <CheckCircle class="h-5 w-5 text-blue-600" />
                      <span class="text-blue-800 font-medium">Project Repository Detected</span>
                    </div>
                    <p class="text-blue-700 text-sm mt-1">
                      {{ props.project.github?.fullName || props.project.gitHub?.fullName }}
                    </p>
                  </div>

                  <!-- Search -->
                  <div class="space-y-2">
                    <Label>Search GitHub Repositories</Label>
                    <div class="flex space-x-2">
                      <Input
                        v-model="searchQuery"
                        placeholder="Search repositories..."
                        @keyup.enter="searchRepositories"
                      />
                      <Button @click="searchRepositories" variant="outline">Search</Button>
                    </div>
                  </div>

                  <!-- Search Results -->
                  <div v-if="searchResults.length > 0" class="max-h-32 overflow-y-auto space-y-1">
                    <div
                      v-for="repo in searchResults"
                      :key="repo.name"
                      class="p-2 border rounded cursor-pointer hover:bg-gray-50"
                      @click="selectRepository(repo)"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex-1">
                          <div class="font-medium">{{ repo.name }}</div>
                          <div class="text-sm text-gray-500">{{ repo.description }}</div>
                        </div>
                        <div class="flex items-center space-x-2 text-sm text-gray-500">
                          <span v-if="repo.language">{{ repo.language }}</span>
                          <span>⭐ {{ repo.stars }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <!-- Repository URL -->
                  <div class="space-y-2">
                    <Label>Repository URL</Label>
                    <Input
                      v-model="repoForm.url"
                      placeholder="https://github.com/owner/repo"
                      type="url"
                    />
                  </div>

                  <!-- Branch Selection -->
                  <div v-if="branches.length > 0" class="space-y-2">
                    <Label>Branch</Label>
                    <Select v-model="repoForm.branch">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="branch in branches" :key="branch" :value="branch">
                          {{ branch }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <!-- Options -->
                  <div class="space-y-3">
                    <div class="flex items-center space-x-2">
                      <Checkbox 
                        id="auto-install" 
                        v-model:checked="repoForm.autoInstall"
                      />
                      <Label for="auto-install">Auto-install dependencies</Label>
                    </div>
                    <div class="flex items-center space-x-2">
                      <Checkbox 
                        id="auto-start" 
                        v-model:checked="repoForm.autoStart"
                      />
                      <Label for="auto-start">Auto-start development server</Label>
                    </div>
                  </div>

                  <!-- Import Button -->
                  <Button 
                    @click="cloneRepository" 
                    :disabled="!isValidGitHubUrl || state.loading"
                    class="w-full"
                  >
                    <Loader2 v-if="state.loading" class="mr-2 h-4 w-4 animate-spin" />
                    <Download v-else class="mr-2 h-4 w-4" />
                    {{ state.loading ? 'Importing...' : 'Import Repository' }}
                  </Button>

                  <!-- Progress -->
                  <div v-if="state.progress" class="space-y-2">
                    <div class="flex justify-between text-sm">
                      <span>{{ state.progress.message }}</span>
                      <span v-if="state.progress.progress">{{ progressPercentage }}%</span>
                    </div>
                    <Progress 
                      v-if="state.progress.progress" 
                      :value="progressPercentage" 
                      class="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <!-- Editor Tab -->
          <TabsContent value="editor" class="flex-1 flex">
            <div class="flex h-full w-full">
              <!-- Left Panel: File Browser -->
              <div 
                class="flex-shrink-0 border-r"
                :style="{ width: leftPanelWidth + 'px' }"
              >
                <WebContainerFileBrowser
                  ref="fileBrowserRef"
                  :web-container="state.webContainer"
                  :selected-file="selectedFile"
                  :changed-files="changedFiles"
                  :project-directory="state.result?.repo ? `/${state.result.repo}` : '/'"
                  @file-selected="onFileSelected"
                />
              </div>

              <!-- Main Editor -->
              <div class="flex-1 flex flex-col">
                <!-- Editor Header -->
                <div class="flex items-center justify-between p-2 border-b bg-gray-50">
                  <div class="flex items-center space-x-2">
                    <FileText class="h-4 w-4" />
                    <span class="font-medium">
                      {{ selectedFile ? selectedFile.split('/').pop() : 'Select a file to edit' }}
                    </span>
                    <Badge v-if="selectedFile && changedFiles.has(selectedFile)" variant="secondary">
                      Modified
                    </Badge>
                  </div>
                  <div class="flex space-x-2">
                    <Button 
                      v-if="selectedFile && changedFiles.has(selectedFile)"
                      @click="toggleDiffPanel"
                      variant="outline"
                      size="sm"
                    >
                      <Eye class="h-4 w-4 mr-2" />
                      {{ showDiffPanel ? 'Hide' : 'Show' }} Diff
                    </Button>
                  </div>
                </div>

                <!-- Editor Content -->
                <div class="flex-1 flex">
                  <!-- Code Editor -->
                  <div :class="showDiffPanel ? 'w-1/2' : 'w-full'" class="h-full">
                    <CodeEditor
                      v-if="selectedFile"
                      :web-container="state.webContainer"
                      :file-path="selectedFile"
                      @file-changed="onFileChanged"
                      @save-file="onFileSaved"
                      @revert-changes="onRevertChanges"
                    />
                    <div v-else class="h-full flex items-center justify-center text-gray-500">
                      <div class="text-center">
                        <FileText class="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>Select a file from the browser to start editing</p>
                      </div>
                    </div>
                  </div>

                  <!-- Diff Panel -->
                  <div v-if="showDiffPanel" class="w-1/2 border-l">
                    <DiffViewer
                      v-if="currentFileDiff"
                      :original-content="currentFileDiff.original"
                      :modified-content="currentFileDiff.current"
                      :file-name="selectedFile"
                      @revert-changes="() => onRevertChanges(selectedFile)"
                      @export-diff="exportChanges"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <!-- Preview Tab -->
          <TabsContent value="preview" class="flex-1">
            <div class="h-full flex flex-col">
              <!-- Preview Header -->
              <div class="flex items-center justify-between p-4 border-b bg-gray-50">
                <div class="flex items-center space-x-2">
                  <Globe class="h-5 w-5" />
                  <span class="font-medium">Live Preview</span>
                  <Badge v-if="devServerState.running && devServerState.url" variant="default" class="bg-green-100 text-green-800">
                    Running - Port {{ devServerState.port }}
                  </Badge>
                  <Badge v-else-if="!devServerState.running" variant="secondary">
                    Not Running
                  </Badge>
                </div>
                <div class="flex space-x-2">
                  <!-- Dev Server Controls -->
                  <Select v-if="devServerState.availableCommands.length > 0" v-model="devServerState.startCommand">
                    <SelectTrigger class="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="cmd in devServerState.availableCommands" :key="cmd.command" :value="cmd.command">
                        {{ cmd.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    v-if="!devServerState.running"
                    @click="startDevServer()"
                    variant="default"
                    size="sm"
                    :disabled="!state.webContainer"
                  >
                    <Play class="h-4 w-4 mr-2" />
                    Start Server
                  </Button>
                  
                  <Button 
                    v-else
                    @click="stopDevServer()"
                    variant="destructive"
                    size="sm"
                  >
                    <Square class="h-4 w-4 mr-2" />
                    Stop Server
                  </Button>
                  
                  <Button 
                    v-if="devServerState.url"
                    @click="() => { if (typeof window !== 'undefined') window.open(devServerState.url, '_blank') }"
                    variant="outline"
                    size="sm"
                  >
                    Open in New Tab
                  </Button>
                  
                  <Button 
                    @click="() => location.reload()"
                    variant="outline"
                    size="sm"
                    :disabled="!devServerState.url"
                  >
                    <RefreshCw class="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    v-if="currentDevProcess && currentDevProcess.output.length > 0"
                    @click="showPreviewOutput = !showPreviewOutput"
                    variant="outline"
                    size="sm"
                  >
                    <Terminal class="h-4 w-4 mr-1" />
                    {{ showPreviewOutput ? 'Hide' : 'Show' }} Output
                  </Button>
                </div>
              </div>

              <!-- Dev Server Output (when not running or starting) -->
              <div v-if="!devServerState.running && devServerState.output.length > 0" class="border-b bg-gray-100">
                <div class="p-3">
                  <h4 class="text-sm font-medium mb-2">Recent Output:</h4>
                  <div class="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
                    <div v-for="line in devServerState.output.slice(-10)" :key="line.timestamp" class="mb-1">
                      <span class="text-gray-500">{{ new Date(line.timestamp).toLocaleTimeString() }}</span>
                      {{ line.text }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Preview Frame -->
              <div class="flex-1 flex flex-col">
                <!-- Dev Server Output (when running) -->
                <div v-if="showPreviewOutput && devServerState.running && currentDevProcess && currentDevProcess.output.length > 0" class="border-b bg-gray-900 text-green-400 p-3 max-h-48 overflow-y-auto">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm font-medium text-green-400">Live Output</h4>
                    <div class="flex items-center space-x-2">
                      <Badge variant="outline" class="text-xs bg-green-100 text-green-800">
                        {{ currentDevProcess.output.length }} lines
                      </Badge>
                      <Button 
                        @click="() => $el.querySelector('.dev-output-container').scrollTop = $el.querySelector('.dev-output-container').scrollHeight"
                        variant="outline"
                        size="sm"
                        class="h-5 px-2 text-xs text-green-400 border-green-400"
                      >
                        ↓ Bottom
                      </Button>
                    </div>
                  </div>
                  <div class="dev-output-container text-xs font-mono space-y-1 max-h-32 overflow-y-auto">
                    <div v-for="line in currentDevProcess.output.slice(-50)" :key="line.timestamp" class="hover:bg-gray-800 px-1 rounded whitespace-pre-wrap">
                      <span class="text-gray-500">{{ new Date(line.timestamp).toLocaleTimeString() }}</span>
                      <span class="ml-2" :class="{
                        'text-red-400': line.type === 'stderr',
                        'text-yellow-400': line.type === 'system',
                        'text-green-400': line.type === 'stdout'
                      }">{{ line.text }}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Debug Info (can be removed later) -->
                <div v-if="devServerState.url" class="text-xs text-gray-500 p-2 bg-gray-100 border-b">
                  WebContainer URL: {{ devServerState.url }}
                </div>
                
                <!-- iframe Preview -->
                <div class="flex-1">
                  <iframe 
                    v-if="devServerState.url"
                    :src="devServerState.url" 
                    class="w-full h-full border-0"
                    title="Development Server Preview"
                  />
                  <div v-else class="h-full flex items-center justify-center text-gray-500">
                    <div class="text-center">
                      <Globe class="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <h3 class="text-lg font-medium mb-2">Development Server</h3>
                      <p v-if="!state.webContainer" class="mb-4">Import a repository to start the dev server</p>
                      <p v-else-if="devServerState.availableCommands.length === 0" class="mb-4">No dev scripts found in package.json</p>
                      <p v-else class="mb-4">Click "Start Server" to run your development server</p>
                      
                      <!-- Available Commands -->
                      <div v-if="devServerState.availableCommands.length > 0" class="mt-4">
                        <p class="text-sm font-medium mb-2">Available Commands:</p>
                        <div class="flex flex-wrap gap-2 justify-center">
                          <Badge v-for="cmd in devServerState.availableCommands" :key="cmd.command" variant="outline">
                            {{ cmd.name }}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <!-- Console Tab -->
          <TabsContent value="console" class="flex-1">
            <ConsoleOutput
              ref="consoleRef"
              :web-container="state.webContainer"
              :project-directory="state.result?.repo ? `/${state.result.repo}` : '/'"
              :register-process="registerConsoleProcess"
              @process-started="(e) => containerStatus.serving = true"
              @process-stopped="(e) => containerStatus.serving = false"
            />
          </TabsContent>

          <!-- Processes Tab -->
          <TabsContent value="processes" class="flex-1 p-6">
            <div class="max-w-6xl mx-auto space-y-6">
              <!-- Tab Header -->
              <div class="flex items-center justify-between">
                <h2 class="text-2xl font-bold">Process Manager</h2>
                <div class="flex items-center space-x-4">
                  <Badge variant="outline">
                    {{ runningProcesses.length }} running
                  </Badge>
                  <Badge variant="secondary">
                    {{ allProcesses.length }} total
                  </Badge>
                  <Button 
                    v-if="runningProcesses.length > 0"
                    @click="stopAllProcesses()"
                    variant="destructive"
                    size="sm"
                  >
                    <Square class="h-4 w-4 mr-2" />
                    Stop All
                  </Button>
                </div>
              </div>

              <!-- Running Processes -->
              <Card v-if="runningProcesses.length > 0">
                <CardHeader>
                  <CardTitle class="flex items-center space-x-2">
                    <div class="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Running Processes</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="space-y-3">
                    <div 
                      v-for="process in runningProcesses" 
                      :key="process.id"
                      class="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                    >
                      <div class="flex items-center space-x-3">
                        <div v-if="process.type === 'dev'" class="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                        <div v-else-if="process.type === 'build'" class="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                        <div v-else-if="process.type === 'test'" class="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                        <div v-else-if="process.type === 'install'" class="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                        <div v-else class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        
                        <div>
                          <div class="flex items-center space-x-2">
                            <code class="text-sm font-medium">{{ process.command }}</code>
                            <Badge :variant="process.type === 'dev' ? 'default' : 'outline'" class="text-xs">{{ process.type }}</Badge>
                            <Badge v-if="process.port" variant="outline" class="text-xs bg-green-100 text-green-800">
                              Port {{ process.port }}
                            </Badge>
                          </div>
                          <p class="text-xs text-gray-500 mt-1">
                            Started {{ new Date(process.startTime).toLocaleTimeString() }}
                            • Running for {{ Math.round((Date.now() - new Date(process.startTime)) / 1000) }}s
                          </p>
                        </div>
                      </div>
                      
                      <div class="flex items-center space-x-2">
                        <Button 
                          v-if="process.url"
                          @click="() => window.open(process.url, '_blank')"
                          variant="outline"
                          size="sm"
                        >
                          <Globe class="h-4 w-4 mr-1" />
                          Open
                        </Button>
                        <Button 
                          @click="killProcess(process.id)"
                          variant="destructive"
                          size="sm"
                        >
                          <Square class="h-4 w-4 mr-1" />
                          Stop
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <!-- Process History -->
              <Card>
                <CardHeader>
                  <CardTitle>Process History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div v-if="allProcesses.length === 0" class="text-center py-8 text-gray-500">
                    <Layout class="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No processes have been started yet</p>
                    <p class="text-sm">Processes started from console or scripts will appear here</p>
                  </div>
                  
                  <div v-else class="space-y-3">
                    <div 
                      v-for="process in allProcesses" 
                      :key="process.id"
                      class="border rounded-lg p-4"
                      :class="{
                        'bg-green-50 border-green-200': process.status === 'completed',
                        'bg-red-50 border-red-200': process.status === 'failed',
                        'bg-gray-50 border-gray-200': process.status === 'killed',
                        'bg-blue-50 border-blue-200': process.status === 'running'
                      }"
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center space-x-2 mb-2">
                            <code class="text-sm font-medium">{{ process.command }}</code>
                            <Badge :variant="process.type === 'dev' ? 'default' : 'outline'" class="text-xs">{{ process.type }}</Badge>
                            <Badge 
                              :variant="process.status === 'running' ? 'default' : process.status === 'completed' ? 'default' : 'destructive'"
                              class="text-xs"
                              :class="{
                                'bg-green-100 text-green-800': process.status === 'completed',
                                'bg-red-100 text-red-800': process.status === 'failed',
                                'bg-gray-100 text-gray-800': process.status === 'killed',
                                'bg-blue-100 text-blue-800': process.status === 'running'
                              }"
                            >
                              {{ process.status }}
                            </Badge>
                            <Badge v-if="process.exitCode !== null" variant="outline" class="text-xs">
                              Exit: {{ process.exitCode }}
                            </Badge>
                          </div>
                          
                          <div class="text-xs text-gray-500 mb-3">
                            <span>Started: {{ new Date(process.startTime).toLocaleString() }}</span>
                            <span v-if="process.endTime" class="ml-4">
                              Ended: {{ new Date(process.endTime).toLocaleString() }}
                            </span>
                            <span v-if="process.endTime" class="ml-4">
                              Duration: {{ Math.round((new Date(process.endTime) - new Date(process.startTime)) / 1000) }}s
                            </span>
                          </div>
                          
                          <!-- Process Output -->
                          <details v-if="process.output.length > 0" class="mt-3">
                            <summary class="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                              View Output ({{ process.output.length }} lines)
                            </summary>
                            <div class="mt-2 bg-gray-900 text-green-400 p-3 rounded text-xs font-mono max-h-64 overflow-y-auto">
                              <div v-for="line in process.output" :key="line.timestamp" class="mb-1">
                                <span class="text-gray-500">{{ new Date(line.timestamp).toLocaleTimeString() }}</span>
                                <span class="ml-2">{{ line.text }}</span>
                              </div>
                            </div>
                          </details>
                        </div>
                        
                        <div class="flex items-center space-x-2 ml-4">
                          <Button 
                            v-if="process.status === 'running'"
                            @click="killProcess(process.id)"
                            variant="destructive"
                            size="sm"
                          >
                            <Square class="h-4 w-4 mr-1" />
                            Stop
                          </Button>
                          <Button 
                            v-if="process.url"
                            @click="() => window.open(process.url, '_blank')"
                            variant="outline"
                            size="sm"
                          >
                            <Globe class="h-4 w-4 mr-1" />
                            Open
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <!-- Dependencies Tab -->
          <TabsContent value="dependencies" class="flex-1 p-6">
            <div class="max-w-6xl mx-auto space-y-6">
              <!-- Tab Header -->
              <div class="flex items-center justify-between">
                <h2 class="text-2xl font-bold">Dependencies</h2>
                <div class="flex space-x-2">
                  <Button 
                    @click="showPackageJson = true"
                    :variant="showPackageJson ? 'default' : 'outline'"
                    size="sm"
                  >
                    <BookOpen class="h-4 w-4 mr-2" />
                    package.json
                  </Button>
                  <Button 
                    @click="showPackageJson = false"
                    :variant="!showPackageJson ? 'default' : 'outline'"
                    size="sm"
                  >
                    <Terminal class="h-4 w-4 mr-2" />
                    Install Output
                  </Button>
                </div>
              </div>

              <!-- Package.json View -->
              <Card v-if="showPackageJson">
                <CardHeader>
                  <CardTitle class="flex items-center space-x-2">
                    <Package class="h-5 w-5" />
                    <span>package.json</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div v-if="packageInfo" class="space-y-6">
                    <!-- Basic Info -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label class="text-sm font-medium text-gray-600">Name</Label>
                        <p class="text-lg font-semibold">{{ packageInfo.name }}</p>
                      </div>
                      <div>
                        <Label class="text-sm font-medium text-gray-600">Version</Label>
                        <p class="text-lg font-semibold">{{ packageInfo.version }}</p>
                      </div>
                      <div>
                        <Label class="text-sm font-medium text-gray-600">License</Label>
                        <p class="text-lg font-semibold">{{ packageInfo.license || 'Not specified' }}</p>
                      </div>
                    </div>

                    <!-- Description -->
                    <div v-if="packageInfo.description">
                      <Label class="text-sm font-medium text-gray-600">Description</Label>
                      <p class="text-base mt-1">{{ packageInfo.description }}</p>
                    </div>

                    <!-- Scripts -->
                    <div v-if="packageInfo.scripts">
                      <Label class="text-sm font-medium text-gray-600 mb-3 block">Available Scripts</Label>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div
                          v-for="(script, name) in packageInfo.scripts"
                          :key="name"
                          class="p-3 border rounded-lg bg-gray-50"
                        >
                          <div class="flex items-center justify-between">
                            <code class="text-sm font-medium text-blue-600">npm run {{ name }}</code>
                            <Button 
                              @click="runNpmScript(name)"
                              variant="outline"
                              size="sm"
                            >
                              <Play class="h-3 w-3" />
                            </Button>
                          </div>
                          <p class="text-sm text-gray-600 mt-1 font-mono">{{ script }}</p>
                        </div>
                      </div>
                    </div>

                    <!-- Dependencies -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <!-- Production Dependencies -->
                      <div v-if="packageInfo.dependencies">
                        <Label class="text-sm font-medium text-gray-600 mb-3 block">Dependencies ({{ Object.keys(packageInfo.dependencies).length }})</Label>
                        <ScrollArea class="h-64 border rounded-lg">
                          <div class="p-3 space-y-2">
                            <div
                              v-for="(version, name) in packageInfo.dependencies"
                              :key="name"
                              class="flex items-center justify-between py-1"
                            >
                              <code class="text-sm font-medium">{{ name }}</code>
                              <Badge variant="outline" class="text-xs">{{ version }}</Badge>
                            </div>
                          </div>
                        </ScrollArea>
                      </div>

                      <!-- Dev Dependencies -->
                      <div v-if="packageInfo.devDependencies">
                        <Label class="text-sm font-medium text-gray-600 mb-3 block">Dev Dependencies ({{ Object.keys(packageInfo.devDependencies).length }})</Label>
                        <ScrollArea class="h-64 border rounded-lg">
                          <div class="p-3 space-y-2">
                            <div
                              v-for="(version, name) in packageInfo.devDependencies"
                              :key="name"
                              class="flex items-center justify-between py-1"
                            >
                              <code class="text-sm font-medium">{{ name }}</code>
                              <Badge variant="secondary" class="text-xs">{{ version }}</Badge>
                            </div>
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="text-center py-8 text-gray-500">
                    <Package class="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No package.json found</p>
                  </div>
                </CardContent>
              </Card>

              <!-- NPM Install Output View -->
              <Card v-if="!showPackageJson">
                <CardHeader>
                  <CardTitle class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                      <Terminal class="h-5 w-5" />
                      <span>NPM Install Output</span>
                      <Badge v-if="npmInstallOutput.length > 0" variant="outline">{{ npmInstallOutput.length }} lines</Badge>
                    </div>
                    <div class="flex space-x-2">
                      <Button 
                        v-if="npmInstallOutput.length > 0"
                        @click="npmInstallOutput = []"
                        variant="outline"
                        size="sm"
                      >
                        Clear
                      </Button>
                      <Button 
                        v-if="state.webContainer && !containerStatus.installing"
                        @click="runManualInstall"
                        variant="outline"
                        size="sm"
                      >
                        <Package class="h-4 w-4 mr-2" />
                        Run npm install
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea class="h-96 border rounded-lg bg-gray-900 text-green-400 font-mono text-sm">
                    <div class="p-4 space-y-1">
                      <div v-if="npmInstallOutput.length === 0 && !containerStatus.installing" class="text-gray-500 text-center py-8">
                        <Package class="h-12 w-12 mx-auto mb-4 text-gray-600" />
                        <p class="mb-2">No install output yet</p>
                        <p class="text-sm">Install output will appear here when you import a repository or run npm install</p>
                      </div>
                      
                      <div v-if="containerStatus.installing" class="text-yellow-400 text-center py-4">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-2"></div>
                        <p>Installing dependencies...</p>
                      </div>
                      
                      <div
                        v-for="(line, index) in npmInstallOutput"
                        :key="index"
                        class="leading-tight hover:bg-gray-800 px-2 py-1 rounded"
                      >
                        <span class="text-gray-500 mr-3 text-xs">{{ new Date(line.timestamp).toLocaleTimeString() }}</span>
                        <span class="whitespace-pre-wrap">{{ line.text.trim() }}</span>
                      </div>
                    </div>
                  </ScrollArea>
                  
                  <!-- Install Summary -->
                  <div v-if="npmInstallOutput.length > 0" class="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-gray-600">Install completed</span>
                      <span class="text-gray-500">{{ npmInstallOutput.length }} output lines</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <!-- Tools Tab -->
          <TabsContent value="tools" class="flex-1 p-6">
            <div class="max-w-4xl mx-auto space-y-6">
              <!-- Project Info -->
              <Card v-if="packageInfo">
                <CardHeader>
                  <CardTitle class="flex items-center space-x-2">
                    <Package class="h-5 w-5" />
                    <span>Project Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <p class="font-medium">{{ packageInfo.name }}</p>
                    </div>
                    <div>
                      <Label>Version</Label>
                      <p class="font-medium">{{ packageInfo.version }}</p>
                    </div>
                    <div class="col-span-2">
                      <Label>Description</Label>
                      <p>{{ packageInfo.description || 'No description' }}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <!-- Quick Actions -->
              <Card>
                <CardHeader>
                  <CardTitle class="flex items-center space-x-2">
                    <Wrench class="h-5 w-5" />
                    <span>Quick Actions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button @click="runNpmScript('dev')" variant="outline" class="h-16 flex-col">
                      <Play class="h-6 w-6 mb-2" />
                      Start Dev
                    </Button>
                    <Button @click="runNpmScript('build')" variant="outline" class="h-16 flex-col">
                      <Package class="h-6 w-6 mb-2" />
                      Build
                    </Button>
                    <Button @click="runNpmScript('test')" variant="outline" class="h-16 flex-col">
                      <TestTube class="h-6 w-6 mb-2" />
                      Test
                    </Button>
                    <Button @click="exportChanges" variant="outline" class="h-16 flex-col">
                      <Download class="h-6 w-6 mb-2" />
                      Export Diff
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <!-- File Changes Summary -->
              <Card v-if="hasUnsavedChanges">
                <CardHeader>
                  <CardTitle class="flex items-center space-x-2">
                    <FileText class="h-5 w-5" />
                    <span>Unsaved Changes</span>
                    <Badge>{{ fileChangeStats.changedFiles }}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="space-y-2">
                    <div
                      v-for="filePath in Array.from(changedFiles)"
                      :key="filePath"
                      class="flex items-center justify-between p-2 border rounded"
                    >
                      <span class="font-medium">{{ filePath }}</span>
                      <div class="flex space-x-2">
                        <Button 
                          @click="selectedFile = filePath; activeTab = 'editor'"
                          variant="outline"
                          size="sm"
                        >
                          Edit
                        </Button>
                        <Button 
                          @click="onRevertChanges(filePath)"
                          variant="outline"
                          size="sm"
                        >
                          Revert
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
</template>