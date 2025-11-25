<script setup>
import { ref, computed, onMounted } from 'vue';
import trpc from '@/trpc.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast/use-toast.ts';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from '@/components/ui/dialog';
import { 
  Cloud, 
  Download, 
  Eye, 
  Copy, 
  Trash2, 
  Search,
  Filter,
  FolderOpen,
  File,
  Image as ImageIcon,
  FileVideo,
  FileAudio,
  FileText,
  FileArchive,
  MoreHorizontal
} from 'lucide-vue-next';

const r2Files = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const selectedType = ref('all');
const selectedBucket = ref('all');
const viewMode = ref('table'); // 'table' or 'grid'
const showPreviewModal = ref(false);
const selectedFile = ref(null);
const copiedKey = ref(null);

// Pagination
const page = ref(1);
const limit = ref(50);
const totalItems = ref(0);
const totalPages = computed(() => Math.ceil(totalItems.value / limit.value));

// Filtered files
const filteredFiles = computed(() => {
  let filtered = r2Files.value;
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(file => 
      file.key.toLowerCase().includes(query) ||
      file.bucket?.toLowerCase().includes(query)
    );
  }
  
  // Type filter
  if (selectedType.value !== 'all') {
    filtered = filtered.filter(file => getFileType(file.key) === selectedType.value);
  }
  
  // Bucket filter
  if (selectedBucket.value !== 'all') {
    filtered = filtered.filter(file => file.bucket === selectedBucket.value);
  }
  
  return filtered;
});

// Get unique buckets
const uniqueBuckets = computed(() => {
  const buckets = [...new Set(r2Files.value.map(file => file.bucket).filter(Boolean))];
  return buckets.sort();
});

// Fetch R2 storage files
async function fetchR2Files() {
  loading.value = true;
  
  try {
    const data = await trpc.r2.list.query({
      page: page.value,
      limit: limit.value
    });
    
    r2Files.value = data.items || [];
    totalItems.value = data.total || 0;
  } catch (error) {
    console.error('Error fetching R2 files:', error);
    toast({
      title: 'Error',
      description: 'Failed to load R2 storage files',
      variant: 'destructive'
    });
  } finally {
    loading.value = false;
  }
}

// Get file type from extension
function getFileType(key) {
  const ext = key.split('.').pop()?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
  const docExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
  
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (docExts.includes(ext)) return 'document';
  if (archiveExts.includes(ext)) return 'archive';
  return 'other';
}

// Get file icon component
function getFileIcon(key) {
  const type = getFileType(key);
  switch (type) {
    case 'image': return ImageIcon;
    case 'video': return FileVideo;
    case 'audio': return FileAudio;
    case 'document': return FileText;
    case 'archive': return FileArchive;
    default: return File;
  }
}

// Format file size
function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date
function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Preview file
function previewFile(file) {
  selectedFile.value = file;
  showPreviewModal.value = true;
}

// Copy URL to clipboard
async function copyUrl(file) {
  try {
    const url = file.url || `https://r2.repo.md/${file.bucket}/${file.key}`;
    await navigator.clipboard.writeText(url);
    copiedKey.value = file.key;
    
    toast({
      title: 'Copied!',
      description: 'URL copied to clipboard',
    });
    
    setTimeout(() => {
      copiedKey.value = null;
    }, 2000);
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to copy URL',
      variant: 'destructive'
    });
  }
}

// Delete file
async function deleteFile(file) {
  if (!confirm(`Are you sure you want to delete ${file.key}?`)) {
    return;
  }
  
  try {
    await trpc.r2.delete.mutate({
      bucket: file.bucket,
      key: file.key
    });
    
    // Remove from local state
    r2Files.value = r2Files.value.filter(f => f.key !== file.key);
    totalItems.value--;
    
    toast({
      title: 'Success',
      description: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    toast({
      title: 'Error',
      description: 'Failed to delete file',
      variant: 'destructive'
    });
  }
}

// Download file
function downloadFile(file) {
  const url = file.url || `https://r2.repo.md/${file.bucket}/${file.key}`;
  window.open(url, '_blank');
}

// Can preview file
function canPreview(file) {
  const type = getFileType(file.key);
  return ['image', 'video', 'audio', 'document'].includes(type);
}

// Get preview URL
function getPreviewUrl(file) {
  return file.url || `https://r2.repo.md/${file.bucket}/${file.key}`;
}

onMounted(() => {
  fetchR2Files();
});
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">R2 Storage</h1>
        <p class="text-muted-foreground">Manage files stored in Cloudflare R2</p>
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          @click="viewMode = 'table'"
          :class="{ 'bg-accent': viewMode === 'table' }"
        >
          <TableIcon class="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          @click="viewMode = 'grid'"
          :class="{ 'bg-accent': viewMode === 'grid' }"
        >
          <GridIcon class="h-4 w-4" />
        </Button>
        <Button @click="fetchR2Files" :disabled="loading">
          <Cloud class="mr-2 h-4 w-4" />
          <span v-if="loading">Loading...</span>
          <span v-else>Refresh</span>
        </Button>
      </div>
    </div>
    
    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Cloud class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Total Files</p>
            <p class="text-2xl font-bold">{{ totalItems }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <FolderOpen class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Buckets</p>
            <p class="text-2xl font-bold">{{ uniqueBuckets.length }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <ImageIcon class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Images</p>
            <p class="text-2xl font-bold">
              {{ r2Files.filter(f => getFileType(f.key) === 'image').length }}
            </p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <File class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Other Files</p>
            <p class="text-2xl font-bold">
              {{ r2Files.filter(f => getFileType(f.key) !== 'image').length }}
            </p>
          </div>
        </div>
      </Card>
    </div>
    
    <!-- Filters -->
    <div class="bg-card rounded-lg p-4">
      <div class="flex flex-wrap gap-4">
        <div class="flex-1 min-w-[300px]">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              v-model="searchQuery"
              placeholder="Search by filename or bucket..."
              class="pl-10"
            />
          </div>
        </div>
        <Select v-model="selectedType">
          <SelectTrigger class="w-[180px]">
            <Filter class="mr-2 h-4 w-4" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="archive">Archives</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="selectedBucket" v-if="uniqueBuckets.length > 1">
          <SelectTrigger class="w-[180px]">
            <FolderOpen class="mr-2 h-4 w-4" />
            <SelectValue placeholder="All buckets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All buckets</SelectItem>
            <SelectItem v-for="bucket in uniqueBuckets" :key="bucket" :value="bucket">
              {{ bucket }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    
    <!-- Table View -->
    <div v-if="viewMode === 'table'" class="bg-card rounded-lg shadow">
      <Table>
        <TableCaption>
          Showing {{ filteredFiles.length }} of {{ totalItems }} files
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[50px]">Type</TableHead>
            <TableHead>Key / Path</TableHead>
            <TableHead>Bucket</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Last Modified</TableHead>
            <TableHead>Content Type</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="file in filteredFiles" :key="file.key">
            <TableCell>
              <component :is="getFileIcon(file.key)" class="h-5 w-5 text-muted-foreground" />
            </TableCell>
            <TableCell class="font-medium max-w-[400px] truncate">
              {{ file.key }}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{{ file.bucket || 'default' }}</Badge>
            </TableCell>
            <TableCell>{{ formatSize(file.size) }}</TableCell>
            <TableCell>{{ formatDate(file.lastModified) }}</TableCell>
            <TableCell>
              <Badge variant="secondary" class="text-xs">
                {{ file.contentType || 'unknown' }}
              </Badge>
            </TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <Button
                  v-if="canPreview(file)"
                  size="icon"
                  variant="ghost"
                  @click="previewFile(file)"
                  title="Preview"
                >
                  <Eye class="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  @click="copyUrl(file)"
                  title="Copy URL"
                >
                  <Copy v-if="copiedKey !== file.key" class="h-4 w-4" />
                  <CheckCircle v-else class="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  @click="downloadFile(file)"
                  title="Download"
                >
                  <Download class="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  @click="deleteFile(file)"
                  title="Delete"
                  class="text-destructive hover:text-destructive"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredFiles.length === 0">
            <TableCell colspan="7" class="text-center py-8">
              <div v-if="loading">Loading files...</div>
              <div v-else-if="searchQuery || selectedType !== 'all' || selectedBucket !== 'all'">
                No files match your filters
              </div>
              <div v-else>No files found in R2 storage</div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    
    <!-- Grid View -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <Card
        v-for="file in filteredFiles"
        :key="file.key"
        class="p-4 hover:shadow-lg transition-shadow cursor-pointer"
        @click="previewFile(file)"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between">
            <component :is="getFileIcon(file.key)" class="h-8 w-8 text-primary" />
            <Button
              size="icon"
              variant="ghost"
              @click.stop="deleteFile(file)"
              class="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
          <div>
            <h3 class="font-medium truncate" :title="file.key">
              {{ file.key.split('/').pop() }}
            </h3>
            <p class="text-sm text-muted-foreground truncate" :title="file.key">
              {{ file.key }}
            </p>
          </div>
          <div class="flex items-center justify-between text-sm">
            <Badge variant="outline">{{ file.bucket || 'default' }}</Badge>
            <span class="text-muted-foreground">{{ formatSize(file.size) }}</span>
          </div>
          <div class="flex gap-1 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              @click.stop="copyUrl(file)"
              class="flex-1"
            >
              <Copy v-if="copiedKey !== file.key" class="h-3 w-3 mr-1" />
              <CheckCircle v-else class="h-3 w-3 mr-1 text-green-600" />
              Copy URL
            </Button>
            <Button
              size="sm"
              variant="outline"
              @click.stop="downloadFile(file)"
              class="flex-1"
            >
              <Download class="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        </div>
      </Card>
    </div>
    
    <!-- Pagination -->
    <div class="flex items-center justify-between" v-if="totalPages > 1">
      <div class="text-sm text-muted-foreground">
        Page {{ page }} of {{ totalPages }}
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          @click="page--; fetchR2Files()"
          :disabled="page <= 1"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          @click="page++; fetchR2Files()"
          :disabled="page >= totalPages"
        >
          Next
        </Button>
      </div>
    </div>
    
    <!-- Preview Modal -->
    <Dialog v-model:open="showPreviewModal">
      <DialogContent class="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{{ selectedFile?.key }}</DialogTitle>
          <DialogDescription>
            {{ formatSize(selectedFile?.size) }} • {{ selectedFile?.contentType }}
          </DialogDescription>
        </DialogHeader>
        <div class="mt-4" v-if="selectedFile">
          <!-- Image Preview -->
          <img
            v-if="getFileType(selectedFile.key) === 'image'"
            :src="getPreviewUrl(selectedFile)"
            :alt="selectedFile.key"
            class="w-full h-auto rounded-lg"
          />
          
          <!-- Video Preview -->
          <video
            v-else-if="getFileType(selectedFile.key) === 'video'"
            :src="getPreviewUrl(selectedFile)"
            controls
            class="w-full h-auto rounded-lg"
          />
          
          <!-- Audio Preview -->
          <audio
            v-else-if="getFileType(selectedFile.key) === 'audio'"
            :src="getPreviewUrl(selectedFile)"
            controls
            class="w-full"
          />
          
          <!-- Document Preview -->
          <iframe
            v-else-if="getFileType(selectedFile.key) === 'document' && selectedFile.contentType === 'application/pdf'"
            :src="getPreviewUrl(selectedFile)"
            class="w-full h-[600px] rounded-lg"
          />
          
          <!-- Other files -->
          <div v-else class="text-center py-12">
            <component :is="getFileIcon(selectedFile.key)" class="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p class="text-muted-foreground">Preview not available for this file type</p>
            <Button @click="downloadFile(selectedFile)" class="mt-4">
              <Download class="mr-2 h-4 w-4" />
              Download File
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showPreviewModal = false">Close</Button>
          <Button @click="downloadFile(selectedFile)">
            <Download class="mr-2 h-4 w-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>