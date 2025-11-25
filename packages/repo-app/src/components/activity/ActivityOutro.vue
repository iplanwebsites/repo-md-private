<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { CheckCircle, Home, ArrowRight } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Props to customize the outro experience
const props = defineProps({
	// Content configuration
	activityConfig: {
		type: Object,
		default: () => ({}),
	},
	// For the next activity button
	buttonLabel: {
		type: String,
		default: "Activité suivante",
	},

	buttonUrl: {
		type: String,
		default: "",
	},

	scores: {
		type: Object,
		default: null,
	},
	// Debug mode (shows raw data)
	debug: {
		type: Boolean,
		default: false,
	},
	nextActivityInviteUrl: {
		type: String,
		default: "",
	},
});

const emit = defineEmits(["startOver"]);

const router = useRouter();

// Allow parent to handle restart

const hasNextActivity = computed(() => !!props.buttonUrl);

const navigateToNext = () => {
	if (props.buttonUrl) {
		router.push(props.buttonUrl);
	}
};

const nextActivityToSuggest = computed(() => {
	return props.activityConfig.nextActivityToSuggest;
});

const outroText = computed(() => {
	return props.activityConfig.outroText;
});

const navigateToHome = () => {
	router.push("/");
};
</script>

<template>
  <div
    class="bg-white shadow rounded-lg p-8 text-center space-y-6 animate-fadeIn"
  >
    <!--
   Debug information (only visible when debug is true) 
    <div v-if="debug" class="text-left bg-gray-100 p-4 rounded-md mb-4 text-xs">
      <pre>{{
        JSON.stringify({ buttonLabel, buttonUrl, scores }, null, 2)
      }}</pre>
    </div>
    -->

    <!-- Success icon -->
    <div class="flex justify-center">
      <CheckCircle class="w-16 h-16 text-green-500 animate-bounce-gentle" />
    </div>

    <!-- Completion message -->
    <div class="space-y-4">
      <h2 class="text-2xl font-bold text-gray-900">Voilà!</h2>
      <p class="text-gray-600">{{ outroText }}</p>
    </div>

    <!-- Scores section (if provided) -->
    <div v-if="scores" class="mt-6 p-4 bg-blue-50 rounded-lg">
      <h3 class="text-lg font-medium mb-3">Vos résultats</h3>
      <div class="space-y-2">
        <div
          v-for="(score, dimension) in scores"
          :key="dimension"
          class="flex justify-between"
        >
          <span class="font-medium">{{ dimension }}</span>
          <span>{{ score }}</span>
        </div>
      </div>
    </div>

    <!-- Navigation buttons -->
    <div
      class="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8"
    >
      <!-- Start over button -->

      <router-link v-if="nextActivityInviteUrl" :to="nextActivityInviteUrl">
        <Button variant="outline" class="w-full sm:w-auto">
          Poursuivre avec la prochaine activité
          <!-- 
          
          {{ nextActivityToSuggest }}
            -->
        </Button>
      </router-link>

      <!-- Start over button -->
      <Button
        variant="outline"
        @click="$emit('startOver')"
        class="w-full sm:w-auto"
      >
        Recommencer
      </Button>

      <!-- Home button -->
      <Button
        variant="outline"
        @click="navigateToHome"
        class="w-full sm:w-auto"
      >
        <Home class="w-4 h-4 mr-2" />
        Accueil
      </Button>

      <!-- Next activity button (if URL provided) -->
      <Button
        v-if="hasNextActivity"
        @click="navigateToNext"
        variant="default"
        class="w-full sm:w-auto"
      >
        {{ buttonLabel }}
        <ArrowRight class="w-4 h-4 ml-2" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
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
