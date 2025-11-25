<script setup>
import { ref, computed, inject, onMounted, watch } from "vue";
import { useOrgStore } from "@/store/orgStore";
import {
  Search,
  User,
  Folder,
  File,
  FileText,
  FileCode,
  FolderOpen,
  RefreshCw,
  Loader,
  ExternalLink,
  ClipboardCopy,
  Github,
  Edit
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRouter, useRoute } from "vue-router";
import FileTree from "@/components/repo/FileTree.vue";
import EmptyStateMsg from "@/components/EmptyStateMsg.vue";
import CodeBlock from "@/components/CodeBlock.vue";
import trpc from "@/trpc";

// Define props from parent
const props = defineProps({
  deployment: {
    type: Object,
    required: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: [String, Object, null],
    default: null,
  },
  repoClient: {
    type: Object,
    default: null,
  },
  project: {
    type: Object,
    default: null,
  },
});

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();
const route = useRoute();

// File list state
const sourceFiles = ref([]);
const distFiles = ref([]);
const fileListLoading = ref(false);
const fileListError = ref(null);
const activeTab = ref("dist"); // source or dist (default to dist)
const selectedFile = ref(null);
const fileContent = ref(null);
const fileContentLoading = ref(false);
const expandedFolders = ref({});

// Remote file loading configuration
const LOAD_REMOTE_FILES = ref(true); // Flag to enable/disable remote file loading
const MAX_FILE_SIZE_KB = 500; // Maximum file size in KB for remote loading

// Fetch source files list
const fetchSourceFiles = async () => {
  if (!props.repoClient) return;

  fileListLoading.value = true;
  fileListError.value = null;

  try {
    sourceFiles.value = await props.repoClient.getSourceFilesList();
  } catch (err) {
    console.error("Error fetching source files:", err);
    fileListError.value = err.message || "Failed to load source files";
  } finally {
    fileListLoading.value = false;
  }
};

// Fetch dist files list
const fetchDistFiles = async () => {
  if (!props.repoClient) return;

  fileListLoading.value = true;
  fileListError.value = null;

  try {
    distFiles.value = await props.repoClient.getDistFilesList();
  } catch (err) {
    console.error("Error fetching dist files:", err);
    fileListError.value = err.message || "Failed to load distribution files";
  } finally {
    fileListLoading.value = false;
  }
};

// Handle folder toggle from FileTree component
const handleFolderToggle = ({ folder, expanded }) => {
  expandedFolders.value[folder.path] = expanded;
};

// Load file content from GitHub
const loadGithubFileContent = async (file) => {
  // Debug logging
  console.log("=== GitHub File Loading Debug ===");
  console.log("props.project:", props.project);
  console.log("props.deployment:", props.deployment);
  console.log("file:", file);
  console.log("repoBranch.value:", repoBranch.value);
  
  // Check all possible project ID locations
  console.log("Possible project IDs:");
  console.log("- props.project?.id:", props.project?.id);
  console.log("- props.project?._id:", props.project?._id);
  console.log("- props.project?.projectId:", props.project?.projectId);
  console.log("- props.deployment?.projectId:", props.deployment?.projectId);
  console.log("- props.deployment?.project?.id:", props.deployment?.project?.id);
  
  // Try to find the correct project ID
  const projectId = props.project?.id || 
                   props.project?._id || 
                   props.project?.projectId || 
                   props.deployment?.projectId || 
                   props.deployment?.project?.id;
  
  console.log("Selected projectId:", projectId);
  console.log("file.path:", file.path);
  
  if (!projectId || !file.path) {
    throw new Error(`Project ID or file path not available. ProjectId: ${projectId}, FilePath: ${file.path}`);
  }

  try {
    const opt = {
      projectId: projectId,
      path: file.path,
      ref: repoBranch.value || "main"
    }
    console.log("Loading GitHub file content with options:", opt);
    const result = await trpc.projects.getGitHubFileContent.query(opt);

    if (!result.success) {
      throw new Error("Failed to fetch file from GitHub");
    }

    const githubFile = result.file;
    
    // Check if it's a directory
    if (githubFile.type === "dir") {
      throw new Error("Selected item is a directory, not a file");
    }

    // Check file size (GitHub API returns size in bytes)
    const fileSizeKB = githubFile.size / 1024;
    if (fileSizeKB > MAX_FILE_SIZE_KB) {
      throw new Error(`File is too large (${Math.round(fileSizeKB)}KB). Maximum size is ${MAX_FILE_SIZE_KB}KB.`);
    }

    // Return the file content
    return githubFile.content || "";
  } catch (error) {
    console.error("Error loading GitHub file content:", error);
    throw error;
  }
};

// Select a file to view
const selectFile = async (file) => {
  // Extract file extension if not already available
  if (!file.extension && file.path) {
    const parts = file.path.split('.');
    if (parts.length > 1) {
      file.extension = parts[parts.length - 1].toLowerCase();
    }
  }

  selectedFile.value = file;
  fileContentLoading.value = true;
  fileContent.value = null;

  try {
    if (!props.repoClient) {
      throw new Error("Repository client not initialized");
    }

    if (activeTab.value === "source") {
      // For source files, conditionally load content from GitHub if flag is enabled
      if (LOAD_REMOTE_FILES.value) {
        try {
          const content = await loadGithubFileContent(file);
          fileContent.value = content;
        } catch (error) {
          console.warn("Failed to load remote file content:", error.message);
          fileContent.value = `Error loading remote file: ${error.message}`;
        }
      } else {
        // Traditional behavior - no content loading
        fileContent.value = null;
      }
      fileContentLoading.value = false;
      return;
    }
    
    // Get the URL for dist files - ensure path has a leading slash
    const filePath = file.path?.startsWith("/") ? file.path : `/${file.path}`;
    const fileUrl = await props.repoClient.getR2Url(filePath);

    // Fetch the file content
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    // Handle different file types
    const contentType = response.headers.get("content-type");
    selectedFile.value.contentType = contentType;
    
    // Check if file is large (more than 1MB)
    const contentLength = response.headers.get("content-length");
    const ONE_MEGABYTE = 1024 * 1024; // 1MB in bytes
    selectedFile.value.isLargeFile = contentLength && Number.parseInt(contentLength, 10) > ONE_MEGABYTE;
    
    // If the file is too large, don't even try to load its content
    if (selectedFile.value.isLargeFile) {
      fileContent.value = null;
      return;
    }

    if (contentType?.includes("application/json")) {
      try {
        const jsonData = await response.json();
        fileContent.value = JSON.stringify(jsonData, null, 2);
      } catch (e) {
        // If JSON parsing fails, just return as text
        console.error("Error parsing JSON:", e);
        fileContent.value = await response.text();
      }
    } else if (
      contentType &&
      (contentType.includes("text") ||
        contentType.includes("javascript") ||
        contentType.includes("css"))
    ) {
      fileContent.value = await response.text();
    } else {
      // For binary files, just set a flag - we'll show the empty state component instead
      fileContent.value = null;
    }
  } catch (err) {
    console.error(`Error fetching file content for ${file.path}:`, err);
    fileContent.value = `Error loading file: ${err.message || "Unknown error"}`;
  } finally {
    fileContentLoading.value = false;
  }
};

// Download or view the current file
const downloadFile = async () => {
  if (activeTab.value === "source") {
    // For source files, redirect to GitHub
    
    // If a file is selected, open that specific file on GitHub
    if (selectedFile.value && githubFileUrl.value) {
      window.open(githubFileUrl.value, "_blank");
    } else {
      // Otherwise open the repository root
      window.open(repoUrl.value || "https://github.com/", "_blank");
    }
    return;
  }
  
  // For dist files
  if (!selectedFile.value || !props.repoClient) return;

  try {
    // Extract file name from path
    const fileName = selectedFile.value.path.split("/").pop();
    
    // For dist files, download from the R2 URL - ensure path has a leading slash
    const filePath = selectedFile.value.path.startsWith("/")
      ? selectedFile.value.path
      : `/${selectedFile.value.path}`;
    const fileUrl = await props.repoClient.getR2Url(filePath);

    // Create a temporary anchor element
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.target = "_blank";

    // Append to body, click and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Error accessing file:", err);
    // Could add toast notification here
  }
};

// Navigate to the file editor
const editFile = () => {
  if (!selectedFile.value || activeTab.value !== "source") return;
  
  const branch = repoBranch.value || "main";
  const filePath = selectedFile.value.path;
  
  // Get orgId and projectId from route params
  const orgId = route.params.orgId;
  const projectId = route.params.projectId;
  
  // Navigate to the source editor with query params
  router.push({
    path: `/${orgId}/${projectId}/source`,
    query: {
      branch: branch,
      file: filePath
    }
  });
};

// Refresh file list
const refreshFiles = () => {
  if (activeTab.value === "source") {
    fetchSourceFiles();
  } else {
    fetchDistFiles();
  }
};

// Switch between source and dist tabs
const switchTab = (tab) => {
  activeTab.value = tab;
  selectedFile.value = null;
  fileContent.value = null;

  if (
    tab === "source" &&
    (!sourceFiles.value || sourceFiles.value.length === 0)
  ) {
    fetchSourceFiles();
  } else if (
    tab === "dist" &&
    (!distFiles.value || distFiles.value.length === 0)
  ) {
    fetchDistFiles();
  }
};

// Watch for changes in the repoClient prop
watch(
  () => props.repoClient,
  () => {
    if (props.repoClient) {
      refreshFiles();
    }
  },
  { immediate: true },
);

// Watch for changes in LOAD_REMOTE_FILES flag
watch(
  () => LOAD_REMOTE_FILES.value,
  (newValue) => {
    // If we have a selected file in the source tab, reload it
    if (activeTab.value === "source" && selectedFile.value) {
      selectFile(selectedFile.value);
    }
  }
);

// Initialize on component mount
onMounted(() => {
  // Debug logging for component props
  console.log("=== DeploySource Component Mounted ===");
  console.log("props.project:", props.project);
  console.log("props.deployment:", props.deployment);
  console.log("props.repoClient:", props.repoClient);
  
  if (props.repoClient) {
    fetchDistFiles(); // Load distribution files by default
  }
});

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);

// Get currently active files list based on active tab
const activeFiles = computed(() => {
  return activeTab.value === "source" ? sourceFiles.value : distFiles.value;
});

// Get expanded folders from expandedFolders state
const expandedKeys = computed(() => {
  return Object.keys(expandedFolders.value).filter(key => expandedFolders.value[key]);
});

// Get repository URL from props
const repoUrl = computed(() => {
  // Try to get the URL from different sources in order of preference
  if (props.deployment.repoUrl) {
    return props.deployment.repoUrl;
  }
  
  if (props.project?.github?.fullName) {
    return `https://github.com/${props.project.github.fullName}`;
  }
  
  return null;
});

// Determine the repository branch
const repoBranch = computed(() => {
  return props.deployment.source?.branch || 
         props.project?.github?.defaultBranch || 
         "main";
});

// Compute GitHub URL for the selected file
const githubFileUrl = computed(() => {
  if (!selectedFile.value || !repoUrl.value) return null;
  
  return `${repoUrl.value}/blob/${repoBranch.value}/${selectedFile.value.path}`;
});

// Determine the language for syntax highlighting based on file extension
const getFileLanguage = computed(() => {
  if (!selectedFile.value || !selectedFile.value.extension) return 'plaintext';
  
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
    'txt': 'plaintext'
  };
  
  return extensionMap[selectedFile.value.extension.toLowerCase()] || 'plaintext';
});
</script>

<template>

  <json-debug :data="distFiles" />
  <PageHeadingBar title="Source" subtitle="Browse source files of your project">
        <template #actions>
        <a :href="repoUrl" target="_blank" rel="noopener noreferrer" v-if="repoUrl">
          <Button
            variant="outline"
            size="sm"
            class="shrink-0"
          >
            <Github class="w-4 h-4" />
            <span class="ml-2">View source on Github  </span>
          </Button>
        </a>
    </template>

    <!--
    <Button
      @click="refreshFiles"
      :disabled="fileListLoading"
      variant="outline"
      class="ml-auto"
    >
      <RefreshCw v-if="!fileListLoading" class="w-4 h-4 mr-2" />
      <Loader v-else class="w-4 h-4 mr-2 animate-spin" />
      Refresh
    </Button> -->
  </PageHeadingBar>

  <div class="container mt-4">
    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <!-- Tab navigation -->
      <div class="flex items-center justify-between border-b border-gray-200">
        <div class="flex">
          <button
            class="px-4 py-2 text-sm font-medium transition-colors focus:outline-none"
            :class="
              activeTab === 'dist'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            "
            @click="switchTab('dist')"
          >
            Distribution Files
          </button>
          <button
            class="px-4 py-2 text-sm font-medium transition-colors focus:outline-none"
            :class="
              activeTab === 'source'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            "
            @click="switchTab('source')"
          >
            Source Files
          </button>
        </div>
        
        <!-- Remote file loading toggle (only show for source tab) -->
        <div v-if="activeTab === 'source'" class="flex items-center gap-2 px-4 py-2">
          <label for="remote-files-toggle" class="text-sm text-gray-600">
            Load remote files
          </label>
          <Switch 
            id="remote-files-toggle"
            v-model:checked="LOAD_REMOTE_FILES" 
            :disabled="!props.project?.id"
          />
        </div>
      </div>

      <!-- Main content -->
      <div class="flex">
        <!-- File explorer sidebar -->
        <div
          class="w-1/3 border-r border-gray-200 h-[70vh] overflow-y-auto p-3"
        >
          <!-- Loading state -->
          <div
            v-if="fileListLoading"
            class="flex flex-col items-center justify-center h-32"
          >
            <Loader class="w-6 h-6 text-blue-500 animate-spin mb-2" />
            <span class="text-sm text-gray-500">Loading files...</span>
          </div>

          <!-- Error state -->
          <div v-else-if="fileListError" class="p-3 text-red-500">
            <p>Error loading files: {{ fileListError }}</p>
            <Button
              @click="refreshFiles"
              variant="outline"
              size="sm"
              class="mt-2"
            >
              Try Again
            </Button>
          </div>

          <!-- Empty state -->
          <div
            v-else-if="
              (activeTab === 'source' &&
                (!sourceFiles || sourceFiles.length === 0)) ||
              (activeTab === 'dist' && (!distFiles || distFiles.length === 0))
            "
            class="flex flex-col items-center justify-center h-32 text-center"
          >
            <FileText class="w-8 h-8 text-gray-300 mb-2" />
            <span class="text-sm text-gray-500"
              >No {{ activeTab }} files found</span
            >
          </div>

          <!-- File tree using the new component -->
          <FileTree
            v-else
            v-model="selectedFile"
            :files="activeFiles"
            :default-expanded="expandedKeys"
            :show-folders-first="true"
            @file:select="selectFile"
            @folder:toggle="handleFolderToggle"
          />
        </div>

        <!-- File content viewer -->
        <div class="w-2/3 h-[70vh] overflow-auto p-4">
          <!-- Source tab content -->
          <div v-if="activeTab === 'source'" class="h-full flex flex-col">
            <!-- No file selected -->
            <div
              v-if="!selectedFile"
              class="flex flex-col items-center justify-center h-full text-center"
            >
              <FileText class="w-12 h-12 text-gray-300 mb-2" />
              <h3 class="text-lg font-medium mb-1">No File Selected</h3>
              <p class="text-sm text-gray-500">
                Select a file from the sidebar to view its contents
                <span v-if="LOAD_REMOTE_FILES">(loaded from GitHub)</span>
              </p>
            </div>

            <!-- File content loading -->
            <div
              v-else-if="fileContentLoading"
              class="flex flex-col items-center justify-center h-full"
            >
              <Loader class="w-8 h-8 text-blue-500 animate-spin mb-2" />
              <span class="text-sm text-gray-500">Loading file content from GitHub...</span>
            </div>

            <!-- Show file content if LOAD_REMOTE_FILES is enabled and content is available -->
            <template v-else-if="LOAD_REMOTE_FILES && fileContent && !fileContent.startsWith('Error loading')">
              <div class="h-full">
                <div class="flex items-center mb-3 pb-2 border-b">
                  <component
                    :is="selectedFile.type === 'file' ? 
                      (selectedFile.extension === 'js' || selectedFile.extension === 'ts' || 
                       selectedFile.extension === 'vue' || selectedFile.extension === 'jsx' || 
                       selectedFile.extension === 'tsx' ? FileCode : 
                       selectedFile.extension === 'md' || selectedFile.extension === 'txt' || 
                       selectedFile.extension === 'json' ? FileText : File) : Folder"
                    class="w-5 h-5 mr-2 text-gray-600"
                  />
                  <h3 class="font-medium">{{ selectedFile.path }}</h3>
                  <div class="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                    Remote
                  </div>
                  
                  <div class="ml-auto flex items-center gap-2">
                    <Button 
                      @click="editFile"
                      variant="outline"
                      size="sm"
                      class="flex items-center gap-1"
                    >
                      <Edit class="w-4 h-4" />
                      Edit
                    </Button>
                    <Button 
                      @click="downloadFile"
                      variant="outline"
                      size="sm"
                      class="flex items-center gap-1"
                    >
                      <ExternalLink class="w-4 h-4" />
                      View on GitHub
                    </Button>
                  </div>
                </div>

                <!-- File content display with syntax highlighting -->
                <CodeBlock
                  :code="fileContent"
                  :language="getFileLanguage"
                  maxHeight="calc(70vh - 200px)"
                />
              </div>
            </template>

            <!-- Show error message if loading failed -->
            <template v-else-if="LOAD_REMOTE_FILES && fileContent && fileContent.startsWith('Error loading')">
              <div class="h-full">
                <div class="flex items-center mb-3 pb-2 border-b">
                  <component
                    :is="selectedFile.type === 'file' ? 
                      (selectedFile.extension === 'js' || selectedFile.extension === 'ts' || 
                       selectedFile.extension === 'vue' || selectedFile.extension === 'jsx' || 
                       selectedFile.extension === 'tsx' ? FileCode : 
                       selectedFile.extension === 'md' || selectedFile.extension === 'txt' || 
                       selectedFile.extension === 'json' ? FileText : File) : Folder"
                    class="w-5 h-5 mr-2 text-gray-600"
                  />
                  <h3 class="font-medium">{{ selectedFile.path }}</h3>
                </div>

                <EmptyStateMsg
                  title="Failed to load remote file"
                  :description="fileContent"
                  :primaryCta="{
                    label: 'View on GitHub',
                    to: githubFileUrl
                  }"
                />
              </div>
            </template>

            <!-- Traditional behavior - GitHub link only -->
            <template v-else>
              <!-- Show selected file name if available -->
              <div v-if="selectedFile" class="flex flex-col items-center justify-center my-4">
                <div class="flex items-center gap-2 px-4 py-2 rounded-md bg-slate-50 border border-slate-200 text-sm">
                  <component
                    :is="selectedFile.type === 'file' ? 
                      (selectedFile.extension === 'js' || selectedFile.extension === 'ts' || 
                       selectedFile.extension === 'vue' || selectedFile.extension === 'jsx' || 
                       selectedFile.extension === 'tsx' ? FileCode : 
                       selectedFile.extension === 'md' || selectedFile.extension === 'txt' || 
                       selectedFile.extension === 'json' ? FileText : File) : Folder"
                    class="w-4 h-4 text-slate-500"
                  />
                  <span class="font-medium">{{ selectedFile.path }}</span>
                </div>
              </div>
              
              <EmptyStateMsg
                title="Source files available on GitHub"
                description="Please check the repository on GitHub to view all source files. Distribution files can be viewed here."
                :primaryCta="{
                  label: selectedFile ? 'View on GitHub' : 'Open Repository',
                  to: selectedFile ? githubFileUrl : repoUrl
                }"
              />
            </template>
          </div>

          <!-- Dist files content -->
          <template v-else>
            <!-- No file selected -->
            <div
              v-if="!selectedFile"
              class="flex flex-col items-center justify-center h-full text-center"
            >
              <FileText class="w-12 h-12 text-gray-300 mb-2" />
              <h3 class="text-lg font-medium mb-1">No File Selected</h3>
              <p class="text-sm text-gray-500">
                Select a file from the sidebar to view its contents
              </p>
            </div>

            <!-- File content loading -->
            <div
              v-else-if="fileContentLoading"
              class="flex flex-col items-center justify-center h-full"
            >
              <Loader class="w-8 h-8 text-blue-500 animate-spin mb-2" />
              <span class="text-sm text-gray-500">Loading file content...</span>
            </div>

            <!-- File content -->
            <div v-else class="h-full">
              <div class="flex items-center mb-3 pb-2 border-b">
                <component
                  :is="selectedFile.type === 'file' ? 
                    (selectedFile.extension === 'js' || selectedFile.extension === 'ts' || 
                     selectedFile.extension === 'vue' || selectedFile.extension === 'jsx' || 
                     selectedFile.extension === 'tsx' ? FileCode : 
                     selectedFile.extension === 'md' || selectedFile.extension === 'txt' || 
                     selectedFile.extension === 'json' ? FileText : File) : Folder"
                  class="w-5 h-5 mr-2 text-gray-600"
                />
                <h3 class="font-medium">{{ selectedFile.path }}</h3>
                
                <Button 
                  v-if="selectedFile"
                  @click="downloadFile"
                  variant="outline"
                  size="sm"
                  class="ml-auto flex items-center gap-1"
                >
                  <component :is="activeTab === 'source' ? ExternalLink : ClipboardCopy" class="w-4 h-4" />
                  {{ activeTab === 'source' ? 'View on GitHub' : 'Download' }}
                </Button>
              </div>

              <!-- Binary file empty state -->
              <div v-if="selectedFile && selectedFile.contentType && 
                !(selectedFile.contentType.includes('text') || 
                   selectedFile.contentType.includes('javascript') || 
                   selectedFile.contentType.includes('css') ||
                   selectedFile.contentType.includes('application/json'))">
                <EmptyStateMsg
                  title="Binary file cannot be displayed"
                  description="This file cannot be displayed in the browser because it's a binary file. You can download it using the button below."
                  :primaryCta="{
                    label: 'Download File',
                    onClick: downloadFile
                  }"
                />
              </div>
              
              <!-- Large file empty state -->
              <div v-else-if="selectedFile && selectedFile.isLargeFile">
                <EmptyStateMsg
                  title="File is too large to display"
                  description="This file is over 1MB and too large to display in the browser. You can download it to view the full content."
                  :primaryCta="{
                    label: 'Download File',
                    onClick: downloadFile
                  }"
                />
              </div>
              
              <!-- Text file content display with syntax highlighting -->
              <CodeBlock
                v-else-if="fileContent"
                :code="fileContent"
                :language="getFileLanguage"
                maxHeight="calc(70vh - 200px)"
              />
              
              <!-- File content error state -->
              <div v-else class="flex flex-col items-center justify-center h-32 text-center">
                <FileText class="w-8 h-8 text-gray-300 mb-2" />
                <span class="text-sm text-gray-500">No content available</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No additional styles needed as they're in the FileTree component */
</style>