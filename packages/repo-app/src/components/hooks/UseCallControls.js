import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import fscreen from "fscreen";

export default function useCallControls(
	audioTrack = ref(null),
	videoTrack = ref(null),
	fullscreenComponentRef = ref(null),
) {
	const isInitialized = ref(false);
	const isMicrophoneMuted = ref(true);
	const isWebcamMuted = ref(true);
	const isFullscreen = ref(false);

	// Enable mic and webcam on first connect
	function initialize() {
		if (isInitialized.value) return;

		if (isMicrophoneMuted.value) {
			toggleMicrophone();
			console.log("user audio track was initialized", audioTrack);
		}

		if (isWebcamMuted.value) {
			toggleWebcam();
			console.log("user video track was initialized", videoTrack);
		}
		isInitialized.value = true;
	}

	// EVENT MANAGEMENT
	function toggleMicrophone() {
		if (audioTrack.value) {
			isMicrophoneMuted.value = !audioTrack.value.muted;
			audioTrack.value.setMuted(isMicrophoneMuted.value);
			console.log("microphone muted set to ", !audioTrack.value.muted);
		}
	}

	function toggleWebcam() {
		if (videoTrack.value) {
			isWebcamMuted.value = !videoTrack.value.muted;
			videoTrack.value.setMuted(isWebcamMuted.value);
			console.log("video muted set to ", !videoTrack.value.muted);
		}
	}

	function toggleFullscreen() {
		if (!fscreen.fullscreenEnabled || !fullscreenComponentRef.value) return;

		if (fscreen.fullscreenElement) {
			fscreen.exitFullscreen();
			console.log("exiting fullscreen");
		} else {
			const fullscreenRef = fullscreenComponentRef.value.container;
			if (!fullscreenRef) return;

			fscreen.requestFullscreen(fullscreenRef);
			console.log("entering fullscreen");
		}
	}

	function handleFullscreenChange() {
		console.log("fullscreen event triggered");
		return (isFullscreen.value = fscreen.fullscreenElement !== null);
	}

	// REACTIVE COMPONENTS
	const isWebcamReady = computed(() => {
		return videoTrack.value?.enabled;
	});

	const isMicrophoneReady = computed(() => {
		return audioTrack.value?.enabled;
	});

	onMounted(() => {
		fscreen.addEventListener("fullscreenchange", handleFullscreenChange);
	});

	onUnmounted(() => {
		fscreen.removeEventListener("fullscreenchange", handleFullscreenChange);
	});

	watch(
		() => videoTrack.value,
		() => (isWebcamMuted.value = videoTrack.value?.muted ?? true),
	);

	watch(
		() => audioTrack.value,
		() => (isMicrophoneMuted.value = audioTrack.value?.muted ?? true),
	);

	return {
		isMicrophoneMuted,
		isWebcamMuted,
		isFullscreen,
		toggleMicrophone,
		toggleWebcam,
		toggleFullscreen,
		isMicrophoneReady,
		isWebcamReady,
	};
}
