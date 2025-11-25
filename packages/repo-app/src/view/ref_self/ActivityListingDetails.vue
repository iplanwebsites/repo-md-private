<!-- ActivityDetails.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { formatDistance } from "date-fns";
import { fr } from "date-fns/locale";
import { usePageTitle } from "@/lib/utils/vueUtils";
import { useMeetingStore } from "@/store/meetingStore";

import trpc from "@/trpc";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
	FileText,
	ArrowLeft,
	FileQuestion,
	ClipboardCheck,
	Clock,
	BookOpen,
	CheckCircle2,
	XCircle,
	Code,
	Users,
	Settings,
	AlertCircle,
} from "lucide-vue-next";
import { useToast } from "@/components/ui/toast/use-toast";

const router = useRouter();
const route = useRoute();
const { toast } = useToast();

// State
const loading = ref(true);
const activity = ref(null);
const clients = ref([]);
const allActivities = ref([]);
const showAllPrompt = ref(false);

// Modal state
const showAssignModal = ref(false);
const selectedClient = ref("");
const customInstructions = ref("");
const processingRequest = ref(false);

// Define activity types with corresponding icons
const activityTypes = {
	form: {
		icon: FileQuestion,
		color: "bg-blue-100 text-blue-700",
		label: "Formulaire",
	},
	assessment: {
		icon: ClipboardCheck,
		color: "bg-green-100 text-green-700",
		label: "Évaluation",
	},
	exercise: {
		icon: BookOpen,
		color: "bg-purple-100 text-purple-700",
		label: "Exercice",
	},
	// Add more types as needed
};

// Computed
const activityIcon = computed(() => {
	if (!activity.value) return FileText;
	return activityTypes[activity.value.type]?.icon || FileText;
});

const activityColorClass = computed(() => {
	if (!activity.value) return "bg-gray-100 text-gray-700";
	return (
		activityTypes[activity.value.type]?.color || "bg-gray-100 text-gray-700"
	);
});

const activityTypeLabel = computed(() => {
	if (!activity.value) return "Activité";
	return activityTypes[activity.value.type]?.label || activity.value.type;
});

const getDependencyName = (activityId) => {
	if (!activityId) return "";
	const dependency = allActivities.value.find(
		(a) => a.activityId === activityId,
	);
	return dependency ? dependency.activityName : activityId;
};

const nextActivityName = computed(() => {
	if (!activity.value?.nextActivityToSuggest) return "";
	return getDependencyName(activity.value.nextActivityToSuggest);
});

// Methods
const fetchActivity = async () => {
	try {
		loading.value = true;
		// Get the slug from the route
		const slug = route.params.slug;

		// Fetch all activities to reference dependencies
		const allActivitiesData = await trpc.listActivities.query();
		allActivities.value = allActivitiesData;

		// Find the current activity by slug
		const foundActivity = allActivitiesData.find(
			(act) => act.activityId === slug,
		);

		if (!foundActivity) {
			toast({
				title: "Erreur",
				description: "Activité non trouvée",
				variant: "destructive",
			});
			// router.push("/activities");
			return;
		}

		activity.value = foundActivity;
	} catch (error) {
		console.error("Error fetching activity:", error);
		toast({
			title: "Erreur",
			description: "Impossible de charger l'activité",
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

const goBack = () => {
	router.push("/bibli");
};

const openAssignDialog = () => {
	selectedClient.value = "";
	customInstructions.value = "";
	showAssignModal.value = true;
};

const closeModal = () => {
	showAssignModal.value = false;
};

const assignActivity = async () => {
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

		// Replace with actual API call
		const generated = await trpc.assignActivity.query({
			patientId: selectedClient.value,
			activityId: activity.value.activityId,
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

// Computed for page title
const pageTitle = computed(() => {
	return activity.value ? activity.value.activityName : "Détails de l'activité";
});

// Use our composable to set the page title
usePageTitle({
	title: pageTitle,
});

// Lifecycle
onMounted(() => {
	fetchActivity();
	fetchClients();
});
</script>

<!-- Template only for ActivityDetails.vue -->
<template>
  <json-debug :data="activity" />
  <div class="container mx-auto p-6">
    <!-- Back button -->
    <Button
      variant="ghost"
      class="mb-6 flex items-center gap-2"
      @click="goBack"
    >
      <ArrowLeft class="w-4 h-4" />
      Retour aux activités
    </Button>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div
        class="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"
      ></div>
    </div>

    <!-- Activity Not Found -->
    <div v-else-if="!activity" class="text-center py-12">
      <XCircle class="mx-auto h-12 w-12 text-destructive" />
      <h3 class="mt-4 text-lg font-medium">Activité non trouvée</h3>
      <p class="text-muted-foreground mt-2">
        L'activité que vous recherchez n'existe pas.
      </p>
      <Button @click="goBack" variant="outline" class="mt-4">
        Retour aux activités
      </Button>
    </div>

    <!-- Activity Details -->
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Main Information -->
      <div class="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div :class="activityColorClass" class="p-2 rounded-lg">
                  <component :is="activityIcon" class="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>{{ activity.activityName }}</CardTitle>
                  <p class="text-sm text-muted-foreground">
                    {{ activityTypeLabel }}
                  </p>
                </div>
              </div>
              <Badge
                v-if="!activity.active"
                variant="outline"
                class="text-xs bg-red-50 text-red-600 border-red-200"
              >
                Inactif
              </Badge>
              <Badge
                v-else
                variant="outline"
                class="text-xs bg-green-50 text-green-600 border-green-200"
              >
                Actif
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div class="mb-4">
              <h3 class="text-sm font-medium mb-2">Description</h3>
              <p class="text-sm text-muted-foreground">
                {{ activity.activityDesc }}
              </p>
            </div>

            <div v-if="activity.about" class="mb-4">
              <h3 class="text-sm font-medium mb-2">À propos</h3>
              <p class="text-sm text-muted-foreground">{{ activity.about }}</p>
            </div>

            <div v-if="activity.introImg" class="mt-6">
              <img
                :src="activity.introImg"
                :alt="activity.activityName"
                class="w-full rounded-lg object-cover max-h-64"
              />
            </div>

            <div v-if="activity.aboutPage" class="mt-6">
              <Prose :md="activity.aboutPage" :max-height="0" />
            </div>
          </CardContent>
          <CardFooter class="border-t pt-6 flex justify-end">
            <Button @click="openAssignDialog" :disabled="!activity.active">
              Assigner cette activité
            </Button>
          </CardFooter>
        </Card>

        <!-- Configuration Tabs -->
        <Tabs defaultValue="details">
          <TabsList class="grid grid-cols-3">
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="requirements">Prérequis</TabsTrigger>
            <TabsTrigger value="technical">Configuration</TabsTrigger>
          </TabsList>

          <!-- Details Tab -->
          <TabsContent value="details" class="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle class="text-base">Informations</CardTitle>
              </CardHeader>
              <CardContent class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <h4 class="text-sm font-medium">Programme</h4>
                    <p class="text-sm text-muted-foreground">
                      {{ activity.programId }}
                    </p>
                  </div>
                  <div>
                    <h4 class="text-sm font-medium">ID d'activité</h4>
                    <p class="text-sm text-muted-foreground">
                      {{ activity.activityId }}
                    </p>
                  </div>
                  <div>
                    <h4 class="text-sm font-medium">Séquence</h4>
                    <p class="text-sm text-muted-foreground">
                      {{ activity.activitySequence || "Non spécifié" }}
                    </p>
                  </div>
                  <div>
                    <h4 class="text-sm font-medium">Temps estimé</h4>
                    <p class="text-sm text-muted-foreground">
                      <span v-if="activity.onboardingDelay"
                        >{{ activity.onboardingDelay }} minutes</span
                      >
                      <span v-else>Non spécifié</span>
                    </p>
                  </div>
                </div>

                <div v-if="activity.outroText">
                  <h4 class="text-sm font-medium mb-1">Message de fin</h4>
                  <p class="text-sm text-muted-foreground">
                    {{ activity.outroText }}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <!-- Requirements Tab -->
          <TabsContent value="requirements" class="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle class="text-base">Prérequis et Suite</CardTitle>
              </CardHeader>
              <CardContent class="space-y-4">
                <div
                  v-if="
                    activity.necessaryContext &&
                    activity.necessaryContext.length
                  "
                >
                  <h4 class="text-sm font-medium mb-2">Prérequis</h4>
                  <div class="flex flex-col gap-2">
                    <div
                      v-for="(prereq, index) in activity.necessaryContext"
                      :key="index"
                      class="flex items-center gap-2 p-2 rounded-md bg-gray-50"
                    >
                      <AlertCircle class="w-4 h-4 text-amber-500" />
                      <span class="text-sm">{{
                        getDependencyName(prereq)
                      }}</span>
                    </div>
                  </div>
                </div>

                <div v-if="activity.nextActivityToSuggest">
                  <h4 class="text-sm font-medium mb-2">
                    Activité suivante suggérée
                  </h4>
                  <div
                    class="flex items-center gap-2 p-2 rounded-md bg-gray-50"
                  >
                    <ArrowLeft class="w-4 h-4 text-primary" />
                    <span class="text-sm">{{ nextActivityName }}</span>
                  </div>
                </div>

                <div
                  v-if="
                    !activity.necessaryContext?.length &&
                    !activity.nextActivityToSuggest
                  "
                  class="py-2"
                >
                  <p class="text-sm text-muted-foreground">
                    Aucun prérequis ou activité suivante définie.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <!-- Technical Tab -->
          <TabsContent value="technical" class="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle class="text-base">Configuration Technique</CardTitle>
              </CardHeader>
              <CardContent class="space-y-4">
                <div v-if="activity.type === 'form'">
                  <h4 class="text-sm font-medium mb-2">
                    Configuration du formulaire
                  </h4>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <h5 class="text-xs font-medium text-muted-foreground">
                        ID de formulaire
                      </h5>
                      <p class="text-sm">
                        {{ activity.formId || "Non spécifié" }}
                      </p>
                    </div>
                    <div>
                      <h5 class="text-xs font-medium text-muted-foreground">
                        Layout
                      </h5>
                      <p class="text-sm">
                        {{ activity.formLayout || "Standard" }}
                      </p>
                    </div>
                    <div>
                      <h5 class="text-xs font-medium text-muted-foreground">
                        Fonction d'analyse
                      </h5>
                      <p class="text-sm">
                        {{ activity.formAnalFunction || "Non spécifié" }}
                      </p>
                    </div>
                    <div>
                      <h5 class="text-xs font-medium text-muted-foreground">
                        Format d'analyse
                      </h5>
                      <p class="text-sm">
                        {{ activity.alalysisOutputFormat || "Non spécifié" }}
                      </p>
                    </div>
                  </div>
                </div>

                <div v-show="false">
                  <h4 class="text-sm font-medium mb-2">Paramètres avancés</h4>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <h5 class="text-xs font-medium text-muted-foreground">
                        Autostart
                      </h5>
                      <p class="text-sm">
                        {{ activity.autostart ? "Oui" : "Non" }}
                      </p>
                    </div>
                    <div>
                      <h5 class="text-xs font-medium text-muted-foreground">
                        Slug
                      </h5>
                      <p class="text-sm">{{ activity.slug }}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Quick Info Card -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <Button
              class="w-full"
              @click="openAssignDialog"
              :disabled="!activity.active"
            >
              Assigner à un client
            </Button>

            <div class="pt-2 border-t">
              <h4 class="text-sm font-medium mb-2">Informations rapides</h4>
              <dl class="space-y-2">
                <div class="flex justify-between">
                  <dt class="text-sm text-muted-foreground">Type:</dt>
                  <dd class="text-sm font-medium">{{ activityTypeLabel }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-sm text-muted-foreground">Statut:</dt>
                  <dd class="text-sm font-medium">
                    {{ activity.active ? "Actif" : "Inactif" }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-sm text-muted-foreground">Durée:</dt>
                  <dd class="text-sm font-medium">
                    {{
                      activity.onboardingDelay
                        ? `${activity.onboardingDelay} min`
                        : "Non spécifié"
                    }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-sm text-muted-foreground">Démarrage auto:</dt>
                  <dd class="text-sm font-medium">
                    {{ activity.autostart ? "Oui" : "Non" }}
                  </dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>

        <!-- Preview / Analysis info -->
        <Card v-if="activity.analysisSystemPrompt && false">
          <CardHeader>
            <CardTitle class="text-base">Prompt d'analyse</CardTitle>
          </CardHeader>
          <CardContent>
            <!-- Use v-if/v-else based on showAllPrompt state -->
            <p v-if="showAllPrompt" class="text-sm text-muted-foreground">
              {{ activity.analysisSystemPrompt }}
            </p>
            <p v-else class="text-sm text-muted-foreground line-clamp-3">
              {{ activity.analysisSystemPrompt }}
            </p>

            <!-- Only show the button when not showing all -->
            <Button
              v-if="!showAllPrompt"
              variant="outline"
              size="sm"
              class="mt-3 w-full"
              @click="showAllPrompt = true"
            >
              Voir le prompt complet
            </Button>

            <!-- Optional: Add a collapse button to go back to truncated view -->
            <Button
              v-else
              variant="outline"
              size="sm"
              class="mt-3 w-full"
              @click="showAllPrompt = false"
            >
              Réduire
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Assign Modal -->
    <Dialog :open="showAssignModal" @update:open="showAssignModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assigner "{{ activity?.activityName }}"</DialogTitle>
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
            @click="assignActivity"
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
  <brochure-footer />
</template>
