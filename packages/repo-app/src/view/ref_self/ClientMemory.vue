<!-- AgentMemoryView.vue -->
<script setup>
import { ref, computed, onMounted, watch } from "vue";
import trpc from "@/trpc";

import { useRouter, useRoute } from "vue-router";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	User,
	Edit,
	Save,
	XCircle,
	BrainCircuit,
	MessageSquare,
	History,
	RefreshCcw,
	Sparkles,
	Info,
	Minimize,
	Trash2,
	Send,
} from "lucide-vue-next";

import { useToast } from "@/components/ui/toast/use-toast";
const { toast } = useToast();

const router = useRouter();
const route = useRoute();

// State management
const loading = ref(false);
const saving = ref(false);
const compressing = ref(false);
const error = ref(null);
const isEditing = ref(false);
const showExplanation = ref(true);

// Question and answer state
const questionInput = ref("");
const questionResponse = ref("");
const isAskingQuestion = ref(false);

// Elipsis menu options
const elipsis = [
	{
		label: "Modifier",
		icon: Edit,
		action: () => {
			startEditing();
		},
	},
	{
		label: "Compresser",
		icon: Minimize,
		action: () => {
			compressMemory();
		},
	},
	{
		label: "Regénérer",
		icon: RefreshCcw,
		action: () => {
			if (isEditing.value) {
				regenerateMemory();
			} else {
				// First start editing, then regenerate
				startEditing();
				regenerateMemory();
			}
		},
	},
	{
		sep: true,
	},
	{
		label: "Réinitialiser",
		icon: Trash2,
		action: () => {
			if (
				confirm(
					"Êtes-vous sûr de vouloir réinitialiser la mémoire ? Cette action est irréversible.",
				)
			) {
				editedMemoryText.value = "";
				if (!isEditing.value) {
					startEditing();
				}
				toast({
					title: "Mémoire réinitialisée",
					description: "La mémoire a été vidée. N'oubliez pas de sauvegarder.",
				});
			}
		},
	},
];

// Props definition
const props = defineProps({
	patientDetails: {
		type: Object,
		required: true,
	},
});

// Computed
const patientId = computed(() => route.params.id);

// Memory size constants
const MAX_MEMORY_SIZE = 5000; // Now in words
const MEMORY_WARNING_THRESHOLD = 4000; // Now in words

// Reactive reference to client details
const patientDetails = ref(props.patientDetails);
const memoryText = ref(patientDetails.value.memory || "");
const editedMemoryText = ref("");
const memorySummary = ref("");
const isLoadingSummary = ref(false);

// Function to count words in a string
const countWords = (text) => {
	return text
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0).length;
};

// Memory size computations
const memorySize = computed(() => countWords(memoryText.value));
const memorySizePercentage = computed(() => {
	const percentage = (memorySize.value / MAX_MEMORY_SIZE) * 100;
	return Math.max(5, Math.min(100, percentage)); // Minimum 5%, maximum 100%
});
const memoryStatus = computed(() => {
	if (memorySize.value > MEMORY_WARNING_THRESHOLD) {
		return "warning";
	} else if (memorySize.value > 500) {
		return "normal";
	} else {
		return "low";
	}
});

// Watch for prop changes
watch(
	() => props.patientDetails,
	(newValue) => {
		patientDetails.value = newValue;
		memoryText.value = newValue.memory || "";
	},
);

// Fetch initial memory on component mount
onMounted(async () => {
	await fetchMemory();
});

async function fetchMemory() {
	loading.value = true;
	try {
		const result = await trpc.patientMemory.getMemory.query({
			patientId: patientId.value,
		});

		memoryText.value = result.memory || "";

		// Optional: Fetch memory summary
		fetchMemorySummary();
	} catch (err) {
		error.value = "Erreur lors du chargement de la mémoire";
		toast({
			title: "Erreur",
			description: "Impossible de charger la mémoire du patient",
			variant: "destructive",
		});
	} finally {
		loading.value = false;
	}
}

async function fetchMemorySummary() {
	isLoadingSummary.value = true;
	try {
		const result = await trpc.patientMemory.summarizeMemory.query({
			patientId: patientId.value,
		});

		memorySummary.value = result.summary;
	} catch (err) {
		console.error("Error fetching memory summary:", err);
	} finally {
		isLoadingSummary.value = false;
	}
}

function startEditing() {
	editedMemoryText.value = memoryText.value;
	isEditing.value = true;
}

function cancelEditing() {
	isEditing.value = false;
}

async function saveMemory() {
	saving.value = true;
	try {
		// Check if edited memory exceeds word limit
		const wordCount = countWords(editedMemoryText.value);
		if (wordCount > MAX_MEMORY_SIZE) {
			toast({
				title: "Limite de mots dépassée",
				description: `Votre mémoire contient ${wordCount} mots, la limite est de ${MAX_MEMORY_SIZE} mots`,
				variant: "destructive",
			});
			saving.value = false;
			return;
		}

		// Save using trpc - update to use the correct endpoint
		await trpc.patientMemory.setMemory.mutate({
			patientId: patientId.value,
			content: editedMemoryText.value,
		});

		// Update local state
		memoryText.value = editedMemoryText.value;
		isEditing.value = false;

		toast({
			title: "Mémoire sauvegardée",
			description: "La mémoire de l'agent a été mise à jour avec succès",
		});

		// Refresh memory summary after save
		fetchMemorySummary();
	} catch (err) {
		error.value = "Erreur lors de la sauvegarde de la mémoire";
		toast({
			title: "Erreur",
			description: "Impossible de sauvegarder la mémoire",
			variant: "destructive",
		});
	} finally {
		saving.value = false;
	}
}

async function regenerateMemory() {
	loading.value = true;
	try {
		// This function isn't in your provided tRPC routes yet
		// We'll need to add a generateMemory endpoint to patientMemory.js
		const response = await trpc.patientMemory.generateMemory.query({
			patientId: patientId.value,
		});

		editedMemoryText.value = response.memory;

		toast({
			title: "Mémoire générée",
			description: "Une nouvelle mémoire a été générée pour ce patient",
		});
	} catch (err) {
		error.value = "Erreur lors de la génération de la mémoire";
		toast({
			title: "Erreur",
			description: "Impossible de générer une nouvelle mémoire",
			variant: "destructive",
		});
	} finally {
		loading.value = false;
	}
}

async function compressMemory() {
	compressing.value = true;
	try {
		// Call compression API (compact memory)
		await trpc.patientMemory.compactMemory.mutate({
			patientId: patientId.value,
		});

		// Refresh memory after compression
		const result = await trpc.patientMemory.getMemory.query({
			patientId: patientId.value,
		});

		if (isEditing.value) {
			editedMemoryText.value = result.memory;
		} else {
			memoryText.value = result.memory;
		}

		toast({
			title: "Mémoire compressée",
			description: "La mémoire du patient a été optimisée avec succès",
		});

		// Refresh memory summary after compression
		fetchMemorySummary();
	} catch (err) {
		error.value = "Erreur lors de la compression de la mémoire";
		toast({
			title: "Erreur",
			description: "Impossible de compresser la mémoire",
			variant: "destructive",
		});
	} finally {
		compressing.value = false;
	}
}

async function appendMemory(content) {
	try {
		await trpc.patientMemory.appendMemory.mutate({
			patientId: patientId.value,
			content: content,
		});

		// Refresh memory after appending
		await fetchMemory();

		toast({
			title: "Mémoire mise à jour",
			description: "Nouvelles informations ajoutées à la mémoire",
		});
	} catch (err) {
		toast({
			title: "Erreur",
			description: "Impossible d'ajouter à la mémoire",
			variant: "destructive",
		});
	}
}

async function askQuestion() {
	if (!questionInput.value.trim()) return;

	questionResponse.value = "";
	isAskingQuestion.value = true;

	try {
		const result = await trpc.patientMemory.askMemoryQuestion.query({
			patientId: patientId.value,
			question: questionInput.value,
		});

		questionResponse.value = result.answer || "Aucune réponse trouvée.";
	} catch (err) {
		toast({
			title: "Erreur",
			description: "Impossible d'obtenir une réponse à votre question",
			variant: "destructive",
		});
		questionResponse.value =
			"Une erreur s'est produite lors du traitement de votre question.";
	} finally {
		isAskingQuestion.value = false;
	}
}

function toggleExplanation() {
	showExplanation.value = !showExplanation.value;
}
</script>

<template>
  <SidePanelHeader
    title="Mémoire"
    :backLink="`/client/${patientId}`"
    :completed="!!memoryText"
    :elipsis="elipsis"
  />

  <div class="container mx-auto p-6 max-w-4xl">
    <!-- Loading and Error States -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div
        class="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"
      ></div>
    </div>

    <div v-else-if="error" class="text-center text-red-600">
      {{ error }}
    </div>

    <!-- Main Content -->
    <div v-else class="space-y-6">
      <!-- Memory Size Indicator -->
      <div class="px-6 pt-4">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium">Utilisation de la mémoire</span>
          <span
            class="text-xs"
            :class="{
              'text-red-500': memoryStatus === 'warning',
              'text-amber-500': memoryStatus === 'normal',
              'text-green-500': memoryStatus === 'low',
            }"
          >
            {{ memorySize }} / {{ MAX_MEMORY_SIZE }} mots
            <span v-if="memoryStatus === 'warning'"
              >(Mémoire presque pleine)</span
            >
          </span>
        </div>
        <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="{
              'bg-red-500': memoryStatus === 'warning',
              'bg-amber-500': memoryStatus === 'normal',
              'bg-green-500': memoryStatus === 'low',
            }"
            :style="{ width: `${memorySizePercentage}%` }"
          ></div>
        </div>
      </div>

      <!-- Memory Summary Section (New) -->
      <div v-if="memorySummary && !isEditing" class="p-6 bg-muted rounded-lg">
        <div class="flex items-center mb-3">
          <Sparkles class="w-5 h-5 mr-2 text-primary" />
          <h3 class="font-medium">Résumé de la mémoire</h3>
        </div>
        <p class="text-sm">{{ memorySummary }}</p>
      </div>

      <div class="p-6">
        <!-- View Mode -->
        <div
          v-if="!isEditing"
          class="whitespace-pre-line bg-accent p-4 rounded-lg min-h-[200px]"
        >
          <p v-if="memoryText" class="text-sm">{{ memoryText }}</p>
          <p v-else class="text-sm text-muted-foreground italic">
            Aucune mémoire enregistrée pour ce patient. Cliquez sur "Modifier"
            pour ajouter des informations.
          </p>
        </div>

        <!-- Edit Mode -->
        <div v-else class="space-y-4">
          <div class="relative">
            <Textarea
              v-model="editedMemoryText"
              placeholder="Saisissez vos notes sur ce patient..."
              class="min-h-[300px] font-mono text-sm"
            />
            <div class="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {{ countWords(editedMemoryText) }} / {{ MAX_MEMORY_SIZE }} mots
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="cancelEditing"> Annuler </Button>
            <Button 
              @click="saveMemory" 
              :disabled="saving || countWords(editedMemoryText) > MAX_MEMORY_SIZE"
            >
              <Save class="w-4 h-4 mr-2" />
              Sauvegarder
            </Button>
          </div>
        </div>
      </div>

      <!-- Ask Question Tool (Replacement for Search) -->
      <div class="p-6 bg-white rounded-lg shadow-sm">
        <div class="flex items-center mb-3">
          <MessageSquare class="w-5 h-5 mr-2 text-primary" />
          <h3 class="font-medium">Poser une question sur ce patient</h3>
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            v-model="questionInput"
            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            placeholder="Posez une question sur ce patient..."
            @keyup.enter="askQuestion"
          />
          <Button
            @click="askQuestion"
            variant="outline"
            class="px-3"
            :disabled="isAskingQuestion"
          >
            <div
              v-if="isAskingQuestion"
              class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"
            ></div>
            <Send v-else class="w-4 h-4 mr-2" />
            Demander
          </Button>
        </div>

        <!-- Question Response Section -->
        <div v-if="questionResponse" class="mt-4 p-4 bg-muted rounded-lg">
          <div class="flex items-start gap-2">
            <BrainCircuit class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <p class="text-xs font-medium mb-1">Réponse:</p>
              <p class="text-sm">{{ questionResponse }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Memory Usage Cards -->
      <ClientMemoryInfo
        :showExplanation="showExplanation"
        @toggleExplanation="toggleExplanation"
      />

      <hr />
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}

.text-muted-foreground {
  color: hsl(var(--muted-foreground));
}

.bg-accent {
  background-color: hsl(var(--accent));
}

.bg-muted {
  background-color: hsl(var(--muted));
}
</style>
