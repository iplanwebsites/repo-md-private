<!-- ClientDetail.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useRoute } from "vue-router";
import trpc from "@/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Check,
	Circle,
	FileText,
	Lightbulb,
	MessageSquare,
	User,
	Mail,
	ChevronRight,
	Link2,
	Clock,
	CheckCircle2,
	AlertCircle,
	Bolt,
} from "lucide-vue-next";

import { useToast } from "@/components/ui/toast/use-toast";
import JsonDebug from "@/components/JsonDebug.vue";

const router = useRouter();
const route = useRoute();

const newNote = ref("");
const { toast } = useToast();

// Mock data - replace with your actual data fetching logic
const clientData = ref({
	id: 1,
	name: "Sophie Dubois",
	email: "sophie.dubois@email.com",
	phone: "+1 514 444 1919",
	status: "active",
	joinedDate: "2024-01-15",
	lastActivity: "2024-01-22",
	notes: [
		{
			id: 1,
			date: "2024-01-20",
			content: "First session completed - very motivated",
		},
		{
			id: 2,
			date: "2024-01-22",
			content: "Working on stress management techniques",
		},
	],
});

const programData = ref({
	name: "General",
	startDate: "2024-01-15",
	objectives: [
		"Améliorer la confiance en soi",
		"Développer la communication assertive",
		"Gestion du stress",
	],
	activities: [
		{ id: 1, name: "Formulaire d'intention initial", completed: true },
		{ id: 2, name: "Définition des objectifs", completed: true },
		{ id: 3, name: "Exercices de respiration", completed: false },
		{ id: 4, name: "Journal de réflexion", completed: false },
		{ id: 5, name: "Bilan mi-parcours", completed: false },
	],
});

// Methods
const handleActivityClick = (activity) => {
	console.log("CLIEKC activity", activity);
	if (activity.completed) {
		const u =
			activity.analysisUrl ||
			`/client/${clientData.value.id}/general-DEMO/${activity.id}`;
		console.log("u", u);
		router.push(u);
		// router.push(`/client/${clientData.value.id}/general/${activity.id}`);
	} else {
		copyActivityStartLink(activity);
		// Copy activity link to clipboard
		//   const activityUrl = `${window.location.origin}/client/${clientData.value.id}/general/${activity.id}`;
		//  navigator.clipboard.writeText(activityUrl);
		// You might want to add a toast notification here
	}
};

const formatDate = (date) => {
	return new Date(date).toLocaleDateString("en-US");
};

const getCompletedActivitiesCount = () => {
	return programData.value.activities.filter((a) => a.completed).length;
};

const getTotalActivitiesCount = () => {
	return programData.value.activities.length;
};

const getClientStatus = (status) => {
	switch (status) {
		case "active":
			return { label: "Actif", class: "bg-green-100 text-green-800" };
		case "new":
			return { label: "Nouveau", class: "bg-blue-100 text-blue-800" };
		default:
			return { label: "Inactif", class: "bg-gray-100 text-gray-800" };
	}
};

const addNote = () => {
	if (newNote.value.trim()) {
		clientData.value.notes.unshift({
			id: Date.now(),
			date: new Date().toISOString(),
			content: newNote.value,
		});
		newNote.value = "";
	}
};

const copyActivityStartLink = (activity) => {
	const default_activityUrl = `${window.location.origin}/start-activity/${activity.startUrl || "startUrlTokenTODO"}`;

	//
	const inviteUrl = `${window.location.origin}${activity.inviteUrl}`;
	navigator.clipboard.writeText(inviteUrl);
	// You might want to add a toast notification here

	activity.hasCopied = true;

	toast({
		title: "Lien copié !",
		description: "Le lien d'invitation a été copié dans votre presse-papiers.",
		duration: 3000,
	});
};

// Get activity ID from route params
const loading = ref(true);
const error = ref(null);
const patientId = computed(() => route.params.id);
// Fetch activity data on component mount
const patientDetails = ref({});
onMounted(async () => {
	try {
		loading.value = true;
		const data = await trpc.getPatientDetails.query({
			patientId: patientId.value,
		});
		patientDetails.value = data;
	} catch (err) {
		error.value = "Une erreur s'est produite lors du chargement de l'activité";
		console.error("Error fetching activity:", err);
	} finally {
		loading.value = false;
	}
});

const activities = computed(() => {
	return patientDetails.value.activities || [];
});
</script>

<template>
  <div class="container mx-auto p-6">
    <ClientBread :clientId="1" :clientName="clientData.name" />

    <!-- Client Header -->
    <div class="mb-8">
      <div class="flex items-center gap-4 mb-2">
        <div class="bg-primary/10 p-3 rounded-full">
          <User class="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 class="text-3xl font-bold">{{ clientData.name }}</h1>
          <div class="flex items-center gap-2 text-muted-foreground mt-1">
            <Mail class="w-4 h-4" />
            <span>{{ clientData.email }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <!-- Left Content - Program Activities -->
      <div class="col-span-2">
        <Card class="mb-6">
          <div class="p-6">
            <!-- Program Header -->
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="text-2xl font-bold">{{ programData.name }}</h2>
                <p class="text-sm text-muted-foreground mt-1">
                  Démarré le {{ formatDate(programData.startDate) }}
                </p>
              </div>
              <div class="flex gap-2">
                <Button variant="outline" size="sm">
                  <FileText class="w-4 h-4 mr-2" />
                  Résumé
                </Button>
                <Button variant="outline" size="sm">
                  <Lightbulb class="w-4 h-4 mr-2" />
                  Idées
                </Button>
                <router-link to="/convo/123456">
                  <Button variant="outline" size="sm">
                    <MessageSquare class="w-4 h-4 mr-2" />

                    Discuter
                  </Button>
                </router-link>
              </div>
            </div>

            <!-- Objectives -->
            <div class="mb-6">
              <h3 class="font-semibold mb-2">Objectifs</h3>
              <ul class="list-disc ml-6 space-y-1">
                <li
                  v-for="(objective, index) in programData.objectives"
                  :key="index"
                  class="text-muted-foreground"
                >
                  {{ objective }}
                </li>
              </ul>
            </div>

            <!-- Activities -->
            <div>
              <h3 class="font-semibold mb-4">Activités</h3>
              <div class="space-y-4">
                <div
                  v-for="activity in [...programData.activities, ...activities]"
                  :key="activity.id"
                  class="flex items-center justify-between p-4 rounded-lg border hover:bg-accent cursor-pointer"
                  @click="handleActivityClick(activity)"
                >
                  <div class="flex items-center gap-3">
                    <Check
                      v-if="activity.completed"
                      class="w-5 h-5 text-green-600"
                    />
                    <Circle v-else class="w-5 h-5 text-muted-foreground" />
                    <span class="text-foreground">
                      {{ activity.activityName || activity.name }}
                    </span>
                  </div>
                  <Button v-if="activity.completed" variant="ghost" size="sm">
                    Voir les détails
                    <ChevronRight class="w-4 h-4 ml-2" />
                  </Button>
                  <Button v-else variant="ghost" size="sm">
                    Copier le lien
                    <Link2 class="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <!-- Right Sidebar -->
      <div class="space-y-6">
        <!-- À propos Card -->
        <Card>
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">À propos</h3>
            <div class="space-y-4">
              <!-- Status -->
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Status</span>
                <span
                  :class="[
                    'px-2 py-1 rounded-full text-sm font-medium',
                    getClientStatus(clientData.status).class,
                  ]"
                >
                  {{ getClientStatus(clientData.status).label }}
                </span>
              </div>

              <!-- Progress -->
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Activités complétées</span>
                <span class="font-medium">
                  {{ getCompletedActivitiesCount() }}/{{
                    getTotalActivitiesCount()
                  }}
                </span>
              </div>

              <!-- Last Activity -->
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Dernière activité</span>
                <span class="font-medium">{{
                  formatDate(clientData.lastActivity)
                }}</span>
              </div>

              <!-- Contact -->
              <div class="pt-4 border-t">
                <div class="space-y-2">
                  <a
                    :href="`mailto:${clientData.email}`"
                    class="text-primary hover:underline block"
                  >
                    {{ clientData.email }}
                  </a>
                  <a
                    :href="`tel:${clientData.phone}`"
                    class="text-primary hover:underline block"
                  >
                    {{ clientData.phone }}
                  </a>
                </div>
              </div>

              <Button size="sm">
                <User class="w-4 h-4 mr-2" />
                Fiche profil
              </Button>
              <Button variant="secondary" size="sm" class="ml-1">
                <Bolt class="w-4 h-4 mr-2" />
                Regénérer la fiche
              </Button>
            </div>
          </div>
        </Card>

        <!-- Notes Card -->
        <Card>
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">Notes</h3>
            <div class="space-y-4">
              <div>
                <Textarea
                  v-model="newNote"
                  placeholder="Ajouter une note..."
                  class="mb-2"
                />
                <Button class="w-full" @click="addNote"> Ajouter </Button>
              </div>
              <div class="space-y-3">
                <div
                  v-for="note in clientData.notes"
                  :key="note.id"
                  class="p-3 rounded-lg bg-accent"
                >
                  <p class="text-sm text-muted-foreground mb-1">
                    {{ formatDate(note.date) }}
                  </p>
                  <p>{{ note.content }}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
  <JsonDebug :data="patientDetails" :expanded="false" />
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
</style>
