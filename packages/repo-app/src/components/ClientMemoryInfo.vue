<!-- ClientMemoryInfo.vue -->
<script setup>
import { ref } from "vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Info, XCircle } from "lucide-vue-next";

const props = defineProps({
	showExplanation: {
		type: Boolean,
		default: true,
	},
});

const emit = defineEmits(["toggleExplanation"]);

function toggleExplanation() {
	emit("toggleExplanation");
}
</script>

<template>
  <Alert v-if="showExplanation" class="mb-6 bg-blue-50 border-blue-200">
    <div class="flex justify-between items-start">
      <div class="flex items-start gap-3">
        <Info class="h-5 w-5 text-blue-500 mt-0.5" />
        <AlertDescription class="text-sm text-blue-700">
          <p class="font-medium mb-2">
            Comment fonctionne la mémoire de l'agent ?
          </p>
          <p>
            La mémoire est utilisée pour enrichir les conversations avec ce
            client. Elle permet à l'agent de :
          </p>
          <ul class="list-disc ml-5 mt-2 space-y-1">
            <li>Se souvenir des informations importantes sur le client</li>
            <li>
              Personnaliser les conversations en fonction des préférences et
              besoins
            </li>
            <li>Générer des réponses plus pertinentes dans le chat</li>
            <li>Maintenir une continuité dans la relation client</li>
          </ul>
          <p class="mt-2">
            Vous pouvez modifier cette mémoire manuellement ou la laisser se
            générer automatiquement à partir des conversations.
          </p>
        </AlertDescription>
      </div>
      <Button variant="ghost" size="icon" @click="toggleExplanation">
        <XCircle class="h-5 w-5" />
      </Button>
    </div>
  </Alert>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    <!-- Conversation Impact -->
    <Card>
      <div class="p-6">
        <div class="flex items-center gap-2 mb-4">
          <MessageSquare class="w-5 h-5 text-primary" />
          <h3 class="font-bold">Impact sur les Conversations</h3>
        </div>
        <div class="space-y-3">
          <div class="bg-accent p-3 rounded-lg">
            <p class="text-sm font-medium">Personnalisation des réponses</p>
            <p class="text-xs text-muted-foreground">
              Les agents utilisent la mémoire pour adapter leur ton et contenu
              aux préférences du client.
            </p>
          </div>
          <div class="bg-accent p-3 rounded-lg">
            <p class="text-sm font-medium">Continuité des échanges</p>
            <p class="text-xs text-muted-foreground">
              Permet de maintenir le contexte entre différentes sessions de
              conversation.
            </p>
          </div>
        </div>
      </div>
    </Card>

    <!-- Memory Evolution -->
    <Card>
      <div class="p-6">
        <div class="flex items-center gap-2 mb-4">
          <History class="w-5 h-5 text-primary" />
          <h3 class="font-bold">Évolution de la Mémoire</h3>
        </div>
        <div class="space-y-3">
          <div class="bg-accent p-3 rounded-lg">
            <p class="text-sm font-medium">Apprentissage continu</p>
            <p class="text-xs text-muted-foreground">
              La mémoire s'enrichit au fil des conversations avec le client.
            </p>
          </div>
          <div class="bg-accent p-3 rounded-lg">
            <p class="text-sm font-medium">Validation humaine</p>
            <p class="text-xs text-muted-foreground">
              Vous pouvez éditer, corriger ou compléter la mémoire à tout
              moment.
            </p>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
