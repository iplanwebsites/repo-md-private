<template>
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
        class="h-3 w-3 text-gray-400 mr-1 flex-shrink-0" 
      />
      <ChevronDown 
        v-else 
        class="h-3 w-3 text-gray-400 mr-1 flex-shrink-0" 
      />
      <Folder 
        v-if="!expandedDirs.has(item.path)" 
        class="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" 
      />
      <FolderOpen 
        v-else 
        class="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" 
      />
      <span class="text-gray-700 font-medium">{{ name }}</span>
    </div>
    
    <!-- Directory Children -->
    <div v-if="item.type === 'directory' && expandedDirs.has(item.path)">
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
    </div>
    
    <!-- File -->
    <div 
      v-if="item.type === 'file'"
      class="flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer text-sm"
      :class="{
        'bg-blue-50 border-r-2 border-blue-500': selectedFile === item.path,
        'bg-orange-50': changedFiles && changedFiles.has(item.path)
      }"
      :style="{ paddingLeft: (level * 12 + 8) + 'px' }"
      @click="$emit('file-selected', item.path)"
    >
      <div class="w-4 mr-1"></div>
      <File :class="getFileIconClass(name)" class="h-4 w-4 mr-2 flex-shrink-0" />
      <span class="text-gray-600 truncate" :class="{ 'font-medium': changedFiles && changedFiles.has(item.path) }">
        {{ name }}
      </span>
      <FileEdit 
        v-if="changedFiles && changedFiles.has(item.path)" 
        class="h-3 w-3 text-orange-500 ml-1 flex-shrink-0" 
      />
    </div>
  </div>
</template>

<script setup>
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, FileEdit } from 'lucide-vue-next'

defineProps({
  name: {
    type: String,
    required: true
  },
  item: {
    type: Object,
    required: true
  },
  level: {
    type: Number,
    default: 0
  },
  selectedFile: {
    type: String,
    default: ''
  },
  changedFiles: {
    type: Set,
    default: () => new Set()
  },
  expandedDirs: {
    type: Set,
    default: () => new Set()
  }
})

defineEmits(['toggle-directory', 'file-selected'])

// File type detection and styling
const getFileIconClass = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return 'text-yellow-500'
    case 'vue':
      return 'text-green-500'
    case 'html':
      return 'text-orange-500'
    case 'css':
    case 'scss':
    case 'sass':
      return 'text-blue-500'
    case 'json':
      return 'text-purple-500'
    case 'md':
    case 'mdx':
      return 'text-gray-600'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return 'text-pink-500'
    default:
      return 'text-gray-500'
  }
}

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
</script>