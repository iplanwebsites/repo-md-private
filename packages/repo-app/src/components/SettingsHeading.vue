<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ""
  }
});
</script>

<template>
  <div class="flex justify-between items-start mb-6">
    <div>
      <h2 class="text-2xl font-semibold">{{ title }}</h2>
      <p v-if="subtitle" class="text-muted-foreground text-sm mt-1">
        {{ subtitle }}
      </p>
    </div>
    
    <div>
      <slot></slot>
    </div>
  </div>
</template>