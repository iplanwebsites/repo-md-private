<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, FileEdit, GitBranch } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import FileTreeNode from './FileTreeNode.vue'

const props = defineProps({
  webContainer: {
    type: Object,
    default: null
  },
  selectedFile: {
    type: String,
    default: ''
  },
  changedFiles: {
    type: Set,
    default: () => new Set()
  },
  projectDirectory: {
    type: String,
    default: '/'
  }
})

const emit = defineEmits(['file-selected', 'refresh'])

// State
const fileTree = ref({})
const expandedDirs = ref(new Set(['']))
const loading = ref(false)
const error = ref(null)

// File type detection
const getFileType = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico']
  const codeTypes = ['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'json', 'md', 'py', 'sh']
  
  if (imageTypes.includes(ext)) return 'image'
  if (codeTypes.includes(ext)) return 'code'
  return 'file'
}

// Get file icon color
const getFileIconColor = (filename, isChanged) => {
  if (isChanged) return 'text-orange-500'
  
  const type = getFileType(filename)
  switch (type) {
    case 'image': return 'text-purple-500'
    case 'code': return 'text-blue-500'
    default: return 'text-gray-500'
  }
}

// Build tree structure from file paths
const buildFileTree = (files) => {
  const tree = {}
  
  console.log('🔧 Building file tree from files:', {
    projectDirectory: props.projectDirectory,
    totalFiles: files.length,
    samplePaths: files.slice(0, 5)
  })
  
  files.forEach((filePath, index) => {
    // Strip the project directory prefix for display, but keep full path for operations
    let displayPath = filePath
    if (props.projectDirectory !== '/' && filePath.startsWith(props.projectDirectory + '/')) {
      displayPath = filePath.substring(props.projectDirectory.length + 1)
    } else if (props.projectDirectory !== '/' && filePath === props.projectDirectory) {
      console.log('⏭️ Skipping project directory itself:', filePath)
      return // Skip the project directory itself
    }
    
    if (index < 3) {
      console.log(`🔍 Processing file ${index}:`, {
        originalPath: filePath,
        displayPath: displayPath,
        projectDir: props.projectDirectory
      })
    }
    
    const parts = displayPath.split('/').filter(Boolean)
    let current = tree
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      
      if (!current[part]) {
        current[part] = isFile 
          ? { type: 'file', path: filePath } // Keep the full path for file operations
          : { type: 'directory', children: {}, path: parts.slice(0, i + 1).join('/') }
      }
      
      if (!isFile) {
        current = current[part].children
      }
    }
  })
  
  console.log('🌳 Final tree structure:', tree)
  return tree
}

// Load file tree from WebContainer
const loadFileTree = async () => {
  if (!props.webContainer) return
  
  // Prevent multiple simultaneous loads
  if (loading.value) {
    console.log('⏳ File tree already loading, skipping...')
    return
  }
  
  loading.value = true
  error.value = null
  
  try {
    console.log('📁 Loading file tree from:', props.projectDirectory)
    const files = await getAllFiles(props.projectDirectory)
    fileTree.value = buildFileTree(files)
    console.log('📊 File tree loaded:', { 
      totalFiles: files.length, 
      treeKeys: Object.keys(fileTree.value),
      sampleFiles: files.slice(0, 5),
      fullTree: fileTree.value
    })
  } catch (err) {
    error.value = err.message
    console.error('Error loading file tree:', err)
  } finally {
    loading.value = false
  }
}

// Recursively get all files
const getAllFiles = async (dirPath, depth = 0) => {
  const files = []
  
  // Prevent infinite recursion
  if (depth > 10) {
    console.warn(`⚠️ Maximum directory depth reached at ${dirPath}`)
    return files
  }
  
  try {
    console.log(`📁 Reading directory: ${dirPath} (depth: ${depth})`)
    const entries = await props.webContainer.fs.readdir(dirPath, { withFileTypes: true })
    console.log(`📊 Found ${entries.length} entries in ${dirPath}`)
    
    for (const entry of entries) {
      const fullPath = dirPath === '/' ? entry.name : `${dirPath}/${entry.name}`
      
      if (entry.isFile()) {
        // Keep the full path for WebContainer operations
        files.push(fullPath)
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subFiles = await getAllFiles(fullPath, depth + 1)
        files.push(...subFiles)
      }
    }
  } catch (err) {
    console.warn(`Could not read directory ${dirPath}:`, err)
  }
  
  return files
}

// Toggle directory expansion
const toggleDirectory = (dirPath) => {
  if (expandedDirs.value.has(dirPath)) {
    expandedDirs.value.delete(dirPath)
  } else {
    expandedDirs.value.add(dirPath)
  }
}

// Select file
const selectFile = (filePath) => {
  emit('file-selected', filePath)
}

// Refresh file tree
const refresh = () => {
  console.log('🔄 Manual refresh requested')
  loadFileTree()
  // Note: No emit needed, parent component manages its own state
}

// Watch for webContainer changes
watch(() => props.webContainer, (newContainer) => {
  if (newContainer) {
    console.log('🔄 WebContainer changed, loading file tree...')
    loadFileTree()
  }
}, { immediate: true })

// Watch for projectDirectory changes
watch(() => props.projectDirectory, (newDir, oldDir) => {
  if (newDir !== oldDir && props.webContainer) {
    console.log('📂 Project directory changed:', oldDir, '->', newDir)
    loadFileTree()
  }
})

// Sort files and directories
const sortTreeItems = (items) => {
  return Object.entries(items).sort(([nameA, itemA], [nameB, itemB]) => {
    // Directories first, then files
    if (itemA.type !== itemB.type) {
      return itemA.type === 'directory' ? -1 : 1
    }
    // Alphabetical within same type
    return nameA.localeCompare(nameB)
  })
}

onMounted(() => {
  console.log('🚀 WebContainerFileBrowser mounted')
  // Don't call loadFileTree here since the watcher will handle it
})

// Expose methods to parent components
defineExpose({
  refresh,
  loadFileTree
})
</script>

<template>
  <div class="h-full flex flex-col bg-gray-50 border-r">
    <!-- Header -->
    <div class="p-3 border-b bg-white">
      <div class="flex items-center justify-between">
        <h3 class="font-medium text-sm">Files</h3>
        <Button @click="refresh" variant="ghost" size="sm">
          <GitBranch class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="p-4 text-center text-sm text-gray-500">
      Loading files...
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-4 text-center text-sm text-red-500">
      Error: {{ error }}
      <Button @click="refresh" variant="outline" size="sm" class="mt-2">
        Retry
      </Button>
    </div>

    <!-- File Tree -->
    <div v-else class="flex-1 overflow-y-auto">
      <FileTreeNode
        v-for="[name, item] in sortTreeItems(fileTree)"
        :key="name"
        :name="name"
        :item="item"
        :level="0"
        :selected-file="selectedFile"
        :changed-files="changedFiles"
        :expanded-dirs="expandedDirs"
        @toggle-directory="toggleDirectory"
        @file-selected="selectFile"
      />
    </div>
  </div>
</template>

<!-- Recursive File Tree Node Component -->
<script>
export default {
  name: 'WebContainerFileBrowser',
  components: {
    FileTreeNode: {
      name: 'FileTreeNode',
      props: {
        name: String,
        item: Object,
        level: Number,
        selectedFile: String,
        changedFiles: Set,
        expandedDirs: Set
      },
      emits: ['toggle-directory', 'file-selected'],
      template: `
        <div>
          <!-- Directory -->
          <div 
            v-if="item.type === 'directory'"
            class="flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer text-sm"
            :style="{ paddingLeft: (level * 12 + 8) + 'px' }"
            @click="$emit('toggle-directory', item.path)"
          >
            <ChevronRight 
              v-if="!expandedDirs.has(item.path)"
              class="h-4 w-4 text-gray-400 mr-1" 
            />
            <ChevronDown 
              v-else
              class="h-4 w-4 text-gray-400 mr-1" 
            />
            <Folder 
              v-if="!expandedDirs.has(item.path)"
              class="h-4 w-4 text-blue-500 mr-2" 
            />
            <FolderOpen 
              v-else
              class="h-4 w-4 text-blue-500 mr-2" 
            />
            <span>{{ name }}</span>
          </div>
          
          <!-- Directory Children -->
          <template v-if="item.type === 'directory' && expandedDirs.has(item.path)">
            <FileTreeNode
              v-for="[childName, childItem] in sortTreeItems(item.children)"
              :key="childName"
              :name="childName"
              :item="childItem"
              :level="level + 1"
              :selected-file="selectedFile"
              :changed-files="changedFiles"
              :expanded-dirs="expandedDirs"
              @toggle-directory="$emit('toggle-directory', $event)"
              @file-selected="$emit('file-selected', $event)"
            />
          </template>
          
          <!-- File -->
          <div 
            v-else-if="item.type === 'file'"
            class="flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer text-sm"
            :class="{
              'bg-blue-50 border-r-2 border-blue-500': selectedFile === item.path
            }"
            :style="{ paddingLeft: (level * 12 + 20) + 'px' }"
            @click="$emit('file-selected', item.path)"
          >
            <File 
              class="h-4 w-4 mr-2"
              :class="getFileIconColor(name, changedFiles.has(item.path))"
            />
            <span class="flex-1">{{ name }}</span>
            <Badge 
              v-if="changedFiles.has(item.path)" 
              variant="secondary" 
              class="text-xs bg-orange-100 text-orange-700"
            >
              M
            </Badge>
          </div>
        </div>
      `,
      methods: {
        sortTreeItems(items) {
          return Object.entries(items).sort(([nameA, itemA], [nameB, itemB]) => {
            if (itemA.type !== itemB.type) {
              return itemA.type === 'directory' ? -1 : 1
            }
            return nameA.localeCompare(nameB)
          })
        },
        getFileIconColor(filename, isChanged) {
          if (isChanged) return 'text-orange-500'
          
          const ext = filename.split('.').pop()?.toLowerCase()
          const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico']
          const codeTypes = ['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'json', 'md', 'py', 'sh']
          
          if (imageTypes.includes(ext)) return 'text-purple-500'
          if (codeTypes.includes(ext)) return 'text-blue-500'
          return 'text-gray-500'
        }
      },
      components: {
        ChevronRight,
        ChevronDown, 
        File,
        Folder,
        FolderOpen,
        Badge
      }
    }
  }
}
</script>