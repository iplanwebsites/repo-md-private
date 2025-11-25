<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAdminTable, formatDate } from '@/composables/useAdminTable';
import { toast } from '@/components/ui/toast/use-toast.ts';
import trpc from '@/trpc.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  FileText,
  Search, 
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Calendar,
  User,
  Tag,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Building,
  FolderKanban
} from 'lucide-vue-next';

// Initialize table composable
const {
  items: notes,
  loading,
  searchQuery,
  page,
  totalItems,
  totalPages,
  stats,
  selectedItem: selectedNote,
  showModal: showNoteModal,
  fetchItems: fetchNotes,
  viewItem: viewNote,
  deleteItem,
  goToPage,
  nextPage,
  prevPage
} = useAdminTable({
  fetchFn: trpc.notes.list.query,
  itemName: 'note',
  itemsName: 'notes',
  searchFields: ['title', 'content', 'tags', 'authorName', 'projectName']
});

// Additional state
const filterType = ref('all');
const filterVisibility = ref('all');
const editMode = ref(false);
const editedNote = ref({});

// Filtered notes
const filteredNotes = computed(() => {
  let filtered = notes.value;
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(note => 
      note.title?.toLowerCase().includes(query) ||
      note.content?.toLowerCase().includes(query) ||
      note.tags?.some(tag => tag.toLowerCase().includes(query)) ||
      note.authorName?.toLowerCase().includes(query) ||
      note.projectName?.toLowerCase().includes(query)
    );
  }
  
  // Type filter
  if (filterType.value !== 'all') {
    filtered = filtered.filter(note => note.type === filterType.value);
  }
  
  // Visibility filter
  if (filterVisibility.value !== 'all') {
    filtered = filtered.filter(note => 
      filterVisibility.value === 'public' ? note.isPublic : !note.isPublic
    );
  }
  
  return filtered;
});

// View/Edit note
function handleViewNote(note) {
  selectedNote.value = note;
  editedNote.value = { ...note };
  editMode.value = false;
  showNoteModal.value = true;
}

// Save edited note
async function saveNote() {
  try {
    await trpc.notes.update.mutate({
      id: editedNote.value.id,
      title: editedNote.value.title,
      content: editedNote.value.content,
      tags: editedNote.value.tags,
      isPublic: editedNote.value.isPublic
    });
    
    // Update local state
    const index = notes.value.findIndex(n => n.id === editedNote.value.id);
    if (index !== -1) {
      notes.value[index] = { ...editedNote.value };
    }
    
    editMode.value = false;
    toast({
      title: 'Success',
      description: 'Note updated successfully',
    });
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to update note',
      variant: 'destructive'
    });
  }
}

// Delete note
async function deleteNote(note) {
  await deleteItem(
    note,
    async (n) => await trpc.notes.delete.mutate({ id: n.id }),
    `Are you sure you want to delete "${note.title}"?`
  );
}

// Get type badge
function getTypeBadge(type) {
  const badges = {
    documentation: { variant: 'default', icon: FileText },
    announcement: { variant: 'secondary', icon: MessageSquare },
    internal: { variant: 'outline', icon: Lock }
  };
  return badges[type] || badges.internal;
}

// Truncate text
function truncate(text, length = 100) {
  if (!text || text.length <= length) return text;
  return text.substring(0, length) + '...';
}

// Fetch on mount
onMounted(() => {
  fetchNotes();
});
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Notes</h1>
        <p class="text-muted-foreground">Manage system notes and documentation</p>
      </div>
      <Button @click="fetchNotes" :disabled="loading">
        <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
        Refresh
      </Button>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <FileText class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Total Notes</p>
            <p class="text-2xl font-bold">{{ stats.total || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Unlock class="h-8 w-8 text-green-600" />
          <div>
            <p class="text-sm text-muted-foreground">Public</p>
            <p class="text-2xl font-bold">{{ stats.public || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Lock class="h-8 w-8 text-orange-600" />
          <div>
            <p class="text-sm text-muted-foreground">Private</p>
            <p class="text-2xl font-bold">{{ stats.private || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Tag class="h-8 w-8 text-purple-600" />
          <div>
            <p class="text-sm text-muted-foreground">Unique Tags</p>
            <p class="text-2xl font-bold">{{ stats.uniqueTags || 0 }}</p>
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
              placeholder="Search by title, content, tags, author..."
              class="pl-10"
              @input="fetchNotes"
            />
          </div>
        </div>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterType === 'all' }"
            @click="filterType = 'all'"
          >
            All Types
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterType === 'documentation' }"
            @click="filterType = 'documentation'"
          >
            Documentation
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterType === 'announcement' }"
            @click="filterType = 'announcement'"
          >
            Announcements
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterType === 'internal' }"
            @click="filterType = 'internal'"
          >
            Internal
          </Button>
        </div>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterVisibility === 'all' }"
            @click="filterVisibility = 'all'"
          >
            All
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterVisibility === 'public' }"
            @click="filterVisibility = 'public'"
          >
            <Unlock class="mr-2 h-4 w-4" />
            Public
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterVisibility === 'private' }"
            @click="filterVisibility = 'private'"
          >
            <Lock class="mr-2 h-4 w-4" />
            Private
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Notes Table -->
    <div class="bg-card rounded-lg shadow">
      <Table>
        <TableCaption>
          Showing {{ filteredNotes.length }} of {{ totalItems }} notes
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead>Created</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="note in filteredNotes" :key="note.id">
            <TableCell>
              <div>
                <div class="font-medium">{{ note.title }}</div>
                <div class="text-sm text-muted-foreground">
                  {{ truncate(note.content, 60) }}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge :variant="getTypeBadge(note.type).variant">
                <component :is="getTypeBadge(note.type).icon" class="mr-1 h-3 w-3" />
                {{ note.type }}
              </Badge>
            </TableCell>
            <TableCell>
              <div v-if="note.authorName" class="flex items-center gap-1">
                <User class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm">{{ note.authorName }}</span>
              </div>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div v-if="note.projectName">
                <div class="flex items-center gap-1">
                  <FolderKanban class="h-4 w-4 text-muted-foreground" />
                  <span class="text-sm">{{ note.projectName }}</span>
                </div>
                <div class="text-xs text-muted-foreground">
                  <Building class="inline h-3 w-3" />
                  {{ note.organizationName }}
                </div>
              </div>
              <span v-else class="text-muted-foreground">System</span>
            </TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-1">
                <Badge 
                  v-for="tag in (note.tags || [])" 
                  :key="tag"
                  variant="secondary"
                  class="text-xs"
                >
                  <Tag class="mr-1 h-3 w-3" />
                  {{ tag }}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              <Badge :variant="note.isPublic ? 'default' : 'secondary'">
                <component :is="note.isPublic ? Unlock : Lock" class="mr-1 h-3 w-3" />
                {{ note.isPublic ? 'Public' : 'Private' }}
              </Badge>
            </TableCell>
            <TableCell>{{ formatDate(note.createdAt) }}</TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  @click="handleViewNote(note)"
                >
                  <Eye class="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  @click="deleteNote(note)"
                  class="text-destructive hover:text-destructive"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredNotes.length === 0">
            <TableCell colspan="8" class="text-center py-8">
              <div v-if="loading">Loading notes...</div>
              <div v-else>No notes found</div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    
    <!-- Pagination -->
    <div class="flex items-center justify-between" v-if="totalPages > 1">
      <div class="text-sm text-muted-foreground">
        Page {{ page }} of {{ totalPages }}
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          @click="prevPage"
          :disabled="page <= 1"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
          v-for="p in Math.min(5, totalPages)"
          :key="p"
          variant="outline"
          size="sm"
          @click="goToPage(p)"
          :class="{ 'bg-accent': page === p }"
        >
          {{ p }}
        </Button>
        <Button
          variant="outline"
          size="icon"
          @click="nextPage"
          :disabled="page >= totalPages"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
    
    <!-- Note Details/Edit Modal -->
    <Dialog v-model:open="showNoteModal">
      <DialogContent class="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {{ editMode ? 'Edit Note' : 'Note Details' }}
          </DialogTitle>
        </DialogHeader>
        <div class="space-y-4" v-if="selectedNote">
          <div v-if="!editMode">
            <!-- View Mode -->
            <div class="space-y-4">
              <div>
                <h3 class="text-lg font-semibold">{{ selectedNote.title }}</h3>
                <div class="flex items-center gap-2 mt-2">
                  <Badge :variant="getTypeBadge(selectedNote.type).variant">
                    {{ selectedNote.type }}
                  </Badge>
                  <Badge :variant="selectedNote.isPublic ? 'default' : 'secondary'">
                    <component :is="selectedNote.isPublic ? Unlock : Lock" class="mr-1 h-3 w-3" />
                    {{ selectedNote.isPublic ? 'Public' : 'Private' }}
                  </Badge>
                </div>
              </div>
              
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label class="font-medium">Author</label>
                  <p class="text-muted-foreground">{{ selectedNote.authorName || 'System' }}</p>
                </div>
                <div>
                  <label class="font-medium">Created</label>
                  <p class="text-muted-foreground">{{ formatDate(selectedNote.createdAt) }}</p>
                </div>
                <div>
                  <label class="font-medium">Project</label>
                  <p class="text-muted-foreground">{{ selectedNote.projectName || 'None' }}</p>
                </div>
                <div>
                  <label class="font-medium">Updated</label>
                  <p class="text-muted-foreground">{{ formatDate(selectedNote.updatedAt) }}</p>
                </div>
              </div>
              
              <div>
                <label class="text-sm font-medium">Tags</label>
                <div class="flex flex-wrap gap-1 mt-1">
                  <Badge 
                    v-for="tag in (selectedNote.tags || [])" 
                    :key="tag"
                    variant="secondary"
                  >
                    {{ tag }}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label class="text-sm font-medium">Content</label>
                <div class="mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap">
                  {{ selectedNote.content }}
                </div>
              </div>
            </div>
          </div>
          
          <div v-else>
            <!-- Edit Mode -->
            <div class="space-y-4">
              <div>
                <label class="text-sm font-medium">Title</label>
                <Input v-model="editedNote.title" class="mt-1" />
              </div>
              
              <div>
                <label class="text-sm font-medium">Content</label>
                <Textarea 
                  v-model="editedNote.content" 
                  class="mt-1 min-h-[200px]"
                  rows="10"
                />
              </div>
              
              <div>
                <label class="text-sm font-medium">Tags (comma-separated)</label>
                <Input 
                  :value="(editedNote.tags || []).join(', ')" 
                  @input="editedNote.tags = $event.target.value.split(',').map(t => t.trim()).filter(Boolean)"
                  class="mt-1"
                />
              </div>
              
              <div class="flex items-center gap-4">
                <label class="text-sm font-medium">Visibility:</label>
                <Button
                  variant="outline"
                  size="sm"
                  @click="editedNote.isPublic = !editedNote.isPublic"
                >
                  <component :is="editedNote.isPublic ? Unlock : Lock" class="mr-2 h-4 w-4" />
                  {{ editedNote.isPublic ? 'Public' : 'Private' }}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showNoteModal = false">Close</Button>
          <Button 
            v-if="!editMode"
            @click="editMode = true"
          >
            <Edit class="mr-2 h-4 w-4" />
            Edit
          </Button>
          <div v-else class="flex gap-2">
            <Button variant="outline" @click="editMode = false">Cancel</Button>
            <Button @click="saveNote">Save Changes</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>