<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Can accept either a string like "+145 -23" or separate plus/minus values
  changes: {
    type: String,
    default: ''
  },
  plus: {
    type: [Number, String],
    default: null
  },
  minus: {
    type: [Number, String],
    default: null
  }
})

// Parse the values intelligently
const parsedValues = computed(() => {
  // If plus and minus are provided directly, use them
  if (props.plus !== null && props.minus !== null) {
    return {
      plus: props.plus,
      minus: props.minus
    }
  }
  
  // Otherwise, parse from the changes string
  if (props.changes) {
    const parts = props.changes.split(' ')
    return {
      plus: parts[0] || '+0',
      minus: parts[1] || '-0'
    }
  }
  
  return { plus: '+0', minus: '-0' }
})
</script>

<template>
  <span class="text-sm font-medium">
    <span class="text-green-600 dark:text-green-400">{{ parsedValues.plus }}</span>
    <span>&nbsp;</span>
    <span class="text-red-600 dark:text-red-400">{{ parsedValues.minus }}</span>
  </span>
</template>