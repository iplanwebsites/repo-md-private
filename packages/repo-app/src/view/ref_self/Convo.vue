# Convo.vue
<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import { Loader2, Send } from "lucide-vue-next";
import VoiceInputBrowser from "@/components/activity/form/VoiceInputBrowser.vue";
import trpc from "@/trpc";

// Route and token handling
const route = useRoute();
const convoId = computed(() => route.params.id);

// State management
const convo = ref({});
const messages = ref([]);
const newMessage = ref("");
const isLoading = ref(true);
const isSending = ref(false);
const isRecording = ref(false);
const messagesContainer = ref(null);

// Scroll to bottom of messages
const scrollToBottom = async () => {
	await nextTick();
	if (messagesContainer.value) {
		messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
	}
};

// Initial conversation fetch
const fetchInitialConversation = async () => {
	if (!convoId.value) return;

	try {
		const response = await trpc.getConvoById.query({
			token: convoId.value,
		});
		messages.value = response.messages || [];
	} catch (error) {
		console.error("Failed to fetch conversation:", error);
	} finally {
		isLoading.value = false;
		await scrollToBottom();
	}
};

// Handle new voice input
const handleNewVoiceInput = (text) => {
	// Ensure text is a string
	const newText = String(text).trim();
	if (!newText) return;

	// Update the input value directly
	newMessage.value = newMessage.value.trim()
		? `${newMessage.value.trim()} ${newText}`
		: newText;
};

// Update voice input model value
const updateVoiceInput = (value) => {
	newMessage.value = value;
};

// Handle message submission
const handleSubmit = async () => {
	if (!newMessage.value.trim() || isSending.value) return;

	const messageContent = newMessage.value;

	// Add user message immediately
	messages.value.push({
		role: "user",
		content: messageContent,
	});

	// Clear input and scroll
	newMessage.value = "";
	await scrollToBottom();

	isSending.value = true;

	try {
		const response = await trpc.replyConvo.query({
			token: convoId.value,
			message: messageContent,
		});

		if (response.message) {
			messages.value.push(response.message);
			await scrollToBottom();
		}
	} catch (error) {
		console.error("Failed to send message:", error);
	} finally {
		isSending.value = false;
	}
};

// Initialize on component mount
onMounted(() => {
	fetchInitialConversation();
});
</script>

<template>
  <JsonDebug :data="convo" :expanded="false" />
  <JsonDebug :data="messages" :expanded="false" />
  <div class="flex flex-col h-screen max-w-4xl mx-auto p-4">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <Loader2 class="w-8 h-8 animate-spin" />
    </div>

    <!-- Chat Messages -->
    <div
      v-else
      ref="messagesContainer"
      class="flex-1 overflow-y-auto space-y-4 mb-4"
    >
      <!-- Default Welcome Message -->
      <div v-if="messages.length === 0" class="text-center text-gray-500 py-8">
        Start a conversation! Ask me anything.
      </div>

      <!-- Message List -->
      <div
        v-for="(message, index) in messages"
        :key="index"
        class="flex"
        :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[80%] rounded-lg p-4"
          :class="[
            message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100',
          ]"
        >
          {{ message.content }}
        </div>
      </div>
    </div>

    <!-- Message Input Form -->
    <form @submit.prevent="handleSubmit" class="flex gap-2">
      <input
        v-model="newMessage"
        type="text"
        placeholder="Type your message..."
        class="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        :disabled="isSending || isRecording"
      />
      <VoiceInputBrowser
        :model-value="newMessage"
        @update:model-value="updateVoiceInput"
        :disabled="isSending"
        @transcribing="isRecording = $event"
        @newVoiceInput="handleNewVoiceInput"
        class="flex-shrink-0"
      />
      <button
        type="submit"
        :disabled="isSending || isRecording || !newMessage.trim()"
        class="p-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
      >
        <Loader2 v-if="isSending" class="w-6 h-6 animate-spin" />
        <Send v-else class="w-6 h-6" />
      </button>
    </form>
  </div>
</template>

<style scoped>
.message-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

.message-container::-webkit-scrollbar {
  width: 6px;
}

.message-container::-webkit-scrollbar-track {
  background: transparent;
}

.message-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}
</style>
