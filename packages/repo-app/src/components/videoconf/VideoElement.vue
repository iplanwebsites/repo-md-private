<script setup>
import { computed, onMounted, watch } from "vue";
import AgoraRTC from "agora-rtc-sdk-ng";
import VideoOverlay from "./VideoOverlay.vue";
import { User } from "lucide-vue-next";

const {
	name,
	videoTrack,
	audioTrack,
	uid,
	isLocal,
	overlayType,
	isPinned,
	participantsCount,
	videoSize,
	className,
} = defineProps({
	name: {
		type: String,
		default: "Invité",
	},
	videoTrack: {
		type: AgoraRTC.ICameraVideoTrack,
		default: null,
	},
	audioTrack: {
		type: AgoraRTC.IMicrophoneAudioTrack,
		default: null,
	},
	uid: {
		type: String,
		default: "",
	},
	isPinned: {
		type: Boolean,
		default: false,
	},
	isLocal: {
		type: Boolean,
		default: false,
	},
	participantsCount: {
		type: Number,
		default: 1,
	},
	overlayType: {
		type: String,
		default: "none",
		validator: (value) => ["none", "small", "normal"].includes(value),
	},
	videoSize: {
		type: Object,
		default: {},
	},
	className: {
		type: String,
		default: "",
	},
});

// REFS
const videoRef = ref(null);
const isInitialized = ref(false);

// EMITER
const emit = defineEmits(["pinned"]);

function handlePinned() {
	if (!uid) return;
	emit("pinned", uid);
}

function isLive(track) {
	if (!track) return false;
	return track.getMediaStreamTrack().readyState === "live";
}

async function mountVideo(track) {
	if (!videoRef.value || !track) return;

	try {
		if (!track.isPlaying && isLive(track)) {
			await track.play(videoRef.value);
			console.log("new video track was mounted", track);
		} else {
			// Retry in the case of a random glitch
			console.log("could not mount video", track);
		}
	} catch (_) {}
}

async function mountAudio(track) {
	if (!track) return;

	try {
		if (!isLocal && !track.isPlaying && isLive(track)) {
			await track.play();
			console.log("new audio track was mounted", track);
		} else {
			// Retry in the case of a random glitch
			console.log(
				`could not mount audio, retrying again ${retry} times`,
				track,
			);
		}
	} catch (_) {}
}

function unmountTrack(track) {
	if (!track) return;
	if (track.isPlaying) {
		track.stop();
		console.log("track was unmounted", track);
	}
}

// REACTIVE COMPONENTS
const isVideoMuted = computed(() => {
	if (videoTrack?.muted !== undefined) {
		return videoTrack.muted;
	}

	return videoTrack === null;
});

const isAudioMuted = computed(() => {
	if (audioTrack?.muted !== undefined) {
		return audioTrack.muted;
	}

	return audioTrack === null;
});

const pinEnabled = computed(() => {
	return participantsCount > 1;
});

const showOverlay = computed(() => {
	return overlayType !== "none";
});

const style = computed(() => {
	const style = {};

	Object.entries(videoSize).forEach(([key, value]) => {
		if (typeof value === "number") style[key] = value + "px";
	});

	return style;
});

const pinned = computed(() => {
	return isPinned ? "" : undefined;
});

onMounted(async () => {
	await mountVideo(videoTrack);
	await mountAudio(audioTrack);
});

onBeforeUnmount(() => {
	unmountTrack(audioTrack);
	unmountTrack(videoTrack);
});

watch(
	() => videoTrack,
	async (newTrack, oldTrack) => {
		console.log("video track is beeing replaced", oldTrack, newTrack);
		unmountTrack(oldTrack);
		await mountVideo(newTrack);
	},
);

watch(
	() => audioTrack,
	async (newTrack, oldTrack) => {
		console.log("audio track is beeing replaced", oldTrack, newTrack);
		unmountTrack(oldTrack);
		await mountAudio(newTrack);
	},
);
</script>

<template>
  <div
    :style="style"
    :data-pinned="pinned"
    class="relative w-full h-full z-10 data-[pinned]:z-0 data-[pinned]:absolute"
    :class="className"
  >
    <video
      class="bg-gray-900 h-full w-full aspect-[16/10]"
      ref="videoRef"
      autoplay
      playsinline
      muted
    ></video>

    <div
      v-if="isVideoMuted"
      class="absolute w-full h-full inset-0 bg-gray-900 flex items-center justify-center aspect-[16/10]"
    >
      <User class="size-1/4 text-gray-500" />
    </div>

    <VideoOverlay
      v-if="showOverlay"
      :name="name"
      :isMuted="isAudioMuted"
      :isPinned="isPinned"
      :pinEnabled="pinEnabled"
      :type="overlayType"
      @pinned="handlePinned"
    />

    <slot></slot>
  </div>
</template>
