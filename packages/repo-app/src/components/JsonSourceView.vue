<script setup>
// Feature flag to control JSON viewer - set to true to always use simple view
const USE_SIMPLE_JSON_VIEWER = true;

import { ref, computed, onMounted } from "vue";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import { FileCode, FileText, File } from "lucide-vue-next";
import { ScrollArea } from "@/components/ui/scroll-area";

const props = defineProps({
  content: {
    type: [String, Object],
    required: true
  },
  fileType: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  extension: {
    type: String,
    default: ''
  },
  maxHeight: {
    type: String,
    default: "calc(70vh - 100px)"
  }
});

// Check if content is large (> 30KB)
const isLargeFile = computed(() => {
  if (typeof props.content === 'string') {
    return props.content.length > 30 * 1024; // 30KB
  }
  return false;
});

// Determine if content is JSON and not too large
const isJson = computed(() => {
  // If the simple viewer flag is enabled, always return false to use simple view
  if (USE_SIMPLE_JSON_VIEWER) return false;
  
  // If it's a large file, don't use JSON viewer
  if (isLargeFile.value) return false;
  
  // Check if the fileType contains 'json' or the extension is 'json'
  const jsonByType = props.fileType?.includes('json') || props.extension === 'json';
  
  // If already determined by filetype/extension
  if (jsonByType) return true;
  
  // Otherwise, try to parse if it's a string
  if (typeof props.content === 'string') {
    try {
      JSON.parse(props.content);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // If it's already an object, it's likely JSON
  return typeof props.content === 'object';
});

// Parse JSON content if needed
const parsedJson = computed(() => {
  if (!isJson.value) return null;
  
  if (typeof props.content === 'string') {
    try {
      return JSON.parse(props.content);
    } catch (e) {
      console.error("Error parsing JSON content:", e);
      return null;
    }
  }
  
  return props.content; // Already an object
});

// Determine if content is code (JS, TS, CSS, etc.)
const isCode = computed(() => {
  const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'vue', 'css', 'scss', 'less', 'html', 'xml', 'php', 'py', 'rb', 'go', 'java', 'c', 'cpp', 'cs'];
  return codeExtensions.includes(props.extension) || 
         (props.fileType && props.fileType.includes('javascript') || 
          props.fileType.includes('typescript') || 
          props.fileType.includes('css'));
});

// Determine icon to use based on file type
const fileIcon = computed(() => {
  // Code files
  if (isCode.value) {
    return FileCode;
  }
  // Text and JSON files
  if (isJson.value || 
      props.extension === 'md' || 
      props.extension === 'txt' || 
      (props.fileType && props.fileType.includes('text'))) {
    return FileText;
  }
  // Default icon
  return File;
});

// Get language class for syntax highlighting
const getLanguageClass = computed(() => {
  const map = {
    'js': 'language-javascript',
    'ts': 'language-typescript',
    'jsx': 'language-javascript',
    'tsx': 'language-typescript',
    'vue': 'language-html',
    'css': 'language-css',
    'scss': 'language-css',
    'less': 'language-css',
    'html': 'language-html',
    'xml': 'language-xml',
    'php': 'language-php',
    'py': 'language-python',
    'rb': 'language-ruby',
    'go': 'language-go',
    'java': 'language-java',
    'c': 'language-c',
    'cpp': 'language-cpp',
    'cs': 'language-csharp',
    'json': 'language-json',
    'md': 'language-markdown',
    'txt': 'language-plaintext',
  };
  
  return map[props.extension] || 'language-plaintext';
});
</script>

<template>
  <div class="code-viewer">
    <!-- Large file notification for JSON -->
    <div 
      v-if="!USE_SIMPLE_JSON_VIEWER && isLargeFile && (fileType?.includes('json') || extension === 'json')" 
      class="text-amber-600 text-xs mb-2 px-2"
    >
      <span>Large JSON file (> 30KB) - Using simple view for better performance</span>
    </div>
    
    <!-- No notification for simple JSON view -->
    
    <!-- JSON content with vue-json-pretty for smaller files -->
    <ScrollArea v-if="isJson && parsedJson" :style="{ maxHeight }">
      <div class="p-1">
        <vue-json-pretty
          :path="'res'"
          :data="parsedJson"
          :highlightMouseoverNode="true"
          :showDoubleQuotes="false"
          :showLength="true"
          :deep="2"
        />
      </div>
    </ScrollArea>
    
    <!-- Regular content display for non-JSON or large files -->
    <ScrollArea v-else :style="{ maxHeight }">
      <pre
        class="text-sm p-3 bg-gray-50 rounded border border-gray-200 overflow-auto"
        :class="getLanguageClass"
      >{{ content }}</pre>
    </ScrollArea>
  </div>
</template>

<style scoped>
.code-viewer {
  width: 100%;
  height: 100%;
}

/* Base code styling */
pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  tab-size: 2;
}

/* Language-specific styling could be added here */
.language-javascript, .language-typescript, .language-json {
  color: #333;
  background-color: #f5f5f5;
}

/* Syntax highlighting for JSON */
.language-json .string { color: #008000; }
.language-json .number { color: #0000ff; }
.language-json .boolean { color: #b22222; }
.language-json .null { color: #808080; }
.language-json .key { color: #a52a2a; }

/* Additional language styles */
.language-html, .language-xml { color: #333; }
.language-css { color: #333; }
.language-markdown { color: #333; }
</style>