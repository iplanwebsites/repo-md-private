<!-- ClientDetail.vue -->
<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { formatDistance } from "date-fns";
import { fr } from "date-fns/locale";
import { formatDate } from "@/lib/utils/dateUtils";
import { usePageTitle } from "@/lib/utils/vueUtils";
import { useConversationStore } from "@/store/conversationStore";
import { useMeetingStore } from "@/store/meetingStore";

import trpc from "@/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CardTitle from "@/components/CardTitle.vue";

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
	MoreHorizontal,
	Lock,
	Video,
	X,
	Radar,
	Notebook,
	NotebookPen,
	Plus,
	Eye,
	RefreshCcw,
	Link,
	Trash2,
	Sprout,
	Calendar,
	Sparkles,
	ArrowRight,
	Brain,
	Sparkle,
} from "lucide-vue-next";

import { useToast } from "@/components/ui/toast/use-toast";
import JsonDebug from "@/components/JsonDebug.vue";
import ClientActivityList from "@/components/client/ClientActivityList.vue";
import ClientExtraList from "@/components/client/ClientExtraList.vue";

import ElipsisMenu from "@/components/ElipsisMenu.vue";
import InfoTooltip from "@/components/InfoTooltip.vue";

const router = useRouter();
const route = useRoute();
const { toast } = useToast();

const clients = ref([]);

// State
const loading = ref(true);
const error = ref(null);
const newNote = ref("");
const patientDetails = ref({
	name: "",
	email: "",
	activities: [],
	notes: [],
	status: "",
	startDate: new Date().toISOString(),
});

// Computed
const patientId = computed(() => route.params.id);

const pageTitle = computed(() => {
	return patientDetails.value ? patientDetails.value.name : "Détails";
});

// Use our composable to set the page title
usePageTitle({
	title: pageTitle,
});

// Methods

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

const sortedNotes = computed(() => [...patientDetails.value.notes].reverse());

const addNote = async () => {
	if (newNote.value.trim()) {
		try {
			await trpc.addPatientNote.mutate({
				patientId: patientId.value,
				content: newNote.value,
			});

			// Refresh patient details to get updated notes
			// await fetchPatientDetails();
			patientDetails.value.notes.push({
				id: Math.random().toString(36).substr(2, 9),
				date: new Date().toISOString(),
				content: newNote.value,
			});
			newNote.value = "";

			toast({
				title: "Note ajoutée",
				description: "La note a été ajoutée avec succès.",
			});
		} catch (err) {
			toast({
				title: "Erreur",
				description: "Impossible d'ajouter la note.",
				variant: "destructive",
			});
		}
	}
};

// Fetch data
const fetchPatientDetails = async () => {
	try {
		loading.value = true;
		const data = await trpc.getPatientDetails.query({
			patientId: patientId.value,
			includeActivities: true,
		});
		patientDetails.value = data;
	} catch (err) {
		error.value = "Une erreur s'est produite lors du chargement des données";
		console.error("Error fetching patient details:", err);
	} finally {
		loading.value = false;
	}
};

// Lifecycle
onMounted(() => {
	init();
});

const init = async function () {
	fetchPatientDetails();
	fetchAllClients();
};

//watch route
watch(
	() => route.params.id,
	() => {
		init();
	},
);
const meetingStore = useMeetingStore();
const fetchAllClients = function () {
	clients.value = meetingStore.patients;
};

function regenFiche() {
	trpc.generateFiche.query(patientId.value);
}

const isSidebarOpen = computed(() => {
	return route.name !== "client";
});

// Computed property for cards data
const bigCards = computed(() => [
	{
		title: "Fiche sommaire",
		icon: Radar,
		bgColor: "bg-purple-100",
		iconBgColor: "bg-purple-500",
		textColor: "text-purple-800",
		route: `/client/${patientDetails.value.id}/fiche`,
	},
	{
		title: "Conseils",
		icon: MessageSquare, //Lightbulb,
		bgColor: "bg-blue-100",
		iconBgColor: "bg-blue-500",
		textColor: "text-blue-800",
		route: `/client/${patientDetails.value.id}/talk`,
	},

	{
		title: "Notes", //"Add note",
		icon: NotebookPen, //FileText,
		bgColor: "bg-green-100",
		iconBgColor: "bg-green-500",
		textColor: "text-green-800",
		route: `/client/${patientDetails.value.id}/note`,
	},
]);

const elipsis = [
	{
		label: "Wiso",
		icon: MessageSquare, // Keep MessageSquare for discussion
		action: () => {
			const { startPatientConversation } = useConversationStore();
			startPatientConversation(patientDetails.value);
		},
	},
	{
		label: "Regénérer la fiche",
		icon: RefreshCcw, // Add RefreshCcw to imports and use for regeneration
		action: () => {
			console.log("Export");
			regenFiche();
		},
	},
	{
		label: "Salle vidéo",
		icon: Video, // Add Video to imports
		action: () => {
			router.push(`/meet/${patientDetails.id}`);
		},
	},
	{
		label: "RDV",
		icon: Calendar, // Add Calendar to imports
		action: () => {
			console.log("RDV clicked");
			// Add your appointment logic here
		},
	},

	/*

            <router-link :to="`/host/${patientDetails.id}`">
              <Button class="flex items-center gap-2" variant="outline">
                <Video class="w-4 h-4" />
                Salle vidéo
              </Button>
            </router-link>

            <Button class="flex items-center gap-2" variant="outline">
              <Calendar class="w-4 h-4" />
              RDV
            </Button>*/

	{
		sep: true,
	},
	{
		label: "Supprimer",
		icon: Trash2, // Add Trash2 to imports and use for delete instead of AlertCircle
		action: () => {
			console.log("Delete");
		},
	},
];

// Method to convert string icon names to Lucide components
const getCardIcon = (iconName) => {
	switch (iconName) {
		case "sparkles":
			return Sparkles;
		case "sparkle":
			return Sparkle;
		case "message-square":
			return MessageSquare;
		default:
			return null;
	}
};

// Method to convert string icon names to Lucide components for items
const getItemIcon = (iconName) => {
	switch (iconName) {
		case "arrow-right":
			return ArrowRight;
		case "message-square":
			return MessageSquare;
		default:
			return MessageSquare; // Fallback
	}
};

// Placeholder function for item click events
const doNothing = () => {
	console.log("Item clicked");
};

const bottomCards = [
	{
		title: "Plan d'action",
		desc: "Questions et sujets à explorer",
		icon: "sparkles",
		footerTxt: "",
		items: [
			{
				icon: "arrow-right",
				title:
					"Qu'est-ce qui te donne de l'énergie en ce moment ? Et qu'est-ce qui t'en enlève ?",
			},
			{
				icon: "arrow-right",
				title:
					"Si tu t'écoutais pleinement cette semaine, quelle décision prendrais-tu ?",
			},
			{
				icon: "arrow-right",
				title: "Y a-t-il un schéma récurrent que tu aimerais transformer ?",
			},
		],
	},
	{
		title: "Évolutions",
		desc: "Thème principal détecté : Recherche de clarté intérieure & besoin de stabilité",
		icon: "sparkle",
		footerTxt: "Derniers échanges analysés\nSéance du 15 mars 2024",
		items: [
			{
				icon: "message-square",
				title:
					"Je sens que je suis en train de passer un cap, mais je ne sais pas encore dans quelle direction.",
			},
			{
				icon: "message-square",
				title:
					"Je me rends compte que je prends souvent des décisions pour faire plaisir, pas pour moi.",
			},
		],
	},
];

const selectedTopTab = ref("tab1");
</script>

<template>
  <div class="min-h-screen overflow-hidden pt-0" style="background: #f9f4ff">
    <!-- Full height container with no scroll -->
    <!-- Main content with own scrollbar -->

    <div
      class="transition-all duration-300 ease-in-out h-[calc(100vh-56px)] mt-14 overflow-y-auto"
      :class="{ 'mr-[500px]': isSidebarOpen }"
    >
      <div class="container mx-auto p-6 min-h-full pt-0">
        <ClientBread
          :clientId="patientDetails.id"
          :clientName="patientDetails.name"
          :clients="clients"
        />

        <PageHeadingBar :title="patientDetails.name">
          <!-- Action Buttons Group -->
          <div class="flex items-center gap-2">
            <router-link :to="`/client/${patientDetails.id}/memory`">
              <Button class="flex items-center gap-2" variant="outline">
                <Brain class="w-4 h-4" />
                Mémoire
              </Button>
            </router-link>

            <router-link
              :to="`/client/${patientDetails.id}/fiche`"
              v-show="patientDetails.fiche"
            >
              <Button class="flex items-center gap-2" variant="outline">
                <Eye class="w-4 h-4" />
                Fiche
              </Button>
            </router-link>

            <ElipsisMenu :items="elipsis" v-if="elipsis.length">
              <Button variant="ghost" size="icon" class="rounded-full">
                <MoreHorizontal class="w-5 h-5" />
              </Button>
            </ElipsisMenu>
          </div>
        </PageHeadingBar>

        <div v-if="loading" class="flex items-center justify-center h-96">
          <div
            class="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"
          ></div>
        </div>

        <div v-else-if="error" class="text-center text-red-600">
          {{ error }}
        </div>

        <div style="max-width: 800px" v-if="!loading">
          <!--
              :patients="meetingStore.patients"
               :meets="meetingStore.meets"
            @clickScheduleMeet="scheduleMeetModal"
            
            -->

          <!-- Client Header 
          <div class="mb-8">
            <div class="flex items-center justify-between gap-4 mb-2">
             
              <div class="flex items-center gap-4">
                <div class="bg-primary/10 p-3 rounded-full">
                  <User class="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 class="text-3xl font-bold">
                    {{ patientDetails.name }}
                  </h1>
                  <a
                    :href="`mailto:${patientDetails.email}`"
                    target="_blank"
                    class="flex items-center gap-2 text-muted-foreground mt-1"
                  >
                    <Mail class="w-4 h-4" />
                    <span>{{ patientDetails.email }}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>-->

          <div
            class="flex flex-col md:flex-row gap-6 p-0 pt-6"
            style="display: none"
          >
            <router-link
              v-for="card in bigCards"
              :key="card.title"
              :to="card.route"
              class="flex-1"
            >
              <div
                :class="[
                  'rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow duration-300',
                  card.bgColor,
                ]"
              >
                <div class="flex flex-col items-center text-center">
                  <div :class="['mb-4 p-4 rounded-full', card.iconBgColor]">
                    <component :is="card.icon" class="w-12 h-12 text-white" />
                  </div>
                  <h2 :class="['text-xl font-semibold', card.textColor]">
                    {{ card.title }}
                  </h2>
                </div>
              </div>
            </router-link>
          </div>

          <div class="NO">
            <!-- Left Content - Activities -->
            <div class="col-span-2">
              <Tabs v-model="selectedTopTab" class="w-full">
                <TabsList>
                  <TabsTrigger value="tab1">Plan de développement</TabsTrigger>
                  <TabsTrigger value="tab2">Résumé</TabsTrigger>
                </TabsList>
                <TabsContent value="account"></TabsContent>
                <TabsContent value="tab2">
                  <MeetingAgenda
                    :patientId="patientId"
                    class="m-5 p-5 mt-12"
                    :showDummyMeets="false"
                    :viewAllButton="false"
                    :showHeader="true"
                  />

                  <pre>
Rencontre 1 mars
“Résumé” + voir plus

Rencontre 20 mars
“Résumé” + voir plus
                  </pre>
                </TabsContent>
              </Tabs>

              <ClientTopCard
                :patientId="patientId"
                :patientDetails="patientDetails"
              />

              <Card class="mb-6 w-full mt-8">
                <!-- Use the ClientActivityList component -->
                <ClientActivityList
                  :patientId="patientId"
                  :activities="patientDetails.activities"
                />
              </Card>

              <Card class="mb-6 w-full mt-8">
                <!-- Use the ClientExtraList component -->
                <ClientExtraList
                  :patientId="patientId"
                  :patientDetails="patientDetails"
                />
              </Card>

              <!-- Bottom Cards -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card
                  v-for="(card, index) in bottomCards"
                  :key="`bottom-card-${index}`"
                  class="overflow-hidden"
                >
                  <div class="p-6">
                    <CardTitle
                      :title="card.title"
                      :icon="getCardIcon(card.icon)"
                    >
                      <template #description>
                        <p class="text-muted-foreground">{{ card.desc }}</p>
                      </template>
                    </CardTitle>

                    <div class="mt-4 space-y-2">
                      <div
                        v-for="(item, itemIndex) in card.items"
                        :key="`card-item-${index}-${itemIndex}`"
                        @click="doNothing"
                        class="p-3 rounded-lg flex items-start gap-3 transition-colors duration-200 hover:bg-accent cursor-pointer"
                      >
                        <component
                          :is="getItemIcon(item.icon)"
                          class="w-5 h-5 mt-0.5 flex-shrink-0 text-primary"
                        />
                        <p class="text-sm">{{ item.title }}</p>
                      </div>
                    </div>

                    <div
                      v-if="card.footerTxt"
                      class="mt-4 pt-4 border-t border-border text-sm text-muted-foreground whitespace-pre-line"
                    >
                      {{ card.footerTxt }}
                    </div>
                  </div>
                </Card>
              </div>

              <!-- Notes Card -->
              <Card>
                <div class="p-6">
                  <CardTitle title="Notes" :icon="User"> </CardTitle>
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
                        v-for="note in sortedNotes"
                        :key="note.id + note.date"
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

              <div class="space-y-6">
                <!-- Client Info Card -->

                <Card v-if="false">
                  <div class="p-6">
                    <h3 class="text-lg font-semibold mb-4">À propos</h3>
                    <div class="space-y-4">
                      <!-- Status -->
                      <div class="flex items-center justify-between">
                        <span class="text-muted-foreground">Status</span>
                        <span
                          :class="[
                            'px-2 py-1 rounded-full text-sm font-medium',
                            getClientStatus(patientDetails.status).class,
                          ]"
                        >
                          {{ getClientStatus(patientDetails.status).label }}
                        </span>
                      </div>

                      <!-- Progress -->
                      <div class="flex items-center justify-between">
                        <span class="text-muted-foreground"
                          >Activités complétées</span
                        >
                        <span class="font-medium">
                          {{
                            patientDetails.activities.filter((a) => a.completed)
                              .length
                          }}/{{ patientDetails.activities.length }}
                        </span>
                      </div>

                      <!-- Contact -->
                      <div class="pt-4 border-t">
                        <div class="space-y-2">
                          <a
                            :href="`mailto:${patientDetails.email}`"
                            class="text-primary hover:underline block"
                          >
                            {{ patientDetails.email }}
                          </a>
                          <a
                            v-if="patientDetails.phone"
                            :href="`tel:${patientDetails.phone}`"
                            class="text-primary hover:underline block"
                          >
                            {{ patientDetails.phone }}
                          </a>
                        </div>
                      </div>

                      <router-link
                        v-show="patientDetails.fiche"
                        :to="`/client/${patientDetails.id}/fiche`"
                        class="flex items-center gap-2 text-primary hover:underline"
                      >
                        <Button size="sm">
                          <User class="w-4 h-4 mr-2" />
                          Fiche profil
                        </Button>
                      </router-link>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <!-- Right Sidebar -->
          </div>
        </div>

        <JsonDebug :data="patientDetails" :expanded="false" />
      </div>
    </div>

    <!-- Sidebar -->

    <!-- Sidebar with own scrollbar -->
    <div
      class="fixed top-14 right-0 h-[calc(100vh-56px)] bg-white border-l border-gray-200 shadow-lg transition-transform duration-300 ease-in-out flex flex-col"
      :class="[
        'w-[500px]',
        isSidebarOpen ? 'translate-x-0' : 'translate-x-full',
      ]"
    >
      <!-- Sidebar content wrapper with own scroll -->
      <div class="flex-1 overflow-y-auto">
        <router-view v-slot="{ Component }">
          <component :is="Component" :patientDetails="patientDetails" />
        </router-view>
      </div>
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
</style>
