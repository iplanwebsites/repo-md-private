<!-- ComingSoon.vue -->
<script setup>
import { Wrench } from "lucide-vue-next";
import { useRoute } from "vue-router";

// Get route instance for debugging
const route = useRoute();

// Using defineProps without type definitions allows acceptance of any props
const props = defineProps();
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-4"
  >
    <!-- Main Content Container -->
    <div class="max-w-4xl w-full text-center space-y-8">
      <!-- Icon Container - Now with Wrench icon -->
      <div
        class="mx-auto w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg flex items-center justify-center"
      >
        <Wrench class="w-8 h-8 text-white transform -rotate-45" />
      </div>

      <!-- Main Text -->
      <div class="space-y-4">
        <div class="text-6xl mb-4">🏗️</div>
        <h1
          class="text-5xl md:text-6xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"
        >
          {{ props.title || "Bientôt Disponible" }}
        </h1>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">
          {{
            props.message ||
            "Nous travaillons dur pour vous apporter quelque chose d'extraordinaire."
          }}
        </p>
      </div>

      <!-- Debug Information -->
      <JsonDebug :data="route.params" label="Route params" :expanded="1" />
      <JsonDebug :data="props" label="Component props" :expanded="1" />

      <!-- Social Links -->
      <div class="flex justify-center gap-6 pt-8">
        <a
          v-for="i in 4"
          :key="i"
          class="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:shadow-lg transition cursor-pointer"
        >
          <div
            class="w-5 h-5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded"
          ></div>
        </a>
      </div>
    </div>
  </div>
</template>
