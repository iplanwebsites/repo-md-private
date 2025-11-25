<script setup>
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
	MessageCircle,
	ChevronDown,
	MessageSquarePlus,
	Trash,
} from "lucide-vue-next";
import { useConversationStore } from "@/store/conversationStore";
import ConversationList from "./ConversationList.vue";
import MessageThread from "./MessageThread.vue";
import ElipsisMenu from "@/components/ElipsisMenu.vue";
import { useRouter } from "vue-router";

const conversationStore = useConversationStore();
const router = useRouter();

// Computed properties from store
const isOpen = computed(() => conversationStore.isOpen);
const showActiveConversation = computed(
	() => conversationStore.showActiveConversation,
);
const showPills = computed({
	get: () => conversationStore.showPillsInsteadOfFirstMessage,
	set: (value) => (conversationStore.showPillsInsteadOfFirstMessage = value),
});

// Computed property for action menu items
const actionMenuItems = computed(() => {
	const items = [];

	// If it's a patient conversation, show specific options
	if (conversationStore.activeConversation?.patientId) {
		// Option to view patient profile
		items.push({
			label: "Voir le profil du client",
			action: () =>
				router.push(
					`/client/${conversationStore.activeConversation.patientId}`,
				),
		});

		// Option to clear context (start a new convo with same client)
		items.push({
			label: "Nouvelle conversation",
			icon: Trash,
			action: () => {
				if (conversationStore.activeConversation) {
					// Get patient details from current conversation
					const patientId = conversationStore.activeConversation.patientId;
					const patientName = conversationStore.activeConversation.patientName;
					const patient = { id: patientId, name: patientName };

					// Remove this conversation from list
					const convId = conversationStore.activeConversation.id;
					conversationStore.goBack();
					conversationStore.conversations =
						conversationStore.conversations.filter(
							(conv) => conv.id !== convId,
						);

					// Start a new conversation with the same patient
					conversationStore.startPatientConversation(patient);
				}
			},
		});
	} else {
		// Default action for non-patient conversations
		items.push({
			label: "Supprimer l'historique",
			icon: Trash,
			action: () => {
				if (conversationStore.activeConversation) {
					const convId = conversationStore.activeConversation.id;
					conversationStore.goBack();
					conversationStore.conversations =
						conversationStore.conversations.filter(
							(conv) => conv.id !== convId,
						);
				}
			},
		});
	}

	return items;
});

// Toggle bubble open/close
function toggleBubble() {
	conversationStore.toggleBubble();
}
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
      <!-- Show either conversation thread or conversations list -->
      <div class="flex-1 overflow-hidden">
        <MessageThread v-if="showActiveConversation" :menuItems="actionMenuItems" />
        <div v-else class="p-6 h-full overflow-y-auto">
          <!-- Pills mode toggle -->

          <ConversationList />
        </div>
      </div>
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
