// fileTree.vue

<script setup>
import { ref, computed } from 'vue';
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
  ChevronDown,Database
} from 'lucide-vue-next';

const props = defineProps({
  // Files list (can be flat structure, will be transformed to tree)
  files: {
    type: Array,
    default: () => [],
  },
  // Initial set of expanded folder paths
  defaultExpanded: {
    type: Array,
    default: () => [],
  },
  // Selected file path
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
  }
});

const emit = defineEmits(['update:modelValue', 'file:select', 'folder:toggle']);

// Convert flat file list to hierarchical tree structure
const treeData = computed(() => {
  const tree = [];
  const folderMap = {};
  const folderSizes = {};
  
  // Process all files to build folder structure and calculate folder sizes
  props.files.forEach(file => {
    // Get folder structure from path or from folder array if available
    const pathParts = file.folder ? [...file.folder, file.filename] : file.path.split('/');
    const fileName = pathParts.pop();
    
    // Track folder path and add file size to all parent folders
    let currentPath = '';
    
    // Process each folder in the path
    pathParts.forEach((folder, i) => {
      const prevPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${folder}` : folder;
      
      // Add size to folder total
      if (!folderSizes[currentPath]) {
        folderSizes[currentPath] = 0;
      }
      folderSizes[currentPath] += file.size || 0;
      
      // Create folder in tree if it doesn't exist
      if (!folderMap[currentPath]) {
        const folderNode = {
          type: 'folder',
          name: folder,
          path: currentPath,
          children: []
        };
        
        if (prevPath) {
          // Add to parent folder
          if (folderMap[prevPath]) {
            folderMap[prevPath].children.push(folderNode);
          }
        } else {
          // Add to root
          tree.push(folderNode);
        }
        
        folderMap[currentPath] = folderNode;
      }
    });
    
    // Add file to its parent folder or to root
    const fileNode = {
      type: 'file',
      name: fileName,
      path: file.path,
      size: file.size || 0,
      extension: file.extension || fileName.split('.').pop() || ''
    };
    
    if (currentPath) {
      folderMap[currentPath].children.push(fileNode);
    } else {
      tree.push(fileNode);
    }
  });
  
  // Update folder sizes
  Object.keys(folderMap).forEach(path => {
    folderMap[path].size = folderSizes[path] || 0;
  });
  
  // Sort the tree items if showFoldersFirst is enabled
  const sortTreeItems = (items) => {
    if (!props.showFoldersFirst) return items;
    
    return [...items].sort((a, b) => {
      // First, sort by type: folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      
      // Then sort alphabetically within each type
      return a.name.localeCompare(b.name);
    });
  };
  
  // Sort the root level and all folder children
  const sortedTree = sortTreeItems(tree);
  
  // Also sort all folder children
  if (props.showFoldersFirst) {
    Object.values(folderMap).forEach(folder => {
      if (folder.children && folder.children.length > 0) {
        folder.children = sortTreeItems(folder.children);
      }
    });
  }
  
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
  
  // Map extensions to icons
  const ext = item.extension?.toLowerCase() || '';
  
  // Image file types
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff'].includes(ext)) {
    return Image;
  }
  
  // Code file types
  if (['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'php', 'py', 'java', 'c', 'cpp', 'go', 'rb'].includes(ext)) {
    return FileCode;
  }
  
  // Data file types with specific icons
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

// Handle file selection
const handleSelect = (item) => {
  if (item.type === 'file') {
    emit('update:modelValue', item);
    emit('file:select', item);
  }
};

// Handle folder toggle
const handleFolderToggle = (item, isExpanded) => {
  emit('folder:toggle', { folder: item, expanded: isExpanded });
};

// Check if an item is the currently selected file
const isSelected = (item) => {
  if (!props.modelValue || item.type !== 'file') return false;
  return props.modelValue.path === item.path;
};
</script>

<template>
  <TreeRoot
    v-slot="{ flattenItems }"
    class="file-tree list-none select-none"
    :items="treeData"
    :get-key="item => item.path"
    :get-children="item => item.children"
    :default-expanded="defaultExpanded"
  >
    <TreeItem
      v-for="item in flattenItems"
      v-slot="{ isExpanded }"
      :key="item._id"
      :style="{ 'padding-left': `${item.level * 0.75}rem` }"
      v-bind="item.bind"
      class="flex items-center justify-between py-1 px-2 my-0.5 rounded hover:bg-gray-100 outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer group"
      :class="{ 'bg-gray-200': isSelected(item.value) }"
      @click="handleSelect(item.value)"
      @toggle="(e) => handleFolderToggle(item.value, !isExpanded)"
    >
      <div class="flex items-center overflow-hidden">
        <component 
          :is="item.hasChildren ? (isExpanded ? ChevronDown : ChevronRight) : null" 
          class="w-4 h-4 mr-1"
          v-if="item.hasChildren"
        />
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
        <span class="truncate">{{ item.value.name }}</span>
      </div>
      
      <!-- File/folder size that appears on hover or permanently if showSizes is true -->
      <div 
        v-if="item.value.size !== undefined"
        class="text-xs text-gray-500 transition-opacity whitespace-nowrap"
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