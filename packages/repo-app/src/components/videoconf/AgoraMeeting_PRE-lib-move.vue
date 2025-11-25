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
import VideoMosaic from "./VideoMosaic.vue"; // Import our VideoMosaic component
import CallRecorder from "./CallRecorder.vue";
import { AudioStorageService } from "@/lib/audioStorageService";
import { audioRecorderService } from "@/lib/audioRecorderService";
import { isLocalhost } from "@/lib/utils/devUtils";
import { useSettingsStore } from "@/store/settingsStore";

import NavigationGuard from "@/components/NavigationGuard.vue";

// Define component props with validation and defaults
const props = defineProps({
	appId: {
		type: String,
		default: appConfigs.AGORA_APP_ID,
		required: false,
	},
	/*
  appKey: { ///not in use
    type: String,
    default: appConfigs.AGORA_APP_KEY,
    required: false,
  },*/
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
	meetingId: {
		///the host SETS it, since only host save stuff (audio rec)
		type: String,
		required: false,
		default: null,
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
const remoteUsers = ref([]); // Track remote users
const isCameraOn = ref(false);
const isMicrophoneOn = ref(false);
const isVideoSubed = ref(false);
const isAudioSubed = ref(false);
const isRecordingReady = ref(false);
const viewMode = ref("grid"); // 'grid' or 'focus'
const focusedUser = ref(null);

// Initialize Agora RTC client with WebRTC mode and VP8 codec
const client = createClient({
	mode: "rtc",
	codec: "vp8",
});
const rtmClient = new AgoraRTM.RTM(props.appId, props.user?.id ?? "guest");

// Track variables for managing media streams
const audioStorageService = new AudioStorageService(props.channel);
/*const audioRecorderService = new AudioRecorderService(
  audioStorageService, /// THIS IS NOT RECEIVED/handled BY audioStorageService - necessary
  debug
);
*/
const userAudioMap = {};
let videoTrack = null;
let audioTrack = null;

const settingsStore = useSettingsStore();
const hostPreferenceEnableRecording = true; // AAAND enable in prefs (todo, later)
const enableLocalAudioRecording = props.isHost && hostPreferenceEnableRecording;

// Initialize camera stream with error handling
async function initializeCamera() {
	try {
		if (props.enableCamera && !videoTrack) {
			videoTrack = await createCameraVideoTrack();
			await client.publish(videoTrack);
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
		audioRecorderService.dispose(); //maybe we can gracefully stop it, upload our stuff, then destroy it?
		// alert("cleanup");
		// Remove all event listeners to prevent memory leaks
		client.removeAllListeners("user-published");
		client.removeAllListeners("user-unpublished");
		client.removeAllListeners("user-joined");
		client.removeAllListeners("user-left");
		rtmClient.removeEventListener("presence", onPresence);

		// Clean up video track
		if (videoTrack) {
			await videoTrack.stop();
			await videoTrack.close();
			videoTrack = null;
			//  alert("cleaned video");
		}

		// Clean up audio track
		if (audioTrack) {
			await audioTrack.stop();
			await audioTrack.close();
			audioTrack = null;
			//  alert("cleaned audio");
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
		remoteUsers.value = [];
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

// Handle user joining
function onUserJoined(user) {
	console.log("User joined:", user.uid);
	// Don't need to do anything special here, as the user will publish their tracks
}

// Handle user leaving
function onUserLeft(user) {
	console.log("User left:", user.uid);
	// Remove the user from our remote users list
	remoteUsers.value = remoteUsers.value.filter((u) => u.uid !== user.uid);

	// If the focused user left, reset focus
	if (focusedUser.value === user.uid) {
		focusedUser.value = null;
	}
}

// Find the onPublished function in AgoraMeeting.vue and replace it with this improved version:

// Handle remote user publishing media
async function onPublished(user, mediaType) {
	try {
		await client.subscribe(user, mediaType);

		if (mediaType === "video") {
			const remoteVideoTrack = user.videoTrack;
			if (remoteVideoTrack) {
				// Create a copy of the array for Vue reactivity
				const updatedUsers = [...remoteUsers.value];

				// Find if user already exists
				const idx = updatedUsers.findIndex((u) => u && u.uid === user.uid);

				// Create a new user object that specifically includes the videoTrack
				const updatedUser = {
					uid: user.uid,
					videoTrack: remoteVideoTrack, // Explicitly reference the track
					hasVideo: true,
					// Include other properties from the original user if needed
					hasAudio: user.hasAudio,
					audioTrack: user.audioTrack,
				};

				if (idx >= 0) {
					// Update existing user
					updatedUsers[idx] = updatedUser;
				} else {
					// Add new user
					updatedUsers.push(updatedUser);
				}

				// Set the updated array
				remoteUsers.value = updatedUsers;
				isVideoSubed.value = true;

				// Add a debug log to confirm track is properly included
				if (debug) {
					console.log(
						`🎬 Remote video track added for ${user.uid}`,
						remoteVideoTrack,
					);
				}
			}
		}

		if (mediaType === "audio") {
			const remoteAudioTrack = user.audioTrack;
			if (remoteAudioTrack) {
				remoteAudioTrack.play();

				// Also update the user in the remoteUsers array to include audio info
				const updatedUsers = [...remoteUsers.value];
				const idx = updatedUsers.findIndex((u) => u && u.uid === user.uid);

				if (idx >= 0) {
					// Update existing user's audio properties
					updatedUsers[idx] = {
						...updatedUsers[idx],
						audioTrack: remoteAudioTrack,
						hasAudio: true,
					};
				}

				// Update remoteUsers array
				if (idx >= 0) {
					remoteUsers.value = updatedUsers;
				}

				// Add track to recorder
				if (enableLocalAudioRecording) {
					const mediaStream = remoteAudioTrack.getMediaStreamTrack();
					audioRecorderService.addAudioStream(mediaStream);
					userAudioMap[user.uid] = mediaStream;
					isAudioSubed.value = true;
				}
			}
		}
	} catch (error) {
		console.error("Error in onPublished:", error);
	}
}

// Also update the onUnPublished function for consistency
async function onUnPublished(user, mediaType) {
	try {
		await client.unsubscribe(user, mediaType);

		if (mediaType === "video") {
			// Update the remote users array
			const idx = remoteUsers.value.findIndex((u) => u.uid === user.uid);
			if (idx >= 0) {
				// Create a new user object with video properties removed/updated
				const updatedUser = {
					...remoteUsers.value[idx],
					videoTrack: null,
					hasVideo: false,
				};

				// Update the array with the new user object
				const updatedUsers = [...remoteUsers.value];
				updatedUsers[idx] = updatedUser;
				remoteUsers.value = updatedUsers;
			}

			// If there are no more video tracks, set isVideoSubed to false
			const hasVideoTracks = remoteUsers.value.some((u) => u.videoTrack);
			if (!hasVideoTracks) {
				isVideoSubed.value = false;
			}

			// Add debug log
			if (debug) {
				console.log(`📴 Remote video track removed for ${user.uid}`);
			}
		}

		if (mediaType === "audio") {
			// Also update the user in the remoteUsers array
			const idx = remoteUsers.value.findIndex((u) => u.uid === user.uid);
			if (idx >= 0) {
				const updatedUser = {
					...remoteUsers.value[idx],
					audioTrack: null,
					hasAudio: false,
				};

				const updatedUsers = [...remoteUsers.value];
				updatedUsers[idx] = updatedUser;
				remoteUsers.value = updatedUsers;
			}

			isAudioSubed.value = false;

			// Remove stream from recorder
			const mediaStream = userAudioMap[user.uid];
			if (mediaStream && enableLocalAudioRecording) {
				audioRecorderService.removeAudioStream(mediaStream);
			}
		}
	} catch (error) {
		console.error("Error in onUnPublished:", error);
	}
}
// Toggle camera state with initialization if needed
async function toggleCamera() {
	try {
		if (!videoTrack) {
			videoTrack = await createCameraVideoTrack();
			await client.publish(videoTrack);
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

// Handle view mode changes
function handleViewModeChange(newMode) {
	viewMode.value = newMode;
}

// Handle focused user changes
function handleFocusedUserChange(userId) {
	focusedUser.value = userId;
}

// Handle fullscreen toggle
function handleFullscreenToggle(isFullscreen) {
	// You can add additional logic here if needed
	console.log("Fullscreen toggled:", isFullscreen);
}

// Component lifecycle hooks
onMounted(async () => {
	try {
		// Initialize recording services for host
		await initializeRecordingServices();

		// Set up event listeners for remote users
		client.on("user-published", onPublished);
		client.on("user-unpublished", onUnPublished);
		client.on("user-joined", onUserJoined);
		client.on("user-left", onUserLeft);
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
	// alert("before unbmount");
	await cleanup();
	return true;
});

const navigationGuardActive = ref(true);

async function handleConfirmNavigation() {
	// Clean up resources, close connections, etc.
	/// if it's just for back... call BACK browser.
	await yourCleanupLogic();
	return Promise.resolve(); // Must return a promise
}

/// EX:
async function leaveExample() {
	navigationGuardActive.value = false; // Disable guard to prevent double cleanup
	await cleanup();
	// Navigate away...
}
</script>

<template>
  <!-- Navigation Guard, for back button, but Goign to settings works, we could fine tune later the behavior
   
      :onConfirmNavigation="handleConfirmNavigation"
      
      -->
  <NavigationGuard
    v-if="navigationGuardActive"
    message="Si vous quittez cette réunion, votre connexion sera interrompue et vous devrez la rejoindre à nouveau."
    title="Quitter la réunion?"
    confirmText="Quitter la réunion"
    cancelText="Rester dans la réunion"
    :interceptBackButton="true"
    :interceptPageClose="true"
    @navigationAttempted="
      (e) => console.log('User attempted to navigate:', e.type)
    "
    @navigationConfirmed="
      (e) => console.log('User confirmed navigation:', e.type)
    "
    @navigationCancelled="
      (e) => console.log('User cancelled navigation:', e.type)
    "
  />

  <div id="meeting" class="relative w-full h-full bg-background">
    <!-- Video Mosaic -->
    <VideoMosaic
      :local-video-track="videoTrack"
      :remote-video-tracks="remoteUsers"
      :is-local-camera-on="isCameraOn"
      :participants="participants"
      :view-mode="viewMode"
      :focused-user="focusedUser"
      @update:viewMode="handleViewModeChange"
      @update:focusedUser="handleFocusedUserChange"
      @toggleFullscreen="handleFullscreenToggle"
      :debug="true"
    />

    <!-- Call Recorder -->
    <div>
      <CallRecorder
        v-if="enableLocalAudioRecording"
        :audioRecorderService="audioRecorderService"
        :audioStorageService="audioStorageService"
        :meetingId="props.meetingId"
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
#meeting {
  @apply flex flex-col h-full;
}
</style>
