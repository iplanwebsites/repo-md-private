<script setup>
import { computed } from 'vue'
import { Clock, XCircle } from 'lucide-vue-next'

const props = defineProps({
  status: {
    type: String,
    required: true
  },
  createdAt: {
    type: [String, Date],
    required: true
  }
})

const isPending = computed(() => 
  props.status?.toLowerCase() === 'pending' || props.status?.toLowerCase() === 'queued'
)

const timeInfo = computed(() => {
  if (!isPending.value || !props.createdAt) return { isRecent: false, isLost: false, hours: 0 }
  
  try {
    const now = new Date()
    const created = new Date(props.createdAt)
    const diffMs = now - created
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    
    return {
      isRecent: diffMins < 30,
      isLost: diffHours >= 6,
      hours: diffHours
    }
  } catch {
    return { isRecent: false, isLost: false, hours: 0 }
  }
})
</script>

<template>
  <div class="flex items-center">
    <!-- Lost job (pending > 6 hours) -->
    <template v-if="timeInfo.isLost">
      <XCircle class="w-4 h-4 mr-2 text-red-500" />
      <span class="text-sm text-red-600">
        Failed
      </span>
    </template>
    
    <!-- Normal pending -->
    <template v-else>
      <Clock 
        :class="[
          'w-4 h-4 mr-2 text-yellow-500',
          { 'animate-pulse': timeInfo.isRecent }
        ]" 
      />
      <span class="text-sm capitalize">
        {{ status }}
        <span 
          v-if="timeInfo.isRecent" 
          class="inline-flex"
        >
          <span class="animate-bounce" style="animation-delay: 0ms;">.</span>
          <span class="animate-bounce" style="animation-delay: 150ms;">.</span>
          <span class="animate-bounce" style="animation-delay: 300ms;">.</span>
        </span>
      </span>
    </template>
  </div>
</template>

<style scoped>
@keyframes bounce {
  0%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-4px);
  }
}

.animate-bounce {
  animation: bounce 1.5s infinite;
}
</style>