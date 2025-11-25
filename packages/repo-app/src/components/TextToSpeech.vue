<script setup>
import { ref, watch, computed, onUnmounted } from "vue";
import { Loader2, Play } from "lucide-vue-next";
import trpc from "@/trpc";
import { Button } from "@/components/ui/button";

const props = defineProps({
	text: {
		type: String,
		required: true,
		default: "",
	},
	voice: {
		type: String,
		default: "sage",
		validator: (value) =>
			[
				"alloy",
				"ash",
				"coral",
				"echo",
				"fable",
				"onyx",
				"nova",
				"sage",
				"shimmer",
			].includes(value),
	},
	speed: {
		type: Number,
		default: 1.0,
		validator: (value) => value >= 0.25 && value <= 4.0,
	},
	autoplay: {
		type: Boolean,
		default: false,
	},
	maxLength: {
		type: Number,
		default: 4096,
	},
	// Nouvelles propriétés pour les chaînes en français canadien
	buttonLabel: {
		type: String,
		default: "Écouter ce contenu",
	},
	loadingLabel: {
		type: String,
		default: "Chargement...",
	},
	errorLabel: {
		type: String,
		default: "Une erreur est survenue lors de la génération audio",
	},
	// Variante du bouton à transmettre au composant Button
	buttonVariant: {
		type: String,
		default: "default",
	},
});

// Émission d'événements
const emit = defineEmits(["audioEnded", "audioLoaded", "audioError"]);

// État
const isLoading = ref(false);
const audioUrl = ref("");
const audioElement = ref(null);
const error = ref(null);

// Propriétés calculées
const truncatedText = computed(() => {
	return props.text.length > props.maxLength
		? props.text.substring(0, props.maxLength)
		: props.text;
});

const hasAudio = computed(() => audioUrl.value !== "");

// Méthodes
const generateSpeech = async () => {
	if (!truncatedText.value || isLoading.value) return;

	isLoading.value = true;
	error.value = null;

	try {
		const response = await trpc.generateSpeech.query({
			text: truncatedText.value,
			voice: props.voice,
			speed: props.speed,
			format: "mp3",
		});

		if (response.success) {
			// Créer une URL blob pour l'audio
			const base64 = response.audioData;
			const byteCharacters = atob(base64);
			const byteNumbers = new Array(byteCharacters.length);

			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}

			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], { type: response.contentType });

			// Révoquer l'URL précédente pour éviter les fuites de mémoire
			if (audioUrl.value && audioUrl.value.startsWith("blob:")) {
				URL.revokeObjectURL(audioUrl.value);
			}

			audioUrl.value = URL.createObjectURL(blob);

			// L'autoplay sera géré par l'événement oncanplay de l'élément audio
		} else {
			error.value = response.error || props.errorLabel;
			emit("audioError", error.value);
		}
	} catch (err) {
		console.error("Erreur lors de la génération audio:", err);
		error.value = err.message || props.errorLabel;
		emit("audioError", error.value);
	} finally {
		isLoading.value = false;
	}
};

const playAudio = () => {
	if (audioElement.value) {
		// Pour contourner les restrictions d'autoplay des navigateurs
		// Nous devons utiliser une promesse pour tenter la lecture
		const playPromise = audioElement.value.play();

		if (playPromise !== undefined) {
			playPromise
				.then(() => {
					// Lecture démarrée avec succès
					emit("audioLoaded");
				})
				.catch((err) => {
					// Autoplay a été empêché
					console.warn("Autoplay a été empêché par le navigateur:", err);
					// Nous ne définissons pas d'erreur ici car c'est juste une restriction du navigateur
				});
		}
	}
};

// Gestionnaire d'événement pour quand l'audio est prêt à être lu
const handleCanPlay = () => {
	if (props.autoplay) {
		playAudio();
	}
};

// Nettoyage lorsque le composant est démonté
const cleanup = () => {
	if (audioUrl.value && audioUrl.value.startsWith("blob:")) {
		URL.revokeObjectURL(audioUrl.value);
	}
};

// Observer les changements de texte pour réinitialiser l'audio
watch(
	() => props.text,
	() => {
		// Réinitialiser l'audio quand le texte change
		if (audioUrl.value) {
			cleanup();
			audioUrl.value = "";
		}
	},
);

// Nettoyage lors du démontage du composant
onUnmounted(cleanup);
</script>

<template>
  <div class="text-to-speech-container">
    <!-- Bouton avec état de génération et de chargement intégrés -->
    <Button
      v-if="!hasAudio"
      @click="generateSpeech"
      :disabled="!text || isLoading"
      :variant="buttonVariant"
    >
      <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
      <Play v-else class="w-4 h-4 mr-2" />
      <span>{{ isLoading ? loadingLabel : buttonLabel }}</span>
    </Button>

    <!-- Lecteur audio (affiché après la génération de l'audio) -->
    <div v-if="hasAudio" class="audio-player">
      <audio
        ref="audioElement"
        :src="audioUrl"
        controls
        class="audio-element"
        @ended="$emit('audioEnded')"
        @canplay="handleCanPlay"
        @error="$emit('audioError', $event)"
        autoplay
      ></audio>
    </div>

    <!-- Message d'erreur -->
    <div v-if="error" class="text-red-500 mt-2 text-sm">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.text-to-speech-container {
  margin: 1rem 0;
}

.audio-element {
  width: 100%;
  max-width: 400px;
  height: 36px;
}
</style>
