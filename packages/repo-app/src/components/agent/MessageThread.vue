<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Mic, Loader, MicOff } from "lucide-vue-next";
import { useConversationStore } from "@/store/conversationStore";
import Prose from "@/components/Prose.vue";
import VoiceInputBrowser from "@/components/activity/form/VoiceInputBrowser.vue";
import ElipsisMenu from "@/components/ElipsisMenu.vue";

const props = defineProps({
	menuItems: {
		type: Array,
		default: () => [],
	},
});

const conversationStore = useConversationStore();
const messagesRef = ref(null);

// Compute if we should show message pills
const shouldShowPills = computed(() => {
	return (
		conversationStore.showPillsInsteadOfFirstMessage &&
		conversationStore.activeConversation &&
		conversationStore.activeConversation.messages.length === 0
	);
});

// Get starter pills for current conversation
const starterPills = computed(() => {
	if (!conversationStore.activeConversation) return [];

	// For patient conversations - use fetched pills if available
	if (conversationStore.activeConversation.type === "patient") {
		const patientId = conversationStore.activeConversation.patientId;
		if (patientId && conversationStore.suggestedPills.patient[patientId]) {
			return conversationStore.suggestedPills.patient[patientId];
		}
		// Fallback if no pills fetched yet
		return [
			{
				id: "patient-pill",
				text: `Discuter du cas de ${conversationStore.activeConversation.patientName}`,
				icon: "👤",
			},
		];
	}

	// For meeting conversations - use fetched pills if available
	if (conversationStore.activeConversation.type === "meeting") {
		const meetingId = conversationStore.activeConversation.meetingId;
		if (meetingId && conversationStore.suggestedPills.meeting[meetingId]) {
			return conversationStore.suggestedPills.meeting[meetingId];
		}
		// Fallback if no pills fetched yet
		return [
			{
				id: "meeting-default-pill",
				text:
					conversationStore.activeConversation.firstMessageContent ||
					"Discuter de cette consultation",
				icon: "📅",
			},
		];
	}

	// Return starter-specific pills if conversation has a starter
	if (conversationStore.activeConversation.starter) {
		return [
			{
				id: "starter-pill",
				text: conversationStore.activeConversation.starter.message,
				icon: conversationStore.activeConversation.starter.icon || "💬",
			},
		];
	}

	// Default pills
	return conversationStore.conversationStarters.slice(0, 3).map((starter) => ({
		id: starter.id,
		text: starter.message,
		icon: starter.icon || "💬",
	}));
});

// Scroll to bottom when messages change
watch(
	() => conversationStore.activeConversation?.messages,
	() => {
		nextTick(() => {
			scrollToBottom();
		});
	},
	{ deep: true },
);

onMounted(() => {
	scrollToBottom();
});

function scrollToBottom() {
	if (messagesRef.value) {
		messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
	}
}

function handleSendMessage() {
	conversationStore.sendMessage();
}

function handleKeyup(event) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		handleSendMessage();
	}
}

function sendPillMessage(pill) {
	conversationStore.sendMessage(pill.text);
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" @click="conversationStore.goBack">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <div class="font-medium">
          {{ conversationStore.activeConversation.title }}
        </div>
      </div>
      <ElipsisMenu v-if="menuItems && menuItems.length" :items="menuItems" />
    </div>

    <!-- Messages -->
    <div ref="messagesRef" class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Message Pills when no messages exist yet -->
      <div v-if="shouldShowPills" class="flex flex-col gap-2">
        <p class="text-sm text-muted-foreground mb-2">
          Comment puis-je vous aider aujourd'hui ?
        </p>

        <!-- Loading indicator for pills -->
        <div
          v-if="conversationStore.suggestedPills.isLoading"
          class="flex items-center justify-center py-3"
        >
          <div
            class="animate-spin h-4 w-4 mr-2 border-2 border-primary rounded-full border-t-transparent"
          ></div>
          <span class="text-sm text-muted-foreground"
            >Chargement des suggestions...</span
          >
        </div>

        <!-- Error message if pill loading failed -->
        <div
          v-else-if="conversationStore.suggestedPills.error"
          class="text-sm text-destructive py-2"
        >
          {{ conversationStore.suggestedPills.error }}
        </div>

        <!-- Pills -->
        <Button
          v-for="pill in starterPills"
          :key="pill.id"
          variant="outline"
          class="justify-start text-left transition-all hover:bg-muted"
          @click="sendPillMessage(pill)"
        >
          <span class="mr-2">{{ pill.icon }}</span>
          <span>{{ pill.title || pill.text }}</span>
        </Button>
      </div>

      <!-- Regular message thread -->
      <template v-else>
        <div
          v-for="message in conversationStore.activeConversation.messages"
          :key="message.id"
          class="flex"
          :class="message.sender === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="rounded-lg px-4 py-2 max-w-[80%]"
            :class="
              message.sender === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            "
          >
            <Prose :md="message.content" :max-height="0" />
            <div class="text-xs opacity-70 mt-1">
              {{ conversationStore.formatDate(message.timestamp) }}
            </div>
          </div>
        </div>

        <div
          v-if="
            conversationStore.conversationStatus[
              conversationStore.activeConversation.id
            ]?.isTyping
          "
          class="flex justify-start"
        >
          <div class="rounded-lg px-4 py-2 bg-muted text-foreground">
            <div class="flex items-center gap-1">
              <span class="animate-pulse">•</span>
              <span class="animate-pulse delay-75">•</span>
              <span class="animate-pulse delay-150">•</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Input -->
    <div class="p-4 border-t">
      <div class="flex items-center gap-2">
        <VoiceInputBrowser
          v-model="conversationStore.newMessageInput"
          :disabled="conversationStore.isLoading"
          @transcribing="conversationStore.isRecording = $event"
          @newVoiceInput="conversationStore.handleNewVoiceInput"
          class="flex-shrink-0"
        >
          <template v-slot="{ isRecording, isTranscribing, isRetrying }">
            <Button
              variant="ghost"
              size="icon"
              class="shrink-0"
              :class="{
                'text-red-500': isRecording,
                'animate-pulse': isRecording,
              }"
            >
              <Mic v-if="!isRecording" class="h-4 w-4" />
              <Loader v-else-if="isTranscribing" class="h-4 w-4 animate-spin" />
              <MicOff v-else class="h-4 w-4" />
              <span class="sr-only">Entrée vocale</span>
            </Button>
          </template>
        </VoiceInputBrowser>
        <Input
          v-model="conversationStore.newMessageInput"
          placeholder="Tapez votre message..."
          class="flex-1"
          @keyup="handleKeyup"
          :disabled="
            conversationStore.isLoading || conversationStore.isRecording
          "
        />
        <Button
          size="icon"
          class="shrink-0"
          @click="handleSendMessage"
          :disabled="
            conversationStore.isLoading ||
            conversationStore.isRecording ||
            !conversationStore.newMessageInput.trim()
          "
        >
          <Send class="h-4 w-4" />
          <span class="sr-only">Envoyer le message</span>
        </Button>
      </div>
    </div>
  </div>
</template>
