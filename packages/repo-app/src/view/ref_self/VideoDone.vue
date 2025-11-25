<script setup>
import { ref, onMounted, computed, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { CheckCircle, Video, FileText, ArrowRight } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();

// Props definition with validation
const props = defineProps({
	session: {
		type: Object,
		default: () => null,
	},
});

// State Management
const meeting = ref(null);
const loading = ref(false);
const transcriptionReady = ref(false);
const countdown = ref(120); // 2 minute countdown for transcript processing
let countdownInterval = null;

// Get the meeting ID from URL params
const meetingId = computed(() => route.query.meetingId);

// Get the room ID from URL params
const roomId = computed(() => route.query.roomId);

// Get patient ID from route params or query
const patientId = computed(
	() => route.params.patientId || route.query.patientId,
);

// Check if user is logged in
const isLoggedIn = computed(() => !!props.session);

// Use a simple placeholder for meeting details if none are available
const meetingDetails = computed(() => {
	if (meeting.value) return meeting.value;

	return {
		id: meetingId.value,
		title: "Votre Réunion",
		patientId: patientId.value,
		patientName: "Patient",
		startTime: new Date().toISOString(),
		duration: "N/A",
	};
});

// Start countdown for transcript processing
const startTranscriptCountdown = () => {
	countdownInterval = setInterval(() => {
		if (countdown.value > 0) {
			countdown.value -= 1;
		} else {
			clearInterval(countdownInterval);
			transcriptionReady.value = true;
		}
	}, 1000);
};

// Format time remaining as MM:SS
const formattedTimeRemaining = computed(() => {
	const minutes = Math.floor(countdown.value / 60);
	const seconds = countdown.value % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

// Navigation handlers
const handleRejoin = () => {
	if (roomId.value) {
		// Navigate to meeting room with the roomId
		router.push(`/meet/${roomId.value}`);
	}
};

const handleViewNotes = () => {
	if (meetingId.value && isLoggedIn.value) {
		router.push(`/meets/${meetingId.value}/notes`);
	} else if (!isLoggedIn.value) {
		// Redirect to login if not logged in
		router.push(`/login?redirect=/meets/${meetingId.value}/notes`);
	}
};

// Clean up interval on component unmount
onUnmounted(() => {
	if (countdownInterval) {
		clearInterval(countdownInterval);
	}
});

// Initialize component
onMounted(() => {
	if (meetingId.value) {
		startTranscriptCountdown();
	}
});
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-8 px-4">
    <div class="max-w-2xl mx-auto">
      <!-- Simple completion message when no meeting ID -->
      <div v-if="!meetingId" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="text-green-500 mb-4">
          <CheckCircle class="h-16 w-16 mx-auto" />
        </div>
        <h2 class="text-xl font-semibold text-gray-800 mb-4">
          Rencontre complétée
        </h2>
        <p class="text-gray-600 mb-2">Merci!</p>
        <p class="text-gray-600 mb-4">Bonne journée!</p>
        <router-link
          to="/"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
        >
          Retour à l'accueil
        </router-link>
      </div>

      <!-- Success state - meeting ended -->
      <div v-else class="bg-white rounded-lg shadow overflow-hidden">
        <!-- Success header -->
        <div class="bg-green-50 p-6 border-b border-green-100">
          <div class="flex items-center justify-center mb-4">
            <CheckCircle class="w-16 h-16 text-green-600" />
          </div>
          <h2 class="text-2xl font-semibold text-center text-gray-800 mb-2">
            Appel terminé avec succès
          </h2>
          <p class="text-center text-gray-600">
            Merci d'avoir participé à la réunion.
          </p>
        </div>

        <div class="p-6">
          <!-- Meeting details 
          <div class="mb-6">
            <h3 class="font-semibold text-gray-700 mb-2">
              Détails de la réunion
            </h3>
            <div class="bg-gray-50 p-4 rounded-lg">
              <p class="text-sm text-gray-700 mb-1">
                <span class="font-medium">ID de réunion:</span> {{ meetingId }}
              </p>
              <p class="text-sm text-gray-700 mb-1" v-if="roomId">
                <span class="font-medium">ID de salle:</span> {{ roomId }}
              </p>
            </div>
          </div>-->

          <!-- Action buttons -->
          <div class="space-y-4">
            <!-- Rejoin button -->
            <router-link
              :to="`/meet/${roomId}`"
              class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Video class="w-5 h-5" />
              <span>Rejoindre la réunion</span>
            </router-link>

            <!-- Meeting notes section (only for logged in users) -->
            <div
              v-if="isLoggedIn"
              class="border border-gray-200 rounded-lg p-4"
            >
              <h3 class="font-semibold text-gray-700 mb-3">
                Notes et résumé de la réunion
              </h3>

              <!-- Transcript processing status -->
              <div
                v-if="!transcriptionReady"
                class="bg-blue-50 p-3 rounded-lg mb-4"
              >
                <div class="flex items-center text-blue-700 mb-2">
                  <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-700"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Traitement de la transcription et analyse en cours
                </div>
                <p class="text-sm text-blue-600">
                  Temps restant estimé: {{ formattedTimeRemaining }}
                </p>
              </div>

              <!-- View notes button -->
              <router-link
                v-if="transcriptionReady"
                :to="`/meets/${meetingId}/notes`"
                class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText class="w-5 h-5" />
                <span>Voir les notes et le résumé</span>
              </router-link>
              <div
                v-else
                class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg opacity-60 cursor-not-allowed"
              >
                <FileText class="w-5 h-5" />
                <span>Traitement des notes en cours...</span>
              </div>
            </div>

            <!-- View upcoming meetings button for logged in users -->
            <router-link
              v-if="isLoggedIn"
              to="/meet"
              class="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span class="font-medium">Voir les prochaines réunions</span>
              <ArrowRight class="w-5 h-5" />
            </router-link>

            <!-- Login button for users who aren't logged in -->
          </div>
        </div>
      </div>
    </div>

    <PoweredBy v-if="!isLoggedIn" />
  </div>
</template>
