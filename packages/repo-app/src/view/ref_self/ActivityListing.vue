<!-- Script for ActivityListing.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import trpc from "@/trpc";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileText, Search, TestTube } from "lucide-vue-next";
import { useToast } from "@/components/ui/toast/use-toast";
import { useMeetingStore } from "@/store/meetingStore";

const router = useRouter();
const { toast } = useToast();

// State
const loading = ref(true);
const activities = ref([]);
const clients = ref([]);
const searchQuery = ref("");
const showTests = ref(false); // Par défaut, masquer les tests (activitySequence > 100)

// Type label configuration
const typeConfig = {
	form: {
		text: "Formulaire",
		color: "bg-blue-50 text-blue-600 border-blue-200",
	},
	realtime: {
		text: "Audio",
		color: "bg-green-50 text-green-600 border-green-200",
	},
};

// Modal state
const showActivityModal = ref(false);
const selectedActivity = ref(null);
const selectedClient = ref("");
const customInstructions = ref("");
const processingRequest = ref(false);

// Filtered activities based on search and filter settings
const filteredActivities = computed(() => {
	// First filter by test setting - hide tests (activitySequence > 100) if showTests is false
	let filtered = activities.value.filter((activity) => {
		if (
			!showTests.value &&
			activity.activitySequence &&
			activity.activitySequence > 10
		) {
			return false;
		}
		return true;
	});

	// Then apply text search if provided
	if (searchQuery.value.trim()) {
		const query = searchQuery.value.toLowerCase();
		filtered = filtered.filter(
			(activity) =>
				activity.activityName?.toLowerCase().includes(query) ||
				activity.activityDesc?.toLowerCase().includes(query) ||
				activity.programId?.toLowerCase().includes(query),
		);
	}

	return filtered;
});

// Methods
const fetchActivities = async () => {
	try {
		loading.value = true;
		const data = await trpc.listActivities.query();
		activities.value = data;
	} catch (error) {
		console.error("Error fetching activities:", error);
		toast({
			title: "Erreur",
			description: "Impossible de charger les activités",
			variant: "destructive",
		});
	} finally {
		loading.value = false;
	}
};

const fetchClients = () => {
	try {
		const meetingStore = useMeetingStore();
		clients.value = meetingStore.patients;
	} catch (error) {
		console.error("Error getting clients from store:", error);
	}
};

const openActivity = (activity) => {
	selectedActivity.value = activity;
	selectedClient.value = "";
	customInstructions.value = "";
	showActivityModal.value = true;
};

const closeModal = () => {
	showActivityModal.value = false;
	selectedActivity.value = null;
};

const sendActivity = async () => {
	if (!selectedClient.value) {
		toast({
			title: "Information requise",
			description: "Veuillez sélectionner un client",
			variant: "destructive",
		});
		return;
	}

	try {
		processingRequest.value = true;

		const generated = await trpc.assignActivity.query({
			patientId: selectedClient.value,
			activityId: selectedActivity.value.activityId,
			customInstructions: customInstructions.value,
		});

		closeModal();

		toast({
			title: "Activité assignée",
			description: "L'activité a été assignée avec succès",
		});

		// Navigate to the client
		if (generated) {
			router.push(`/client/${selectedClient.value}`);
		}
	} catch (error) {
		console.error("Error assigning activity:", error);
		toast({
			title: "Erreur",
			description: "Impossible d'assigner l'activité",
			variant: "destructive",
		});
	} finally {
		processingRequest.value = false;
	}
};

// Lifecycle
onMounted(() => {
	fetchActivities();
	fetchClients();
});
</script>

<!-- Simplified ActivityListing.vue Template -->
<template>
  <div class="container mx-auto p-6">
    <!-- Page Header       <h1 class="text-3xl font-bold">Les Activités</h1> -->

    <div class="mb-7">
      <h2 class="text-2xl font-bold text-gray-900">
        Activités d’exploration disponibles
      </h2>
      <h3 class="text-lg text-gray-700 mt-2">
        Partagez ces tests et activités avec vos clients pour affiner vos
        analyses.
      </h3>
      <p class="italic text-gray-600 mt-4 border-l-4 border-blue-500 pl-4">
        « Des explorations conçues par Repo.md, pour des aperçus ultra-précis. »
      </p>
      <p class="mt-2 text-gray-800">
        Mettez-en une à la disposition de vos clients pour compléter leur profil
        unique.
      </p>
    </div>

    <!-- Search and filters -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <!-- Search input -->
      <div class="relative flex-grow">
        <Search
          class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="searchQuery"
          placeholder="Rechercher une activité..."
          class="pl-10 w-full"
        />
      </div>

      <!-- Filter controls -->
      <div class="flex items-center gap-6">
        <div class="flex items-center space-x-2" v-if="false">
          <Switch id="show-tests" v-model="showTests" />
          <Label
            for="show-tests"
            class="flex items-center gap-1 cursor-pointer"
          >
            <TestTube class="h-4 w-4" />
            <span>Afficher les tests (séquence > 100)</span>
          </Label>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div
        class="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"
      ></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredActivities.length === 0" class="text-center py-12">
      <FileText class="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">Aucune activité trouvée</h3>
      <p class="text-muted-foreground mt-2">
        Aucune activité ne correspond à votre recherche.
      </p>
      <Button @click="searchQuery = ''" variant="outline" class="mt-4">
        Réinitialiser la recherche
      </Button>
    </div>

    <!-- Activities Grid -->
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      <router-link
        v-for="activity in filteredActivities"
        :key="activity.slug"
        :to="`/bibli/activities/${activity.activityId}`"
        custom
        v-slot="{ navigate }"
      >
        <Card
          class="overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer"
          @click="navigate"
        >
          <div class="relative">
            <img
              v-if="activity.introImg"
              :src="activity.introImg"
              :alt="activity.activityName"
              class="w-full h-32 object-cover"
            />
            <div
              v-else
              class="w-full h-32 bg-gray-100 flex items-center justify-center"
            >
              <FileText class="w-12 h-12 text-gray-400" />
            </div>

            <!-- Type Badge -->
            <div class="absolute top-2 right-2">
              <Badge
                class="text-xs font-normal"
                :class="typeConfig[activity.type]?.color || ''"
              >
                {{ typeConfig[activity.type]?.text || activity.type }}
              </Badge>
              <Badge
                v-if="
                  activity.activitySequence && activity.activitySequence > 100
                "
                class="text-xs font-normal ml-1 bg-red-100 text-red-600 border-red-200"
              >
                TEST
              </Badge>
            </div>

            <!-- Sequence number -->
            <div
              v-if="activity.activitySequence"
              class="absolute top-2 left-2 w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-bold shadow-sm"
            >
              {{ activity.activitySequence }}
            </div>
          </div>

          <div class="p-4">
            <div class="flex items-start justify-between">
              <h3 class="font-medium line-clamp-1">
                {{ activity.activityName }}
              </h3>
              <Badge
                v-if="!activity.active"
                variant="outline"
                class="ml-2 text-xs bg-red-50 text-red-600 border-red-200"
              >
                Inactif
              </Badge>
            </div>

            <p class="text-sm text-muted-foreground mt-2 line-clamp-2">
              {{ activity.activityDesc }}
            </p>
          </div>
        </Card>
      </router-link>
    </div>

    <!-- Assignment Modal -->
    <Dialog :open="showActivityModal" @update:open="showActivityModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            >Assigner "{{ selectedActivity?.activityName }}"</DialogTitle
          >
          <DialogDescription>
            Choisissez le client à qui vous souhaitez assigner cette activité
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-4">
          <Select v-model="selectedClient">
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="client in clients"
                :key="client.id"
                :value="client.id"
              >
                {{ client.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <div>
            <p class="text-sm font-medium mb-2">
              Instructions personnalisées (optionnel)
            </p>
            <Textarea
              v-model="customInstructions"
              placeholder="Ajoutez des instructions spécifiques pour ce client..."
              class="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="closeModal"
            :disabled="processingRequest"
          >
            Annuler
          </Button>
          <Button
            @click="sendActivity"
            :disabled="processingRequest || !selectedClient"
          >
            <span v-if="processingRequest" class="flex items-center gap-2">
              <div
                class="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"
              ></div>
              Traitement...
            </span>
            <span v-else>Assigner</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
