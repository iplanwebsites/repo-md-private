<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useOrgStore } from '@/store/orgStore';
import { useToast } from '@/components/ui/toast/use-toast';
import trpc from '@/trpc';
import { 
  ChevronLeft, 
  Save, 
  GitBranch, 
  Loader2,
  FileText,
  Github,
  Plus
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog/index';
import LazyFileTree from '@/components/repo/LazyFileTree.vue';
import CodeBlock from '@/components/CodeBlock.vue';
import PageHeadingBar from '@/components/PageHeadingBar.vue';
import JsonDebug from '@/components/JsonDebug.vue';

const route = useRoute();
const router = useRouter();
const orgStore = useOrgStore();
const { toast } = useToast();

// Define props
const props = defineProps({
  project: {
    type: Object,
    default: null,
  },
});

// Route params and query
const orgId = computed(() => route.params.orgId);
const projectId = computed(() => route.params.projectId);
const currentBranch = ref(route.query.branch || 'main');
const selectedFilePath = ref(route.query.file || '');

// Component state
const loading = ref(false);
const saving = ref(false);
const hasUnsavedChanges = ref(false);
const fileContent = ref('');
const originalContent = ref('');
const fileSha = ref('');
const commitMessage = ref('');
const branches = ref([]);
const loadedFiles = ref([]);
const loadingBranches = ref(false);
const showNewBranchDialog = ref(false);
const newBranchName = ref('');
const creatingBranch = ref(false);
const selectKey = ref(0); // Key to force re-render of select

// Debug state
const debugInfo = ref({
  githubApiResponses: [],
  builtTree: {},
  lastError: null,
  fileContentMap: new Map()
});

// Computed property for debug data to show in JsonDebug
const debugData = computed(() => ({
  githubApiResponses: debugInfo.value.githubApiResponses,
  builtTree: debugInfo.value.builtTree,
  lastError: debugInfo.value.lastError,
  fileContentResponses: Array.from(debugInfo.value.fileContentMap.entries()).map(([k, v]) => ({ path: k, ...v })),
  currentState: {
    branch: currentBranch.value,
    selectedFile: selectedFilePath.value,
    contentLength: fileContent.value.length,
    projectId: project.value?._id || project.value?.id || projectId.value,
    repoInfo: repoInfo.value,
    branches: branches.value,
    projectGitHub: project.value?.github || project.value?.gitHub
  }
}));

// File editing state
const isEditing = ref(false);
const editedContent = ref('');

// Get current project from props
const project = computed(() => props.project);

// Repository info
const repoInfo = computed(() => {
  // Check different possible locations for GitHub info
  const github = project.value?.github || project.value?.gitHub;
  
  if (!github) {
    console.log('No GitHub info found in project:', project.value);
    return null;
  }
  
  // Handle different property names
  const fullName = github.nameWithOwner || github.fullName || github.full_name;
  const name = github.name || github.repoName;
  
  if (!fullName && !name) {
    console.log('GitHub info incomplete:', github);
    return null;
  }
  
  return {
    owner: fullName?.split('/')[0] || github.owner,
    name: name,
    fullName: fullName || `${github.owner}/${name}`
  };
});

// Determine file language for syntax highlighting
const getFileLanguage = computed(() => {
  if (!selectedFilePath.value) return 'plaintext';
  
  const extension = selectedFilePath.value.split('.').pop()?.toLowerCase();
  const extensionMap = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'vue': 'html',
    'html': 'html',
    'htm': 'html',
    'xml': 'xml',
    'css': 'css',
    'scss': 'css',
    'sass': 'css',
    'less': 'css',
    'json': 'json',
    'md': 'markdown',
    'markdown': 'markdown',
    'py': 'python',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'yml': 'yaml',
    'yaml': 'yaml',
    'txt': 'plaintext'
  };
  
  return extensionMap[extension] || 'plaintext';
});

// Check if the selected file is an image
const isImage = computed(() => {
  if (!selectedFilePath.value) return false;
  const extension = selectedFilePath.value.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff'].includes(extension || '');
});

// Image URL for display
const imageUrl = computed(() => {
  if (!isImage.value || !fileContent.value) return '';
  
  // If it's a base64 data URL, return as is
  if (fileContent.value.startsWith('data:')) {
    return fileContent.value;
  }
  
  // If we have the download_url from the file object
  const file = loadedFiles.value?.find(f => f.path === selectedFilePath.value);
  if (file?.download_url) {
    return file.download_url;
  }
  
  // Try to construct a raw GitHub URL
  if (repoInfo.value) {
    return `https://raw.githubusercontent.com/${repoInfo.value.fullName}/${currentBranch.value}/${selectedFilePath.value}`;
  }
  
  return '';
});

// Load directory contents from GitHub
const loadDirectory = async (path = '') => {
  if (!projectId.value) {
    console.error('No project ID available');
    debugInfo.value.lastError = 'No project ID available';
    return [];
  }
  
  try {
    const queryParams = {
      projectId: project.value?._id || projectId.value,
      path: path,
      ref: currentBranch.value
    };
    
    console.log('Loading directory with params:', queryParams);
    
    const result = await trpc.projects.listGitHubDirectory.query(queryParams);
    
    // Store the raw API response for debugging
    debugInfo.value.githubApiResponses.push({
      path,
      params: queryParams,
      response: result,
      timestamp: new Date().toISOString()
    });
    
    if (result.success && result.directory) {
      const items = result.directory.items.map(item => {
        // Better folder detection
        const isFolder = item.type === 'dir' || item.type === 'tree';
        
        // For FileTree component compatibility, ensure folders have children array
        const mappedItem = {
          ...item,
          type: isFolder ? 'folder' : 'file',
          path: item.path,
          name: item.name,
          size: item.size || 0,
          extension: isFolder ? '' : (item.name.split('.').pop() || ''),
          download_url: item.download_url,
          // Add empty children array for folders so FileTree recognizes them
          ...(isFolder ? { children: [] } : {})
        };
        
        // Update the built tree structure for debugging
        if (!debugInfo.value.builtTree[path]) {
          debugInfo.value.builtTree[path] = [];
        }
        debugInfo.value.builtTree[path].push(mappedItem);
        
        return mappedItem;
      });
      
      // Store files for image URL lookup
      loadedFiles.value = [...loadedFiles.value, ...items];
      
      return items;
    }
    return [];
  } catch (error) {
    console.error('Error loading directory:', error);
    debugInfo.value.lastError = error.message || 'Failed to load directory contents';
    toast({
      title: 'Error loading files',
      description: error.message || 'Failed to load directory contents',
      variant: 'destructive',
    });
    return [];
  }
};

// Fetch file content
const fetchFileContent = async (filePath) => {
  console.log('fetchFileContent called with:', filePath);
  console.log('projectId.value:', projectId.value);
  console.log('project.value:', project.value);
  
  if (!filePath) {
    console.warn('No filePath provided');
    return;
  }
  
  if (!projectId.value && !project.value?._id) {
    console.error('No project ID available');
    debugInfo.value.lastError = 'No project ID available';
    return;
  }
  
  // Clear previous content to ensure reactivity
  fileContent.value = '';
  originalContent.value = '';
  editedContent.value = '';
  fileSha.value = '';
  
  // For images, we don't need to fetch content, just use the URL
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff'].includes(ext || '')) {
    loading.value = false;
    // Force update for image display
    fileContent.value = 'IMAGE_FILE';
    return;
  }
  
  loading.value = true;
  try {
    const queryParams = {
      projectId: project.value?._id || project.value?.id || projectId.value,
      path: filePath.startsWith('/') ? filePath.slice(1) : filePath,
      ref: currentBranch.value
    };
    
    console.log('Fetching file content with params:', queryParams);
    
    const result = await trpc.projects.getGitHubFileContent.query(queryParams);
    
    // Store in debug info
    debugInfo.value.fileContentMap.set(filePath, {
      params: queryParams,
      response: result,
      timestamp: new Date().toISOString()
    });
    
    console.log('GitHub file content result:', result);
    
    if (result.success && result.file) {
      // Use Vue's nextTick to ensure reactivity
      await nextTick();
      fileContent.value = result.file.content || '';
      originalContent.value = result.file.content || '';
      fileSha.value = result.file.sha || '';
      editedContent.value = result.file.content || '';
      hasUnsavedChanges.value = false;
      console.log('File content set, length:', fileContent.value.length);
    } else {
      console.error('Failed to fetch file content:', result);
      debugInfo.value.lastError = `Failed to fetch file content: ${result.error || 'Unknown error'}`;
    }
  } catch (error) {
    console.error('Error fetching file:', error);
    debugInfo.value.lastError = error.message || 'Failed to load file content';
    toast({
      title: 'Error loading file',
      description: error.message || 'Failed to load file content',
      variant: 'destructive',
    });
  } finally {
    loading.value = false;
  }
};

const projectGithubInfo = computed(() => props.project?.github || null);

// Save file changes
const saveFile = async () => {
  if (!selectedFilePath.value || !projectId.value || !hasUnsavedChanges.value) return;
  
  saving.value = true;
  try {
    const message = commitMessage.value.trim() || `Update ${selectedFilePath.value.split('/').pop()}`;
    
    const result = await trpc.projects.updateGitHubFile.mutate({
      projectId: project.value?._id || projectId.value,
      path: selectedFilePath.value.startsWith('/') ? selectedFilePath.value.slice(1) : selectedFilePath.value,
      content: editedContent.value,
      message: message,
      branch: currentBranch.value,
      sha: fileSha.value
    });
    
    if (result.success) {
      toast({
        title: 'Success',
        description: 'File saved successfully',
        duration: 3000,
      });
      fileSha.value = result.content.sha;
      originalContent.value = editedContent.value;
      fileContent.value = editedContent.value;
      hasUnsavedChanges.value = false;
      commitMessage.value = '';
      isEditing.value = false;
    }
  } catch (error) {
    console.error('Error saving file:', error);
    toast({
      title: 'Error saving file',
      description: error.message || 'Failed to save file',
      variant: 'destructive',
    });
  } finally {
    saving.value = false;
  }
};

// Handle file selection
const handleFileSelect = (file) => {
  if (hasUnsavedChanges.value) {
    if (!confirm('You have unsaved changes. Do you want to discard them?')) {
      return;
    }
  }
  
  selectedFilePath.value = file.path;
  router.push({
    query: {
      ...route.query,
      file: file.path
    }
  });
  // Immediately fetch content in case watcher doesn't trigger
  fetchFileContent(file.path);
};

// Load branches from GitHub
const loadBranches = async () => {
  const pid = project.value?._id || project.value?.id || projectId.value;
  console.log('loadBranches called, projectId:', pid, 'project:', project.value);
  
  if (!pid || loadingBranches.value) {
    console.log('Skipping loadBranches - no projectId or already loading');
    return;
  }
  
  loadingBranches.value = true;
  try {
    console.log('Fetching branches for project:', pid);
    const result = await trpc.projects.listGitHubBranches.query({
      projectId: pid
    });
    
    console.log('Branches API result:', result);
    
    if (result.success && result.branches) {
      branches.value = result.branches.map(branch => ({
        value: branch.name,
        label: branch.name,
        protected: branch.protected
      }));
      console.log('Branches loaded:', branches.value);
    }
  } catch (error) {
    console.error('Error loading branches:', error);
    toast({
      title: 'Error loading branches',
      description: error.message || 'Failed to load branches',
      variant: 'destructive',
    });
  } finally {
    loadingBranches.value = false;
  }
};

// Create a new branch
const createNewBranch = async () => {
  if (!newBranchName.value.trim() || creatingBranch.value) return;
  
  creatingBranch.value = true;
  try {
    const result = await trpc.projects.createGitHubBranch.mutate({
      projectId: project.value?._id || projectId.value,
      branchName: newBranchName.value.trim(),
      fromBranch: currentBranch.value
    });
    
    if (result.success) {
      toast({
        title: 'Success',
        description: `Branch "${newBranchName.value}" created successfully`,
        duration: 3000,
      });
      
      // Add the new branch to the list
      branches.value.push({
        value: result.branch.branch,
        label: result.branch.branch,
        protected: false
      });
      
      // Switch to the new branch
      handleBranchChange(result.branch.branch);
      
      // Close dialog and reset
      showNewBranchDialog.value = false;
      newBranchName.value = '';
    }
  } catch (error) {
    console.error('Error creating branch:', error);
    toast({
      title: 'Error creating branch',
      description: error.message || 'Failed to create branch',
      variant: 'destructive',
    });
  } finally {
    creatingBranch.value = false;
  }
};

// Handle branch change
const handleBranchChange = async (newBranch, fromRoute = false) => {
  console.log('handleBranchChange called with:', newBranch, 'current:', currentBranch.value);
  
  // Check if it's the new branch option
  if (newBranch === '__new_branch__') {
    showNewBranchDialog.value = true;
    return;
  }
  
  if (hasUnsavedChanges.value) {
    if (!confirm('You have unsaved changes. Do you want to discard them?')) {
      console.log('Branch change cancelled, keeping current branch:', currentBranch.value);
      // Force the select to re-render with the current value
      selectKey.value++;
      return;
    }
  }
  
  // Update current branch
  currentBranch.value = newBranch;
  console.log('Branch updated to:', currentBranch.value);
  
  // Clear all cached data
  loadedFiles.value = [];
  debugInfo.value.builtTree = {};
  debugInfo.value.fileContentMap.clear();
  
  // Clear file content
  fileContent.value = '';
  originalContent.value = '';
  editedContent.value = '';
  fileSha.value = '';
  hasUnsavedChanges.value = false;
  isEditing.value = false;
  
  // Update route only if not called from route watcher
  if (!fromRoute) {
    router.push({
      query: {
        ...route.query,
        branch: newBranch
      }
    });
  }
  
  // Reload file content if a file was selected
  if (selectedFilePath.value) {
    await fetchFileContent(selectedFilePath.value);
  }
};

// Start editing
const startEditing = () => {
  isEditing.value = true;
  editedContent.value = fileContent.value;
};

// Cancel editing
const cancelEditing = () => {
  if (hasUnsavedChanges.value) {
    if (!confirm('You have unsaved changes. Do you want to discard them?')) {
      return;
    }
  }
  isEditing.value = false;
  editedContent.value = originalContent.value;
  hasUnsavedChanges.value = false;
};

// Handle image load error
const handleImageError = (event) => {
  console.error('Failed to load image:', selectedFilePath.value);
  event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+SW1hZ2UgZmFpbGVkIHRvIGxvYWQ8L3RleHQ+Cjwvc3ZnPg==';
};

// Watch for content changes
watch(editedContent, (newContent) => {
  hasUnsavedChanges.value = newContent !== originalContent.value;
});

// Watch for route changes
watch(() => route.query.file, (newFile) => {
  if (newFile) {
    selectedFilePath.value = newFile;
    fetchFileContent(newFile);
  }
}, { immediate: true });

watch(() => route.query.branch, async (newBranch) => {
  if (newBranch && newBranch !== currentBranch.value) {
    // Use the handleBranchChange function to ensure proper cleanup
    await handleBranchChange(newBranch, true);
  }
});

// Watch for project changes to reload branches
watch(() => project.value, (newProject) => {
  console.log('Project changed:', newProject);
  if (newProject?._id) {
    console.log('Loading branches for project:', newProject._id);
    loadBranches();
  }
}, { immediate: true, deep: true });

// Initialize
onMounted(async () => {
  console.log('ProjectSourceEditor mounted');
  console.log('Props:', props);
  console.log('Project from props:', project.value);
  console.log('ProjectId from route:', projectId.value);
  
  // The watcher with immediate: true will handle loading branches when project is available
});

// Prevent navigation if there are unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges.value) {
    e.preventDefault();
    e.returnValue = '';
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <PageHeadingBar 
      title="Source Editor"
      :subtitle="repoInfo ? `Editing files in ${repoInfo.fullName}` : 'Edit your project files'"
    >

          <template #actions>
        <div class="flex items-center space-x-3">
          <a 
            v-if="projectGithubInfo" 
            :href="`https://github.com/${projectGithubInfo.fullName}`" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github class="h-4 w-4 mr-2" />
              View on github
            </Button>
          </a>
          
     

     
        </div>
      </template>


 
    </PageHeadingBar>

    <div class="container mx-auto px-4 py-6">
      <!-- Debug Panel -->
      <JsonDebug 
        :data="debugData" 
        label="Source Editor Debug Info"
        :showInProd="false"
        class="mb-4"
      />
      
      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <div class="flex h-[calc(100vh-200px)]">
          <!-- File tree sidebar -->
          <div class="w-80 border-r bg-gray-50 overflow-hidden flex flex-col">
            <!-- Branch selector -->
            <div class="p-4 border-b">
              <div class="flex items-center gap-2">
                <GitBranch class="w-4 h-4 text-muted-foreground" />
                <Select
                  :modelValue="currentBranch"
                  @update:modelValue="handleBranchChange"
                  class="flex-1"
                  :disabled="loadingBranches"
                >
                  <SelectTrigger class="h-8">
                    <SelectValue :placeholder="loadingBranches ? 'Loading branches...' : currentBranch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem 
                      v-for="branch in branches" 
                      :key="branch.value" 
                      :value="branch.value"
                    >
                      {{ branch.label }}
                      <span v-if="branch.protected" class="ml-2 text-xs text-muted-foreground">(protected)</span>
                    </SelectItem>
                    <SelectItem 
                      value="__new_branch__"
                      class="border-t mt-1 pt-1"
                    >
                      <div class="flex items-center gap-2">
                        <Plus class="h-3 w-3" />
                        <span>New branch</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
        
            <!-- File list -->
            <div class="flex-1 overflow-y-auto p-4">
              <LazyFileTree
                :key="`tree-${currentBranch}`"
                :rootPath="''"
                :selectedFile="{ path: selectedFilePath }"
                :loadDirectory="loadDirectory"
                @select="handleFileSelect"
              />
            </div>
          </div>

          <!-- Editor area -->
          <div class="flex-1 flex flex-col overflow-hidden bg-white">
            <!-- File header -->
            <div v-if="selectedFilePath" class="border-b bg-gray-50">
              <div class="flex items-center justify-between px-6 py-3">
                <div class="flex items-center gap-2">
                  <FileText class="w-4 h-4 text-muted-foreground" />
                  <span class="font-medium">{{ selectedFilePath }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <a 
                    v-if="repoInfo && selectedFilePath" 
                    :href="`https://github.com/${repoInfo.fullName}/blob/${currentBranch}/${selectedFilePath}`" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <Github class="h-4 w-4 mr-2" />
                      View on GitHub
                    </Button>
                  </a>
                  <Button
                    v-if="!isEditing && !isImage"
                    @click="startEditing"
                    variant="default"
                    size="sm"
                  >
                    Edit
                  </Button>
                  <template v-else>
                    <Button
                      @click="cancelEditing"
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      @click="saveFile"
                      :disabled="!hasUnsavedChanges || saving"
                      variant="default"
                      size="sm"
                    >
                      <Loader2 v-if="saving" class="w-4 h-4 mr-1 animate-spin" />
                      <Save v-else class="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </template>
                </div>
              </div>
              
              <!-- Commit message input -->
              <div v-if="isEditing && hasUnsavedChanges" class="px-6 pb-3">
                <Input
                  v-model="commitMessage"
                  placeholder="Commit message (optional)"
                  class="max-w-md"
                />
              </div>
            </div>

            <!-- File content -->
            <div class="flex-1 overflow-hidden">
              <div v-if="loading" class="flex items-center justify-center h-full">
                <Loader2 class="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
              
              <div v-else-if="!selectedFilePath" class="flex items-center justify-center h-full">
                <div class="text-center">
                  <FileText class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p class="text-muted-foreground">Select a file to edit</p>
                </div>
              </div>
              
              <div v-else-if="isEditing && !isImage" class="h-full p-4">
                <Textarea
                  v-model="editedContent"
                  class="w-full h-full font-mono text-sm resize-none"
                  :placeholder="'Enter ' + getFileLanguage + ' code here...'"
                />
              </div>
              
              <div v-else-if="isImage" class="h-full overflow-auto p-8 bg-gray-50">
                <div class="flex items-center justify-center h-full">
                  <img 
                    :src="imageUrl"
                    :alt="selectedFilePath"
                    class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    @error="handleImageError"
                  />
                </div>
              </div>
              
              <div v-else class="h-full overflow-auto">
                <CodeBlock
                  :key="`${selectedFilePath}-${fileContent.length}`"
                  :code="fileContent"
                  :language="getFileLanguage"
                  maxHeight="100%"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- New Branch Dialog -->
    <Dialog v-model:open="showNewBranchDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Branch</DialogTitle>
          <DialogDescription>
            Create a new branch from the current branch ({{ currentBranch }})
          </DialogDescription>
        </DialogHeader>
        
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <label for="branch-name" class="text-sm font-medium">
              Branch name
            </label>
            <Input
              id="branch-name"
              v-model="newBranchName"
              placeholder="feature/new-feature"
              @keyup.enter="createNewBranch"
              :disabled="creatingBranch"
            />
            <p class="text-xs text-muted-foreground">
              Use descriptive names like feature/, fix/, or docs/ prefixes
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            @click="showNewBranchDialog = false"
            :disabled="creatingBranch"
          >
            Cancel
          </Button>
          <Button
            @click="createNewBranch"
            :disabled="!newBranchName.trim() || creatingBranch"
          >
            <Loader2 v-if="creatingBranch" class="mr-2 h-4 w-4 animate-spin" />
            Create Branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>