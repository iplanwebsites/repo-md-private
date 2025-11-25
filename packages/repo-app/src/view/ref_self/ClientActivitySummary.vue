<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/dateUtils";
import { Button } from "@/components/ui/button";
import trpc from "@/trpc";
import {
	ChevronLeft,
	ChevronRight,
	FileText,
	MessageSquare,
	Lightbulb,
	BookOpen,
	CheckCircle2,
	AlertCircle,
	HelpCircle,
	Book,
	Cog,
	CheckCircle,
	RefreshCcw, // Add this
	Link, // Add this
	Trash2, // Add this
} from "lucide-vue-next";

import { useToast } from "@/components/ui/toast/use-toast";

const router = useRouter();
const route = useRoute();
const { toast } = useToast();

// State
const loading = ref(true);
const error = ref(null);

// Get client ID and activity ID from route
const patientId = computed(() => route.params.id);
const convoId = computed(() => route.params.convoId);

// Props definition
const props = defineProps({
	patientDetails: {
		type: Object,
		required: true,
	},
});

// Program progress data
const programProgress = ref({
	totalActivities: 0,
	completedActivities: 0,
	currentActivityIndex: 0,
	milestones: [],
});

// Resources and ideas
const resources = ref([]);
const ideas = ref([]);

const patientDetails = computed(() => {
	return props.patientDetails;
});

// Find current conversation
const currentConvo = computed(() => {
	const p = patientDetails.value;
	if (!p || !p.activities) return null;

	for (const activity of p.activities) {
		if (!activity.convos) continue;
		const foundConvo = activity.convos.find(
			(convo) => convo.id === convoId.value,
		);
		if (foundConvo) {
			return foundConvo;
		}
	}
	return null;
});

// Find invite URL
const inviteUrl = computed(() => {
	return currentActivity.value?.inviteUrl || "";
});

// Find current activity
const currentActivity = computed(() => {
	const p = patientDetails.value;
	const convo = currentConvo.value;

	if (!p || !p.activities || !convo || !convo.activityId) {
		console.warn("Missing required data:", {
			hasPatient: !!p,
			hasActivities: !!p?.activities,
			hasConvo: !!convo,
			activityId: convo?.activityId,
		});
		return null;
	}

	const activities = p.activities;
	console.log("Looking for activityId:", convo.activityId);
	console.log(
		"Available activities:",
		activities.map((a) => ({
			id: a.id,
			name: a.name,
			matches: a.activityId === convo.activityId,
		})),
	);

	const foundActivity = activities.find((activity) => {
		console.log(`Comparing activity: ${activity.id} === ${convo.activityId}`, {
			activityId: activity.id,
			convoActivityId: convo.activityId,
			matches: activity.id === convo.activityId,
			activityType: typeof activity.id,
			convoIdType: typeof convo.activityId,
		});

		return activity.activityId === convo.activityId;
	});

	if (!foundActivity) {
		console.warn(`No activity found with id: ${convo.activityId}`);
		return null;
	}

	return {
		...foundActivity,
		previousActivity: getPreviousActivity(activities, foundActivity.id),
		nextActivity: getNextActivity(activities, foundActivity.id),
	};
});

// Get other conversations from the same activity
const otherConvos = computed(() => {
	const p = patientDetails.value;
	const currentConvoId = convoId.value;

	if (!p?.activities || !currentConvo.value?.activityId) return [];

	// Find the activity that matches the current conversation's activityId
	const activity = p.activities.find(
		(a) => a.activityId === currentConvo.value.activityId,
	);

	if (!activity?.convos) return [];

	// Return all conversations except the current one, sorted by completedAt date
	return activity.convos
		.filter((convo) => {
			//convo.id !== currentConvoId
			if (convo.activityId !== currentConvo.value.activityId) return false;
			return true;
		})
		.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
});

// Methods
const fetchcurrentActivity = async () => {
	try {
		loading.value = true;
	} catch (err) {
		error.value = "Error loading activity data";
		console.error("Error fetching activity data:", err);
	} finally {
		loading.value = false;
	}
};

const getNextActivity = (activities, currentId) => {
	const currentIndex = activities.findIndex((a) => a.id === currentId);
	const nextActivity = activities[currentIndex + 1];
	return nextActivity
		? { id: nextActivity.id, name: nextActivity.activityName }
		: null;
};

const getPreviousActivity = (activities, currentId) => {
	const currentIndex = activities.findIndex((a) => a.id === currentId);
	const prevActivity = activities[currentIndex - 1];
	return prevActivity
		? { id: prevActivity.id, name: prevActivity.activityName }
		: null;
};

const navigateToActivity = (convoId) => {
	if (convoId) {
		router.push(`/client/${patientId.value}/activity/${convoId}`);
	}
};

// Using formatDate from dateUtils now

const getProgressWidth = () => {
	return `${(programProgress.value.completedActivities / programProgress.value.totalActivities) * 100}%`;
};

const analyseConvo = async () => {
	console.log("Analyzing conversation...");
	toast({
		title: "Analyse en cours",
		description: "Analyse de la conversation en cours...",
	});
	const anal = await trpc.analyseConvo.query(convoId.value);
	console.log(anal);
	currentConvo.value.analysis = anal.analysis;
	currentConvo.value.analysisHtml = anal.analysisHtml;
};

const elipsis = [
	{
		label: "Wiso",
		icon: MessageSquare,
		action: () => {
			console.log("Share");
		},
	},
	{
		label: "Regénérer l'analyse",
		icon: RefreshCcw,
		action: () => {
			console.log("Export");
			analyseConvo();
		},
	},
	{
		label: "Copier le lien d'invitation",
		icon: Link,
		action: () => {
			console.log("Export");
			const u = `${window.location.origin}${inviteUrl.value}`;
			console.log("Copy to clipboard:", u);
			navigator.clipboard.writeText(u);
			toast({
				title: "Lien copié",
				description: "Le lien d'invitation a été copié dans le presse-papiers",
			});
		},
	},
	{
		sep: true,
	},
	{
		label: "Supprimer",
		icon: Trash2,
		action: () => {
			console.log("Delete");
		},
	},
];

onMounted(() => {
	fetchcurrentActivity();
});
</script>

<template>
  <div class="" v-if="currentActivity && currentConvo">
    <div v-if="loading" class="flex items-center justify-center h-20">
      <div
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"
      ></div>
    </div>

    <div v-else-if="error" class="text-center text-red-600">
      {{ error }}
    </div>

    <div v-else>
      <SidePanelHeader
        :title="currentActivity.activityName"
        :subtitle="currentActivity.clientName"
        :backLink="`/client/${patientId}`"
        :completed="true"
        :elipsis="elipsis"
      />

      <div class="container mx-auto p-6">
        <Tabs default-value="page1" class=" ">
          <TabsList>
            <TabsTrigger value="page1">Sommaire</TabsTrigger>
            <TabsTrigger value="page2" v-if="currentActivity.type != 'form'"
              >Transcription</TabsTrigger
            >
            <!-- 
            <TabsTrigger value="page3">À propos</TabsTrigger>
            -->
          </TabsList>
          <TabsContent value="page3">
            <Card class="p-4 mt-2">
              <p>
                {{ currentActivity.about }}
              </p>
            </Card>
          </TabsContent>
          <TabsContent value="page2">
            <Card v-if="currentConvo && currentConvo.formAnswers" class="p-3">
              TODO: show answers:
              <json-debug
                :data="currentConvo.formAnswers"
                label="formAnswers"
              />
              {{ currentConvo.formAnswers }}
            </Card>

            <Cardno>
              <div class="transcript"></div>
              <StaticChatBubbleThread
                v-if="
                  currentConvo &&
                  currentConvo.transcript &&
                  currentConvo.transcript.messages
                "
                class="mt-6"
                :messages="currentConvo?.transcript?.messages"
              />
            </Cardno>
          </TabsContent>

          <TabsContent value="page1">
            <!-- Summary Card 
            <Card>
              <div class="p-6">
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <h2 class="text-xl font-semibold">Résumé de l'activité</h2>
                    <p class="text-sm text-muted-foreground">
                      {{ formatDate(currentConvo?.completedAt) }}
                      <span v-if="currentActivity.duration">
                        • {{ currentActivity.duration }}</span
                      >
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <CheckCircle2 class="w-5 h-5 text-green-500" />
                    <span class="text-sm font-medium">Complété</span>
                  </div>
                </div>
                <p class="text-muted-foreground mb-6">
                  {{ currentConvo.transcript?.summary }}
                </p>
                <div class="flex gap-3">
                  <Button class="gap-2">
                    <FileText class="w-4 h-4" />
                    Complémenter et partager à {{ currentActivity.clientName }}
                  </Button>
                  <Button variant="outline" class="gap-2">
                    <MessageSquare class="w-4 h-4" />
                    Discuter
                  </Button>
                </div>
              </div>
            </Card>-->

            <div v-if="currentConvo.formResults">
              <Big5Spider
                v-if="
                  currentConvo.formResults &&
                  currentConvo.formResults.dimensions
                "
                :dimensions="currentConvo.formResults.dimensions"
              />

              <json-debug :data="currentConvo.formResults" />
            </div>

            <CardNo>
              <div class="p-2">
                <div class="flex items-center gap-2 mb-4"></div>

                <p class="text-sm text-muted-foreground">
                  {{ formatDate(currentConvo?.completedAt) }}
                  <span v-if="currentActivity.duration">
                    • {{ currentActivity.duration }}</span
                  >
                </p>

                <p class="text-muted-foreground mb-6">
                  {{ currentConvo.transcript?.summary }}
                </p>

                <p class="text-muted-foreground mb-6 pre-line">
                  <Prose :html="currentConvo?.analysisHtml" :max-height="0" />
                </p>
              </div>
            </CardNo>

            <!-- Ideas Card -->
            <Card>
              <div class="p-6">
                <div class="flex items-center gap-2 mb-4">
                  <Lightbulb class="w-5 h-5 text-yellow-500" />
                  <h2 class="text-xl font-semibold">
                    Questions pertinentes pour préparer la prochaine séance
                  </h2>
                </div>
                <ul class="space-y-3">
                  <li
                    v-for="(idea, index) in ideas"
                    :key="index"
                    class="flex items-start gap-3"
                  >
                    <HelpCircle class="w-5 h-5 text-blue-500 mt-1" />
                    <span>{{ idea }}</span>
                  </li>
                </ul>
              </div>
            </Card>

            <!-- Resources Card -->
            <Card>
              <div class="p-6">
                <div class="flex items-center gap-2 mb-4">
                  <BookOpen class="w-5 h-5 text-purple-500" />
                  <h2 class="text-xl font-semibold">Ressources</h2>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <Button
                    v-for="(resource, index) in resources"
                    :key="index"
                    variant="outline"
                    class="h-auto p-4 flex flex-col items-start gap-2"
                  >
                    <span class="text-sm text-muted-foreground">{{
                      resource.type
                    }}</span>
                    <span class="font-medium">{{ resource.title }}</span>
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <!-- Other Conversations Card -->
        <Card class="mt-6" v-if="otherConvos.length > 0" style="display: none">
          <div class="p-6">
            <h2 class="text-xl font-semibold mb-4">
              Autres résultats de cette activité
            </h2>
            <div class="space-y-3">
              <div
                v-for="convo in otherConvos"
                :key="convo.id"
                class="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer"
                @click="router.push(`/client/${patientId}/convo/${convo.id}`)"
              >
                <div class="flex items-center gap-3">
                  {{ convo.activityId }}
                  <MessageSquare class="w-5 h-5 text-muted-foreground" />
                  <span>{{ formatDate(convo.completedAt) }}</span>
                  ----
                  <span>{{ formatDate(convo.date) }}</span>
                </div>
                <ChevronRight class="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </Card>

        <div class="grid grid-cols-3 gap-6">
          <div class="col-span-2 space-y-6"></div>
        </div>
      </div>
    </div>
  </div>

  <JsonDebug :data="patientDetails" :expanded="false" label="patientDetails" />
  <JsonDebug
    :data="currentActivity"
    :expanded="false"
    label="currentActivity"
  />
  <JsonDebug :data="currentConvo" :expanded="false" label="currentConvo" />
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
