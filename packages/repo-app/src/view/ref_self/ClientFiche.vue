<!-- FicheView.vue -->
<script setup>
import { ref, computed, onMounted, watch } from "vue";
import trpc from "@/trpc";

import { useRouter, useRoute } from "vue-router";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import CollapsibleFicheCard from "@/components/CollapsibleFicheCard.vue";
import {
	User,
	Mail,
	MapPin,
	GraduationCap,
	Languages,
	Brain,
	Target,
	Sparkles,
	Clock,
	FileText,
	BarChart,
	Compass,
	Heart,
	Shield,
	Info,
	MessageSquare,
	RefreshCcw,
	Link,
	Trash2,
} from "lucide-vue-next";

import { useToast } from "@/components/ui/toast/use-toast";
const { toast } = useToast();

const router = useRouter();
const route = useRoute();

// State management
const loading = ref(false);
const error = ref(null);
const useDummyData = ref(false);

// Props definition
const props = defineProps({
	patientDetails: {
		type: Object,
		required: true,
	},
});

// Computed
const patientId = computed(() => route.params.id);

// Reactive reference to patient details
const patientDetails = ref(props.patientDetails);

// Watch for prop changes
watch(
	() => props.patientDetails,
	(newValue) => {
		patientDetails.value = newValue;
	},
);

import { dummyData } from "@/data/dummyFiche2";

const newData = ref(null);

// Display data computation
const displayData = computed(() => {
	if (newData.value) {
		return newData.value;
	}
	return useDummyData.value ? dummyData : patientDetails.value.fiche;
});

// Utility functions

const formatPercentage = (value) => `${Math.round(value * 100)}%`;

async function regenFiche() {
	console.log("Regenerating fiche...");
	toast({
		title: "Fiche regénérée",
		description: "La fiche a été regénérée avec succès",
	});
	newData.value = { loading: true };
	loading.value = true;
	newData.value = await trpc.generateFiche.query(patientId.value);
	loading.value = false;
	console.log("New data:", newData.value);
}

const elipsis = [
	{
		label: "Wiso",
		icon: MessageSquare,
		action: () => {
			console.log("Share");
		},
	},
	{
		label: "Regénérer la fiche",
		icon: RefreshCcw,
		action: () => {
			console.log("Export");
			regenFiche();
		},
	},
	{
		label: "Partager le lien d'invitation",
		icon: Link,
		action: () => {
			console.log("Export");
			//   const u = `${window.location.origin}${inviteUrl.value}`;
			const u = "TODO";
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

function toFixedNumber(value) {
	if (value === null) return "";
	//validation
	if (isNaN(value)) return "";
	//if value is not a number

	return value.toFixed(1);
}
</script>

<template>
  <SidePanelHeader
    title="Fiche"
    :backLink="`/client/${patientId}`"
    :completed="false"
    :elipsis="elipsis"
  />

  <json-debug :data="newData" label="newData" />
  <json-debug :data="patientDetails.fiche" label="patientDetails.fiche" />

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
    <div v-if="displayData && !error && !loading" class="space-y-6">
      <!-- General Information Card - This one stays non-collapsible -->
      <Card>
        <div class="p-6">
          <h2 class="text-lg font-bold mb-4">Informations Générales</h2>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex items-center gap-2">
              <User class="w-4 h-4 text-muted-foreground" />
              <span
                >{{ displayData.generalInfo?.firstName }}
                {{ displayData.generalInfo?.lastName }}</span
              >
            </div>
            <div class="flex items-center gap-2">
              <Mail class="w-4 h-4 text-muted-foreground" />
              <span>{{ displayData.generalInfo?.contact.email }}</span>
            </div>
            <div class="flex items-center gap-2">
              <MapPin class="w-4 h-4 text-muted-foreground" />
              <span>{{ displayData.generalInfo?.location }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Languages class="w-4 h-4 text-muted-foreground" />
              <span>{{
                displayData.generalInfo?.contact.languages.join(", ")
              }}</span>
            </div>
            <div class="flex items-center gap-2">
              <GraduationCap class="w-4 h-4 text-muted-foreground" />
              <span>{{ displayData.generalInfo?.education.level }}</span>
            </div>
          </div>
        </div>
      </Card>

      <!-- Personality Summary Card - Now Collapsible -->
      <CollapsibleFicheCard title="Résumé de la Personnalité" :icon="User">
        <div class="space-y-4">
          <p class="text-sm">
            {{ displayData.personalitySummary?.shortSummary }}
          </p>

          <!-- Core Values -->
          <div class="bg-accent p-4 rounded-lg">
            <h3 class="font-medium mb-3">Valeurs Fondamentales</h3>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="value in displayData.personalitySummary?.coreValues
                  .values"
                :key="value"
                class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
              >
                {{ value }}
              </span>
            </div>
            <p class="mt-2 text-sm">
              {{ displayData.personalitySummary?.coreValues.description }}
            </p>
          </div>

          <!-- Life Mission -->
          <div class="bg-accent p-4 rounded-lg">
            <h3 class="font-medium mb-3">Mission de Vie</h3>
            <div class="space-y-2">
              <p class="text-sm"></p>

              <p class="text-sm">
                <strong>Vision:</strong>
                {{ displayData.personalitySummary?.lifeMission?.vision }}
              </p>
              <p class="text-sm">
                <strong>Mission:</strong>
                {{ displayData.personalitySummary?.lifeMission?.mission }}
              </p>
              <div class="mt-2">
                <div class="text-sm">Alignement</div>
                <div class="w-full bg-primary/20 h-2 rounded-full mt-1">
                  <div
                    class="bg-primary h-full rounded-full"
                    :style="{
                      width: `${displayData.personalitySummary?.lifeMission?.alignment * 100}%`,
                    }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleFicheCard>

      <!-- Psychological Analysis Card -->
      <CollapsibleFicheCard title="Analyse Psychologique" :icon="Brain">
        <!-- Big Five Profile -->
        <div class="space-y-4 mb-6">
          <div
            v-for="(dimension, trait) in displayData.psychologicalAnalysis
              ?.bigFive"
            :key="trait"
            class="bg-accent p-4 rounded-lg"
          >
            <div class="flex justify-between items-center mb-2">
              <span class="font-medium">{{ trait }}</span>
              <span>{{ toFixedNumber(dimension.score) }}/5</span>
            </div>
            <div class="w-full bg-primary/20 h-2 rounded-full mb-2">
              <div
                class="bg-primary h-full rounded-full"
                :style="{ width: `${dimension.percentile}%` }"
              ></div>
            </div>
            <p class="text-sm">{{ dimension.interpretation }}</p>
          </div>
        </div>

        <!-- Identity Structure -->
        <div class="bg-accent p-4 rounded-lg">
          <h3 class="font-medium mb-3">Structure Identitaire</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <h4 class="text-sm font-medium mb-2">Forces</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="strength in displayData.psychologicalAnalysis
                    ?.identityStructure.strengths"
                  :key="strength"
                  class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                >
                  {{ strength }}
                </span>
              </div>
            </div>
            <div>
              <h4 class="text-sm font-medium mb-2">Valeurs</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="value in displayData.psychologicalAnalysis
                    ?.identityStructure.values"
                  :key="value"
                  class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                >
                  {{ value }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleFicheCard>

      <!-- Cognitive Patterns Card -->
      <CollapsibleFicheCard title="Patterns Cognitifs" :icon="Brain">
        <div class="space-y-6">
          <!-- Thinking Style -->
          <div class="bg-accent p-4 rounded-lg">
            <h3 class="font-medium mb-3">Style de Pensée</h3>
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-sm font-medium mb-2">Analytique</p>
                  <div class="w-full bg-primary/20 h-2 rounded-full">
                    <div
                      class="bg-primary h-full rounded-full"
                      :style="{
                        width: `${displayData.cognitivePatterns?.thinkingStyle.analytical * 100}%`,
                      }"
                    ></div>
                  </div>
                </div>
                <div>
                  <p class="text-sm font-medium mb-2">Créatif</p>
                  <div class="w-full bg-primary/20 h-2 rounded-full">
                    <div
                      class="bg-primary h-full rounded-full"
                      :style="{
                        width: `${displayData.cognitivePatterns?.thinkingStyle.creative * 100}%`,
                      }"
                    ></div>
                  </div>
                </div>
              </div>
              <div>
                <p class="text-sm">
                  <strong>Style Principal:</strong>
                  {{
                    displayData.cognitivePatterns?.thinkingStyle.primaryStyle
                  }}
                </p>
                <p class="text-sm">
                  <strong>Style Secondaire:</strong>
                  {{
                    displayData.cognitivePatterns?.thinkingStyle.secondaryStyle
                  }}
                </p>
              </div>
            </div>
          </div>

          <!-- Decision Making -->
          <div class="bg-accent p-4 rounded-lg">
            <h3 class="font-medium mb-3">Prise de Décision</h3>
            <p class="text-sm mb-3">
              {{ displayData.cognitivePatterns?.decisionMaking.style }}
            </p>
            <div class="space-y-3">
              <div>
                <p class="font-medium mb-2">Patterns</p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="pattern in displayData.cognitivePatterns
                      ?.decisionMaking.patterns"
                    :key="pattern"
                    class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                  >
                    {{ pattern }}
                  </span>
                </div>
              </div>
              <div>
                <p class="font-medium mb-2">Défis</p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="challenge in displayData.cognitivePatterns
                      ?.decisionMaking.challenges"
                    :key="challenge"
                    class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm"
                  >
                    {{ challenge }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Behavioral Patterns -->
          <div class="bg-accent p-4 rounded-lg">
            <h3 class="font-medium mb-3">Patterns Comportementaux</h3>
            <div class="space-y-4">
              <div
                v-for="pattern in displayData.cognitivePatterns
                  ?.behavioralPatterns"
                :key="pattern.pattern"
                class="border-l-2 border-primary pl-4"
              >
                <p class="font-medium">{{ pattern.pattern }}</p>
                <p class="text-sm">Fréquence: {{ pattern.frequency }}</p>
                <p class="text-sm text-muted-foreground">
                  Contexte: {{ pattern.context }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleFicheCard>

      <!-- Emotional Profile Card -->
      <CollapsibleFicheCard title="Profil Émotionnel" :icon="Heart">
        <div class="space-y-6">
          <!-- Dominant Emotions -->
          <div class="bg-accent p-4 rounded-lg">
            <h3 class="font-medium mb-3">Émotions Dominantes</h3>
            <div class="space-y-4">
              <div
                v-for="emotion in displayData.emotionalProfile
                  ?.dominantEmotions"
                :key="emotion.emotion"
                class="border-l-2 border-primary pl-4"
              >
                <div class="flex justify-between items-center">
                  <p class="font-medium">{{ emotion.emotion }}</p>
                  <span class="text-sm"
                    >Intensité: {{ emotion.intensity }}/5</span
                  >
                </div>
                <p class="text-sm text-muted-foreground">
                  Contexte: {{ emotion.context }}
                </p>
              </div>
            </div>
          </div>

          <!-- Perfect Day -->
          <div class="bg-accent p-4 rounded-lg">
            <h3 class="font-medium mb-3">Journée Parfaite</h3>
            <div class="space-y-4">
              <div
                v-for="activity in displayData.emotionalProfile?.perfectDay
                  .activities"
                :key="activity.timeBlock"
                class="border-l-2 border-primary pl-4"
              >
                <p class="font-medium">{{ activity.timeBlock }}</p>
                <p class="text-sm">{{ activity.activity }}</p>
                <p class="text-sm text-muted-foreground">
                  {{ activity.significance }}
                </p>
              </div>
            </div>
          </div>

          <!-- Fears and Resilience -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-accent p-4 rounded-lg">
              <h3 class="font-medium mb-3">Peurs</h3>
              <div class="space-y-3">
                <div
                  v-for="fear in displayData.emotionalProfile?.fears"
                  :key="fear.description"
                >
                  <p class="text-sm font-medium">{{ fear.description }}</p>
                  <p class="text-sm">Origine: {{ fear.root }}</p>
                  <p class="text-sm text-muted-foreground">
                    Stratégie: {{ fear.copingStrategy }}
                  </p>
                </div>
              </div>
            </div>
            <div class="bg-accent p-4 rounded-lg">
              <h3 class="font-medium mb-3">Résilience</h3>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="factor in displayData.emotionalProfile?.resilience"
                  :key="factor"
                  class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                >
                  {{ factor }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleFicheCard>

      <!-- Development Areas Card -->
      <CollapsibleFicheCard title="Axes de Développement" :icon="Target">
        <div class="space-y-6">
          <!-- Development Axes -->
          <div
            v-for="axis in displayData.development?.axes"
            :key="axis.area"
            class="bg-accent p-4 rounded-lg"
          >
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-medium">{{ axis.area }}</h3>
              <span
                class="px-2 py-1 rounded-full text-xs"
                :class="{
                  'bg-red-100 text-red-800': axis.priority === 'high',
                  'bg-yellow-100 text-yellow-800': axis.priority === 'medium',
                  'bg-green-100 text-green-800': axis.priority === 'low',
                }"
              >
                {{ axis.priority }}
              </span>
            </div>
            <div class="space-y-2">
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="recommendation in axis.recommendations"
                  :key="recommendation"
                  class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                >
                  {{ recommendation }}
                </span>
              </div>
            </div>
          </div>

          <!-- Interventions -->
          <div
            v-for="intervention in displayData.development?.interventions"
            :key="intervention.type"
            class="bg-accent p-4 rounded-lg"
          >
            <h3 class="font-medium mb-3">{{ intervention.type }}</h3>
            <p class="text-sm mb-3">{{ intervention.description }}</p>
            <div class="space-y-3">
              <div>
                <p class="font-medium mb-2">Exercices</p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="exercise in intervention.exercises"
                    :key="exercise"
                    class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                  >
                    {{ exercise }}
                  </span>
                </div>
              </div>
              <div>
                <p class="font-medium mb-2">Résultats Attendus</p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="outcome in intervention.expectedOutcomes"
                    :key="outcome"
                    class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                  >
                    {{ outcome }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleFicheCard>

      <!-- Vision Card -->
      <CollapsibleFicheCard title="Vision" :icon="Compass">
        <div class="space-y-6">
          <!-- Long Term Vision -->
          <div class="bg-accent p-4 rounded-lg">
            <h3 class="font-medium mb-3">Vision à Long Terme</h3>
            <p class="text-sm mb-4">
              {{ displayData.vision?.longTermVision }}
            </p>
            <div>
              <p class="font-medium mb-2">Jalons Clés</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="milestone in displayData.vision?.keyMilestones"
                  :key="milestone"
                  class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                >
                  {{ milestone }}
                </span>
              </div>
            </div>
          </div>

          <!-- Timeline -->
          <div class="relative">
            <div class="absolute top-0 bottom-0 left-4 w-0.5 bg-primary"></div>
            <div class="space-y-6">
              <div
                v-for="event in displayData.vision?.timeline"
                :key="event.age"
                class="relative pl-8"
              >
                <div
                  class="absolute left-0 w-8 flex items-center justify-center"
                >
                  <div class="w-3 h-3 bg-primary rounded-full"></div>
                </div>
                <div class="bg-accent p-4 rounded-lg">
                  <div class="flex justify-between items-center mb-2">
                    <span class="font-medium">{{ event.age }} ans</span>
                    <div class="flex gap-2">
                      <span
                        v-for="emotion in event.emotions"
                        :key="emotion"
                        class="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs"
                      >
                        {{ emotion }}
                      </span>
                    </div>
                  </div>
                  <p class="font-medium text-sm">{{ event.event }}</p>
                  <p class="text-sm text-muted-foreground mt-1">
                    {{ event.impact }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleFicheCard>
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
