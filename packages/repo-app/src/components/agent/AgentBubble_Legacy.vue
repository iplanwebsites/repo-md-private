<script setup>
import { ref, computed, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	ArrowLeft,
	ChevronRight,
	Mic,
	Send,
	User,
	Users,
	MessageCircle,
	X,
	ChevronDown,
	RefreshCw,
	MicOff,
	Loader,
	Sparkles,
} from "lucide-vue-next";

import { conversationStarters, sampleConversations } from "./data.js";

import VoiceInputBrowser from "@/components/activity/form/VoiceInputBrowser.vue";

import trpc from "@/trpc";

// Props for patients
const props = defineProps({
	patients: {
		type: Array,
		default: () => [],
	},
});

// State management with Vue 3 refs
const isOpen = ref(false); // Bubble is closed by default
const activeTab = ref("general");
const selectedPatient = ref("");
const activeConversation = ref(null);
const conversations = ref(sampleConversations);
const newMessageInput = ref(""); // Track message input
const patientConversations = ref([]); // Patient-specific conversations
const conversationStatus = ref({}); // Track typing status, read receipts, etc.

const isLoading = ref(false);
const aiError = ref(null);
const isRecording = ref(false); // Track voice recording state

// Computed properties for view management
const showGeneralListing = computed(
	() => activeTab.value === "general" && !activeConversation.value,
);

const showActiveConversation = computed(
	() =>
		(activeTab.value === "general" || activeTab.value === "patient") &&
		activeConversation.value,
);

const showPatientListing = computed(
	() =>
		activeTab.value === "patient" &&
		selectedPatient.value &&
		!activeConversation.value,
);

const currentPatient = computed(() => {
	return props.patients.find((p) => p.id === selectedPatient.value);
});

// Computed property to check if patients exist
const hasPatients = computed(() => {
	return props.patients && props.patients.length > 0;
});

// Methods
const toggleBubble = () => {
	isOpen.value = !isOpen.value;
	if (!isOpen.value) {
		// Reset state when closing bubble
		activeConversation.value = null;
	}
};

const goBack = () => {
	activeConversation.value = null;
};

const startNewConversation = (starter) => {
	const newId = `conv-${Date.now()}`;
	const newConversation = {
		id: newId,
		title: starter.title,
		lastMessage: "",
		timestamp: new Date(),
		messages: [
			{
				id: 1,
				content: `Bonjour ! Comment puis-je vous aider concernant ${starter.title.toLowerCase()} ?`,
				sender: "ai",
				timestamp: new Date(),
			},
		],
		...(activeTab.value === "patient" && selectedPatient.value
			? { patientId: selectedPatient.value }
			: {}),
		status: "active",
	};

	// Add conversation to the appropriate list
	if (activeTab.value === "general") {
		conversations.value = [newConversation, ...conversations.value];
	} else if (activeTab.value === "patient" && selectedPatient.value) {
		patientConversations.value = [
			newConversation,
			...patientConversations.value,
		];
	}

	// Set as active conversation
	activeConversation.value = newConversation;

	// Initialize conversation status
	conversationStatus.value[newId] = {
		isTyping: false,
		unreadCount: 0,
	};
};

const startPatientConversation = (title) => {
	if (!selectedPatient.value) return;

	const newId = `${selectedPatient.value}-conv-${Date.now()}`;
	const newConversation = {
		id: newId,
		title: title,
		lastMessage: "",
		timestamp: new Date(),
		messages: [
			{
				id: 1,
				content: `Bonjour ! Comment puis-je vous aider concernant ${title.toLowerCase()} pour ${currentPatient.value?.name} ?`,
				sender: "ai",
				timestamp: new Date(),
			},
		],
		patientId: selectedPatient.value,
		status: "active",
	};

	patientConversations.value = [newConversation, ...patientConversations.value];
	activeConversation.value = newConversation;

	// Initialize conversation status
	conversationStatus.value[newId] = {
		isTyping: false,
		unreadCount: 0,
	};
};

const sendMessage = async () => {
	if (!newMessageInput.value.trim() || !activeConversation.value) return;

	// Add user message
	const userMessage = {
		id: Date.now(),
		content: newMessageInput.value.trim(),
		sender: "user",
		timestamp: new Date(),
	};

	activeConversation.value.messages.push(userMessage);
	activeConversation.value.lastMessage = userMessage.content;
	activeConversation.value.timestamp = new Date();

	// Clear input
	newMessageInput.value = "";

	// Set typing status
	if (conversationStatus.value[activeConversation.value.id]) {
		conversationStatus.value[activeConversation.value.id].isTyping = true;
	}

	try {
		isLoading.value = true;
		aiError.value = null;

		// Format messages for the API
		const formattedMessages = [];

		// 1. Add system message - simplified
		const systemContent =
			activeTab.value === "patient" && currentPatient.value
				? `Vous discutez du patient ${currentPatient.value.name}, âge ${currentPatient.value.age}. Dernière visite: ${currentPatient.value.lastVisit}.`
				: "Assistant médical";

		formattedMessages.push({
			role: "system",
			content: systemContent,
		});

		// 2. Add conversation history
		activeConversation.value.messages.forEach((msg) => {
			formattedMessages.push({
				role: msg.sender === "user" ? "user" : "assistant",
				content: msg.content,
			});
		});

		// Call the tRPC mutation with properly formatted messages
		const options = {
			messages: formattedMessages,
			conversationId: activeConversation.value.id,
			patientId: activeConversation.value.patientId || null,
			systemPrompt: systemContent,
		};

		const response = await trpc.openAiCompletion.mutate(options);

		// Add AI response
		if (response && response.content) {
			const aiResponse = {
				id: Date.now() + 1,
				content: response.content,
				sender: "ai",
				timestamp: new Date(),
			};

			activeConversation.value.messages.push(aiResponse);
			activeConversation.value.lastMessage = aiResponse.content;
			activeConversation.value.timestamp = new Date();
		} else {
			throw new Error("Empty response from AI");
		}
	} catch (err) {
		console.error("Error getting AI response:", err);
		aiError.value = "Échec de l'obtention d'une réponse. Veuillez réessayer.";

		// Add error message to conversation
		const errorMessage = {
			id: Date.now() + 1,
			content:
				"Je suis désolé, mais je n'ai pas pu traiter votre demande. Veuillez réessayer.",
			sender: "ai",
			timestamp: new Date(),
			isError: true,
		};

		activeConversation.value.messages.push(errorMessage);
		activeConversation.value.lastMessage = errorMessage.content;
		activeConversation.value.timestamp = new Date();
	} finally {
		isLoading.value = false;

		// Reset typing status
		if (conversationStatus.value[activeConversation.value.id]) {
			conversationStatus.value[activeConversation.value.id].isTyping = false;
		}
	}
};

const setPatient = (patientId) => {
	selectedPatient.value = patientId;
	activeConversation.value = null;

	// Load patient-specific conversations from backend in a real scenario
	// For now, reset conversations
	patientConversations.value = [];
};

const formatDate = (date) => {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
};

// Handle new voice input from VoiceInputBrowser
const handleNewVoiceInput = (text) => {
	// Ensure text is a string
	const newText = String(text).trim();
	if (!newText) return;

	// Update the input value directly
	newMessageInput.value = newMessageInput.value.trim()
		? `${newMessageInput.value.trim()} ${newText}`
		: newText;
};

// Update voice input model value
const updateVoiceInput = (value) => {
	newMessageInput.value = value;
};

// Watch for tab changes
watch(activeTab, (newTab) => {
	// Reset active conversation when switching tabs
	activeConversation.value = null;

	// Reset patient selection when switching to general tab
	if (newTab === "general") {
		selectedPatient.value = "";
	}
});
</script>

<template>
  <!-- Chat Bubble (Consistent UI for both open and closed states) -->
  <div class="fixed bottom-4 right-4 z-50">
    <!-- Chat button/toggle -->
    <Button
      size="icon"
      class="h-14 w-14 rounded-full shadow-lg crazy-shadow"
      @click="toggleBubble"
    >
      <MessageCircle v-if="!isOpen" class="h-6 w-6" />
      <ChevronDown v-else class="h-6 w-6" />
      <span class="sr-only">{{ isOpen ? "Fermer" : "Ouvrir" }} le chat</span>
    </Button>

    <!-- Expanded Chat Widget -->
    <Card
      v-if="isOpen"
      class="absolute bottom-16 right-0 w-[450px] shadow-xl crazy-shadow border-2 border-black flex flex-col h-[650px] bg-green-50"
    >
      <CardHeader class="p-0 relative flex-shrink-0">
        <Tabs
          :model-value="activeTab"
          class="w-full"
          @update:model-value="activeTab = $event"
        >
          <TabsList
            class="w-full rounded-none rounded-t-lg"
            :class="hasPatients ? 'grid grid-cols-2' : ''"
          >
            <TabsTrigger value="general" class="gap-2">
              <Users class="h-4 w-4" />
              Général
            </TabsTrigger>
            <TabsTrigger v-if="hasPatients" value="patient" class="gap-2">
              <User class="h-4 w-4" />
              Clients
            </TabsTrigger>
          </TabsList>
          <div
            v-if="activeTab === 'patient' && hasPatients"
            class="p-4 border-b"
          >
            <Select
              :model-value="selectedPatient"
              @update:model-value="setPatient"
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un patient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="patient in patients"
                  :key="patient.id"
                  :value="patient.id"
                >
                  {{ patient.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Tabs>
      </CardHeader>

      <CardContent class="p-4 overflow-auto flex-1">
        <!-- General Tab with Conversation List -->
        <div v-if="showGeneralListing" class="space-y-6">
          <div>
            <h3 class="font-semibold mb-3">
              Démarrer une nouvelle conversation
            </h3>
            <div class="space-y-2">
              <button
                v-for="starter in conversationStarters"
                :key="starter.id"
                @click="startNewConversation(starter)"
                class="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <span class="text-2xl">{{ starter.icon }}</span>
                <div class="flex-1">
                  <div class="font-medium">{{ starter.title }}</div>
                  <div class="text-sm text-muted-foreground">
                    {{ starter.description }}
                  </div>
                </div>
                <ChevronRight class="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div v-if="conversations.length > 0">
            <h3 class="font-semibold mb-3">Conversations précédentes</h3>
            <div class="space-y-2">
              <button
                v-for="conversation in conversations"
                :key="conversation.id"
                @click="activeConversation = conversation"
                class="w-full p-3 flex flex-col gap-1 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div class="flex items-center justify-between">
                  <div class="font-medium">{{ conversation.title }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ formatDate(conversation.timestamp) }}
                  </div>
                </div>
                <div
                  class="text-sm text-muted-foreground truncate max-w-[300px] line-clamp-2"
                >
                  {{ conversation.lastMessage || "Pas encore de messages" }}
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Patient Tab with Conversation List -->
        <div v-else-if="showPatientListing" class="space-y-6">
          <div>
            <h3 class="font-semibold mb-3">Informations du patient</h3>
            <div class="p-3 rounded-lg bg-muted mb-4">
              <div class="font-medium">{{ currentPatient?.name }}</div>
              <div class="text-sm text-muted-foreground">
                Dernière visite:
                {{ currentPatient?.lastVisit }}
              </div>
            </div>

            <h3 class="font-semibold mb-3">
              Démarrer une nouvelle conversation
            </h3>
            <div class="space-y-2">
              <button
                v-for="option in [
                  'Révision de médicaments',
                  'Plan de traitement',
                  'Résultats de tests',
                  'Planification de rendez-vous',
                ]"
                :key="option"
                @click="startPatientConversation(option)"
                class="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div class="font-medium">{{ option }}</div>
                <ChevronRight class="h-4 w-4 ml-auto text-muted-foreground" />
              </button>
            </div>
          </div>

          <div v-if="patientConversations.length > 0">
            <h3 class="font-semibold mb-3">Conversations précédentes</h3>
            <div class="space-y-2">
              <button
                v-for="conversation in patientConversations"
                :key="conversation.id"
                @click="activeConversation = conversation"
                class="w-full p-3 flex flex-col gap-1 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div class="flex items-center justify-between">
                  <div class="font-medium">{{ conversation.title }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ formatDate(conversation.timestamp) }}
                  </div>
                </div>
                <div
                  class="text-sm text-muted-foreground truncate max-w-[300px] line-clamp-2"
                >
                  {{ conversation.lastMessage || "Pas encore de messages" }}
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Active Conversation View -->
        <div v-else-if="showActiveConversation" class="flex flex-col h-full">
          <div class="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="icon" @click="goBack">
              <ArrowLeft class="h-4 w-4" />
            </Button>
            <div class="font-medium">{{ activeConversation.title }}</div>
            <div
              v-if="activeTab === 'patient' && currentPatient"
              class="text-xs text-muted-foreground ml-auto"
            >
              {{ currentPatient.name }}
            </div>
          </div>

          <div class="space-y-4 flex-1 overflow-y-auto mb-4 pr-2">
            <div
              v-for="message in activeConversation.messages"
              :key="message.id"
              class="flex"
              :class="
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              "
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
                <!--  
                <hr />
                <div>{{ message.content }}</div>
                -->
                <div class="text-xs opacity-70 mt-1">
                  {{ formatDate(message.timestamp) }}
                </div>
              </div>
            </div>

            <div
              v-if="conversationStatus[activeConversation.id]?.isTyping"
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
          </div>
          <!-- 
          <VoiceInputBrowser
            v-model="newMessageInput"
            :disabled="isLoading"
            @transcribing="isRecording = $event"
            @newVoiceInput="handleNewVoiceInput"
            class="flex-shrink-0"
          /> -->
          <div class="flex items-center gap-2 mt-auto">
            <VoiceInputBrowser
              v-model="newMessageInput"
              :disabled="isLoading"
              @transcribing="isRecording = $event"
              @newVoiceInput="handleNewVoiceInput"
              class="flex-shrink-0"
            >
              <!-- Default slot for customizing the button -->
              <template v-slot="{ isRecording, isTranscribing, isRetrying }">
                <div>
                  <!-- 
                  {{ isRecording }} ==isRecording

                  <br />
                  {{ isTranscribing }} == isTranscribing
                  <br />
                  {{ isRetrying }} == isRetrying
                    -->
                </div>

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
                  <Loader
                    v-else-if="isTranscribing"
                    class="h-4 w-4 animate-spin"
                  />
                  <RefreshCw
                    v-else-if="isRetrying"
                    class="h-4 w-4 animate-spin"
                  />
                  <Mic v-else class="h-4 w-4" />
                  <span class="sr-only">Entrée vocale</span>
                </Button>
              </template>
            </VoiceInputBrowser>
            <Input
              v-model="newMessageInput"
              placeholder="Tapez votre message..."
              class="flex-1"
              @keyup.enter="sendMessage"
              :disabled="isLoading || isRecording"
            />
            <Button
              size="icon"
              class="shrink-0"
              @click="sendMessage"
              :disabled="isLoading || isRecording || !newMessageInput.trim()"
            >
              <Send class="h-4 w-4" />
              <span class="sr-only">Envoyer le message</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.crazy-shadow {
  box-shadow:
    0 20px 25px -5px rgb(20 149 74 / 72%),
    0 8px 10px -6px rgb(0 0 0 / 0.1);
}
</style>
