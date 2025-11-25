# MeetingPreview.vue - Simplified Version
<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { Video, VideoOff, Mic, MicOff, Camera, Clock } from "lucide-vue-next";

//import { audioRecorderService } from "@/services/AudioRecorderService";
import { mediaStreamManager } from "@/lib/mediaStreamManager";

import {
	formatMeetingDateTime,
	sortMeetingsByProximity,
} from "@/lib/utils/meetingUtils";
import { onBeforeRouteLeave } from "vue-router";

const props = defineProps({
	modelValue: {
		type: Object,
		default: () => ({
			isVideoEnabled: true,
			isAudioEnabled: true,
		}),
	},
	meetingTime: {
		type: [String, Date, null],
		default: null,
	},
});

const emit = defineEmits(["update:modelValue", "join"]);

const videoRef = ref(null);
const hasWebcam = ref(false);
const loading = ref(false);
const mediaStream = ref(null);

const isVideoEnabled = ref(props.modelValue.isVideoEnabled);
const isAudioEnabled = ref(props.modelValue.isAudioEnabled);

watch([isVideoEnabled, isAudioEnabled], ([video, audio]) => {
	emit("update:modelValue", {
		isVideoEnabled: video,
		isAudioEnabled: audio,
	});
});

const attachStreamToVideo = async () => {
	if (!videoRef.value || !mediaStream.value) {
		console.log("Waiting for video element and stream to be ready...");
		return;
	}

	try {
		console.log("Attaching stream to video element...");
		videoRef.value.srcObject = mediaStream.value;
		videoRef.value.onloadedmetadata = () =>
			console.log("Video metadata loaded");
		videoRef.value.onplay = () => console.log("Video playback started");
		videoRef.value.onerror = (e) => console.error("Video error:", e);

		await videoRef.value.play();
		console.log("Video playback started successfully");
	} catch (err) {
		console.error("Error attaching stream to video:", err);
	}
};

const initializeMediaStream = async () => {
	try {
		loading.value = true;
		console.log("Requesting media stream...");

		const stream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true,
		});

		const videoTracks = stream.getVideoTracks();
		if (videoTracks.length === 0) {
			throw new Error("No video tracks found in media stream");
		}

		mediaStream.value = stream;

		// Add to our singleton managers
		mediaStreamManager.addStream(stream);
		//  audioRecorderService.addAudioStream(stream);
		//alert(222);
		hasWebcam.value = true;
		await attachStreamToVideo();
	} catch (err) {
		console.error("Error accessing webcam:", err);
		hasWebcam.value = false;
		alert(
			"Impossible d'accéder à votre caméra. Veuillez vérifier les permissions.",
		);
	} finally {
		loading.value = false;
	}
};

watch(
	[videoRef, mediaStream],
	([newVideoRef, newMediaStream]) => {
		if (newVideoRef && newMediaStream) {
			console.log("Video element or stream updated, attempting to attach...");
			attachStreamToVideo();
		}
	},
	{ immediate: true },
);

const toggleVideo = () => {
	if (mediaStream.value) {
		const videoTracks = mediaStream.value.getVideoTracks();
		videoTracks.forEach((track) => {
			track.enabled = !isVideoEnabled.value;
		});
		isVideoEnabled.value = !isVideoEnabled.value;
	}
};

const toggleAudio = () => {
	if (mediaStream.value) {
		const audioTracks = mediaStream.value.getAudioTracks();
		audioTracks.forEach((track) => {
			track.enabled = !isAudioEnabled.value;
		});
		isAudioEnabled.value = !isAudioEnabled.value;
	}
};

const cleanupMediaStream = () => {
	if (mediaStream.value) {
		console.log("Cleaning up media stream for microphone preview");

		// Manual cleanup of this specific stream
		mediaStreamManager.removeStream(mediaStream.value);

		mediaStream.value = null;
	}
};

onMounted(async () => {
	console.log("MeetingPreview component mounted");
	await initializeMediaStream();

	// Initialize the audio recorder service if needed
	/*
  if (!audioRecorderService.isRecordingReady()) {
    await audioRecorderService.initializeMediaRecorder();
  }*/
});

// Countdown timer for meeting
const countdownText = computed(() => {
	if (!props.meetingTime) return null;

	const meetingDate = new Date(props.meetingTime);
	const now = new Date();

	// If meeting is in the past
	if (meetingDate < now) {
		return "La réunion a déjà commencé";
	}

	// Calculate time difference
	const diff = meetingDate - now;
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

	// Format countdown text
	if (days > 0) {
		return `Démarre dans ${days} jour${days > 1 ? "s" : ""} et ${hours}h`;
	} else if (hours > 0) {
		return `Démarre dans ${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`;
	} else if (minutes > 0) {
		return `Démarre dans ${minutes} minute${minutes > 1 ? "s" : ""}`;
	} else {
		return "Démarre maintenant";
	}
});

const formattedMeetingTime = computed(() => {
	if (!props.meetingTime) return null;

	return formatMeetingDateTime(props.meetingTime);
});

const handleClick = () => {
	cleanupMediaStream();
	emit("join");
};

// Update countdown every minute
const countdownInterval = setInterval(() => {
	// Force computed property to reevaluate
	// We just need to access it to trigger the reevaluation
	if (countdownText.value) console.log("Countdown updated");
}, 15 * 1000);

onUnmounted(() => {
	console.log("MeetingPreview component unmounting");
	cleanupMediaStream();
	clearInterval(countdownInterval);
});
</script>

<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex flex-col md:flex-row gap-8 items-center">
      <div class="relative w-full md:w-2/3">
        <div
          v-if="loading"
          class="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 rounded-lg"
        >
          <div class="text-white">Chargement de la caméra...</div>
        </div>
        <video
          v-if="hasWebcam"
          ref="videoRef"
          autoplay
          playsinline
          muted
          class="w-full h-[400px] rounded-lg bg-gray-900 object-cover"
        ></video>
        <div
          v-else
          class="w-full h-[400px] bg-gray-900 rounded-lg flex items-center justify-center"
        >
          <Camera class="w-16 h-16 text-gray-500" />
        </div>

        <!-- Media controls -->
        <div
          class="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4"
        >
          <button
            @click="toggleVideo"
            :class="[
              'p-3 rounded-full text-white hover:opacity-90 transition-colors',
              isVideoEnabled ? 'bg-blue-600' : 'bg-red-600',
            ]"
          >
            <component
              :is="isVideoEnabled ? Video : VideoOff"
              class="w-5 h-5"
            />
          </button>
          <button
            @click="toggleAudio"
            :class="[
              'p-3 rounded-full text-white hover:opacity-90 transition-colors',
              isAudioEnabled ? 'bg-blue-600' : 'bg-red-600',
            ]"
          >
            <component :is="isAudioEnabled ? Mic : MicOff" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Join meeting section -->
      <div class="w-full md:w-1/3 flex flex-col items-center gap-4">
        <!-- Meeting time countdown if available -->
        <div v-if="props.meetingTime" class="w-full mb-2">
          <div class="flex items-center gap-2 text-blue-600 font-medium">
            <Clock class="w-5 h-5" />
            <span>{{ countdownText }}</span>
          </div>
          <div class="text-sm text-gray-500 mt-1">
            {{ formattedMeetingTime }}
          </div>
        </div>

        <button
          @click="handleClick"
          class="w-full py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
        >
          Démarrer la réunion
        </button>
        <p class="text-gray-600 text-sm text-center">
          Votre vidéo et audio seront activés lorsque vous rejoindrez la réunion
        </p>
      </div>
    </div>
  </div>
</template>
