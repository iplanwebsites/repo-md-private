<script setup>
import { ref, onMounted, nextTick } from "vue";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-vue-next";
import hljs from 'highlight.js/lib/core';

// Import common languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import html from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('html', html);
hljs.registerLanguage('xml', html);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('python', python);

const props = defineProps({
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    default: 'plaintext',
  },
  showLineNumbers: {
    type: Boolean,
    default: false,
  },
  maxHeight: {
    type: String,
    default: '400px',
  },
  noScroll: {
    type: Boolean,
    default: false,
  },
});

const codeRef = ref(null);
const copied = ref(false);
const highlightedCode = ref('');

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.code);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1000);
  } catch (err) {
    console.error('Failed to copy code:', err);
  }
};

const highlightCode = () => {
  if (!props.code) {
    highlightedCode.value = '';
    return;
  }

  try {
    if (props.language && props.language !== 'plaintext' && hljs.getLanguage(props.language)) {
      const result = hljs.highlight(props.code, { language: props.language });
      highlightedCode.value = result.value;
    } else {
      // Auto-detect language or use as plaintext
      const result = hljs.highlightAuto(props.code);
      highlightedCode.value = result.value;
    }
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    // Fall back to escaped plain text
    highlightedCode.value = escapeHtml(props.code);
  }
};

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const addLineNumbers = (code) => {
  if (!props.showLineNumbers) return code;
  
  const lines = code.split('\n');
  return lines
    .map((line, index) => {
      const lineNumber = (index + 1).toString().padStart(2, ' ');
      return `<span class="line-number">${lineNumber}</span>${line}`;
    })
    .join('\n');
};

onMounted(async () => {
  await nextTick();
  highlightCode();
});

// Watch for code changes
import { watch } from 'vue';
watch(() => props.code, highlightCode, { immediate: true });
watch(() => props.language, highlightCode);
</script>

<template>
  <div class="code-block-container">
    <div class="code-block-header">
      <span v-if="language && language !== 'plaintext'" class="language-label">
        {{ language }}
      </span>
      <Button
        variant="ghost"
        size="sm"
        @click="copyToClipboard"
        class="copy-button"
        :class="{ 'copied': copied }"
      >
        <Check v-if="copied" class="w-4 h-4 text-green-500" />
        <Copy v-else class="w-4 h-4" />
      </Button>
    </div>
    <div 
      class="code-block-content" 
      :class="{ 'no-scroll': noScroll }"
      :style="noScroll ? {} : { maxHeight }"
    >
      <pre 
        ref="codeRef" 
        class="code-pre"
        :class="{ 'line-numbers': showLineNumbers }"
      ><code 
        class="hljs" 
        :class="`language-${language}`"
        v-html="addLineNumbers(highlightedCode)"
      ></code></pre>
    </div>
  </div>
</template>

<style scoped>
.code-block-container {
  position: relative;
  background-color: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 8px;
  overflow: hidden;
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #f1f3f4;
  border-bottom: 1px solid #e1e4e8;
  min-height: 40px;
}

.language-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #586069;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.copy-button {
  padding: 0.25rem;
  height: auto;
  min-height: auto;
  transition: all 0.2s ease;
}

.copy-button:hover {
  background-color: #e1e4e8;
}

.copy-button.copied {
  background-color: #d4edda;
}

.code-block-content {
  overflow: auto;
  position: relative;
}

.code-block-content.no-scroll {
  overflow: visible;
  max-height: none !important;
}

.code-pre {
  margin: 0;
  padding: 1rem;
  background-color: transparent;
  border: none;
  border-radius: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #24292e;
  overflow-x: auto;
  white-space: pre;
}

.code-pre.line-numbers {
  padding-left: 3.5rem;
  position: relative;
}

:deep(.line-number) {
  position: absolute;
  left: 0;
  width: 3rem;
  padding-right: 1rem;
  text-align: right;
  color: #6a737d;
  background-color: #f6f8fa;
  border-right: 1px solid #e1e4e8;
  user-select: none;
  pointer-events: none;
}

/* Highlight.js theme customization */
:deep(.hljs) {
  background: transparent;
  color: #24292e;
}

:deep(.hljs-keyword),
:deep(.hljs-selector-tag),
:deep(.hljs-title),
:deep(.hljs-section),
:deep(.hljs-doctag),
:deep(.hljs-name),
:deep(.hljs-strong) {
  color: #d73a49;
  font-weight: 600;
}

:deep(.hljs-string),
:deep(.hljs-attr) {
  color: #032f62;
}

:deep(.hljs-comment),
:deep(.hljs-quote),
:deep(.hljs-variable),
:deep(.hljs-template-variable),
:deep(.hljs-tag),
:deep(.hljs-regexp),
:deep(.hljs-meta),
:deep(.hljs-number),
:deep(.hljs-built_in),
:deep(.hljs-builtin-name),
:deep(.hljs-literal),
:deep(.hljs-params),
:deep(.hljs-symbol),
:deep(.hljs-bullet),
:deep(.hljs-code),
:deep(.hljs-formula) {
  color: #6a737d;
}

:deep(.hljs-function),
:deep(.hljs-class),
:deep(.hljs-type) {
  color: #6f42c1;
}

:deep(.hljs-attribute) {
  color: #005cc5;
}

:deep(.hljs-subst) {
  color: #24292e;
}

:deep(.hljs-emphasis) {
  font-style: italic;
}

:deep(.hljs-deletion) {
  background-color: #ffeef0;
}

:deep(.hljs-addition) {
  background-color: #f0fff4;
}

/* Custom scrollbar for code block */
.code-block-content::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.code-block-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.code-block-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.code-block-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.code-block-content {
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f1f1f1;
}
</style>