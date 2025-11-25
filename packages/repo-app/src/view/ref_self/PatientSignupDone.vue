# Merci.vue
<script setup>
import { onMounted } from "vue";
import { CheckCircle } from "lucide-vue-next";

import { useRouter } from "vue-router";
const router = useRouter();

// Optional: Add any required logic here
const redirectToHome = () => {
	router.push("/");
};
</script>

<template>
  <div
    class="min-h-screen w-full bg-gray-50 flex items-center justify-center p-4"
  >
    <div
      class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-6 animate-fadeIn"
    >
      <!-- Animated checkmark -->
      <div class="flex justify-center">
        <CheckCircle class="w-20 h-20 text-green-500 animate-bounce-gentle" />
      </div>

      <!-- Thank you message -->
      <h1 class="text-3xl font-bold text-gray-900">Merci !</h1>
      <p class="text-lg text-gray-600">
        Votre inscription a été enregistrée avec succès. Nous vous contacterons
        prochainement.
      </p>

      <!-- Additional information -->
      <div class="bg-green-50 rounded-md p-4 mt-6">
        <p class="text-green-800">
          Un email de confirmation a été envoyé à votre adresse.
        </p>
      </div>

      <!-- Return button -->
      <div class="mt-8">
        <button
          @click="redirectToHome"
          class="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  </div>
</template>

<style>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounceGentle {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.6s ease-out forwards;
}

.animate-bounce-gentle {
  animation: bounceGentle 2s ease-in-out infinite;
}
</style>
