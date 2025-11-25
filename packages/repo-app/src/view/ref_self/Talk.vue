<!-- ConversationComponent.vue -->
<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from "vue";
import { useRoute } from "vue-router";
import { Conversation } from "@11labs/client";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/use-toast";
import { Mic, MicOff, Loader2 } from "lucide-vue-next";

// Default agent ID that will be used if no URL parameters are provided
const DEFAULT_AGENT_ID = "ptoCBPQ44u3HKhu6fPcb";

// Mock function to decode JWT tokens - replace with actual implementation
const decodeJwtToken = (token: string): string => {
	// In a real implementation, this would decode and validate the JWT
	// For now, we'll just simulate extracting an agent ID
	console.log("Decoding JWT token:", token);
	// Return a mock agent ID - in production this would come from the decoded token
	return `decoded-${token.substring(0, 8)}`;
};

const route = useRoute();
const connectionStatus = ref<"disconnected" | "connecting" | "connected">(
	"disconnected",
);
const agentMode = ref<"speaking" | "listening">("listening");
const isLoading = ref(false);
const conversationInstance = ref<any>(null);
const { toast } = useToast();

// Function to determine which agent ID to use based on URL parameters
const determineAgentId = (): string => {
	if (route.params.eleven) {
		// If an Eleven Labs ID is provided directly in the URL
		return route.params.eleven as string;
	} else if (route.params.jwt) {
		// If a JWT token is provided, decode it to get the agent ID
		return decodeJwtToken(route.params.jwt as string);
	}
	// Fall back to the default agent ID if no parameters are provided
	return DEFAULT_AGENT_ID;
};

const startConversation = async () => {
	try {
		isLoading.value = true;
		connectionStatus.value = "connecting";
		await navigator.mediaDevices.getUserMedia({ audio: true });

		// Get the appropriate agent ID based on URL parameters
		const agentId = determineAgentId();
		console.log("Using agent ID:", agentId);

		conversationInstance.value = await Conversation.startSession({
			agentId: agentId,

			onConnect: () => {
				connectionStatus.value = "connected";
				toast({
					title: "Connecté",
					description: "La conversation vocale est maintenant active",
				});
			},

			onDisconnect: () => {
				connectionStatus.value = "disconnected";
				toast({
					title: "Déconnecté",
					description: "La conversation vocale est terminée",
				});
			},

			onError: (error) => {
				console.error("Conversation error:", error);
				toast({
					title: "Erreur",
					description: "Une erreur s'est produite pendant la conversation",
					variant: "destructive",
				});
			},

			onModeChange: (mode) => {
				agentMode.value = mode.mode;
			},
		});
	} catch (error) {
		console.error("Failed to start conversation:", error);
		toast({
			title: "Erreur",
			description:
				"Impossible de démarrer la conversation. Veuillez vérifier les permissions du microphone.",
			variant: "destructive",
		});
	} finally {
		isLoading.value = false;
	}
};

const stopConversation = async () => {
	if (conversationInstance.value) {
		try {
			await conversationInstance.value.endSession();
			conversationInstance.value = null;
		} catch (error) {
			console.error("Error ending conversation:", error);
			toast({
				title: "Erreur",
				description: "Impossible de terminer la conversation correctement",
				variant: "destructive",
			});
		}
	}
};

onBeforeUnmount(() => {
	if (conversationInstance.value) {
		conversationInstance.value.endSession();
	}
});

const getStatusText = () => {
	switch (connectionStatus.value) {
		case "connected":
			return "Conversation active";
		case "connecting":
			return "Établissement de la connexion...";
		default:
			return "Prêt à commencer";
	}
};

const getAgentModeText = (mode: string) => {
	return mode === "speaking" ? "en train de parler" : "en train d'écouter";
};

// Optional: Log the current agent ID when the component mounts
onMounted(() => {
	const agentId = determineAgentId();
	console.log("Component mounted with agent ID:", agentId);
});
</script>

<template>
  <div class="container mx-auto py-8 px-4">
    <div class="max-w-2xl mx-auto space-y-8">
      <Card class="shadow-lg">
        <CardHeader>
          <CardTitle>Parler avec Wiso</CardTitle>
          <CardDescription>
            Conversez naturellement avec notre assistant IA en utilisant votre
            voix
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Rest of the template remains unchanged -->
          <div class="flex gap-4 justify-center">
            <Button
              @click="startConversation"
              :disabled="connectionStatus === 'connected' || isLoading"
              :variant="
                connectionStatus === 'connected' ? 'outline' : 'default'
              "
              class="w-40"
            >
              <template v-if="isLoading">
                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                Connexion
              </template>
              <template v-else>
                <Mic class="mr-2 h-4 w-4" />
                Démarrer l'appel
              </template>
            </Button>

            <Button
              @click="stopConversation"
              :disabled="connectionStatus !== 'connected'"
              variant="destructive"
              class="w-40"
            >
              <MicOff class="mr-2 h-4 w-4" />
              Terminer l'appel
            </Button>
          </div>

          <div class="rounded-lg bg-muted p-4 space-y-3">
            <h3 class="font-semibold">État Actuel</h3>
            <div class="space-y-2 text-sm text-muted-foreground">
              <p class="flex items-center gap-2">
                <span
                  class="inline-block w-2 h-2 rounded-full"
                  :class="{
                    'bg-green-500': connectionStatus === 'connected',
                    'bg-yellow-500': connectionStatus === 'connecting',
                    'bg-gray-500': connectionStatus === 'disconnected',
                  }"
                ></span>
                {{ getStatusText() }}
              </p>
              <p v-if="connectionStatus === 'connected'">
                L'assistant IA est {{ getAgentModeText(agentMode) }}
              </p>
            </div>
          </div>

          <div class="rounded-lg bg-muted p-4 space-y-3">
            <h3 class="font-semibold">Mode d'emploi</h3>
            <div class="space-y-2 text-sm text-muted-foreground">
              <p>
                1. Cliquez sur "Démarrer l'appel" et autorisez l'accès au
                microphone
              </p>
              <p>2. Attendez que la connexion soit établie</p>
              <p>3. Parlez naturellement lorsque l'assistant écoute</p>
              <p>4. Écoutez les réponses de l'assistant</p>
              <p>5. Cliquez sur "Terminer l'appel" lorsque vous avez terminé</p>
            </div>
          </div>

          <div class="text-sm text-muted-foreground flex items-start gap-2">
            <span class="text-yellow-500">ℹ️</span>
            <span>
              Votre conversation vocale est traitée en temps réel et n'est pas
              stockée. Pour une expérience optimale, utilisez un microphone de
              qualité dans un environnement calme.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
