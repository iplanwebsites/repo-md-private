<!-- AgoraMeeting.vue -->

<script setup>
// Import necessary Vue and Agora SDK functions
import { appConfigs } from "@/appConfigs.js";

import { ref, onMounted, onBeforeUnmount } from "vue";
import AgoraRTC from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import AgoraTokenService from "@/lib/agoraTokenService";
import trpc from "@/trpc";
import MeetingToolbar from "./MeetingToolbar.vue";
import CallRecorder from "./CallRecorder.vue";
import { AudioStorageService } from "@/lib/audioStorageService";
import { AudioRecorderService } from "@/lib/_audioRecorderService";
import { isLocalhost } from "@/lib/utils/devUtils";
import { useSettingsStore } from "@/store/settingsStore";

// Define component props with validation and defaults
const props = defineProps({
	appId: {
		type: String,
		default: appConfigs.AGORA_APP_ID,
		required: false,
	},
	appKey: {
		type: String,
		default: appConfigs.AGORA_APP_KEY,
		required: false,
	},
	channel: {
		type: String,
		required: true,
	},
	uid: {
		type: [String, Number],
		required: false,
		default: null,
	},
	user: {
		type: Object,
		required: false,
	},
	isHost: {
		type: Boolean,
		required: false,
		default: false,
	},
	enableCamera: {
		type: Boolean,
		required: false,
		default: true,
	},
	enableMicrophone: {
		type: Boolean,
		required: false,
		default: true,
	},
});

// Initialize client with token server URL
const SERVER_URL = "https://api.repo.md"; // TODO: replcate base URL with server URL, local for development, like trpc, but streamline.
const tokenService = new AgoraTokenService(`${SERVER_URL}/agora/token`);

const { createCameraVideoTrack, createMicrophoneAudioTrack, createClient } =
	AgoraRTC;

// Define emitted events
const emit = defineEmits(["left"]);

// Set debug env
const debug = isLocalhost(); //&& false;

AgoraRTC.setLogLevel(debug ? 2 : 3);

// Reactive state management using refs
const participants = ref([]);
const isCameraOn = ref(false);
const isMicrophoneOn = ref(false);
const isVideoSubed = ref(false);
const isAudioSubed = ref(false);
const isRecordingReady = ref(false);

// Initialize Agora RTC client with WebRTC maode and VP8 codec
const client = createClient({
	mode: "rtc",
	codec: "vp8",
});
const rtmClient = new AgoraRTM.RTM(props.appId, props.user?.id ?? "guest");

// Track variables for managing media streams
const audioStorageService = new AudioStorageService(props.channel);
const audioRecorderService = new AudioRecorderService(
	audioStorageService,
	debug,
);
const userAudioMap = {};
let videoTrack = null;
let audioTrack = null;

const settingsStore = useSettingsStore();
const enableLocalAudioRecording = props.isHost; // AAAND enable in prefs (todo, later)

// Initialize camera stream with error handling
async function initializeCamera() {
	try {
		if (props.enableCamera && !videoTrack) {
			videoTrack = await createCameraVideoTrack();
			await client.publish(videoTrack);
			videoTrack.play("local-video");
			videoTrack.setMuted(false);
			isCameraOn.value = true;
		}
	} catch (error) {
		console.error("Failed to initialize camera:", error);
	}
}

// Initialize microphone stream with error handling
async function initializeMicrophone() {
	try {
		if (props.enableMicrophone && !audioTrack) {
			audioTrack = await createMicrophoneAudioTrack();
			await client.publish(audioTrack);
			await audioTrack.setMuted(false);
			isMicrophoneOn.value = true;

			// Add track to recorder
			if (enableLocalAudioRecording) {
				audioRecorderService.addAudioStream(audioTrack.getMediaStreamTrack());
				isRecordingReady.value = true;
			}
		}
	} catch (error) {
		console.error("Failed to initialize microphone:", error);
	}
}

// Initialize both media devices in parallel
async function initializeMediaDevices() {
	try {
		await Promise.all([initializeCamera(), initializeMicrophone()]);
	} catch (error) {
		console.error("Failed to initialize media devices:", error);
	}
}

async function initializeRecordingServices() {
	if (!enableLocalAudioRecording) {
		return;
	}

	// Initialize audio recorder and audio storage for host
	await audioRecorderService.initializeMediaRecorder();

	// Init DB for recording
	try {
		await audioStorageService.initDB();
	} catch (error) {
		console.error("Could not initialize DB for audio recording", error);
	}
}

// Comprehensive cleanup function for resource disposal
async function cleanup() {
	try {
		// Remove all event listeners to prevent memory leaks
		client.removeAllListeners("user-published");
		client.removeAllListeners("user-unpublished");
		rtmClient.removeEventListener("presence", onPresence);

		// Clean up video track
		if (videoTrack) {
			videoTrack.stop();
			videoTrack.close();
			videoTrack = null;
		}

		// Clean up audio track
		if (audioTrack) {
			audioTrack.stop();
			audioTrack.close();
			audioTrack = null;
		}

		// Leave the channel if connected
		if (client.connectionState === "CONNECTED") {
			await client.leave();
			await rtmClient.unsubscribe(props.channel);
			await rtmClient.logout();
		}

		// Reset all state variables
		isCameraOn.value = false;
		isMicrophoneOn.value = false;
		isVideoSubed.value = false;
		isAudioSubed.value = false;
	} catch (error) {
		console.error("Failed to cleanup resources:", error);
	}
}

async function onPresence(e) {
	try {
		// Retrieve list of connected users (AKA occupants)
		const { occupants } = await rtmClient.presence.getOnlineUsers(
			props.channel,
			"MESSAGE",
		);

		// Retrieve connected users details in their states
		const states = await Promise.all(
			occupants.map(async (user) => {
				return await rtmClient.presence.getState(
					user.userId,
					props.channel,
					"MESSAGE",
				);
			}),
		);

		participants.value = states.map((state) => state.states.state);
	} catch (error) {
		console.error("Failed to update online users:", error);
	}
}

// Handle remote user publishing media
async function onPublished(user, mediaType) {
	await client.subscribe(user, mediaType);

	if (mediaType === "video") {
		const remoteVideoTrack = user.videoTrack;
		if (remoteVideoTrack) {
			remoteVideoTrack.play("remote-video");
			isVideoSubed.value = true;
		}
	}

	if (mediaType === "audio") {
		const remoteAudioTrack = user.audioTrack;
		if (remoteAudioTrack) {
			remoteAudioTrack.play();

			// Add track to recorder
			if (enableLocalAudioRecording) {
				const mediaStream = remoteAudioTrack.getMediaStreamTrack();
				audioRecorderService.addAudioStream(mediaStream);
				userAudioMap[user.uid] = mediaStream;
				isAudioSubed.value = true;
			}
		}
	}
}

// Handle remote user unpublishing media
async function onUnPublished(user, mediaType) {
	await client.unsubscribe(user, mediaType);

	if (mediaType === "video") {
		isVideoSubed.value = false;
	}
	if (mediaType === "audio") {
		isAudioSubed.value = false;

		// Remove stream from recorder
		const mediaStream = userAudioMap[user.uid];
		if (mediaStream && enableLocalAudioRecording) {
			audioRecorderService.removeAudioStream(mediaStream);
		}
	}
}

// Toggle camera state with initialization if needed
async function toggleCamera() {
	try {
		if (!videoTrack) {
			videoTrack = await createCameraVideoTrack();
			await client.publish(videoTrack);
			videoTrack.play("local-video");
		}

		if (!isCameraOn.value) {
			videoTrack.setMuted(false);
		} else {
			videoTrack.setMuted(true);
		}

		isCameraOn.value = !isCameraOn.value;
	} catch (error) {
		console.error("Failed to toggle camera:", error);
	}
}

// Toggle microphone state with initialization if needed
async function toggleMicrophone() {
	try {
		if (!audioTrack) {
			audioTrack = await createMicrophoneAudioTrack();
			await client.publish(audioTrack);
		}

		if (!isMicrophoneOn.value) {
			await audioTrack.setMuted(false);
		} else {
			await audioTrack.setMuted(true);
		}

		isMicrophoneOn.value = !isMicrophoneOn.value;
	} catch (error) {
		console.error("Failed to toggle microphone:", error);
	}
}

// Handle user leaving the meeting
async function leave() {
	try {
		await cleanup();
		emit("left");
	} catch (error) {
		console.error("Failed to leave channel:", error);
		emit("left");
	}
}

// Component lifecycle hooks
onMounted(async () => {
	try {
		// Initialize recording services for host
		await initializeRecordingServices();

		// Set up event listeners for remote users
		client.on("user-published", onPublished);
		client.on("user-unpublished", onUnPublished);
		rtmClient.addEventListener("presence", onPresence);

		// Join the channels first
		const { rtcToken, rtmToken } = await tokenService.fetchRTETokens(
			props.channel,
			props.user?.id ?? "guest",
		);

		await client.join(
			props.appId,
			props.channel,
			rtcToken,
			props.user?.id ?? "guest",
		);
		await rtmClient.login({ token: rtmToken });
		await rtmClient.subscribe(props.channel);
		await rtmClient.presence.setState(props.channel, "MESSAGE", {
			state: {
				name: props.user?.user_metadata?.full_name ?? "Guest",
				uid: props.user?.id ?? "guest",
				role: props.isHost ? "Coach" : "Participant",
			},
		});

		// Initialize media devices
		await initializeMediaDevices();
	} catch (error) {
		console.error("Failed to join channel:", error);
		// Attempt cleanup if initialization fails
		await cleanup();
	}
});

// Cleanup when component unmounts
onBeforeUnmount(async () => {
	await cleanup();
});
</script>

<template>
  <div id="meeting" class="relative w-full h-full bg-background">
    <!-- Video Grid -->
    <div class="content-video">
      <video
        v-show="!isVideoSubed || isCameraOn"
        id="local-video"
        :class="[
          'video-element',
          'local',
          { 'video-fullscreen': !isVideoSubed },
        ]"
      />
      <video
        v-show="isVideoSubed"
        id="remote-video"
        :class="[
          'video-element',
          'remote',
          { 'video-fullscreen': isVideoSubed && !isCameraOn },
        ]"
      />
    </div>

    <!-- Call Recorder -->
    <div>
      <CallRecorder
        v-if="enableLocalAudioRecording"
        :audioRecorderService="audioRecorderService"
        :audioStorageService="audioStorageService"
        :meetingId="props.channel"
        :participants="participants"
        :isRecordingReady="isRecordingReady"
        :autoStart="true"
      />
    </div>

    <!-- Toolbar -->
    <MeetingToolbar
      :is-camera-on="isCameraOn"
      :is-microphone-on="isMicrophoneOn"
      :is-host="isHost"
      :is-video-subed="isVideoSubed"
      :is-audio-subed="isAudioSubed"
      @toggle-camera="toggleCamera"
      @toggle-microphone="toggleMicrophone"
      @leave="leave"
    />
  </div>
</template>

<style scoped>
.content-video {
  @apply flex flex-grow items-center justify-center h-full max-h-screen p-4;
}

.video-element {
  @apply flex-grow rounded-lg bg-neutral-800;
  aspect-ratio: 16/9;
  margin: 4px;
}

.video-fullscreen {
  @apply max-w-full max-h-full;
}
</style>
