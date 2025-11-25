<script setup>
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { useConversationStore } from "@/store/conversationStore";

const conversationStore = useConversationStore();

function startNewConversation() {
	// Toggle open the bubble and navigate to it
	conversationStore.isOpen = true;
}

function openConversation(conversation) {
	conversationStore.activeConversation = conversation;
	conversationStore.isOpen = true;
}
</script>

<template>
  <section class="mb-8 bg-white rounded-lg p-6 shadow-sm">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold">Conversations Wiso récentes</h2>
      <Button @click="startNewConversation" class="flex items-center gap-2">
        <Plus class="h-4 w-4" />
        Nouvelle conversation
      </Button>
    </div>

    <div v-if="conversationStore.conversations.length > 0" class="space-y-3">
      <div
        v-for="conversation in conversationStore.conversations.slice(0, 3)"
        :key="conversation.id"
        @click="openConversation(conversation)"
        class="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
      >
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-semibold">{{ conversation.title }}</h3>
            <p class="text-sm text-gray-600 mt-1 line-clamp-1">
              {{ conversation.lastMessage || "Pas encore de messages" }}
            </p>
          </div>
          <div class="text-xs text-gray-500">
            {{ conversationStore.formatDate(conversation.timestamp) }}
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-6 text-gray-500">
      Aucune conversation récente
    </div>

    <div
      v-if="conversationStore.conversations.length > 3"
      v-show="false"
      class="mt-4 text-center"
    >
      <Button
        variant="ghost"
        @click="startNewConversation"
        class="flex items-center gap-2 mx-auto"
      >
        Voir toutes les conversations
        <ChevronRight class="h-4 w-4" />
      </Button>
    </div>
  </section>
</template>
