<!-- HomePage.vue -->
<script setup>
import { onMounted, ref, defineProps, computed, toRefs } from "vue";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RouterLink } from "vue-router";
import {
	User,
	MessageCircle,
	Menu,
	Settings,
	Clock,
	MoreVertical,
	Clipboard,
	Sparkles,
	ArrowRight,
	AlertTriangle,
	Calendar,
	Search,
	HelpCircle,
	MapPin,
} from "lucide-vue-next";
import HomeActionBar from "@/components/HomeActionBar.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { formatDate } from "@/lib/utils/dateUtils";
import HomeConversationSection from "@/components/HomeConversationSection.vue";

import trpc from "@/trpc";
import { useMeetingStore } from "@/store/meetingStore"; // Import the meeting store
import { useConversationStore } from "@/store/conversationStore"; // Import conversation store

// Define props with default values
const props = defineProps({
	session: {
		type: Object,
		default: () => ({}),
	},
});

// Get the stores
const meetingStore = useMeetingStore();
const conversationStore = useConversationStore();

const { session } = toRefs(props);
const user = computed(() => ({
	email: session.value?.user?.email || "",
	avatar: session.value?.user?.user_metadata?.avatar_url || "",
	name:
		session.value?.user?.user_metadata?.full_name ||
		session.value?.user?.email?.split("@")[0] ||
		"",
}));

// Get clients from the store instead of props
const clients = computed(() => meetingStore.patients);

// Search functionality
const searchQuery = ref("");
const filteredClients = computed(() => {
	if (!searchQuery.value.trim()) {
		return clients.value;
	}
	const query = searchQuery.value.toLowerCase();
	return clients.value.filter((client) =>
		client.name.toLowerCase().includes(query),
	);
});

// Add constant for maximum clients to show and ref for showing all clients
const MAX_CLIENTS_TO_SHOW = 5;
const showAllClients = ref(false);

// Add computed property for displayed clients
const displayedClients = computed(() => {
	if (showAllClients.value || searchQuery.value.trim()) {
		return filteredClients.value;
	}
	return filteredClients.value.slice(0, MAX_CLIENTS_TO_SHOW);
});

// Toggle function to show all clients
const toggleShowAllClients = () => {
	showAllClients.value = !showAllClients.value;
};

function hello() {
	/*
  trpc.hello.query("helllloooo999").then((res) => {
    console.log(res);
  });
  return "Hello World";
  */
}

function initializeMentor() {
	/// TBD: This is just a placeholder for now

	trpc.initializeMentor.query("helllloooo999").then((res) => {
		console.log(res);
	});
	return "Hello World";
}

// Data for appointments - use computed to get from meetingStore
const appointments = computed(() => {
	if (!meetingStore.meets || meetingStore.meets.length === 0) {
		return [];
	}

	const now = new Date();

	// Sort meetings by start time, filter out past meetings
	const sortedMeets = [...meetingStore.meets]
		.filter((meet) => {
			const meetingStart = new Date(meet.startTime);
			return meet.status === "scheduled" && meetingStart >= now;
		})
		.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
		.slice(0, 5); // Show the next 5 upcoming meetings

	return sortedMeets.map((meet) => {
		const meetDate = new Date(meet.startTime);
		const endTime = new Date(meetDate);
		endTime.setMinutes(endTime.getMinutes() + meet.duration);

		// Find patient for this meeting
		const patient = meetingStore.patients.find((p) => p.id === meet.patientId);

		return {
			id: meet.id,
			clientName: patient?.name || "Client",
			timeSlot: `${meetDate.getHours()}h${meetDate.getMinutes().toString().padStart(2, "0")} à ${endTime.getHours()}h${endTime.getMinutes().toString().padStart(2, "0")}`,
			day: meetDate.toLocaleDateString("en-US", { weekday: "long" }),
			date: meetDate.getDate(),
		};
	});
});

import { useRouter } from "vue-router";

const router = useRouter();

function clickMeeting(meetingId) {
	console.log("Meeting clicked:", meetingId);
	// Implementation for starting a meeting
	///navugate
	router.push(`/meets/${meetingId}`);
}

// Data for tasks
const tasks = ref([
	{
		id: 1,
		clientName: "Gabriel Beaulieu",
		description:
			"Dernières activités non complétées. Envoyer un message de motivation.",
		actionLabel: "Relancer",
	},
	{
		id: 2,
		clientName: "Erin Carlone",
		description:
			"Dernières activités non complétées. Envoyer un message de motivation.",
		actionLabel: "Relancer",
	},
	{
		id: 3,
		clientName: "Josiane Decarie",
		description: "Prêt(e) pour une nouvelle activité",
		actionLabel: "Envoyer",
	},
]);

// Data for recommendations
const recommendations = ref([
	{
		id: 1,
		clientName: "Alexandre Lepage",
		description:
			"Notes de la dernière séance : Wiso vous a préparé un debriefing.",
	},
	{
		id: 2,
		clientName: "Souhaib Khadraoui",
		description:
			"A exprimé des difficultés à structurer son temps, proposez-lui une activité sur la gestion des priorités.",
	},
	{
		id: 3,
		clientName: "Julie Bernard",
		description: "Recommandation",
	},
]);

// Concepts data
const concepts = ref([
	{
		id: 1,
		title: "Débuter avec Repo.md",
		description:
			"Découvrez comment Repo.md transforme l'approche du coaching professionnel. Notre plateforme combine l'intelligence artificielle et les meilleures pratiques du coaching pour offrir un accompagnement personnalisé et innovant. Idéal pour les coachs qui souhaitent digitaliser leur pratique et maximiser l'impact de leurs séances.",
		category: "introduction",
		link: "/getting-started",
	},
	{
		id: 2,
		title: "Créer des activités personnalisées",
		description:
			"Développez des exercices et des programmes sur mesure pour vos clients. Notre interface intuitive vous permet de créer des parcours de coaching adaptés aux objectifs spécifiques de chaque client, qu'il s'agisse de développement professionnel, de leadership ou de gestion du changement.",
		category: "création",
		link: "/create-activity",
	},
	{
		id: 3,
		title: "Participez au développement",
		description:
			"Votre expertise enrichit notre plateforme ! En tant que coach professionnel, vos retours sont précieux pour façonner l'avenir du coaching digital. Partagez vos idées pour améliorer Repo.md et contribuez à créer des outils qui répondent aux besoins réels des coachs et de leurs clients.",
		category: "communauté",
		link: "/contribute",
	},
]);

const handleNewActivity = () => {
	console.log("New activity action triggered");
	// Implementation for new activity
};

const handlePlanMeeting = () => {
	console.log("Plan meeting action triggered");
	// Implementation for planning a meeting
};

const handleAddClient = () => {
	console.log("Add client action triggered");
	// Implementation for adding a client
};

// Load data on mount
onMounted(() => {
	initializeMentor();

	// Only log data, no need to fetch again since App.vue already fetched it
	console.log("Using data from meeting store");
	console.log("Patients:", meetingStore.patients);
	console.log("Meetings:", meetingStore.meets);

	// If data isn't available yet, it will be reactive when it arrives
});

// Import date formatting utils instead of defining locally

// Check if data is loading
const isLoading = computed(
	() => meetingStore.patientsLoading || meetingStore.meetsLoading,
);

// Check if there's an error
const storeError = computed(() => meetingStore.error);
</script>

<template>
  <div class="bg-crazy img4">
    <!-- Action Bar -->
    <HomeActionBar
      @new-activity="handleNewActivity"
      @plan-meeting="handlePlanMeeting"
      @add-client="handleAddClient"
      style="max-width: 2070px"
    />

    <div class="min-h-screen p-6 container">
      <div style="max-width: 2000px">
        <!-- Header -->
        <header class="flex justify-between items-center mb-8">
          <h1 class="text-2xl font-bold">
            Bonjour {{ String(user.name).split(" ")[0] }},
            <div class="block text-lg font-normal">
              Heureux de vous retrouver. Continuons à révéler le potentiel de
              vos clients.
            </div>
          </h1>

          <div class="flex gap-2">
            <Button variant="ghost" size="icon" class="bg-black text-white">
              <Menu />
            </Button>
            <Button variant="outline" size="icon">
              <Settings />
            </Button>
          </div>
        </header>

        <!-- Loading indicator -->
        <div v-if="isLoading" class="text-center py-4">
          <p class="text-gray-600">Chargement des données...</p>
        </div>

        <!-- Error message -->
        <div
          v-else-if="storeError"
          class="bg-red-100 text-red-700 p-4 rounded-lg mb-6"
        >
          <p>{{ storeError }}</p>
        </div>

        <div v-else class="flex flex-col md:flex-row gap-6">
          <!-- Main Content Column (Left) -->
          <div class="w-full md:w-2/3">
            <!-- Appointments Section -->
            <section class="mb-8">
              <div class="bg-violet-50 p-3 rounded-lg inline-block mb-4">
                <span class="text-violet-600 font-medium"
                  >Prochains rendez-vous</span
                >
                <Badge class="ml-2 bg-blue-100 text-blue-800">
                  {{ meetingStore.upcomingMeetingsCount }} planifiés
                </Badge>
              </div>

              <!-- Appointment Cards -->
              <div v-if="appointments.length > 0" class="space-y-4">
                <div
                  v-for="appointment in appointments"
                  :key="appointment.id"
                  class="bg-white rounded-lg p-4 shadow-sm"
                >
                  <div class="flex justify-between items-start">
                    <div class="flex gap-4">
                      <div class="text-center">
                        <div class="font-medium">{{ appointment.day }}</div>
                        <div class="text-3xl font-bold">
                          {{ appointment.date }}
                        </div>
                      </div>
                      <div>
                        <h3 class="font-bold text-lg">
                          {{ appointment.clientName }}
                        </h3>
                        <div
                          class="flex items-center text-gray-500 gap-1 mt-1 text-sm"
                        >
                          <MapPin class="h-4 w-4" />
                          <span>En ligne</span>
                          <Clock class="h-4 w-4 ml-2" />
                          <span>{{ appointment.timeSlot }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="flex gap-2">
                      <Button
                        class="bg-black text-white"
                        @click="clickMeeting(appointment.id)"
                      >
                        Démarrer la séance
                      </Button>
                      <Button
                        variant="outline"
                        class="flex items-center gap-1"
                        @click="
                          conversationStore.startMeetingConversation(
                            appointment
                          )
                        "
                      >
                        <HelpCircle class="h-4 w-4" />
                        Wiso
                      </Button>
                      <Button variant="ghost" size="icon">
                        <MoreVertical />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No appointments message -->
              <div v-else class="bg-white rounded-lg p-4 shadow-sm">
                <p class="text-gray-600">Aucun rendez-vous planifié</p>
              </div>

              <router-link :to="'/meet'" class="block mt-4">
                <Button variant="ghost" class="mt-4">
                  Voir tous les rendez-vous
                </Button>
              </router-link>
            </section>

            <!-- Conversations Section -->
            <HomeConversationSection />

            <!-- Tasks Section -->
            <section class="mb-8 bg-white rounded-lg p-6 shadow-sm">
              <h2 class="text-xl font-bold mb-6">
                Préparer la scéance / wiso / consulter activités complétées
              </h2>

              <div class="space-y-6">
                <div
                  v-for="task in tasks"
                  :key="task.id"
                  class="flex justify-between items-center"
                >
                  <div class="flex gap-4">
                    <div class="bg-violet-100 p-3 rounded-lg">
                      <Clipboard class="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 class="font-medium">{{ task.clientName }}</h3>
                      <p class="text-gray-600 text-sm">
                        {{ task.description }}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline">
                    {{ task.actionLabel }}
                  </Button>
                </div>
              </div>
            </section>

            <!-- Recommendations Section -->
            <section class="mb-8 bg-white rounded-lg p-6 shadow-sm">
              <h2 class="text-xl font-bold mb-6">Recommandations Wiso</h2>

              <div class="space-y-6">
                <div
                  v-for="recommendation in recommendations"
                  :key="recommendation.id"
                  class="flex justify-between items-center"
                >
                  <div class="flex gap-4">
                    <div class="bg-violet-100 p-3 rounded-lg">
                      <Sparkles class="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 class="font-medium">
                        {{ recommendation.clientName }}
                      </h3>
                      <p class="text-gray-600 text-sm">
                        {{ recommendation.description }}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <ArrowRight />
                  </Button>
                </div>
              </div>
            </section>

            <!-- Concepts Section
            <section class="mb-8">
              <h2 class="text-xl font-bold mb-6">Concepts principaux</h2>
              <div class="grid gap-6">
                <Card
                  v-for="concept in concepts"
                  :key="concept.id"
                  class="p-6 transition-shadow hover:shadow-lg"
                >
                  <RouterLink :to="concept.link" class="block">
                    <h2 class="text-2xl font-semibold mb-2">
                      {{ concept.title }}
                    </h2>
                    <p class="text-muted-foreground">
                      {{ concept.description }}
                    </p>
                    <Badge class="mt-4">{{ concept.category }}</Badge>
                  </RouterLink>
                </Card>
              </div>
            </section> -->
          </div>

          <!-- Sidebar Column (Right) -->
          <div class="w-full md:w-1/3">
            <!-- Next Meeting -->
            <section v-if="meetingStore.nextScheduledPatient" class="mb-8">
              <h2 class="text-xl font-bold mb-6">Prochain rendez-vous</h2>
              <div class="bg-white rounded-lg p-4 shadow-sm">
                <div class="flex gap-4 mb-3">
                  <div class="bg-blue-100 p-2 rounded-full">
                    <Clock class="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 class="font-medium">
                      {{ meetingStore.nextScheduledPatient.name }}
                    </h3>
                    <p class="text-gray-600 text-sm">
                      {{ meetingStore.nextScheduledPatient.meetingTime }}
                    </p>
                    <p class="text-gray-600 text-sm">
                      {{ meetingStore.nextScheduledPatient.agenda }}
                    </p>
                  </div>
                </div>
                <div class="flex justify-end">
                  <Button> Préparer la séance </Button>
                </div>
              </div>
            </section>

            <!-- Actions Section -->
            <section class="mb-8">
              <h2 class="text-xl font-bold mb-6">Actions à prendre</h2>

              <div class="space-y-6">
                <!-- Unconfirmed Appointment -->
                <div class="bg-white rounded-lg p-4 shadow-sm">
                  <div class="flex gap-4 mb-3">
                    <div class="bg-orange-100 p-2 rounded-full">
                      <AlertTriangle class="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <h3 class="font-medium">Marc-André Bourassa</h3>
                      <p class="text-gray-600 text-sm">
                        RDV non confirmé pour demain
                      </p>
                    </div>
                  </div>
                  <div class="flex justify-end">
                    <Button variant="outline"> Relancer </Button>
                  </div>
                </div>

                <!-- New Appointment Request -->
                <div class="bg-white rounded-lg p-4 shadow-sm">
                  <div class="flex gap-4 mb-3">
                    <div class="bg-orange-100 p-2 rounded-full">
                      <AlertTriangle class="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <h3 class="font-medium">Karine Gendreau</h3>
                      <p class="text-gray-600 text-sm">
                        Nouvelle demande de rdv
                      </p>
                      <div class="mt-3 space-y-2 text-sm text-gray-500">
                        <div class="flex items-center gap-1">
                          <Calendar class="h-4 w-4" />
                          <span>Jeudi 27 mars 2025</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <MapPin class="h-4 w-4" />
                          <span>En ligne</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <Clock class="h-4 w-4" />
                          <span>15h00 à 15h45</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="flex justify-end gap-2">
                    <Button> Accepter </Button>
                    <Button variant="outline"> Refuser </Button>
                  </div>
                </div>
              </div>
            </section>

            <!-- Clients Section -->
            <section class="mb-8">
              <h2 class="text-xl font-bold mb-6">
                Liste des clients
                <Badge class="ml-2 bg-green-100 text-green-800">
                  {{ meetingStore.availableRoomsCount }} disponibles
                </Badge>
              </h2>

              <div class="bg-white rounded-lg p-4 shadow-sm">
                <!-- Fixed Search Bar -->
                <div class="relative mb-4">
                  <div
                    class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                  >
                    <Search class="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Rechercher"
                    class="pl-10 w-full"
                  />
                </div>

                <!-- Clients List - Now using displayedClients instead of filteredClients -->
                <div v-if="displayedClients.length > 0" class="space-y-2">
                  <RouterLink
                    v-for="client in displayedClients"
                    :key="client.id"
                    :to="'/client/' + client.id"
                    class="flex justify-between items-center p-2 hover:bg-gray-50 rounded"
                  >
                    <div>
                      <p class="font-medium">{{ client.name }}</p>
                      <p class="text-xs text-muted-foreground">
                        <Badge
                          :class="meetingStore.getBadgeClass(client.roomStatus)"
                        >
                          {{ meetingStore.formatStatus(client.roomStatus) }}
                        </Badge>
                        <span v-if="client.nextMeeting" class="ml-2">
                          {{ meetingStore.formatDate(client.nextMeeting) }}
                        </span>
                      </p>
                    </div>
                    <Button variant="ghost" size="icon">
                      <MoreVertical class="h-4 w-4" />
                    </Button>
                  </RouterLink>
                </div>
                <div v-else class="text-center py-4">
                  <p v-if="searchQuery" class="text-gray-600">
                    Aucun client ne correspond à votre recherche
                  </p>
                  <p v-else class="text-gray-600">Aucun client disponible</p>
                </div>

                <!-- Show All Clients Toggle Button -->
                <div
                  v-if="
                    filteredClients.length > MAX_CLIENTS_TO_SHOW && !searchQuery
                  "
                  class="mt-4 text-center"
                >
                  <Button variant="ghost" @click="toggleShowAllClients">
                    {{ showAllClients ? "Voir moins" : "Voir tous..." }}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-surface {
  background-color: hsl(var(--background));
}
</style>
