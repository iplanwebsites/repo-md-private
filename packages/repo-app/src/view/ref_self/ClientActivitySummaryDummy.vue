<!-- ActivitySummary.vue -->
<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-vue-next";

const router = useRouter();

// Mock data - replace with your actual data fetching logic
const activityData = ref({
	id: 3,
	name: "Exercices de respiration",
	date: "2024-01-20",
	clientName: "Sophie Dubois",
	summary:
		"Session très productive. Sophie a montré une excellente compréhension des techniques de respiration profonde. Elle a particulièrement bien réussi l'exercice du carré respiratoire.",
	status: "completed",
	duration: "45 minutes",
	nextActivity: {
		id: 4,
		name: "Journal de réflexion",
	},
	previousActivity: {
		id: 2,
		name: "Définition des objectifs",
	},
});

const programProgress = ref({
	totalActivities: 5,
	completedActivities: 2,
	currentActivityIndex: 2,
	milestones: [
		{ name: "Évaluation initiale", completed: true },
		{ name: "Définition des objectifs", completed: true },
		{ name: "Exercices de respiration", completed: true },
		{ name: "Journal de réflexion", completed: false },
		{ name: "Bilan mi-parcours", completed: false },
	],
});

const resources = ref([
	{ title: "Guide de respiration profonde", type: "PDF" },
	{ title: "Application de méditation recommandée", type: "Link" },
	{ title: "Vidéo explicative", type: "Video" },
]);

const ideas = ref([
	"Suggérer la pratique quotidienne de 5 minutes",
	"Intégrer la respiration aux moments de stress",
	"Tenir un journal des séances",
]);

const navigateToActivity = (activityId) => {
	router.push(`/${activityId}`);
};

const formatDate = (date) => {
	return new Date(date).toLocaleDateString("en-US");
};

const getProgressWidth = () => {
	return `${(programProgress.value.completedActivities / programProgress.value.totalActivities) * 100}%`;
};
</script>

<template>
  <div class="container mx-auto p-6">
    <ClientBread
      clientName="Sophie Dubois"
      programName="General"
      activityName="Exercices de respiration"
      :clientId="1"
      :programId="'general'"
      :activityId="3"
    />
    <!-- Navigation Header -->

    <div
      class="flex items-center justify-between mb-8 mt-33"
      style="margin-top: 100px"
    >
      <Button
        variant="ghost"
        class="gap-2"
        @click="navigateToActivity(activityData.previousActivity.id)"
      >
        <ChevronLeft class="w-4 h-4" />
        {{ activityData.previousActivity.name }}
      </Button>
      <h1 class="text-2xl font-bold text-center">{{ activityData.name }}</h1>
      <Button
        variant="ghost"
        class="gap-2"
        @click="navigateToActivity(activityData.nextActivity.id)"
      >
        {{ activityData.nextActivity.name }}
        <ChevronRight class="w-4 h-4" />
      </Button>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <!-- Main Content -->
      <div class="col-span-2 space-y-6">
        <!-- Summary Card -->
        <Card>
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-xl font-semibold">Résumé de l'activité</h2>
                <p class="text-sm text-muted-foreground">
                  {{ formatDate(activityData.date) }} •
                  {{ activityData.duration }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <CheckCircle2 class="w-5 h-5 text-green-500" />
                <span class="text-sm font-medium">Complété</span>
              </div>
            </div>
            <p class="text-muted-foreground mb-6">{{ activityData.summary }}</p>
            <div class="flex gap-3">
              <Button class="gap-2">
                <FileText class="w-4 h-4" />
                Voir la transcription
              </Button>
              <Button class="gap-2">
                <FileText class="w-4 h-4" />
                Complémenter et partager à Sophie
              </Button>
              <Button variant="outline" class="gap-2">
                <MessageSquare class="w-4 h-4" />
                Discuter
              </Button>
            </div>
          </div>
        </Card>

        <!-- Ideas Card -->

        <Card>
          <div class="p-6">
            <div class="flex items-center gap-2 mb-4">
              <Book class="w-5 h-5 text-green-500" />
              <h2 class="text-xl font-semibold">Analyse</h2>
            </div>

            <Button variant="outline" class="gap-2">
              <Cog class="w-4 h-4" />
              Regénérer
            </Button>

            <p class="text-muted-foreground mb-6">{{ activityData.summary }}</p>
            <p class="text-muted-foreground mb-6">{{ activityData.summary }}</p>
            <p class="text-muted-foreground mb-6">{{ activityData.summary }}</p>
            <p class="text-muted-foreground mb-6">{{ activityData.summary }}</p>
            <p class="text-muted-foreground mb-6">{{ activityData.summary }}</p>

            <img
              src="https://arxiv.org/html/2402.01765v1/extracted/5380407/radar_plot.png"
            />

            <p class="text-muted-foreground mb-6">{{ activityData.summary }}</p>
          </div>
        </Card>

        <Card>
          <div class="p-6">
            <div class="flex items-center gap-2 mb-4">
              <Lightbulb class="w-5 h-5 text-yellow-500" />
              <h2 class="text-xl font-semibold">Idées pour la suite</h2>
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
      </div>

      <!-- Right Sidebar - Progress -->
      <Card class="h-fit">
        <div class="p-6">
          <h2 class="text-xl font-semibold mb-4">Progression du programme</h2>
          <div class="space-y-6">
            <div>
              <div
                class="flex justify-between text-sm text-muted-foreground mb-2"
              >
                <span>Progression totale</span>
                <span
                  >{{ programProgress.completedActivities }}/{{
                    programProgress.totalActivities
                  }}
                  activités</span
                >
              </div>
              <div class="w-full bg-accent rounded-full h-2">
                <div
                  class="bg-primary rounded-full h-2"
                  :style="{ width: getProgressWidth() }"
                />
              </div>
            </div>

            <div class="space-y-3">
              <div
                v-for="(milestone, index) in programProgress.milestones"
                :key="index"
                class="flex items-center gap-3 p-3 rounded-lg border"
              >
                <CheckCircle2
                  v-if="milestone.completed"
                  class="w-5 h-5 text-green-500"
                />
                <AlertCircle v-else class="w-5 h-5 text-muted-foreground" />
                <span
                  :class="
                    milestone.completed
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  "
                >
                  {{ milestone.name }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
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
