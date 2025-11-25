<script setup>
import { ref, onMounted } from 'vue';
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

const waitlistEntries = ref([]);
const loading = ref(false);

// Fetch waitlist entries using tRPC
async function fetchWaitlist() {
  loading.value = true;
  
  try {
    const data = await trpc.waitlist.getAll.query();
    waitlistEntries.value = data;
  } catch (error) {
    console.error('Error fetching waitlist:', error);
    toast({
      title: 'Error',
      description: 'Failed to load waitlist entries',
      variant: 'destructive'
    });
  } finally {
    loading.value = false;
  }
}

// Invite a user from the waitlist
async function inviteUser(entry) {
  try {
    await trpc.waitlist.invite.mutate({
      id: entry.id
    });
    
    // Update local state
    entry.invited = true;
    entry.invitedOn = new Date().toISOString();
    
    toast({
      title: 'Success',
      description: `User ${entry.email} has been invited`,
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    toast({
      title: 'Error',
      description: 'Failed to invite user',
      variant: 'destructive'
    });
  }
}

// Save notes for a waitlist entry
async function saveNotes(entry) {
  try {
    await trpc.waitlist.updateNotes.mutate({
      id: entry.id,
      notes: entry.notes
    });
    
    toast({
      title: 'Success',
      description: 'Notes saved successfully',
    });
  } catch (error) {
    console.error('Error saving notes:', error);
    toast({
      title: 'Error',
      description: 'Failed to save notes',
      variant: 'destructive'
    });
  }
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return '';
  
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

onMounted(() => {
  fetchWaitlist();
});
</script>

<template>
  <div class="container mx-auto py-6 space-y-8">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Waitlist Management</h1>
      <Button @click="fetchWaitlist" :disabled="loading">
        <span v-if="loading" class="animate-spin mr-2">⏳</span>
        <span v-else>Refresh</span>
      </Button>
    </div>
    
    <div class="bg-muted/20 p-4 rounded-lg">
      <div class="flex gap-4 flex-wrap">
        <div>
          <span class="font-medium">Total entries:</span> {{ waitlistEntries.length }}
        </div>
        <div>
          <span class="font-medium">Invited:</span> 
          {{ waitlistEntries.filter(entry => entry.invited).length }}
        </div>
        <div>
          <span class="font-medium">Pending:</span> 
          {{ waitlistEntries.filter(entry => !entry.invited).length }}
        </div>
      </div>
    </div>
    
    <div class="bg-card rounded-lg shadow">
      <Table>
        <TableCaption>List of waitlist sign-ups</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Use Cases</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="entry in waitlistEntries" :key="entry.id" 
            :class="{'bg-muted/20': entry.invited}">
            <TableCell class="font-medium">{{ entry.email }}</TableCell>
            <TableCell>{{ entry.name || '—' }}</TableCell>
            <TableCell>{{ entry.company || '—' }}</TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-1">
                <Badge 
                  v-for="(useCase, index) in entry.useCases" 
                  :key="index"
                  variant="outline"
                  class="text-xs"
                >
                  {{ useCase }}
                </Badge>
              </div>
            </TableCell>
            <TableCell>{{ formatDate(entry.createdAt) }}</TableCell>
            <TableCell>
              <Badge 
                :variant="entry.invited ? 'default' : 'outline'"
                :class="entry.invited ? 'bg-green-600 hover:bg-green-600' : ''"
              >
                {{ entry.invited ? 'Invited' : 'Pending' }}
              </Badge>
              <div v-if="entry.invitedOn" class="text-xs text-muted-foreground mt-1">
                {{ formatDate(entry.invitedOn) }}
              </div>
            </TableCell>
            <TableCell>
              <Input v-model="entry.notes" placeholder="Add notes..." class="w-full h-8" />
              <Button 
                size="sm" 
                variant="ghost" 
                class="mt-1 h-6 text-xs" 
                @click="saveNotes(entry)"
              >
                Save
              </Button>
            </TableCell>
            <TableCell>
              <Button 
                size="sm" 
                :variant="entry.invited ? 'outline' : 'default'"
                :disabled="entry.invited"
                @click="inviteUser(entry)"
              >
                {{ entry.invited ? 'Invited' : 'Invite' }}
              </Button>
            </TableCell>
          </TableRow>
          <TableRow v-if="waitlistEntries.length === 0">
            <TableCell colspan="8" class="text-center py-8">
              <div v-if="loading">Loading waitlist entries...</div>
              <div v-else>No waitlist entries found</div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>