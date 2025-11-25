<script setup>
import { ref, computed, watch } from 'vue';
import { TreeItem, TreeRoot } from 'reka-ui';
import { 
  Folder, 
  FolderOpen, 
  File as FileIcon, 
  FileText, 
  FileCode, 
  Image,
  Braces,
  File,
  FileAudio,
  FileVideo,
  BookText,
  FileArchive,
  ChevronRight,
  ChevronDown,
  Database,
  Loader2
} from 'lucide-vue-next';

const props = defineProps({
  // Directory responses from GitHub API calls
  directoryResponses: {
    type: Map,
    required: true
  },
  // Selected file
  modelValue: {
    type: [Object, null],
    default: null,
  },
  // Whether to show file sizes
  showSizes: {
    type: Boolean,
    default: true,
  },
  // Whether to show folders first in the tree
  showFoldersFirst: {
    type: Boolean,
    default: true,
  },
  // Loading state for specific folders
  loadingFolders: {
    type: Set,
    default: () => new Set()
  }
});

const emit = defineEmits(['update:modelValue', 'file:select', 'folder:toggle']);

// Build tree structure from directory responses
const treeData = computed(() => {
  const tree = [];
  const nodeMap = new Map();
  
  // First pass: create all nodes
  props.directoryResponses.forEach((items, dirPath) => {
    items.forEach(item => {
      const node = {
        type: item.type === 'folder' ? 'folder' : 'file',
        name: item.name,
        path: item.path,
        size: item.size || 0,
        extension: item.type === 'folder' ? '' : (item.name?.split('.').pop() || ''),
        children: item.type === 'folder' ? [] : undefined,
        download_url: item.download_url,
        _loaded: true
      };
      
      nodeMap.set(item.path, node);
    });
  });
  
  // Second pass: build tree structure
  nodeMap.forEach((node, path) => {
    if (path.includes('/')) {
      // Find parent path
      const lastSlash = path.lastIndexOf('/');
      const parentPath = path.substring(0, lastSlash);
      const parent = nodeMap.get(parentPath);
      
      if (parent && parent.children) {
        parent.children.push(node);
      } else {
        // Parent not loaded yet, add to root
        tree.push(node);
      }
    } else {
      // Root level item
      tree.push(node);
    }
  });
  
  // Sort items if needed
  const sortItems = (items) => {
    if (!props.showFoldersFirst) return items;
    
    return [...items].sort((a, b) => {
      // Folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });
  };
  
  // Sort root and all children
  const sortedTree = sortItems(tree);
  nodeMap.forEach(node => {
    if (node.children && node.children.length > 0) {
      node.children = sortItems(node.children);
    }
  });
  
  return sortedTree;
});

// Format file size for display
const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Get icon based on file extension or folder
const getFileIcon = (item, isExpanded) => {
  if (item.type === 'folder') {
    return isExpanded ? FolderOpen : Folder;
  }
  
  const ext = item.extension?.toLowerCase() || '';
  
  // Image file types
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff'].includes(ext)) {
    return Image;
  }
  
  // Code file types
  if (['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'php', 'py', 'java', 'c', 'cpp', 'go', 'rb'].includes(ext)) {
    return FileCode;
  }
  
  // Data file types
  switch (ext) {
    case 'json':
      return Braces;
    case 'csv':
    case 'xlsx':
    case 'xls':
      return File;
    case 'sqlite':
      return Database;
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
      return FileAudio;
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'webm':
    case 'mkv':
      return FileVideo;
    case 'pdf':
      return BookText;
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz':
    case '7z':
      return FileArchive;
    case 'md':
    case 'txt':
    case 'doc':
    case 'docx':
      return FileText;
    default:
      return FileIcon;
  }
};

// Handle item click
const handleItemClick = (item) => {
  if (item.type === 'file') {
    emit('update:modelValue', item);
    emit('file:select', item);
  }
};

// Handle folder toggle
const handleFolderToggle = (item, isExpanded) => {
  if (item.type === 'folder') {
    emit('folder:toggle', { folder: item, expanded: isExpanded });
  }
};

// Check if folder is loading
const isFolderLoading = (folder) => {
  return props.loadingFolders.has(folder.path);
};

// Check if item is selected
const isSelected = (item) => {
  if (!props.modelValue || item.type !== 'file') return false;
  return props.modelValue.path === item.path;
};

// Check if folder has been loaded
const isFolderLoaded = (folder) => {
  return props.directoryResponses.has(folder.path);
};
</script>

<template>
  <TreeRoot
    v-slot="{ flattenItems }"
    class="file-tree list-none select-none"
    :items="treeData"
    :get-key="item => item.path"
    :get-children="item => item.children"
  >
    <TreeItem
      v-for="item in flattenItems"
      v-slot="{ isExpanded }"
      :key="item._id"
      :style="{ 'padding-left': `${item.level * 0.75}rem` }"
      v-bind="item.bind"
      class="flex items-center justify-between py-1 px-2 my-0.5 rounded hover:bg-gray-100 outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer group"
      :class="{ 'bg-primary-100': isSelected(item.value) }"
      @click="handleItemClick(item.value)"
      @toggle="(e) => handleFolderToggle(item.value, !isExpanded)"
    >
      <div class="flex items-center overflow-hidden">
        <!-- Folder expand/collapse icon or loading spinner -->
        <div class="w-4 h-4 mr-1 flex items-center justify-center">
          <Loader2 
            v-if="item.hasChildren && isFolderLoading(item.value)" 
            class="w-3 h-3 animate-spin"
          />
          <component 
            v-else-if="item.hasChildren"
            :is="isExpanded ? ChevronDown : ChevronRight" 
            class="w-4 h-4"
          />
        </div>
        
        <!-- File/folder icon -->
        <component
          :is="getFileIcon(item.value, isExpanded)"
          class="w-4 h-4 min-w-4 mr-2"
          :class="{
            'text-blue-500': item.value.type === 'folder',
            'text-green-500': item.value.extension === 'json',
            'text-purple-500': ['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(item.value.extension),
            'text-yellow-500': ['mp3', 'wav', 'ogg'].includes(item.value.extension),
            'text-red-500': ['pdf'].includes(item.value.extension),
            'text-orange-500': ['mp4', 'mov', 'avi'].includes(item.value.extension),
            'text-gray-500': !['folder', 'json'].includes(item.value.type) && 
                           !['jpg', 'jpeg', 'png', 'gif', 'svg', 'mp3', 'wav', 'ogg', 'pdf', 'mp4', 'mov', 'avi'].includes(item.value.extension)
          }"
        />
        
        <!-- File/folder name -->
        <span class="truncate">{{ item.value.name }}</span>
        
        <!-- Show if folder hasn't been loaded yet -->
        <span 
          v-if="item.value.type === 'folder' && !isFolderLoaded(item.value) && !isExpanded" 
          class="ml-2 text-xs text-gray-400"
        >
          ...
        </span>
      </div>
      
      <!-- File/folder size -->
      <div 
        v-if="item.value.size !== undefined && item.value.type === 'file'"
        class="text-xs text-gray-500 transition-opacity whitespace-nowrap ml-2"
        :class="showSizes ? '' : 'opacity-0 group-hover:opacity-100'"
      >
        {{ formatSize(item.value.size) }}
      </div>
    </TreeItem>
  </TreeRoot>
</template>

<style scoped>
.file-tree {
  user-select: none;
  font-size: 0.875rem;
}
</style>