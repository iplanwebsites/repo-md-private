<template>
  <div class="min-h-screen bg-background p-6">
    <!-- Header -->
    <div class="max-w-6xl mx-auto mb-8">
      <h1 class="text-3xl font-semibold text-foreground">What should we code next?</h1>
    </div>

    <!-- Search/Input Bar -->
    <div class="max-w-6xl mx-auto mb-6">
      <Card class="p-4">
        <div class="flex items-center justify-between">
          <Input 
            v-model="searchQuery"
            placeholder="In my current project, find a bug in the last 5 commits and fix it"
            class="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div class="flex items-center gap-4 ml-4">
            <Select>
              <SelectTrigger class="w-[140px]">
                <SelectValue placeholder="Select repo">
                  <div class="flex items-center gap-2">
                    <FolderIcon class="h-4 w-4" />
                    <span>monorepo</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monorepo">
                  <div class="flex items-center gap-2">
                    <FolderIcon class="h-4 w-4" />
                    <span>monorepo</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger class="w-[120px]">
                <SelectValue placeholder="Select branch">
                  <div class="flex items-center gap-2">
                    <GitBranchIcon class="h-4 w-4" />
                    <span>main</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">
                  <div class="flex items-center gap-2">
                    <GitBranchIcon class="h-4 w-4" />
                    <span>main</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm">Ask</Button>
            <Button>Code</Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Tabs -->
    <div class="max-w-6xl mx-auto">
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="bg-transparent h-auto p-0 w-full justify-start border-b rounded-none">
          <TabsTrigger
            v-for="tab in tabs"
            :key="tab"
            :value="tab"
            class="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-foreground rounded-none px-1 pb-3"
          >
            {{ tab }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="Tasks" class="mt-6">
          <div class="space-y-4">
            <Card
              v-for="task in tasks"
              :key="task.id"
              class="p-4 hover:shadow-sm transition-shadow"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="font-medium mb-1">{{ task.title }}</h3>
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{{ task.timeAgo }}</span>
                    <span>·</span>
                    <span>{{ task.repository }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <Badge
                    v-if="task.status"
                    :variant="task.status === 'Open' ? 'secondary' : 'default'"
                    :class="task.status === 'Open' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-purple-100 text-purple-700 hover:bg-purple-100'"
                  >
                    {{ task.status }}
                  </Badge>
                  <Badge variant="outline" :class="task.changes.startsWith('+') ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'">
                    {{ task.changes }}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="Archive" class="mt-6">
          <div class="text-center text-muted-foreground py-8">
            No archived tasks
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FolderIcon, GitBranchIcon } from 'lucide-vue-next'

const activeTab = ref('Tasks')
const tabs = ['Tasks', 'Archive']
const searchQuery = ref('')

const tasks = ref([
  {
    id: 1,
    title: 'Scan the entire repository and flag any variables, parameters, or properties whose n...',
    timeAgo: 'May 2',
    repository: 'monorepo',
    status: 'Open',
    changes: '+57 -27'
  },
  {
    id: 2,
    title: 'Convert non-critical components to React.lazy with Suspense fallbacks',
    timeAgo: '2 hours ago',
    repository: 'monorepo',
    status: 'Merged',
    changes: '+134 -45'
  },
  {
    id: 3,
    title: 'Create a CI workflow that runs ESLint on every PR and blocks on violations...',
    timeAgo: '2 hours ago',
    repository: 'monorepo',
    status: null,
    changes: '+89 -33'
  },
  {
    id: 4,
    title: 'Look at my config in sudo_documentation and import terminal sizes from terminal_emulator',
    timeAgo: '3 hours ago',
    repository: 'monorepo',
    status: null,
    changes: '+93 -58'
  }
])
</script>