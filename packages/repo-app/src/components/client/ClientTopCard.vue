<script setup>
import { computed } from "vue";

const topCard = computed(() => ({
	date: "14 février 2025",
	objective: "bilan intermédiaire",
	explorationCompleted: true,
	mirrorTitle: "Miroir des émotions",
	mirrorResults: "Les résultats montrent des blocages émotionnels récurrents",
	recommendationTitle: "Recommandation Wiso",
	recommendationContent: `Alexandre a complété l'exploration Miroir des émotions. Les résultats indiquent des blocages émotionnels récurrents, notamment liés à des expériences passées encore vives. Il pourrait être utile d'explorer avec lui comment ces émotions influencent ses décisions actuelles et ses réactions face aux situations stressantes.`,
}));
</script>

<template>
  <div
    class="p-5 bg-white rounded-lg shadow-md border border-gray-200 w-full mt-9"
  >
    <!-- Header -->
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-medium text-gray-700">Prochaine séance</h3>
      <span
        class="text-sm font-medium text-purple-300 bg-purple-50 px-2 py-1 rounded"
      >
        {{ topCard.date }}
      </span>
    </div>

    <!-- Main content with timeline -->
    <div class="relative">
      <!-- Vertical line -->
      <div class="absolute left-3 top-0 h-full w-0.5 bg-gray-100"></div>

      <!-- Main objective with purple circle -->
      <div class="flex mb-5">
        <div class="relative">
          <div
            class="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center z-10 relative"
          >
            <div class="w-2 h-2 rounded-full bg-white"></div>
          </div>
        </div>
        <div class="ml-5">
          <p class="text-gray-700 font-medium">
            Objectif principal : {{ topCard.objective }}
          </p>

          <div
            v-if="topCard.explorationCompleted"
            class="mt-2 text-green-600 text-sm font-normal bg-green-50 rounded-md px-3 py-1 inline-flex items-center"
          >
            <span class="mr-1.5">✓</span> Une nouvelle exploration a été
            complétée
          </div>
        </div>
      </div>

      <!-- Mirror section with light purple circle -->
      <div class="flex mb-5">
        <div class="relative">
          <div
            class="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center z-10 relative"
          >
            <div class="w-2 h-2 rounded-full bg-purple-500"></div>
          </div>
        </div>
        <div class="ml-5">
          <p class="text-purple-600 font-medium">{{ topCard.mirrorTitle }}</p>
          <p class="text-gray-600 text-sm mt-1">{{ topCard.mirrorResults }}</p>
          <a
            href="#"
            class="text-sm text-purple-400 hover:underline mt-1 inline-block"
          >
            Voir les résultats <span class="ml-1">→</span>
          </a>
        </div>
      </div>

      <!-- Recommendation section with light pink/purple circle -->
      <div class="flex">
        <div class="relative">
          <div
            class="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center z-10 relative"
          >
            <div class="w-2 h-2 rounded-full bg-pink-400"></div>
          </div>
        </div>
        <div class="ml-5">
          <p class="text-purple-600 font-medium">
            {{ topCard.recommendationTitle }}
          </p>
          <p class="text-gray-600 text-sm mt-1">
            {{ topCard.recommendationContent }}
          </p>
        </div>
      </div>
    </div>

    <!-- Button -->
    <button
      class="mt-6 w-full py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
    >
      Ajouter une note pré-séance
    </button>
  </div>
</template>
