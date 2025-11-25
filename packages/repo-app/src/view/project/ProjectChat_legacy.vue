<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { FolderIcon, GitBranchIcon } from 'lucide-vue-next'
import DiffNums from '@/components/ui/DiffNums.vue'

const router = useRouter()
const activeTab = ref('tasks')
const selectedRepository = ref('turtle-blog')
const selectedBranch = ref('main')
const searchQuery = ref('')

// Navigate to task detail
const goToTask = (taskId) => {
  router.push(`./chat/${taskId}`)
}

// Static data for tasks
const tasks = [
  {
    id: 1,
    title: 'Write a blog article about the migration patterns of loggerhead sea turtles and their imp...',
    timeAgo: 'May 2',
    repository: 'turtle-blog',
    status: 'Open',
    changes: '+1,245 -0'
  },
  {
    id: 2,
    title: 'Plan content roadmap for next month focused on turtle conservation awareness',
    timeAgo: '2 hours ago',
    repository: 'turtle-blog',
    status: 'Merged',
    changes: '+342 -15'
  },
  {
    id: 3,
    title: 'Create an interactive guide on identifying different turtle species with photos and key features',
    timeAgo: '2 hours ago',
    repository: 'turtle-blog',
    status: null,
    changes: '+892 -33'
  },
  {
    id: 4,
    title: 'Draft newsletter about recent turtle nesting season results and volunteer opportunities',
    timeAgo: '3 hours ago',
    repository: 'turtle-blog',
    status: null,
    changes: '+456 -12'
  }
]
</script>

<template>
  <div class="min-h-screen bg-muted/40 p-6">
    <!-- Header -->
    <div class="max-w-6xl mx-auto mb-8">
      <h1 class="text-3xl font-semibold text-foreground">What should we write next?</h1>
    </div>

    <!-- Search/Input Bar -->
    <div class="max-w-6xl mx-auto mb-6">
      <Card class="p-4">
        <div class="flex items-start gap-4">
          <Textarea 
            v-model="searchQuery"
            placeholder="Write a comprehensive guide on sea turtle conservation efforts in the Pacific Ocean, including recent research findings and practical ways readers can help"
            class="flex-1 min-h-[80px] resize-none border-0 shadow-none focus-visible:ring-0 text-muted-foreground"
            @keydown.enter.shift.prevent="searchQuery += '\n'"
          />
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <FolderIcon class="w-4 h-4 text-muted-foreground" />
              <span class="text-muted-foreground">{{ selectedRepository }}</span>
            </div>
            <Select v-model="selectedBranch">
              <SelectTrigger class="w-[120px] border-0 shadow-none">
                <div class="flex items-center gap-2">
                  <GitBranchIcon class="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Select branch" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">main</SelectItem>
                <SelectItem value="develop">develop</SelectItem>
                <SelectItem value="feature">feature</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" class="text-muted-foreground hover:text-foreground">
              Ask
            </Button>
            <Button class="rounded-full">
              Write
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Tabs -->
    <div class="max-w-6xl mx-auto">
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid w-full grid-cols-2 max-w-[200px]">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>

        <!-- Task List -->
        <TabsContent value="tasks" class="mt-6 space-y-4">
          <Card
            v-for="task in tasks" 
            :key="task.id"
            class="p-4 hover:shadow-sm transition-shadow cursor-pointer"
            @click="goToTask(task.id)"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="text-foreground font-medium mb-1">{{ task.title }}</h3>
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{{ task.timeAgo }}</span>
                  <span>·</span>
                  <span>{{ task.repository }}</span>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <Badge 
                  v-if="task.status" 
                  :variant="task.status === 'Open' ? 'default' : 'secondary'"
                >
                  {{ task.status }}
                </Badge>
                <DiffNums :changes="task.changes" />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="archive" class="mt-6">
          <div class="text-center py-12 text-muted-foreground">
            No archived tasks yet
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>