<script setup>
import { ref, onMounted, watch, nextTick } from "vue";

const props = defineProps({
	messages: {
		type: Array,
		default: () => [],
	},
	currentAssistantMessage: {
		type: String,
		default: "",
	},
	showSystemMessages: {
		type: Boolean,
		default: true,
	},
	showToolMessages: {
		type: Boolean,
		default: true,
	},
});

const messageContainer = ref(null);

// Scroll to bottom of messages
const scrollToBottom = async () => {
	await nextTick();
	if (messageContainer.value) {
		messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
	}
};

// Watch for changes in messages or currentAssistantMessage to auto-scroll
watch(() => props.messages.length, scrollToBottom);
watch(() => props.currentAssistantMessage, scrollToBottom);

onMounted(scrollToBottom);

// Filter messages based on showSystemMessages and showToolMessages props
const filteredMessages = computed(() => {
	return props.messages.filter((message) => {
		if (message.role === "system" && !props.showSystemMessages) return false;
		if (message.role === "tool" && !props.showToolMessages) return false;
		return true;
	});
});
</script>

<template>
  <div
    ref="messageContainer"
    class="message-thread flex-1 p-4 overflow-y-auto space-y-4"
  >
    <!-- Regular messages -->
    <div
      v-for="message in filteredMessages"
      :key="message.id"
      class="flex flex-col space-y-1"
      :class="{
        'items-end': message.role === 'user',
        'items-start': message.role !== 'user',
      }"
    >
      <div
        class="px-4 py-2 rounded-lg max-w-[80%] break-words"
        :class="{
          'bg-blue-500 text-white': message.role === 'user',
          'bg-gray-100 text-gray-900': message.role === 'assistant',
          'bg-yellow-100 text-yellow-900': message.role === 'system',
          'bg-green-100 text-green-900': message.role === 'tool',
          'bg-red-100 text-red-900': message.role === 'error',
        }"
      >
        {{ message.content }}
      </div>
      <span class="text-xs text-gray-500">{{ message.timestamp }}</span>
    </div>

    <!-- Streaming message indicator -->
    <div
      v-if="currentAssistantMessage"
      class="flex flex-col space-y-1 items-start"
    >
      <div
        class="px-4 py-2 rounded-lg max-w-[80%] bg-gray-100 text-gray-900 break-words"
      >
        {{ currentAssistantMessage }}
        <span class="inline-block animate-pulse">▋</span>
      </div>
    </div>
  </div>
</template>
