# ProUpgradeBox.vue
<script setup>
import { Sparkles, Sparkle, ArrowRight, Star } from "lucide-vue-next";
</script>

<template>
  <router-link to="/upgrade">
    <div
      class="mx-2 mb-4 overflow-hidden rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 p-4 text-white shadow-lg"
    >
      <div class="mb-2 flex items-center">
        <Sparkles class="mr-2 h-4 w-4" />
        <span class="font-bold text-sm">Passez au plan PRO</span>
      </div>

      <p class="mb-3 text-sm text-white/90">
        Débloquez toutes les fonctionnalités premium pour développer votre
        pratique de coaching
      </p>
      <p class="mb-3 text-sm text-white/90">En savoir plus</p>

      <!-- 
    <div class="space-y-2 mb-4">
      <div class="flex items-center text-xs">
        <div class="mr-2 h-1 w-1 rounded-full bg-white/90"></div>
        <span>Activités et exercices illimités</span>
      </div>
      <div class="flex items-center text-xs">
        <div class="mr-2 h-1 w-1 rounded-full bg-white/90"></div>
        <span>Outils spécialisés avancés</span>
      </div>
      <div class="flex items-center text-xs">
        <div class="mr-2 h-1 w-1 rounded-full bg-white/90"></div>
        <span>Support prioritaire</span>
      </div>
    </div>
         <button
        class="flex w-full items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-white/90 transition-colors"
      >
        Découvrir les avantages
        <ArrowRight class="ml-2 h-4 w-4" />
      </button>
     -->
    </div>
  </router-link>
</template>
