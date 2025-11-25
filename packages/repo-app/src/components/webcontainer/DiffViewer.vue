<script setup>
import { ref, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, RotateCcw, Download } from 'lucide-vue-next'

const props = defineProps({
  originalContent: {
    type: String,
    default: ''
  },
  modifiedContent: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'plaintext'
  }
})

const emit = defineEmits(['revert-changes', 'export-diff'])

// Diff computation
const diffLines = computed(() => {
  const original = props.originalContent.split('\n')
  const modified = props.modifiedContent.split('\n')
  
  return generateDiff(original, modified)
})

const stats = computed(() => {
  const lines = diffLines.value
  return {
    additions: lines.filter(l => l.type === 'addition').length,
    deletions: lines.filter(l => l.type === 'deletion').length,
    total: lines.length
  }
})

const hasChanges = computed(() => {
  return props.originalContent !== props.modifiedContent
})

// Simple diff algorithm (LCS-based)
function generateDiff(original, modified) {
  const result = []
  const originalLen = original.length
  const modifiedLen = modified.length
  
  // Create LCS table
  const lcs = Array(originalLen + 1).fill(null).map(() => 
    Array(modifiedLen + 1).fill(0)
  )
  
  // Fill LCS table
  for (let i = 1; i <= originalLen; i++) {
    for (let j = 1; j <= modifiedLen; j++) {
      if (original[i - 1] === modified[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1])
      }
    }
  }
  
  // Backtrack to generate diff
  let i = originalLen
  let j = modifiedLen
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === modified[j - 1]) {
      result.unshift({
        type: 'unchanged',
        content: original[i - 1],
        lineNumber: { original: i, modified: j }
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      result.unshift({
        type: 'addition',
        content: modified[j - 1],
        lineNumber: { original: null, modified: j }
      })
      j--
    } else if (i > 0 && (j === 0 || lcs[i][j - 1] < lcs[i - 1][j])) {
      result.unshift({
        type: 'deletion',
        content: original[i - 1],
        lineNumber: { original: i, modified: null }
      })
      i--
    }
  }
  
  return result
}

// Export diff as patch format
const exportDiff = () => {
  const patch = generatePatchFormat()
  emit('export-diff', patch)
}

const generatePatchFormat = () => {
  const header = `--- a/${props.fileName}
+++ b/${props.fileName}
@@ -1,${props.originalContent.split('\n').length} +1,${props.modifiedContent.split('\n').length} @@
`
  
  const diffContent = diffLines.value.map(line => {
    switch (line.type) {
      case 'addition':
        return `+${line.content}`
      case 'deletion':
        return `-${line.content}`
      case 'unchanged':
        return ` ${line.content}`
      default:
        return line.content
    }
  }).join('\n')
  
  return header + diffContent
}

// Revert changes
const revertChanges = () => {
  emit('revert-changes')
}

// Get line type class
const getLineClass = (type) => {
  switch (type) {
    case 'addition':
      return 'bg-green-50 border-l-4 border-green-400 text-green-800'
    case 'deletion':
      return 'bg-red-50 border-l-4 border-red-400 text-red-800'
    case 'unchanged':
      return 'bg-gray-50'
    default:
      return ''
  }
}

const getLinePrefix = (type) => {
  switch (type) {
    case 'addition':
      return '+'
    case 'deletion':
      return '-'
    default:
      return ' '
  }
}
</script>

<template>
  <Card class="h-full">
    <CardHeader class="pb-3">
      <div class="flex items-center justify-between">
        <CardTitle class="flex items-center space-x-2">
          <FileText class="h-5 w-5" />
          <span>Diff Viewer</span>
          <Badge v-if="fileName" variant="outline">{{ fileName }}</Badge>
        </CardTitle>
        <div class="flex items-center space-x-2">
          <Badge v-if="stats.additions > 0" class="bg-green-100 text-green-800">
            +{{ stats.additions }}
          </Badge>
          <Badge v-if="stats.deletions > 0" class="bg-red-100 text-red-800">
            -{{ stats.deletions }}
          </Badge>
        </div>
      </div>
    </CardHeader>
    
    <CardContent class="p-0">
      <div v-if="!hasChanges" class="p-8 text-center text-gray-500">
        <FileText class="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No changes detected</p>
        <p class="text-sm">Make edits to see differences here</p>
      </div>
      
      <div v-else>
        <!-- Controls -->
        <div class="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <Badge variant="outline">{{ stats.total }} lines</Badge>
            <span class="text-sm text-gray-600">
              {{ stats.additions }} additions, {{ stats.deletions }} deletions
            </span>
          </div>
          <div class="flex space-x-2">
            <Button @click="exportDiff" variant="outline" size="sm">
              <Download class="h-4 w-4 mr-2" />
              Export Diff
            </Button>
            <Button @click="revertChanges" variant="outline" size="sm">
              <RotateCcw class="h-4 w-4 mr-2" />
              Revert
            </Button>
          </div>
        </div>

        <!-- Diff View Tabs -->
        <Tabs default-value="unified" class="h-full">
          <TabsList class="w-full justify-start rounded-none border-b">
            <TabsTrigger value="unified">Unified</TabsTrigger>
            <TabsTrigger value="split">Split</TabsTrigger>
          </TabsList>
          
          <!-- Unified View -->
          <TabsContent value="unified" class="mt-0">
            <ScrollArea class="h-96">
              <div class="font-mono text-sm">
                <div
                  v-for="(line, index) in diffLines"
                  :key="index"
                  class="flex"
                  :class="getLineClass(line.type)"
                >
                  <div class="w-12 px-2 py-1 text-right text-gray-400 bg-gray-100 border-r">
                    {{ line.lineNumber.original || line.lineNumber.modified || '' }}
                  </div>
                  <div class="w-4 px-1 py-1 text-center text-gray-500">
                    {{ getLinePrefix(line.type) }}
                  </div>
                  <div class="flex-1 px-2 py-1 whitespace-pre-wrap break-all">
                    {{ line.content }}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <!-- Split View -->
          <TabsContent value="split" class="mt-0">
            <div class="grid grid-cols-2 gap-0 border-t">
              <!-- Original -->
              <div class="border-r">
                <div class="bg-red-50 px-4 py-2 text-sm font-medium text-red-800 border-b">
                  Original
                </div>
                <ScrollArea class="h-80">
                  <div class="font-mono text-sm">
                    <div
                      v-for="(line, index) in props.originalContent.split('\n')"
                      :key="'orig-' + index"
                      class="flex hover:bg-gray-50"
                    >
                      <div class="w-12 px-2 py-1 text-right text-gray-400 bg-gray-100 border-r">
                        {{ index + 1 }}
                      </div>
                      <div class="flex-1 px-2 py-1 whitespace-pre-wrap break-all">
                        {{ line }}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
              
              <!-- Modified -->
              <div>
                <div class="bg-green-50 px-4 py-2 text-sm font-medium text-green-800 border-b">
                  Modified
                </div>
                <ScrollArea class="h-80">
                  <div class="font-mono text-sm">
                    <div
                      v-for="(line, index) in props.modifiedContent.split('\n')"
                      :key="'mod-' + index"
                      class="flex hover:bg-gray-50"
                    >
                      <div class="w-12 px-2 py-1 text-right text-gray-400 bg-gray-100 border-r">
                        {{ index + 1 }}
                      </div>
                      <div class="flex-1 px-2 py-1 whitespace-pre-wrap break-all">
                        {{ line }}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </CardContent>
  </Card>
</template>