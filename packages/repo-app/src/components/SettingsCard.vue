<script setup>
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-vue-next";
import { computed } from 'vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  isSaving: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  save: {
    type: Boolean,
    default: true
  },
  saveText: {
    type: String,
    default: 'Save'
  },
  more: {
    type: [String, Object],
    default: null
  },
  moreText: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['save']);

const handleSave = () => {
  emit('save');
};

// Compute if we should show the footer
const showFooter = computed(() => {
  return props.save || props.more;
});
</script>

<template>
  <div class="rounded-lg border bg-card mb-6">
    <div class="p-6">
      <div class="mb-4">
        <h3 class="text-lg font-medium mb-1">{{ title }}</h3>
        <p v-if="description" class="text-sm text-muted-foreground">
          {{ description }}
        </p>
      </div>
      
      <slot></slot>
    </div>
    
    <!-- Footer with save button and/or "more" link -->
    <div v-if="showFooter" class="text-xs text-muted-foreground bg-muted mt-2 text-sm flex items-center p-4 border-t" :class="{'justify-between': more, 'justify-end': !more}">
      <div v-if="more">
        Learn more about
        <router-link :to="more" class="text-blue-500 hover:underline gap-1">
          {{ moreText || title }}
        </router-link>
      </div>
      
      <Button 
        v-if="save" 
        variant="outline" 
        size="sm"
        @click="handleSave" 
        :disabled="disabled || isSaving"
      >
        <span v-if="isSaving" class="flex items-center">
          <RotateCw class="animate-spin h-4 w-4 mr-2" />
          Saving...
        </span>
        <span v-else>{{ saveText }}</span>
      </Button>
    </div>
  </div>
</template>