<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  date: {
    type: [String, Date],
    required: true
  }
})

const currentTime = ref(Date.now())
let updateInterval = null

const timeAgo = computed(() => {
  if (!props.date) return ""
  
  try {
    const now = currentTime.value
    const past = new Date(props.date).getTime()
    const diffMs = now - past
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return `${diffSecs}s ago`
  } catch {
    return props.date
  }
})

const updateFrequency = computed(() => {
  if (!props.date) return null
  
  const now = currentTime.value
  const past = new Date(props.date).getTime()
  const diffMs = now - past
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMins / 60)
  
  // Less than 1 minute: update every second
  if (diffMins < 1) return 1000
  // Less than 1 hour: update every minute
  if (diffHours < 1) return 60000
  // Less than 1 day: update every hour
  if (diffHours < 24) return 3600000
  // More than 1 day: update every day
  return 86400000
})

const startUpdating = () => {
  stopUpdating()
  
  const frequency = updateFrequency.value
  if (frequency) {
    updateInterval = setInterval(() => {
      currentTime.value = Date.now()
      // Recalculate frequency and restart if needed
      const newFrequency = updateFrequency.value
      if (newFrequency !== frequency) {
        startUpdating()
      }
    }, frequency)
  }
}

const stopUpdating = () => {
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
}

onMounted(() => {
  currentTime.value = Date.now()
  startUpdating()
})

onUnmounted(() => {
  stopUpdating()
})
</script>

<template>
  <span>{{ timeAgo }}</span>
</template>