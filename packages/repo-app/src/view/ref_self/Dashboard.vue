<!-- HomePage.vue -->
<script setup>
import { onMounted, ref } from "vue";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RouterLink } from "vue-router";
import { User, MessageCircle } from "lucide-vue-next";
import HomeActionBar from "@/components/HomeActionBar.vue";
import { useMeetingStore } from "@/store/meetingStore";

import trpc from "@/trpc";

const props = defineProps(["session"]);
const { session } = toRefs(props);

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

const clients = ref([]);

function fetchClients() {
	try {
		const meetingStore = useMeetingStore();
		// Keeping original property names from API response
		clients.value = meetingStore.patients.map((patient) => ({
			...patient,
			activities: patient.activities?.filter((a) => a.completed).length || 0,
			lastUpdate: patient.lastUpdate || new Date(),
			status: patient.status || "active",
			program: patient.program || "General Program",
		}));
	} catch (err) {
		console.error("Error loading patients:", err);
	}
}

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

onMounted(() => {
	initializeMentor();
	fetchClients();
});

// Données des concepts principaux

// TODO: Load from Blog route
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

// Données pour la barre latérale
const asideTab = ref("clients");

const activites = ref([
	{
		id: 1,
		titre: "Bilan de compétences",
		type: "Évaluation",
		statut: "En cours",
	},
	{
		id: 2,
		titre: "Gestion du stress",
		type: "Atelier",
		statut: "Planifié",
	},
	{
		id: 3,
		titre: "Leadership situationnel",
		type: "Formation",
		statut: "Terminé",
	},
]);

// Fonction pour formater la date
const formaterDate = (date) => {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
};
</script>

<template>
  <div>
    <!-- Action Bar -->

    <HomeDash :session="session" :clients="clients" />

    <div class="px-4 py-6 lg:px-8 bg-surface" style="display: none">
      <div class="container mx-auto">
        <!-- En-tête -->
        <div class="text-center my-8">
          <h1 class="text-3xl font-bold mb-3" @click="hello">
            Tableau de bord
          </h1>
          <p class="text-lg text-muted-foreground mb-6">
            Explorer le coaching à l'ère de l'IA
          </p>
        </div>

        <div class="flex flex-row gap-4">
          <!-- Contenu Principal -->
          <div class="flex-none w-full md:w-2/3">
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
                  <p class="text-muted-foreground">{{ concept.description }}</p>
                  <Badge class="mt-4">{{ concept.category }}</Badge>
                </RouterLink>
              </Card>
            </div>
          </div>

          <!-- Barre latérale -->
          <div class="rightPane flex-none w-1/3 hidden md:block">
            <Tabs v-model="asideTab" class="space-y-6">
              <TabsList class="w-full">
                <TabsTrigger value="clients" class="w-1/2">
                  <User class="w-4 h-4 mr-2" />
                  Clients
                </TabsTrigger>
                <TabsTrigger value="activites" class="w-1/2">
                  <MessageCircle class="w-4 h-4 mr-2" />
                  Ressources
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Card class="p-6 mt-4">
              <!-- Liste des clients -->
              <div v-if="asideTab === 'clients'" class="space-y-4">
                <RouterLink
                  v-for="client in clients"
                  :key="client.id"
                  :to="'/client/' + client.id"
                  class="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <User class="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p class="font-medium">{{ client.name }}</p>
                    <p class="text-sm text-muted-foreground">
                      {{ client.programme }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      Dernier accès: {{ formaterDate(client.lastUpdate) }}
                    </p>
                  </div>
                </RouterLink>
              </div>

              <!-- Liste des activités -->
              <div v-if="asideTab === 'activites'" class="space-y-4">
                <RouterLink
                  v-for="activite in activites"
                  :key="activite.id"
                  :to="'/activity/' + activite.id"
                  class="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <MessageCircle class="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p class="font-medium">{{ activite.titre }}</p>
                    <p class="text-sm text-muted-foreground">
                      {{ activite.type }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      Statut: {{ activite.statut }}
                    </p>
                  </div>
                </RouterLink>
              </div>
            </Card>
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

.container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
