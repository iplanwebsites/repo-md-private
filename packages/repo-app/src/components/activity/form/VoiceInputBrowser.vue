// VoiceInputBrowser.vue
<script setup>
import { ref, computed, onUnmounted } from "vue";
import { Mic, MicOff, Loader, RefreshCw } from "lucide-vue-next";

// Define component props with validation
const props = defineProps({
	modelValue: {
		type: String,
		default: "",
	},
	disabled: {
		type: Boolean,
		default: false,
	},
});

// Define component events
const emit = defineEmits([
	"update:modelValue",
	"transcribing",
	"newVoiceInput",
]);

// Core state management using refs for reactivity
const isRecording = ref(false);
const isTranscribing = ref(false);
const error = ref("");
const recognition = ref(null);
const recordingTime = ref(0);
const retryCount = ref(0);
const isRetrying = ref(false);
const currentTranscript = ref(""); // Tracks current recognition session

// Timer management
let timerInterval = null;
let retryTimeout = null;

// Configuration constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Format recording time as MM:SS
const formattedTime = computed(() => {
	const mins = Math.floor(recordingTime.value / 60);
	const secs = recordingTime.value % 60;
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
});

// Initialize speech recognition with proper error handling
const initializeSpeechRecognition = () => {
	// Check browser support
	if (
		!("webkitSpeechRecognition" in window) &&
		!("SpeechRecognition" in window)
	) {
		error.value =
			"La reconnaissance vocale n'est pas prise en charge par ce navigateur";
		return null;
	}

	const SpeechRecognition =
		window.SpeechRecognition || window.webkitSpeechRecognition;
	const instance = new SpeechRecognition();

	// Configure recognition settings
	instance.continuous = true;
	instance.interimResults = true;
	instance.lang = "en-US"; // Set language to French Canadian

	// Handle recognition results
	instance.onresult = handleRecognitionResult;

	// Handle recognition errors
	instance.onerror = (event) => {
		console.log("Speech recognition error:", event.error);

		switch (event.error) {
			case "network":
				handleNetworkError();
				break;
			case "not-allowed":
			case "permission-denied":
				error.value =
					"L'accès au microphone a été refusé. Veuillez vérifier vos permissions.";
				stopRecording();
				break;
			case "no-speech":
				// Common and safe to ignore
				break;
			case "audio-capture":
				error.value =
					"Aucun microphone n'a été trouvé. Veuillez vérifier votre matériel.";
				stopRecording();
				break;
			default:
				error.value = `Erreur de microphone: ${event.error}`;
				stopRecording();
		}
	};

	// Handle recognition end with retry logic
	instance.onend = () => {
		if (isRecording.value && !error.value) {
			// Normal restart during continuous recording
			instance.start();
		} else if (isRecording.value && error.value) {
			// Error occurred during recording - handle retry
			handleNetworkError();
		} else {
			// Clean stop
			stopRecording();
		}
	};

	return instance;
};

// Process recognition results
const handleRecognitionResult = (event) => {
	// Reset error states on successful result
	retryCount.value = 0;
	isRetrying.value = false;
	error.value = "";

	let interimTranscript = "";
	let finalTranscript = "";

	// Process all results since last update
	for (let i = event.resultIndex; i < event.results.length; i++) {
		const transcript = event.results[i][0].transcript;
		if (event.results[i].isFinal) {
			finalTranscript += transcript + " ";
			// Emit only the new final transcript
			emit("newVoiceInput", finalTranscript.trim());
			// Update the current transcript for the next recognition
			currentTranscript.value = "";
		} else {
			interimTranscript += transcript;
			currentTranscript.value = interimTranscript;
		}
	}

	// Instead of emitting the model value directly, we'll let the parent component
	// handle the accumulation of text through the newVoiceInput event
};

// Handle network errors with retry logic
const handleNetworkError = () => {
	if (retryCount.value < MAX_RETRIES) {
		retryCount.value++;
		isRetrying.value = true;
		error.value = `Erreur réseau. Nouvelle tentative... (Essai ${retryCount.value}/${MAX_RETRIES})`;

		// Clear existing retry timeout
		if (retryTimeout) {
			clearTimeout(retryTimeout);
		}

		// Attempt retry after delay
		retryTimeout = setTimeout(() => {
			if (isRecording.value) {
				try {
					recognition.value?.start();
				} catch (e) {
					console.error("Retry failed:", e);
				}
			}
		}, RETRY_DELAY);
	} else {
		error.value =
			"Échec de la connexion réseau. Veuillez vérifier votre connexion internet et réessayer.";
		stopRecording();
	}
};

// Start recording with initialization and error handling
const startRecording = async () => {
	try {
		if (!recognition.value) {
			recognition.value = initializeSpeechRecognition();
		}

		if (!recognition.value) {
			error.value = "Impossible d'initialiser la reconnaissance vocale";
			return;
		}

		// Reset all state for new recording
		retryCount.value = 0;
		isRetrying.value = false;
		error.value = "";
		currentTranscript.value = "";

		await recognition.value.start();
		isRecording.value = true;
		isTranscribing.value = true;
		emit("transcribing", true);

		// Start recording timer
		recordingTime.value = 0;
		timerInterval = setInterval(() => {
			recordingTime.value++;
		}, 1000);
	} catch (err) {
		error.value =
			"Impossible d'accéder au microphone. Veuillez vérifier les permissions.";
		stopRecording();
	}
};

// Stop recording and clean up
const stopRecording = () => {
	if (recognition.value) {
		try {
			recognition.value.stop();
		} catch (e) {
			console.error("Error stopping recognition:", e);
		}
	}

	// Reset all state
	isRecording.value = false;
	isTranscribing.value = false;
	isRetrying.value = false;
	emit("transcribing", false);

	// Clear timers
	if (timerInterval) {
		clearInterval(timerInterval);
		timerInterval = null;
	}
	if (retryTimeout) {
		clearTimeout(retryTimeout);
		retryTimeout = null;
	}

	recordingTime.value = 0;
	retryCount.value = 0;
};

// Toggle recording state
const toggleRecording = () => {
	if (props.disabled) return;

	if (isRecording.value) {
		stopRecording();
	} else {
		startRecording();
	}
};

// Manual retry connection
const retryConnection = () => {
	if (!isRecording.value) {
		startRecording();
	} else {
		recognition.value?.stop();
		setTimeout(() => {
			recognition.value?.start();
		}, 100);
	}
};

// Clean up on component unmount
onUnmounted(() => {
	stopRecording();
	if (retryTimeout) {
		clearTimeout(retryTimeout);
	}
	if (recognition.value) {
		recognition.value = null;
	}
});

// Expose component state for slots using computed to ensure reactivity
// Always return a valid object with default values to prevent null destructuring errors
const componentState = computed(() => {
	return {
		isRecording: isRecording.value || false,
		isTranscribing: isTranscribing.value || false,
		isRetrying: isRetrying.value || false,
		error: error.value || "",
		formattedTime: formattedTime.value || "00:00",
		disabled: props.disabled || false,
		retryCount: retryCount.value || 0,
		toggleRecording,
		retryConnection,
	};
});
</script>

<template>
  <div class="voice-input-browser">
    <!-- Voice Input Controls -->
    <div class="flex items-center gap-2">
      <!-- Custom Button with Slot Support -->
      <div
        @click="toggleRecording"
        :class="{ 'cursor-not-allowed': props.disabled }"
      >
        <!-- Default Button (if no slot is provided) -->
        <template v-if="!$slots.default">
          <button
            type="button"
            :disabled="props.disabled"
            :class="[
              'inline-flex items-center px-4 py-2 rounded-md text-white transition-colors',
              isRecording
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700',
              props.disabled ? 'opacity-50' : '',
            ]"
            aria-label="Basculer l'enregistrement"
          >
            <!-- Retrying State -->
            <template v-if="isRetrying">
              <RefreshCw class="w-5 h-5 mr-2 animate-spin" />
              <span>Nouvelle tentative...</span>
            </template>

            <!-- Recording/Transcribing State -->
            <template v-else-if="isTranscribing">
              <Loader class="w-5 h-5 mr-2 animate-spin" />
              <span>Transcription en cours... {{ formattedTime }}</span>
            </template>

            <!-- Default State -->
            <template v-else>
              <component
                :is="isRecording ? MicOff : Mic"
                class="w-5 h-5 mr-2"
              />
              <span
                >{{
                  isRecording ? "Arrêter" : "Commencer"
                }}
                l'enregistrement</span
              >
            </template>
          </button>
        </template>

        <!-- Custom Button Slot with fallback for null/undefined state -->
        <template v-else>
          <slot
            :isRecording="isRecording"
            :isTranscribing="isTranscribing"
            :isRetrying="isRetrying"
            :error="error"
            :formattedTime="formattedTime"
            :disabled="props.disabled"
            :retryCount="retryCount"
            :toggleRecording="toggleRecording"
            :retryConnection="retryConnection"
          ></slot>
        </template>
      </div>

      <!-- Recording State Indicator -->
      <div v-if="isRecording && $slots.recordingState" class="recording-state">
        <slot
          name="recordingState"
          :isRecording="isRecording"
          :isTranscribing="isTranscribing"
          :isRetrying="isRetrying"
          :error="error"
          :formattedTime="formattedTime"
          :disabled="props.disabled"
          :retryCount="retryCount"
        ></slot>
      </div>
      <div v-else-if="isRecording" class="flex items-center gap-2">
        <div class="h-3 w-3 rounded-full bg-red-600 animate-pulse"></div>
        <span class="text-sm text-gray-600">{{ formattedTime }}</span>
      </div>

      <!-- Retrying State Indicator -->
      <div v-if="isRetrying && $slots.retryingState" class="retrying-state">
        <slot
          name="retryingState"
          :isRecording="isRecording"
          :isTranscribing="isTranscribing"
          :isRetrying="isRetrying"
          :error="error"
          :formattedTime="formattedTime"
          :disabled="props.disabled"
          :retryCount="retryCount"
        ></slot>
      </div>
      <div v-else-if="isRetrying" class="flex items-center gap-2">
        <RefreshCw class="w-4 h-4 text-yellow-600 animate-spin" />
        <span class="text-sm text-yellow-600">Nouvelle tentative...</span>
      </div>

      <!-- Manual Retry Button -->
      <div
        v-if="error && !isRetrying && $slots.retryButton"
        class="retry-button"
      >
        <slot
          name="retryButton"
          v-bind="{ retryConnection, ...componentState }"
        ></slot>
      </div>
      <button
        v-else-if="error && !isRetrying"
        @click="retryConnection"
        aria-label="Réessayer la connexion"
        class="inline-flex items-center px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
      >
        <RefreshCw class="w-4 h-4 mr-1" />
        <span>Réessayer</span>
      </button>
    </div>

    <!-- Error Message Display -->
    <div v-if="error" class="text-sm text-red-600 mt-1" role="alert">
      {{ error }}
    </div>
  </div>
</template>
