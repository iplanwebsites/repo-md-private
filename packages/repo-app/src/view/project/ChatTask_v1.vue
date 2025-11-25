<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ChevronDown, Upload, Bell, MoreHorizontal, ChevronRight, Info, Search, Copy } from 'lucide-vue-next'
import DiffNums from '@/components/ui/DiffNums.vue'

const route = useRoute()
const router = useRouter()
const taskId = ref(route.params.taskId)
const activeTab = ref('diff')
const showFiles = ref(true)
const userInput = ref('')

// Sample task data
const task = ref({
  title: 'Write a blog article about the migration patterns of loggerhead sea turtles',
  date: 'May 16',
  project: 'turtle-blog',
  changes: '+1,245 -0'
})

// Sample diff data
const diffLines = [
  { oldNum: 1, newNum: 1, content: '# Loggerhead Sea Turtle Migration Patterns', type: 'added' },
  { oldNum: 2, newNum: 2, content: '', type: 'normal' },
  { oldNum: 3, newNum: 3, content: '## Introduction', type: 'added' },
  // ... more lines
]

const goBack = () => {
  router.push('../')
}
</script>

<template>
  <div class="min-h-screen bg-muted/40">
    <!-- Header -->
    <div class="bg-background border-b">
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="icon" @click="goBack">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div>
            <h1 class="text-lg font-medium">{{ task.title }}</h1>
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{{ task.date }}</span>
              <span>{{ task.project }}</span>
              <DiffNums :changes="task.changes" />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Button>
            Push
            <ChevronDown class="ml-2 h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Upload class="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Bell class="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreHorizontal class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <div class="flex h-[calc(100vh-64px)]">
      <!-- Left Panel - Chat -->
      <div class="w-1/3 bg-background border-r p-6 overflow-y-auto">
        <div class="space-y-6">
          <div>
            <h2 class="text-lg font-medium mb-2">Write comprehensive content about:</h2>
            <p class="text-muted-foreground">Loggerhead sea turtle migration patterns in the Pacific Ocean...</p>
          </div>

          <div class="text-sm text-muted-foreground">
            Worked for 3m 13s <ChevronRight class="inline h-3 w-3" />
          </div>

          <div>
            <h3 class="font-medium mb-3">Summary</h3>
            <ul class="space-y-2 text-sm">
              <li class="flex">
                <span class="mr-2">•</span>
                <div>
                  Created comprehensive introduction covering turtle biology
                  <Button variant="ghost" size="sm" class="ml-1 h-auto p-0">
                    <Info class="h-3 w-3" />
                  </Button>
                </div>
              </li>
              <li class="flex">
                <span class="mr-2">•</span>
                <div>
                  Added migration route maps and seasonal patterns
                  <Button variant="ghost" size="sm" class="ml-1 h-auto p-0">
                    <Info class="h-3 w-3" />
                  </Button>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="font-medium mb-3">Preview</h3>
            <div class="flex items-center gap-2 text-sm">
              <span class="text-green-500">✓</span>
              <code class="bg-muted px-2 py-1 rounded">npm run preview</code>
              <Button variant="ghost" size="sm" class="h-auto p-0">
                <Search class="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div class="text-sm text-muted-foreground">
            What else would you like to write today?
          </div>

          <div>
            <Button variant="ghost" @click="showFiles = !showFiles" class="w-full justify-between">
              <span class="font-medium">Files (2)</span>
              <ChevronDown :class="['h-4 w-4 transition-transform', showFiles && 'rotate-180']" />
            </Button>
            <div v-if="showFiles" class="mt-2 space-y-2">
              <div class="flex justify-between items-center text-sm">
                <span>content/blog/turtle-migration.md</span>
                <DiffNums changes="+145 -0" />
              </div>
              <div class="flex justify-between items-center text-sm">
                <span>content/blog/images/</span>
                <Badge variant="secondary" class="text-xs">New</Badge>
              </div>
            </div>
          </div>

          <div>
            <Textarea
              v-model="userInput"
              placeholder="Request changes or ask a question"
              class="min-h-[80px] resize-none"
            />
          </div>
        </div>
      </div>

      <!-- Right Panel - Code Diff -->
      <div class="flex-1 overflow-hidden">
        <Tabs v-model="activeTab" class="h-full flex flex-col">
          <div class="p-4 border-b">
            <TabsList class="grid w-full grid-cols-2 max-w-[200px]">
              <TabsTrigger value="diff">Diff</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="diff" class="flex-1 mt-0 overflow-hidden">
            <div class="h-full bg-gray-900">
              <div class="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                <div class="flex items-center gap-2 text-sm text-gray-400">
                  <ChevronDown class="h-4 w-4" />
                  <span>content/blog/turtle-migration.md</span>
                  <Button variant="ghost" size="sm" class="h-auto p-0 text-gray-400 hover:text-gray-200">
                    <Copy class="h-3 w-3" />
                  </Button>
                </div>
                <DiffNums changes="+145 -0" />
              </div>

              <div class="overflow-auto h-[calc(100%-48px)]">
                <div class="font-mono text-sm">
                  <div v-for="(line, index) in diffLines" :key="index" 
                       :class="[
                         'px-4 py-0.5',
                         line.type === 'added' && 'bg-green-900/30 text-green-300',
                         line.type === 'removed' && 'bg-red-900/30 text-red-300',
                         line.type === 'normal' && 'text-gray-300'
                       ]">
                    <span class="inline-block w-12 text-right pr-4 select-none text-gray-500">{{ line.oldNum }}</span>
                    <span class="inline-block w-12 text-right pr-4 select-none text-gray-500">{{ line.newNum }}</span>
                    <span class="inline-block w-8 text-center select-none">{{ line.type === 'added' ? '+' : '' }}</span>
                    <span>{{ line.content }}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs" class="flex-1 mt-0 overflow-hidden">
            <div class="p-4 h-full overflow-auto">
              <div class="font-mono text-sm space-y-1">
                <div class="text-muted-foreground">[2024-05-16 10:23:45] Starting content generation...</div>
                <div class="text-muted-foreground">[2024-05-16 10:23:47] Analyzing topic: sea turtle migration</div>
                <div class="text-muted-foreground">[2024-05-16 10:23:52] Generated outline with 5 sections</div>
                <div class="text-muted-foreground">[2024-05-16 10:24:15] Content generation complete</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
</template>