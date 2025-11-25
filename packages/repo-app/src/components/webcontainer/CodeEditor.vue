<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Save, 
  RotateCcw, 
  Search, 
  Replace, 
  FileText, 
  Settings, 
  Maximize2,
  Minimize2,
  Copy,
  Download
} from 'lucide-vue-next'

const props = defineProps({
  webContainer: {
    type: Object,
    default: null
  },
  filePath: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'plaintext'
  },
  readOnly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'save-file', 
  'file-changed', 
  'revert-changes',
  'search-replace'
])

// Editor state
const editorRef = ref(null)
const monacoEditor = ref(null)
const originalContent = ref('')
const currentContent = ref('')
const hasUnsavedChanges = ref(false)
const loading = ref(false)
const error = ref(null)

// Editor settings
const editorSettings = ref({
  theme: 'vs-dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'on',
  minimap: true,
  lineNumbers: 'on',
  autoIndent: 'advanced',
  formatOnSave: true
})

// Search/Replace state
const searchVisible = ref(false)
const searchQuery = ref('')
const replaceQuery = ref('')
const searchResults = ref([])
const currentSearchIndex = ref(0)

// UI state
const isFullscreen = ref(false)
const showSettings = ref(false)

// Available themes
const themes = [
  { value: 'vs', label: 'Light' },
  { value: 'vs-dark', label: 'Dark' },
  { value: 'hc-black', label: 'High Contrast' }
]

// Language detection
const detectedLanguage = computed(() => {
  if (props.language !== 'plaintext') return props.language
  
  if (!props.filePath) return 'plaintext'
  
  const ext = props.filePath.split('.').pop()?.toLowerCase()
  const languageMap = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'vue': 'html',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'yml': 'yaml',
    'yaml': 'yaml',
    'xml': 'xml',
    'svg': 'xml',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'java': 'java'
  }
  
  return languageMap[ext] || 'plaintext'
})

// Load file content
const loadFile = async () => {
  if (!props.webContainer || !props.filePath) return
  
  loading.value = true
  error.value = null
  
  try {
    const content = await props.webContainer.fs.readFile(props.filePath, 'utf-8')
    originalContent.value = content
    currentContent.value = content
    hasUnsavedChanges.value = false
    
    if (monacoEditor.value) {
      monacoEditor.value.setValue(content)
    }
  } catch (err) {
    error.value = `Failed to load file: ${err.message}`
    console.error('Error loading file:', err)
  } finally {
    loading.value = false
  }
}

// Save file
const saveFile = async () => {
  if (!props.webContainer || !props.filePath || props.readOnly) return
  
  try {
    await props.webContainer.fs.writeFile(props.filePath, currentContent.value, 'utf-8')
    originalContent.value = currentContent.value
    hasUnsavedChanges.value = false
    
    emit('save-file', {
      filePath: props.filePath,
      content: currentContent.value
    })
  } catch (err) {
    error.value = `Failed to save file: ${err.message}`
    console.error('Error saving file:', err)
  }
}

// Revert changes
const revertChanges = () => {
  currentContent.value = originalContent.value
  hasUnsavedChanges.value = false
  
  if (monacoEditor.value) {
    monacoEditor.value.setValue(originalContent.value)
  }
  
  emit('revert-changes', props.filePath)
}

// Copy content to clipboard
const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(currentContent.value)
  } catch (err) {
    console.error('Failed to copy content:', err)
  }
}

// Download file
const downloadFile = () => {
  const blob = new Blob([currentContent.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = props.filePath.split('/').pop() || 'file.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Initialize Monaco Editor
const initializeMonaco = async () => {
  if (typeof window === 'undefined') return
  
  try {
    // Configure Monaco Environment to disable workers
    window.MonacoEnvironment = {
      getWorker: function (workerId, label) {
        // Return a simple worker that doesn't do anything to prevent errors
        const workerBlob = new Blob([`
          self.onmessage = function(e) {
            // Simple echo worker that prevents errors
            self.postMessage({ type: 'result', data: null });
          };
        `], { type: 'application/javascript' });
        
        return new Worker(URL.createObjectURL(workerBlob));
      }
    }
    
    // Dynamically import Monaco Editor
    const monaco = await import('monaco-editor')
    
    // Disable problematic language features that require workers
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true
    })
    
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true
    })
    
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: false,
      enableSchemaRequest: false,
      hover: false,
      completion: false
    })
    
    // Disable CSS language features
    monaco.languages.css.cssDefaults.setOptions({
      validate: false,
      lint: false,
      hover: false,
      completion: false
    })
    
    // Disable HTML language features
    monaco.languages.html.htmlDefaults.setOptions({
      validate: false,
      suggest: false,
      hover: false,
      completion: false
    })
    
    if (!editorRef.value) return
    
    // Configure Monaco
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      typeRoots: ["node_modules/@types"]
    })
    
    // Create editor with worker-disabled features
    monacoEditor.value = monaco.editor.create(editorRef.value, {
      value: currentContent.value,
      language: detectedLanguage.value,
      theme: editorSettings.value.theme,
      fontSize: editorSettings.value.fontSize,
      tabSize: editorSettings.value.tabSize,
      wordWrap: editorSettings.value.wordWrap,
      minimap: { enabled: editorSettings.value.minimap },
      lineNumbers: editorSettings.value.lineNumbers,
      autoIndent: editorSettings.value.autoIndent,
      readOnly: props.readOnly,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      },
      // Disable features that require workers
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      acceptSuggestionOnEnter: 'off',
      hover: { enabled: false },
      parameterHints: { enabled: false },
      occurrencesHighlight: false,
      selectionHighlight: false,
      codeLens: false,
      folding: false,
      foldingHighlight: false,
      linkedEditing: false,
      colorDecorators: false
    })
    
    // Listen for content changes
    monacoEditor.value.onDidChangeModelContent(() => {
      const newContent = monacoEditor.value.getValue()
      currentContent.value = newContent
      hasUnsavedChanges.value = newContent !== originalContent.value
      
      emit('file-changed', {
        filePath: props.filePath,
        content: newContent,
        hasChanges: hasUnsavedChanges.value
      })
    })
    
    // Add keyboard shortcuts
    monacoEditor.value.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveFile)
    monacoEditor.value.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      searchVisible.value = true
    })
    
  } catch (err) {
    console.error('Failed to initialize Monaco Editor:', err)
    error.value = 'Failed to initialize code editor'
  }
}

// Update editor settings
const updateEditorSettings = () => {
  if (!monacoEditor.value) return
  
  monacoEditor.value.updateOptions({
    theme: editorSettings.value.theme,
    fontSize: editorSettings.value.fontSize,
    tabSize: editorSettings.value.tabSize,
    wordWrap: editorSettings.value.wordWrap,
    minimap: { enabled: editorSettings.value.minimap },
    lineNumbers: editorSettings.value.lineNumbers
  })
}

// Search functionality
const performSearch = () => {
  if (!monacoEditor.value || !searchQuery.value) return
  
  const matches = monacoEditor.value.getModel().findMatches(
    searchQuery.value,
    true,
    false,
    true,
    null,
    true
  )
  
  searchResults.value = matches
  currentSearchIndex.value = 0
  
  if (matches.length > 0) {
    monacoEditor.value.setSelection(matches[0].range)
    monacoEditor.value.revealRangeInCenter(matches[0].range)
  }
}

// Navigate search results
const nextSearchResult = () => {
  if (searchResults.value.length === 0) return
  
  currentSearchIndex.value = (currentSearchIndex.value + 1) % searchResults.value.length
  const match = searchResults.value[currentSearchIndex.value]
  monacoEditor.value.setSelection(match.range)
  monacoEditor.value.revealRangeInCenter(match.range)
}

const previousSearchResult = () => {
  if (searchResults.value.length === 0) return
  
  currentSearchIndex.value = currentSearchIndex.value === 0 
    ? searchResults.value.length - 1 
    : currentSearchIndex.value - 1
  const match = searchResults.value[currentSearchIndex.value]
  monacoEditor.value.setSelection(match.range)
  monacoEditor.value.revealRangeInCenter(match.range)
}

// Replace functionality
const replaceAll = () => {
  if (!monacoEditor.value || !searchQuery.value) return
  
  const newContent = currentContent.value.replaceAll(searchQuery.value, replaceQuery.value)
  monacoEditor.value.setValue(newContent)
  currentContent.value = newContent
  
  emit('search-replace', {
    searchQuery: searchQuery.value,
    replaceQuery: replaceQuery.value,
    filePath: props.filePath
  })
}

// Toggle fullscreen
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  
  nextTick(() => {
    if (monacoEditor.value) {
      monacoEditor.value.layout()
    }
  })
}

// Watch for file path changes
watch(() => props.filePath, () => {
  if (props.filePath) {
    loadFile()
  }
}, { immediate: true })

// Watch for language changes
watch(() => detectedLanguage.value, (newLanguage) => {
  if (monacoEditor.value) {
    const monaco = monacoEditor.value.getModel()
    if (monaco) {
      monaco.setLanguage ? monaco.setLanguage(newLanguage) : null
    }
  }
})

// Watch editor settings
watch(() => editorSettings.value, updateEditorSettings, { deep: true })

// Lifecycle
onMounted(() => {
  nextTick(initializeMonaco)
})

onUnmounted(() => {
  if (monacoEditor.value) {
    monacoEditor.value.dispose()
  }
})
</script>

<template>
  <Card :class="{ 'fixed inset-0 z-50': isFullscreen }" class="h-full">
    <CardHeader class="pb-3">
      <div class="flex items-center justify-between">
        <CardTitle class="flex items-center space-x-2">
          <FileText class="h-5 w-5" />
          <span>{{ filePath.split('/').pop() || 'Code Editor' }}</span>
          <Badge v-if="detectedLanguage !== 'plaintext'" variant="outline">
            {{ detectedLanguage }}
          </Badge>
          <Badge v-if="hasUnsavedChanges" class="bg-orange-100 text-orange-800">
            Modified
          </Badge>
          <Badge v-if="readOnly" variant="secondary">
            Read Only
          </Badge>
        </CardTitle>
        
        <div class="flex items-center space-x-2">
          <Button 
            v-if="!readOnly && hasUnsavedChanges"
            @click="saveFile" 
            variant="default" 
            size="sm"
          >
            <Save class="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button 
            v-if="hasUnsavedChanges"
            @click="revertChanges" 
            variant="outline" 
            size="sm"
          >
            <RotateCcw class="h-4 w-4 mr-2" />
            Revert
          </Button>
          <Button @click="copyContent" variant="outline" size="sm">
            <Copy class="h-4 w-4" />
          </Button>
          <Button @click="downloadFile" variant="outline" size="sm">
            <Download class="h-4 w-4" />
          </Button>
          <Button @click="searchVisible = !searchVisible" variant="outline" size="sm">
            <Search class="h-4 w-4" />
          </Button>
          <Button @click="showSettings = !showSettings" variant="outline" size="sm">
            <Settings class="h-4 w-4" />
          </Button>
          <Button @click="toggleFullscreen" variant="outline" size="sm">
            <Maximize2 v-if="!isFullscreen" class="h-4 w-4" />
            <Minimize2 v-else class="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <!-- Search Bar -->
      <div v-if="searchVisible" class="mt-3 p-3 bg-gray-50 rounded-lg">
        <div class="grid grid-cols-12 gap-2 items-center">
          <div class="col-span-4">
            <Input
              v-model="searchQuery"
              placeholder="Search..."
              @keyup.enter="performSearch"
            />
          </div>
          <div class="col-span-4">
            <Input
              v-model="replaceQuery"
              placeholder="Replace with..."
            />
          </div>
          <div class="col-span-4 flex space-x-1">
            <Button @click="performSearch" size="sm" variant="outline">
              Search
            </Button>
            <Button @click="previousSearchResult" size="sm" variant="outline">
              ↑
            </Button>
            <Button @click="nextSearchResult" size="sm" variant="outline">
              ↓
            </Button>
            <Button @click="replaceAll" size="sm" variant="outline">
              <Replace class="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div v-if="searchResults.length > 0" class="mt-2 text-sm text-gray-600">
          {{ currentSearchIndex + 1 }} of {{ searchResults.length }} matches
        </div>
      </div>
      
      <!-- Settings Panel -->
      <div v-if="showSettings" class="mt-3 p-3 bg-gray-50 rounded-lg">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <Label>Theme</Label>
            <Select v-model="editorSettings.theme">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="theme in themes" :key="theme.value" :value="theme.value">
                  {{ theme.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Font Size</Label>
            <Input 
              v-model.number="editorSettings.fontSize" 
              type="number" 
              min="10" 
              max="24"
            />
          </div>
          <div>
            <Label>Tab Size</Label>
            <Input 
              v-model.number="editorSettings.tabSize" 
              type="number" 
              min="1" 
              max="8"
            />
          </div>
          <div>
            <Label>Word Wrap</Label>
            <Select v-model="editorSettings.wordWrap">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="on">On</SelectItem>
                <SelectItem value="wordWrapColumn">Word Wrap Column</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </CardHeader>
    
    <CardContent class="p-0 h-full">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-96">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading file...</p>
        </div>
      </div>
      
      <!-- Error State -->
      <div v-else-if="error" class="flex items-center justify-center h-96">
        <div class="text-center text-red-500">
          <p>{{ error }}</p>
          <Button @click="loadFile" variant="outline" size="sm" class="mt-2">
            Retry
          </Button>
        </div>
      </div>
      
      <!-- Editor -->
      <div v-else class="h-full">
        <div 
          ref="editorRef" 
          class="h-full min-h-96"
          :class="{ 'h-screen': isFullscreen }"
        ></div>
      </div>
    </CardContent>
  </Card>
</template>

<style>
/* Monaco Editor Theme Customizations */
.monaco-editor {
  border-radius: 0 0 8px 8px;
}

.monaco-editor .margin {
  background-color: transparent;
}
</style>