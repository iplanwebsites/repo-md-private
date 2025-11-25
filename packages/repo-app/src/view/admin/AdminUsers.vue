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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { 
  Users, 
  Search, 
  Filter, 
  UserCheck, 
  UserX,
  Mail,
  Calendar,
  Building,
  Shield,
  MoreHorizontal,
  Eye,
  Edit,
  Ban,
  Trash2,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next';

const users = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const filterStatus = ref('all'); // 'all', 'active', 'inactive', 'banned'
const showUserModal = ref(false);
const selectedUser = ref(null);

// Pagination
const page = ref(1);
const limit = ref(25);
const totalItems = ref(0);
const totalPages = computed(() => Math.ceil(totalItems.value / limit.value));

// Stats
const stats = ref({
  total: 0,
  active: 0,
  inactive: 0,
  banned: 0,
  newThisMonth: 0
});

// Filtered users
const filteredUsers = computed(() => {
  let filtered = users.value;
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(user => 
      user.email?.toLowerCase().includes(query) ||
      user.name?.toLowerCase().includes(query) ||
      user.id?.toLowerCase().includes(query)
    );
  }
  
  // Status filter
  if (filterStatus.value !== 'all') {
    filtered = filtered.filter(user => {
      switch (filterStatus.value) {
        case 'active': return user.status === 'active' && !user.banned;
        case 'inactive': return user.status === 'inactive' && !user.banned;
        case 'banned': return user.banned;
        default: return true;
      }
    });
  }
  
  return filtered;
});

// Fetch users
async function fetchUsers() {
  loading.value = true;
  
  try {
    const data = await trpc.users.list.query({
      page: page.value,
      limit: limit.value,
      search: searchQuery.value,
      status: filterStatus.value
    });
    
    users.value = data.items || [];
    totalItems.value = data.total || 0;
    
    // Update stats
    if (data.stats) {
      stats.value = data.stats;
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    toast({
      title: 'Error',
      description: 'Failed to load users',
      variant: 'destructive'
    });
  } finally {
    loading.value = false;
  }
}

// View user details
function viewUser(user) {
  selectedUser.value = user;
  showUserModal.value = true;
}

// Ban/unban user
async function toggleBan(user) {
  const action = user.banned ? 'unban' : 'ban';
  
  if (!confirm(`Are you sure you want to ${action} ${user.email}?`)) {
    return;
  }
  
  try {
    await trpc.users.toggleBan.mutate({
      userId: user.id,
      banned: !user.banned
    });
    
    // Update local state
    user.banned = !user.banned;
    
    toast({
      title: 'Success',
      description: `User ${action}ned successfully`,
    });
  } catch (error) {
    console.error('Error toggling ban:', error);
    toast({
      title: 'Error',
      description: `Failed to ${action} user`,
      variant: 'destructive'
    });
  }
}

// Delete user
async function deleteUser(user) {
  if (!confirm(`Are you sure you want to permanently delete ${user.email}? This action cannot be undone.`)) {
    return;
  }
  
  try {
    await trpc.users.delete.mutate({
      userId: user.id
    });
    
    // Remove from local state
    users.value = users.value.filter(u => u.id !== user.id);
    totalItems.value--;
    
    toast({
      title: 'Success',
      description: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    toast({
      title: 'Error',
      description: 'Failed to delete user',
      variant: 'destructive'
    });
  }
}

// Impersonate user
async function impersonateUser(user) {
  if (!confirm(`Are you sure you want to impersonate ${user.email}?`)) {
    return;
  }
  
  try {
    const { token } = await trpc.users.impersonate.mutate({
      userId: user.id
    });
    
    // Store admin token and switch to user
    localStorage.setItem('admin_token', localStorage.getItem('auth_token'));
    localStorage.setItem('auth_token', token);
    
    toast({
      title: 'Success',
      description: `Now impersonating ${user.email}`,
    });
    
    // Redirect to user dashboard
    window.location.href = '/';
  } catch (error) {
    console.error('Error impersonating user:', error);
    toast({
      title: 'Error',
      description: 'Failed to impersonate user',
      variant: 'destructive'
    });
  }
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

// Get user initials
function getUserInitials(user) {
  if (user.name) {
    return user.name.split(' ').map(n => n[0]).join('').toUpperCase();
  }
  return user.email?.substring(0, 2).toUpperCase() || 'U';
}

// Export users
async function exportUsers() {
  try {
    const data = await trpc.users.export.query({
      format: 'csv'
    });
    
    // Create blob and download
    const blob = new Blob([data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: 'Success',
      description: 'Users exported successfully',
    });
  } catch (error) {
    console.error('Error exporting users:', error);
    toast({
      title: 'Error',
      description: 'Failed to export users',
      variant: 'destructive'
    });
  }
}

onMounted(() => {
  fetchUsers();
});
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Users</h1>
        <p class="text-muted-foreground">Manage platform users and permissions</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="exportUsers">
          <Download class="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button @click="fetchUsers" :disabled="loading">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
          Refresh
        </Button>
      </div>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Users class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Total Users</p>
            <p class="text-2xl font-bold">{{ stats.total }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <UserCheck class="h-8 w-8 text-green-600" />
          <div>
            <p class="text-sm text-muted-foreground">Active</p>
            <p class="text-2xl font-bold">{{ stats.active }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <UserX class="h-8 w-8 text-orange-600" />
          <div>
            <p class="text-sm text-muted-foreground">Inactive</p>
            <p class="text-2xl font-bold">{{ stats.inactive }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Ban class="h-8 w-8 text-red-600" />
          <div>
            <p class="text-sm text-muted-foreground">Banned</p>
            <p class="text-2xl font-bold">{{ stats.banned }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Calendar class="h-8 w-8 text-blue-600" />
          <div>
            <p class="text-sm text-muted-foreground">New This Month</p>
            <p class="text-2xl font-bold">{{ stats.newThisMonth }}</p>
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
              placeholder="Search by name, email, or ID..."
              class="pl-10"
              @input="fetchUsers"
            />
          </div>
        </div>
        <div class="flex gap-2">
          <Button
            variant="outline"
            :class="{ 'bg-accent': filterStatus === 'all' }"
            @click="filterStatus = 'all'; fetchUsers()"
          >
            All
          </Button>
          <Button
            variant="outline"
            :class="{ 'bg-accent': filterStatus === 'active' }"
            @click="filterStatus = 'active'; fetchUsers()"
          >
            <UserCheck class="mr-2 h-4 w-4" />
            Active
          </Button>
          <Button
            variant="outline"
            :class="{ 'bg-accent': filterStatus === 'inactive' }"
            @click="filterStatus = 'inactive'; fetchUsers()"
          >
            <UserX class="mr-2 h-4 w-4" />
            Inactive
          </Button>
          <Button
            variant="outline"
            :class="{ 'bg-accent': filterStatus === 'banned' }"
            @click="filterStatus = 'banned'; fetchUsers()"
          >
            <Ban class="mr-2 h-4 w-4" />
            Banned
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Users Table -->
    <div class="bg-card rounded-lg shadow">
      <Table>
        <TableCaption>
          Showing {{ (page - 1) * limit + 1 }} - {{ Math.min(page * limit, totalItems) }} of {{ totalItems }} users
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Organizations</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="user in users" :key="user.id">
            <TableCell>
              <div class="flex items-center gap-3">
                <Avatar>
                  <AvatarImage :src="user.avatar" :alt="user.name" />
                  <AvatarFallback>{{ getUserInitials(user) }}</AvatarFallback>
                </Avatar>
                <div>
                  <div class="font-medium">{{ user.name || user.email }}</div>
                  <div class="text-sm text-muted-foreground">{{ user.id }}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Mail class="h-4 w-4 text-muted-foreground" />
                {{ user.email }}
              </div>
            </TableCell>
            <TableCell>
              <Badge 
                v-if="user.banned" 
                variant="destructive"
              >
                Banned
              </Badge>
              <Badge 
                v-else-if="user.status === 'active'" 
                variant="default"
                class="bg-green-600 hover:bg-green-600"
              >
                Active
              </Badge>
              <Badge 
                v-else 
                variant="secondary"
              >
                Inactive
              </Badge>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Shield v-if="user.role === 'admin'" class="h-4 w-4 text-primary" />
                <span>{{ user.role || 'user' }}</span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Building class="h-4 w-4 text-muted-foreground" />
                <span>{{ user.organizationCount || 0 }}</span>
              </div>
            </TableCell>
            <TableCell>{{ formatDate(user.createdAt) }}</TableCell>
            <TableCell>{{ formatDate(user.lastActiveAt) }}</TableCell>
            <TableCell class="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="viewUser(user)">
                    <Eye class="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="impersonateUser(user)">
                    <UserCheck class="mr-2 h-4 w-4" />
                    Impersonate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    @click="toggleBan(user)"
                    :class="user.banned ? '' : 'text-orange-600'"
                  >
                    <Ban class="mr-2 h-4 w-4" />
                    {{ user.banned ? 'Unban' : 'Ban' }} User
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    @click="deleteUser(user)"
                    class="text-destructive"
                  >
                    <Trash2 class="mr-2 h-4 w-4" />
                    Delete User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="users.length === 0">
            <TableCell colspan="8" class="text-center py-8">
              <div v-if="loading">Loading users...</div>
              <div v-else>No users found</div>
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
          @click="page--; fetchUsers()"
          :disabled="page <= 1"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
          v-for="p in Math.min(5, totalPages)"
          :key="p"
          variant="outline"
          size="sm"
          @click="page = p; fetchUsers()"
          :class="{ 'bg-accent': page === p }"
        >
          {{ p }}
        </Button>
        <Button
          variant="outline"
          size="icon"
          @click="page++; fetchUsers()"
          :disabled="page >= totalPages"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
    
    <!-- User Details Modal -->
    <Dialog v-model:open="showUserModal">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            Complete information for {{ selectedUser?.email }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4" v-if="selectedUser">
          <div class="flex items-center gap-4">
            <Avatar class="h-16 w-16">
              <AvatarImage :src="selectedUser.avatar" :alt="selectedUser.name" />
              <AvatarFallback>{{ getUserInitials(selectedUser) }}</AvatarFallback>
            </Avatar>
            <div>
              <h3 class="text-lg font-semibold">{{ selectedUser.name || 'No name' }}</h3>
              <p class="text-muted-foreground">{{ selectedUser.email }}</p>
              <div class="flex gap-2 mt-2">
                <Badge 
                  v-if="selectedUser.banned" 
                  variant="destructive"
                >
                  Banned
                </Badge>
                <Badge 
                  v-else-if="selectedUser.status === 'active'" 
                  variant="default"
                >
                  Active
                </Badge>
                <Badge 
                  v-else 
                  variant="secondary"
                >
                  Inactive
                </Badge>
                <Badge variant="outline">
                  {{ selectedUser.role || 'user' }}
                </Badge>
              </div>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium">User ID</label>
              <p class="text-sm text-muted-foreground font-mono">{{ selectedUser.id }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Auth Provider</label>
              <p class="text-sm text-muted-foreground">{{ selectedUser.provider || 'email' }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Created</label>
              <p class="text-sm text-muted-foreground">{{ formatDate(selectedUser.createdAt) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Last Active</label>
              <p class="text-sm text-muted-foreground">{{ formatDate(selectedUser.lastActiveAt) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Email Verified</label>
              <p class="text-sm text-muted-foreground">
                {{ selectedUser.emailVerified ? 'Yes' : 'No' }}
              </p>
            </div>
            <div>
              <label class="text-sm font-medium">Organizations</label>
              <p class="text-sm text-muted-foreground">{{ selectedUser.organizationCount || 0 }} organizations</p>
            </div>
          </div>
          
          <div v-if="selectedUser.metadata" class="space-y-2">
            <label class="text-sm font-medium">Metadata</label>
            <pre class="text-xs bg-muted p-3 rounded-lg overflow-x-auto">{{ JSON.stringify(selectedUser.metadata, null, 2) }}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showUserModal = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>