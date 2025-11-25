<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from "vue";
import { Mic, MicOff, Send, Power, PowerOff } from "lucide-vue-next";
import { useRoute, useRouter } from "vue-router";
import { Loader2, Hand } from "lucide-vue-next";
import { OpenAIRealtimeClient } from "../../lib/realtime";
import { isLocalhost } from "@/lib/utils/devUtils.js";

import MultipleChoice from "@/components/activity/realtime/MultipleChoice.vue";
import MessageThread from "@/components/activity/realtime/RealtimeMessageThread.vue"; // Import the new component

import ActivityOutro from "@/components/activity/ActivityOutro.vue";

import trpc from "@/trpc";

const router = useRouter();

const isDev = isLocalhost();

const AUTO_CONNECT = true; // disable to manually connect, useful for debugging

// Route and token handling
const route = useRoute();
const convoId = computed(() => route.params.id);
const isLoading = ref(true);
const convo = ref({});

// State
const client = ref(null);
const isConnected = ref(false);
const isConnecting = ref(false); // New state to track connection in progress
const isRecording = ref(false);
const turnDetection = ref(true);
const textMessage = ref("");
const ephemeralToken = ref("");
const messages = ref([]);
const currentAssistantMessage = ref(""); // To accumulate streaming response
const connectionError = ref(""); // Track connection error messages

// Display preferences
const showSystemMessages = ref(false);
const showToolMessages = ref(false);

const activityDone = ref(false);

// Add these refs to your existing state section
const showMultipleChoiceDialog = ref(false);
const currentQuestion = ref("");
const currentOptions = ref([]);

const activityConfig = ref({});

// Initial conversation fetch
const fetchInitialConversation = async () => {
	if (!convoId.value) return;

	try {
		const response = await trpc.getConvoById.query({
			token: convoId.value,
		});
		convo.value = response;
		activityConfig.value = response.activity || {};
		if (convo.value.completed === true) activityDone.value = true;
		// messages.value = response.messages || [];
	} catch (error) {
		console.error("Failed to fetch conversation:", error);
		connectionError.value = "Échec du chargement de la conversation";
	} finally {
		isLoading.value = false;
		return true;
	}
};

const showImage = ref(false);
const imageUrl = ref("");

async function sendToollMsg(messageText) {
	console.log("Sending message:", messageText);
	await client.value.sendMessage(`[ tool function RESPONSE: ${messageText} ]`);
	addMessage("tool", messageText);
	return true;
}

/// triggered by LLM.
const imageQuestion = ref("");
const toolsHandlers = {
	showImage: async (data) => {
		console.log("🖼️🖼️ showImage", data);
		imageUrl.value = data.url;

		imageQuestion.value = data.question;
		showImage.value = true;
		await setTimeout(() => {
			//showImage.value = false;
		}, 500);
		await sendToollMsg("showImage: image shown to user....  ");

		return true;
	},
	hideImage: async (data) => {
		console.log("hideImage", data);
		imageUrl.value = "";
		imageQuestion.value = "";
		showImage.value = false;
		await setTimeout(() => {
			//showImage.value = false;
		}, 500);

		await sendToollMsg("tool: hideImage: no more image shown to user...");
		return true;
	},
	send_convo_summary: async (data) => {
		console.log("send_convo_summary", data);
		alert("SEE CONVO SUMMARY LOGS...");
		//addMessage("system", "Sending conversation summary...");
		try {
			// await client.value.sendConvoSummary(data);
			// addMessage("system", "Conversation summary sent successfully");
		} catch (error) {
			console.error("Failed to send conversation summary:", error);
			//addMessage("error", `Failed to send conversation summary: ${error.message}`);
		}
	},
	get_weather: async (data) => {
		console.log("get_weather", data);
		alert(data.location);
		//addMessage("system", "Sending conversation summary...");
		try {
			// await client.value.sendConvoSummary(data);
			// addMessage("system", "Conversation summary sent successfully");
		} catch (error) {
			console.error("Failed to send conversation summary:", error);
			//addMessage("error", `Failed to send conversation summary: ${error.message}`);
		}
	},
	saveFullTranscript: async (data) => {
		console.log("saveFullTranscript", data);

		console.log("saveFullTranscript", data);
		try {
			// Use the correct TRPC mutation syntax
			const result = await trpc.saveConvoTranscript.mutate({
				convoId: convoId.value,
				transcript: data.transcript,
			});
			console.log("Transcript saved:", result);
			addMessage("system", "Transcript saved successfully");
			activityDone.value = true;
		} catch (error) {
			console.error("Failed to save transcript:", error);
			addMessage("error", `Failed to save transcript: ${error.message}`);
		}
	},
	showMultipleChoice: async (data) => {
		console.log("showMultipleChoice called:", data);
		currentQuestion.value = data.question;
		currentOptions.value = data.options;
		showMultipleChoiceDialog.value = true;

		// Add to message history if config specifies
		if (data.config?.showInChat) {
			addMessage("assistant", data.question);
		}

		// Optional callback handling through the client
		if (data.config?.onSelect) {
			// Store callback for later use
			currentCallback.value = data.config.onSelect;
		}
	},
};

// Initialize client
onMounted(async () => {
	await fetchInitialConversation();

	const ephe = convo.value.ephemeralToken;

	if (!ephe) {
		console.error("Failed to get ephemeral token");
		connectionError.value = "Échec de l'obtention du jeton éphémère";
		return;
	}

	client.value = new OpenAIRealtimeClient(ephe, {
		debug: true,
	});
	ephemeralToken.value = ephe;

	// Register tools
	client.value.registerTools(toolsHandlers);

	// Set up event listeners
	client.value
		.on("connected", handleConnect)
		.on("disconnected", handleDisconnect)
		.on("message", handleMessage)
		.on("error", handleError);

	// Auto-connect if enabled
	if (AUTO_CONNECT) {
		try {
			isConnecting.value = true;
			await client.value.connect();
		} catch (error) {
			console.error("Auto-connect error:", error);
			isConnecting.value = false;
			connectionError.value = `Erreur de connexion automatique: ${error.message}`;
			addMessage("error", `Erreur de connexion automatique: ${error.message}`);
		}
	}
});

onBeforeUnmount(() => {
	if (client.value) {
		client.value.disconnect();
	}
});

// Event handlers
const handleConnect = () => {
	isConnected.value = true;
	isConnecting.value = false;
	connectionError.value = "";
	addMessage("system", "Connecté à OpenAI");

	// Auto-start conversation if enabled in activity config
	if (activityConfig.value?.autostart === true) {
		// Increased delay to ensure connection is fully established
		setTimeout(() => {
			// Check if still connected before triggering
			if (isConnected.value && client.value?.isConnected) {
				//  if (isConnected.value && client.value?.isConnected) {
				triggerResponse();
			} else {
				console.log("Connection not ready for autostart. Please try manually.");
				addMessage(
					"error",
					"Connection not ready for autostart. Please try manually.",
				);
			}
		}, 1500); // Increased from 500ms to 1500ms
	}
};

const handleDisconnect = () => {
	isConnected.value = false;
	isRecording.value = false;
	isConnecting.value = false;
	connectionError.value = "Déconnecté d'OpenAI. Veuillez vous reconnecter.";
	addMessage("system", "Déconnecté d'OpenAI");
};

const handleMessage = (data) => {
	console.log("Received message event:", data);

	// Handle bot's audio transcript
	if (
		data.type === "response.output_item.done" &&
		data.item?.content?.[0]?.type === "audio"
	) {
		addMessage("assistant", data.item.content[0].transcript);
	}

	// Handle user's audio transcript
	if (data.type === "conversation.item.input_audio_transcription.completed") {
		addMessage("user", data.transcript);
	}

	// Your existing streaming text handling
	if (data.type === "response.start") {
		currentAssistantMessage.value = "";
	} else if (data.type === "response.content" && data.response?.content) {
		currentAssistantMessage.value += data.response.content;
	} else if (data.type === "response.done") {
		if (currentAssistantMessage.value) {
			addMessage("assistant", currentAssistantMessage.value);
			currentAssistantMessage.value = "";
		}

		if (data.response?.output) {
			data.response.output.forEach((output) => {
				if (output.type === "text") {
					addMessage("assistant", output.text);
				}
			});
		}
	}
};

const handleError = (error) => {
	console.error("Client error:", error);
	isConnecting.value = false;
	connectionError.value = `Erreur: ${error.message}`;
	addMessage("error", `Erreur: ${error.message}`);
};

// UI Actions
const toggleConnection = async () => {
	if (isConnected.value) {
		client.value.disconnect();
	} else {
		try {
			isConnecting.value = true;
			connectionError.value = "";
			await client.value.connect();
		} catch (error) {
			isConnecting.value = false;
			connectionError.value = `Erreur de connexion: ${error.message}`;
			addMessage("error", `Erreur de connexion: ${error.message}`);
		}
	}
};

const toggleRecording = () => {
	isRecording.value = !isRecording.value;
	if (isRecording.value) {
		addMessage("system", "Started recording");
	} else {
		addMessage("system", "Stopped recording");
	}
};

const sendMessage = async () => {
	if (!textMessage.value.trim()) return;

	try {
		const messageText = textMessage.value;
		addMessage("user", messageText);
		textMessage.value = ""; // Clear input immediately for better UX

		console.log("Sending message:", messageText);
		await client.value.sendMessage(messageText);
	} catch (error) {
		console.error("Failed to send message:", error);
		addMessage("error", `Échec de l'envoi du message: ${error.message}`);
	}
};

const addMessage = (role, content) => {
	messages.value.push({
		id: crypto.randomUUID(),
		role,
		content,
		timestamp: new Date().toLocaleTimeString(),
	});
};

const handleMultipleChoice = (selectedOption) => {
	console.log("Selected:", selectedOption);

	// Add the selection to chat if needed
	addMessage("user", selectedOption);

	// Hide the dialog
	showMultipleChoiceDialog.value = false;

	// Send the selection back through the client
	if (client.value) {
		client.value.sendMessage(selectedOption);
	}
};

function getOpenAiConversation() {
	console.log(client.value);
}

const trigerringResponse = ref(false);

const triggerResponse = async () => {
	console.log("handleWantResponse");

	// Verify connection is ready
	if (!client.value?.isConnected) {
		// Changed from: if (!client.value?.isConnected)
		addMessage(
			"error",
			"Connection not ready. Please wait a moment and try again.",
		);
		return;
	}

	trigerringResponse.value = true;
	addMessage("system", "Requesting response from model...");

	try {
		await client.value.requestResponse({
			instructions: "Continue the conversation",
			max_output_tokens: 2048,
		});
	} catch (error) {
		console.error("Error requesting response:", error);
		addMessage("error", `Failed to get response: ${error.message}`);
	} finally {
		trigerringResponse.value = false;
	}
};

const title = computed(() => convo.value?.activity?.activityName || "  Convo");

function handleStartOver() {
	console.log("handleStartOver");
	router.back();
}

// Toggle display preferences
const toggleSystemMessages = () => {
	showSystemMessages.value = !showSystemMessages.value;
};

const toggleToolMessages = () => {
	showToolMessages.value = !showToolMessages.value;
};
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <!-- Header -->
    <header class="bg-white shadow">
      <div
        class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between"
      >
        <h1 class="text-xl font-bold text-gray-900">{{ title }}</h1>

        <div class="flex items-center gap-4">
          <!-- Display preferences -->
          <div class="flex items-center gap-2" v-if="isDev">
            <label class="flex items-center gap-1 text-sm text-gray-700">
              <input
                type="checkbox"
                v-model="showSystemMessages"
                class="form-checkbox h-3 w-3 text-blue-600"
              />
              System
            </label>
            <label class="flex items-center gap-1 text-sm text-gray-700">
              <input
                type="checkbox"
                v-model="showToolMessages"
                class="form-checkbox h-3 w-3 text-blue-600"
              />
              Tools
            </label>
          </div>

          <!-- Connection toggle - only show when AUTO_CONNECT is false or connection was lost -->
          <button
            v-if="!AUTO_CONNECT || !isConnected"
            @click="toggleConnection"
            class="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium"
            :class="
              isConnected
                ? 'bg-red-100 text-red-800'
                : 'bg-green-100 text-green-800'
            "
            :disabled="isConnecting"
          >
            <Loader2 v-if="isConnecting" class="h-4 w-4 mr-2 animate-spin" />
            <component
              v-else
              :is="isConnected ? PowerOff : Power"
              class="h-4 w-4 mr-2"
            />
            {{
              isConnected
                ? "Déconnecter"
                : isConnecting
                  ? "Connexion en cours..."
                  : !AUTO_CONNECT
                    ? "Connecter"
                    : "Reconnecter"
            }}
          </button>
        </div>
      </div>
    </header>

    <!-- Outro -->
    <ActivityOutro
      v-if="activityDone"
      :debug="false"
      @startOver="handleStartOver"
      :activityConfig="activityConfig"
      :nextActivityInviteUrl="convo.nextActivityInviteUrl"
    />

    <div
      v-if="showImage && !activityDone"
      class="bg-white shadow rounded-lg mx-auto my-4 p-4 max-w-4xl"
    >
      <img :src="imageUrl" alt="shown-image" class="w-1/2 h-1/2 mx-auto" />
      <h1 class="text-3xl font-bold text-center mt-4">
        {{ imageQuestion }}
      </h1>
    </div>

    <MultipleChoice
      v-if="showMultipleChoiceDialog"
      :question="currentQuestion"
      :options="currentOptions"
      @choice="handleMultipleChoice"
    />

    <!-- Messages -->
    <main
      v-show="!activityDone && isConnected"
      class="flex-1 max-w-7xl w-full mx-auto px-4 py-8"
    >
      <div class="bg-white shadow rounded-lg flex flex-col h-[600px]">
        <!-- Use our new MessageThread component -->
        <MessageThread
          :messages="messages"
          :currentAssistantMessage="currentAssistantMessage"
          :showSystemMessages="showSystemMessages"
          :showToolMessages="showToolMessages"
        />

        <!-- Input area -->
        <div class="border-t p-4 space-y-4">
          <!-- Text input -->
          <div class="flex gap-2">
            <Input
              v-model="textMessage"
              @keyup.enter="sendMessage"
              type="text"
              placeholder="Écrivez un message..."
              class="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              :disabled="!isConnected || isConnecting"
            />
            <button
              @click="sendMessage"
              class="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50"
              :disabled="!isConnected || isConnecting || !textMessage.trim()"
            >
              <Send class="h-4 w-4" />
            </button>
          </div>

          <!-- Audio controls -->
          <div class="flex justify-center gap-3">
            <button
              @click="toggleRecording"
              class="inline-flex items-center px-4 py-2 rounded-full"
              :class="
                isRecording
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              "
              :disabled="!isConnected || isConnecting"
            >
              <component
                :is="isRecording ? MicOff : Mic"
                class="h-4 w-4 mr-2"
              />
              {{ isRecording ? "Arrêt" : "Enregistrer" }}
            </button>

            <button
              class="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 disabled:opacity-50"
              :disabled="trigerringResponse || !isConnected || isConnecting"
              @click="triggerResponse"
            >
              <Hand class="h-4 w-4 mr-2" />
              Demander une réponse
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Loading/Connection overlay -->
    <div
      v-if="isLoading || isConnecting || (!isConnected && AUTO_CONNECT)"
      class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50"
    >
      <div
        class="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center gap-3 max-w-md"
      >
        <Loader2
          v-if="isLoading || isConnecting"
          class="h-6 w-6 animate-spin text-blue-500"
        />
        <div v-if="connectionError" class="text-red-500 mb-2">
          {{ connectionError }}
        </div>
        <span v-if="isLoading">Chargement de la conversation...</span>
        <span v-else-if="isConnecting">Connexion à OpenAI en cours...</span>
        <span v-else-if="!isConnected && AUTO_CONNECT"
          >Pas de connexion à OpenAI.</span
        >

        <!-- Display reconnect button inside the overlay when disconnected -->
        <button
          v-if="!isConnected && !isConnecting && !isLoading"
          @click="toggleConnection"
          class="mt-3 inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
        >
          <Power class="h-4 w-4 mr-2" />
          Reconnecter
        </button>
      </div>
    </div>
  </div>
</template>
