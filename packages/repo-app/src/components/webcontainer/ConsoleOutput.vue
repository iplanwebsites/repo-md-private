<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Terminal, 
  Trash2, 
  Play, 
  Square, 
  Copy,
  Download,
  Settings,
  Maximize2,
  Minimize2
} from 'lucide-vue-next'

const props = defineProps({
  webContainer: {
    type: Object,
    default: null
  },
  autoScroll: {
    type: Boolean,
    default: true
  },
  projectDirectory: {
    type: String,
    default: '/'
  },
  registerProcess: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['command-executed', 'process-started', 'process-stopped'])

// Console state
const consoleRef = ref(null)
const outputLines = ref([])
const currentCommand = ref('')
const commandHistory = ref([])
const historyIndex = ref(-1)
const activeProcesses = ref(new Map())
const isMaximized = ref(false)

// Console settings
const settings = ref({
  theme: 'dark',
  fontSize: 14,
  maxLines: 1000,
  showTimestamps: true,
  autoScroll: true
})

// Available npm scripts
const availableScripts = ref([])
const selectedScript = ref('')

// Common commands
const commonCommands = [
  { label: 'npm run dev', value: 'npm run dev' },
  { label: 'npm run build', value: 'npm run build' },
  { label: 'npm run test', value: 'npm run test' },
  { label: 'npm install', value: 'npm install' },
  { label: 'npm run lint', value: 'npm run lint' },
  { label: 'ls -la', value: 'ls -la' },
  { label: 'pwd', value: 'pwd' }
]

// Computed
const filteredOutput = computed(() => {
  return outputLines.value.slice(-settings.value.maxLines)
})

const hasActiveProcesses = computed(() => {
  return activeProcesses.value.size > 0
})

// Add output line
const addOutputLine = (content, type = 'stdout', command = null) => {
  const timestamp = new Date().toLocaleTimeString()
  const id = Date.now() + Math.random()
  
  outputLines.value.push({
    id,
    timestamp,
    content: content.toString(),
    type, // 'stdout', 'stderr', 'command', 'system'
    command
  })
  
  // Auto-scroll if enabled
  if (settings.value.autoScroll) {
    nextTick(() => {
      scrollToBottom()
    })
  }
  
  // Limit output lines
  if (outputLines.value.length > settings.value.maxLines + 100) {
    outputLines.value = outputLines.value.slice(-settings.value.maxLines)
  }
}

// Execute command
const executeCommand = async (command) => {
  if (!props.webContainer || !command.trim()) return
  
  // Add command to history
  if (!commandHistory.value.includes(command)) {
    commandHistory.value.push(command)
  }
  historyIndex.value = -1
  
  // Add command line to output
  addOutputLine(`$ ${command}`, 'command')
  
  try {
    // Parse command and arguments
    const [cmd, ...args] = command.trim().split(' ')
    
    // Spawn process with project directory
    const process = await props.webContainer.spawn(cmd, args, {
      cwd: props.projectDirectory
    })
    
    // Store active process
    const processId = Date.now().toString()
    activeProcesses.value.set(processId, {
      process,
      command,
      startTime: new Date()
    })
    
    // Register with parent process manager if available
    let managedProcessId = null
    if (props.registerProcess) {
      managedProcessId = props.registerProcess(command, process)
      console.log(`🔗 Console process registered as managed process: ${managedProcessId}`)
    }
    
    emit('process-started', { processId, command, managedProcessId })
    
    // Handle output streams
    if (process.output) {
      const reader = process.output.getReader()
      
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
            
            // Clean up ANSI escape codes
            const cleanText = text.replace(/\x1B\[[0-9;]*[mGKHf]/g, '').trim()
            if (cleanText) {
              addOutputLine(cleanText, 'stdout', command)
            }
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            addOutputLine(`Output stream error: ${error.message}`, 'stderr', command)
          }
        }
      }
      
      readOutput()
    }
    
    // Wait for process to complete
    const exitCode = await process.exit
    
    // Remove from active processes
    activeProcesses.value.delete(processId)
    
    // Add exit status
    if (exitCode === 0) {
      addOutputLine(`Process exited with code ${exitCode}`, 'system', command)
    } else {
      addOutputLine(`Process failed with exit code ${exitCode}`, 'stderr', command)
    }
    
    emit('process-stopped', { processId, command, exitCode })
    emit('command-executed', { command, exitCode })
    
  } catch (error) {
    addOutputLine(`Error executing command: ${error.message}`, 'stderr', command)
    emit('command-executed', { command, error: error.message })
  }
  
  currentCommand.value = ''
}

// Stop all processes
const stopAllProcesses = async () => {
  for (const [processId, { process, command }] of activeProcesses.value) {
    try {
      if (process.kill) {
        process.kill()
      }
      addOutputLine(`Stopped: ${command}`, 'system')
      emit('process-stopped', { processId, command, killed: true })
    } catch (error) {
      addOutputLine(`Error stopping process: ${error.message}`, 'stderr')
    }
  }
  activeProcesses.value.clear()
}

// Handle keyboard events
const handleKeyDown = (event) => {
  switch (event.key) {
    case 'Enter':
      event.preventDefault()
      executeCommand(currentCommand.value)
      break
    case 'ArrowUp':
      event.preventDefault()
      if (commandHistory.value.length > 0) {
        historyIndex.value = Math.min(historyIndex.value + 1, commandHistory.value.length - 1)
        currentCommand.value = commandHistory.value[commandHistory.value.length - 1 - historyIndex.value]
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      if (historyIndex.value >= 0) {
        historyIndex.value = Math.max(historyIndex.value - 1, -1)
        currentCommand.value = historyIndex.value >= 0 
          ? commandHistory.value[commandHistory.value.length - 1 - historyIndex.value]
          : ''
      }
      break
    case 'Tab':
      event.preventDefault()
      // Basic command completion
      if (currentCommand.value) {
        const matches = commonCommands.filter(cmd => 
          cmd.value.startsWith(currentCommand.value)
        )
        if (matches.length === 1) {
          currentCommand.value = matches[0].value
        }
      }
      break
  }
}

// Scroll to bottom
const scrollToBottom = () => {
  if (consoleRef.value) {
    consoleRef.value.scrollTop = consoleRef.value.scrollHeight
  }
}

// Clear console
const clearConsole = () => {
  outputLines.value = []
  addOutputLine('Console cleared', 'system')
}

// Copy output
const copyOutput = () => {
  const text = filteredOutput.value
    .map(line => `${settings.value.showTimestamps ? line.timestamp + ' ' : ''}${line.content}`)
    .join('\n')
  
  navigator.clipboard.writeText(text).catch(console.error)
}

// Export console output
const exportOutput = () => {
  const text = filteredOutput.value
    .map(line => `${line.timestamp} [${line.type}] ${line.content}`)
    .join('\n')
  
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `console-${new Date().getTime()}.log`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Load package.json scripts
const loadPackageScripts = async () => {
  if (!props.webContainer) return
  
  try {
    const packageJsonPath = props.projectDirectory === '/' ? '/package.json' : `${props.projectDirectory}/package.json`
    console.log('📄 Loading package.json scripts from:', packageJsonPath)
    
    const packageJson = await props.webContainer.fs.readFile(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(packageJson)
    
    if (pkg.scripts) {
      availableScripts.value = Object.keys(pkg.scripts).map(name => ({
        name,
        command: `npm run ${name}`,
        script: pkg.scripts[name]
      }))
      console.log('✅ Loaded npm scripts:', Object.keys(pkg.scripts))
    }
  } catch (error) {
    console.warn('Could not load package.json scripts:', error)
  }
}

// Quick script execution
const runScript = (scriptName) => {
  executeCommand(`npm run ${scriptName}`)
}

// Get line style based on type
const getLineClass = (type) => {
  switch (type) {
    case 'command':
      return 'text-cyan-400 font-semibold'
    case 'stderr':
      return 'text-red-400'
    case 'system':
      return 'text-yellow-400'
    case 'stdout':
    default:
      return 'text-green-400'
  }
}

// Initialize
onMounted(() => {
  if (props.webContainer) {
    loadPackageScripts()
    addOutputLine('WebContainer console ready', 'system')
  }
})

// Cleanup
onUnmounted(() => {
  stopAllProcesses()
})

// Expose methods to parent components
defineExpose({
  addOutputLine,
  clearConsole,
  executeCommand,
  stopAllProcesses
})
</script>

<template>
  <Card :class="{ 'fixed inset-4 z-50': isMaximized }" class="h-full bg-gray-900 text-green-400">
    <CardHeader class="pb-3 border-b border-gray-700">
      <div class="flex items-center justify-between">
        <CardTitle class="flex items-center space-x-2 text-green-400">
          <Terminal class="h-5 w-5" />
          <span>Console</span>
          <Badge v-if="hasActiveProcesses" class="bg-yellow-600 text-yellow-100">
            {{ activeProcesses.size }} running
          </Badge>
        </CardTitle>
        
        <div class="flex items-center space-x-2">
          <!-- Quick Script Buttons -->
          <div v-if="availableScripts.length > 0" class="flex space-x-1">
            <Button
              v-for="script in availableScripts.slice(0, 3)"
              :key="script.name"
              @click="runScript(script.name)"
              variant="outline"
              size="sm"
              class="text-green-400 border-green-400 hover:bg-green-400 hover:text-gray-900"
            >
              {{ script.name }}
            </Button>
          </div>
          
          <Button @click="copyOutput" variant="outline" size="sm" class="text-green-400 border-green-400">
            <Copy class="h-4 w-4" />
          </Button>
          <Button @click="exportOutput" variant="outline" size="sm" class="text-green-400 border-green-400">
            <Download class="h-4 w-4" />
          </Button>
          <Button @click="clearConsole" variant="outline" size="sm" class="text-green-400 border-green-400">
            <Trash2 class="h-4 w-4" />
          </Button>
          <Button 
            v-if="hasActiveProcesses"
            @click="stopAllProcesses" 
            variant="destructive" 
            size="sm"
          >
            <Square class="h-4 w-4" />
          </Button>
          <Button 
            @click="isMaximized = !isMaximized" 
            variant="outline" 
            size="sm"
            class="text-green-400 border-green-400"
          >
            <Maximize2 v-if="!isMaximized" class="h-4 w-4" />
            <Minimize2 v-else class="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <!-- Quick Commands -->
      <div class="flex flex-wrap gap-2 mt-3">
        <Button
          v-for="cmd in commonCommands.slice(0, 6)"
          :key="cmd.value"
          @click="currentCommand = cmd.value"
          variant="ghost"
          size="sm"
          class="text-green-400 hover:bg-green-400 hover:text-gray-900"
        >
          {{ cmd.label }}
        </Button>
      </div>
    </CardHeader>
    
    <CardContent class="p-0 h-full flex flex-col">
      <!-- Console Output -->
      <div 
        ref="consoleRef"
        class="flex-1 overflow-y-auto p-4 font-mono text-sm bg-gray-900"
        :style="{ fontSize: settings.fontSize + 'px' }"
      >
        <div
          v-for="line in filteredOutput"
          :key="line.id"
          class="flex whitespace-pre-wrap break-all"
          :class="getLineClass(line.type)"
        >
          <span v-if="settings.showTimestamps" class="text-gray-500 mr-3 flex-shrink-0">
            {{ line.timestamp }}
          </span>
          <span class="flex-1">{{ line.content }}</span>
        </div>
      </div>
      
      <!-- Command Input -->
      <div class="border-t border-gray-700 p-4 bg-gray-800">
        <div class="flex items-center space-x-2">
          <span class="text-cyan-400 font-semibold">$</span>
          <input
            v-model="currentCommand"
            type="text"
            class="flex-1 bg-transparent text-green-400 outline-none placeholder-gray-500"
            placeholder="Enter command..."
            @keydown="handleKeyDown"
            autocomplete="off"
          />
          <Button 
            @click="executeCommand(currentCommand)"
            :disabled="!currentCommand.trim()"
            variant="outline"
            size="sm"
            class="text-green-400 border-green-400 hover:bg-green-400 hover:text-gray-900"
          >
            <Play class="h-4 w-4" />
          </Button>
        </div>
        
        <!-- Active Processes -->
        <div v-if="hasActiveProcesses" class="mt-2 text-sm">
          <div class="text-yellow-400 mb-1">Active Processes:</div>
          <div 
            v-for="[id, proc] in activeProcesses"
            :key="id"
            class="text-gray-400 flex items-center justify-between"
          >
            <span>{{ proc.command }}</span>
            <span class="text-xs">{{ Math.round((Date.now() - proc.startTime) / 1000) }}s</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>