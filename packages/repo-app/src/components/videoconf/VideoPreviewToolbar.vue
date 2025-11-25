<script setup>
import { computed, onMounted, watch } from "vue";
import { Mic, MicOff, Video, VideoOff, Camera, User } from "lucide-vue-next";
import AgoraRTC from "agora-rtc-sdk-ng";

const { isMicrophoneMuted, isWebcamMuted, className } = defineProps({
	isMicrophoneMuted: {
		type: Boolean,
		default: true,
	},
	isWebcamMuted: {
		type: Boolean,
		default: true,
	},
	isMicrophoneReady: {
		type: Boolean,
		default: false,
	},
	isWebcamReady: {
		type: Boolean,
		default: false,
	},
	className: {
		type: String,
		default: "",
	},
});

// EMITER
const emit = defineEmits(["toggleMicrophone", "toggleWebcam"]);

// EVENT LISTENERS
function toggleMicrophone() {
	emit("toggleMicrophone");
}

function toggleWebcam() {
	emit("toggleWebcam");
}

// REACTIVE COMPONENTS
const microphoneMuted = computed(() => {
	return isMicrophoneMuted ? "" : undefined;
});

const webcamMuted = computed(() => {
	return isWebcamMuted ? "" : undefined;
});
</script>

<template>
  <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
    <button
      v-if="isWebcamReady"
      @click="toggleWebcam"
      :data-webcam-off="webcamMuted"
      class="p-3 rounded-full text-white hover:opacity-90 transition-colors bg-blue-600 data-[webcam-off]:bg-red-600"
    >
      <component :is="isWebcamMuted ? VideoOff : Video" class="w-5 h-5" />
    </button>
    <button
      v-if="isMicrophoneReady"
      @click="toggleMicrophone"
      :data-mic-off="microphoneMuted"
      class="p-3 rounded-full text-white hover:opacity-90 transition-colors bg-blue-600 data-[mic-off]:bg-red-600"
    >
      <component :is="isMicrophoneMuted ? MicOff : Mic" class="w-5 h-5" />
    </button>
  </div>
</template>
