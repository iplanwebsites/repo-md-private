<!-- AgoraMeeting.vue -->

<script setup>
// Import necessary Vue and dependencies
import { appConfigs } from "@/appConfigs.js";
import { ref, onMounted, onBeforeUnmount } from "vue";

import AgoraTokenService from "@/lib/agoraTokenService";
import trpc from "@/trpc";
import MeetingToolbar from "./MeetingToolbar.vue";
import VideoMosaic from "./VideoMosaic.vue";
import CallRecorder from "./CallRecorder.vue";
import { AudioStorageService } from "@/lib/audioStorageService";
import { audioRecorderService } from "@/lib/audioRecorderService";
import { isLocalhost } from "@/lib/utils/devUtils";
import { useSettingsStore } from "@/store/settingsStore";
import NavigationGuard from "@/components/NavigationGuard.vue";

import { getAgoraService } from "@/lib/agoraService";

// Define component props with validation and defaults
const props = defineProps({
	appId: {
		type: String,
		default: appConfigs.AGORA_APP_ID,
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
	meetingId: {
		type: String,
		required: false,
		default: null,
	},
});

const router = useRouter();

// Initialize client with token server URL
const SERVER_URL = appConfigs.apiUrl; //"https://api.repo.md";
const tokenService = new AgoraTokenService(`${SERVER_URL}/agora/token`);

// Define emitted events
const emit = defineEmits(["left"]);

// Set debug env
const debug = true; // Force debug to true for troubleshooting

// Enhanced debug logging with emojis
const log = (emoji, message, ...args) => {
	if (debug) {
		console.log(`${emoji} [Agora] ${message}`, ...args);
	}
};

// Reactive state management using refs
const participants = ref([]);
const remoteUsers = ref([]);
const isCameraOn = ref(false);
const isMicrophoneOn = ref(false);
const isVideoSubed = ref(false);
const isAudioSubed = ref(false);
const isRecordingReady = ref(false);
const viewMode = ref("grid"); // 'grid' or 'focus'
const focusedUser = ref(null);
const isServiceReady = ref(false);
const client = ref(null);

// Track variables for managing media streams
const audioStorageService = new AudioStorageService(props.channel);
const userAudioMap = {};
let videoTrack = null;
let audioTrack = null;
let agoraService = null;

const settingsStore = useSettingsStore();
const hostPreferenceEnableRecording = true;
const enableLocalAudioRecording =
	props.isHost && hostPreferenceEnableRecording && props.meetingId;

// Helper function to check equality of UIDs regardless of type
function isSameUid(uid1, uid2) {
	// Convert both to strings for comparison
	return String(uid1) === String(uid2);
}

// Initialize Agora service and client
async function initializeAgoraService() {
	try {
		log("🚀", "Starting Agora service initialization");

		// Get the Agora service instance
		agoraService = getAgoraService();
		log("🚀", "Agora service instance created");

		// First, make sure modules are loaded by calling any method
		log("🚀", "Loading Agora modules...");
		await agoraService.loadModules();
		log("🚀", "Agora modules loaded successfully");

		// Set log level as early as possible
		await agoraService.setLogLevel(3);
		log("🚀", "Log level set to 3");

		// Then create the client
		log("🚀", "Creating RTC client (mode: rtc, codec: vp8)");
		client.value = await agoraService.createClient({
			mode: "rtc",
			codec: "vp8",
			//region NA
		});
		log("🚀", "RTC client created successfully", client.value);

		// Set up event listeners for remote users
		log("🚀", "Setting up event listeners");
		client.value.on("user-published", onPublished);
		client.value.on("user-unpublished", onUnPublished);
		client.value.on("user-joined", onUserJoined);
		client.value.on("user-left", onUserLeft);

		// Add connection state change listener
		client.value.on("connection-state-change", (currentState, prevState) => {
			log("🔌", `Connection state changed: ${prevState} -> ${currentState}`);

			if (currentState === "CONNECTED") {
				log("🔌", "Successfully connected to channel!");
				log(
					"👤",
					"Remote users in channel:",
					client.value.remoteUsers?.map((u) => `${u.uid} (${typeof u.uid})`) ||
						[],
				);
			}
		});

		isServiceReady.value = true;
		log("🚀", "Agora service initialization complete");
		return true;
	} catch (error) {
		console.error("❌ Failed to initialize Agora service:", error);
		return false;
	}
}

// Initialize camera stream with error handling
async function initializeCamera() {
	try {
		if (props.enableCamera && !videoTrack && isServiceReady.value) {
			log("🎬", "Initializing camera video track");
			videoTrack = await agoraService.createCameraVideoTrack();
			log("🎬", "Publishing camera video track");
			await client.value.publish(videoTrack);
			log("🎬", "Camera video track published successfully");
			isCameraOn.value = true;
		}
	} catch (error) {
		console.error("❌ Failed to initialize camera:", error);
		log("🐛", "Camera initialization error details:", {
			message: error.message,
			stack: error.stack,
		});
	}
}

// Initialize microphone stream with error handling
async function initializeMicrophone() {
	try {
		if (props.enableMicrophone && !audioTrack && isServiceReady.value) {
			log("🎤", "Initializing microphone audio track");
			audioTrack = await agoraService.createMicrophoneAudioTrack();
			log("🎤", "Publishing microphone audio track");
			await client.value.publish(audioTrack);
			await audioTrack.setMuted(false);
			log("🎤", "Microphone audio track published successfully");
			isMicrophoneOn.value = true;

			// Add track to recorder
			if (enableLocalAudioRecording) {
				log("🎤", "Adding audio track to recorder");
				audioRecorderService.addAudioStream(audioTrack.getMediaStreamTrack());
				isRecordingReady.value = true;
			}
		}
	} catch (error) {
		console.error("❌ Failed to initialize microphone:", error);
		log("🐛", "Microphone initialization error details:", {
			message: error.message,
			stack: error.stack,
		});
	}
}

// Initialize both media devices in parallel
async function initializeMediaDevices() {
	try {
		if (isServiceReady.value) {
			log("🚀", "Initializing media devices in parallel");
			await Promise.all([initializeCamera(), initializeMicrophone()]);
			log("🚀", "Media devices initialization complete");
		}
	} catch (error) {
		console.error("❌ Failed to initialize media devices:", error);
		log("🐛", "Media devices initialization error details:", {
			message: error.message,
			stack: error.stack,
		});
	}
}

// Retry mechanism for media device initialization
async function retryMediaDeviceInitialization(maxRetries = 3) {
	let attempt = 0;

	while (attempt < maxRetries) {
		attempt++;
		log("🚀", `Media device initialization attempt ${attempt}/${maxRetries}`);

		try {
			await initializeMediaDevices();
			log("🚀", "Media devices initialized successfully");
			return true;
		} catch (error) {
			log(
				"⚠️",
				`Media device initialization attempt ${attempt} failed:`,
				error.message,
			);

			if (attempt >= maxRetries) {
				console.error("❌ All media device initialization attempts failed");
				return false;
			}

			// Wait before retrying
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}

	return false;
}

async function initializeRecordingServices() {
	if (!enableLocalAudioRecording) {
		return;
	}

	log("🎤", "Initializing recording services for host");

	// Initialize audio recorder and audio storage for host
	await audioRecorderService.initializeMediaRecorder();
	log("🎤", "Media recorder initialized");

	// Init DB for recording
	try {
		await audioStorageService.initDB();
		log("🎤", "Audio storage DB initialized");
	} catch (error) {
		console.error("❌ Could not initialize DB for audio recording", error);
		log("🐛", "DB initialization error details:", {
			message: error.message,
			stack: error.stack,
		});
	}
}

// Simplified cleanup function using agoraService
async function cleanup() {
	log("🧹", "Starting cleanup process");

	// Clear local track references
	log("🧹", "Clearing local tracks");
	videoTrack = null;
	audioTrack = null;

	// Reset all state variables
	log("🧹", "Resetting state variables");
	isCameraOn.value = false;
	isMicrophoneOn.value = false;
	isVideoSubed.value = false;
	isAudioSubed.value = false;
	remoteUsers.value = [];
	isServiceReady.value = false;

	try {
		// Dispose audio recorder first
		log("🧹", "Disposing audio recorder");
		audioRecorderService.dispose();

		// Clean up via agoraService - this handles all Agora resources
		if (agoraService) {
			log("🧹", "Cleaning up Agora service");
			await agoraService.cleanup();
			log("🧹", "Agora service cleanup completed");
		}

		log("🧹", "Cleanup process completed successfully");
		return true;
	} catch (error) {
		console.error("❌ Failed to cleanup resources:", error);
		log("🐛", "Cleanup error details:", {
			message: error.message,
			stack: error.stack,
		});
		return false;
	}
}

// Use agoraService to get participants
async function onPresence(e) {
	try {
		if (isServiceReady.value) {
			log("👤", "Updating participants list from presence event", e);
			participants.value = await agoraService.getParticipants(
				props.channel,
				"MESSAGE",
			);
			log("👤", "Participants updated:", participants.value);
		}
	} catch (error) {
		console.error("❌ Failed to update online users:", error);
		log("🐛", "Presence update error details:", {
			message: error.message,
			stack: error.stack,
		});
	}
}

// Helper function to check if a client is properly connected
function isClientFullyConnected() {
	if (!client.value) return false;

	return client.value.connectionState === "CONNECTED";
}

// Handle user joining - Enhanced for better debugging
function onUserJoined(user) {
	log("👤", `User joined channel: ${user.uid} (type: ${typeof user.uid})`);

	// Add user to remoteUsers array preemptively
	const exists = remoteUsers.value.some((u) => isSameUid(u.uid, user.uid));

	if (!exists) {
		log("👤", `Adding new user ${user.uid} to remoteUsers array on join event`);
		const newUser = {
			uid: user.uid,
			hasVideo: false,
			hasAudio: false,
			videoTrack: null,
			audioTrack: null,
		};

		remoteUsers.value = [...remoteUsers.value, newUser];
	}

	log(
		"👤",
		"Current remote users:",
		client.value.remoteUsers.map((u) => `${u.uid} (${typeof u.uid})`),
	);
	log("👤", "All users in channel:", [
		`${client.value.uid} (${typeof client.value.uid})`,
		...client.value.remoteUsers.map((u) => `${u.uid} (${typeof u.uid})`),
	]);
}

// Handle user leaving
function onUserLeft(user) {
	log("👤", `User left channel: ${user.uid} (type: ${typeof user.uid})`);

	// Remove the user from our remote users list
	const beforeCount = remoteUsers.value.length;
	remoteUsers.value = remoteUsers.value.filter(
		(u) => !isSameUid(u.uid, user.uid),
	);
	const afterCount = remoteUsers.value.length;

	log("👤", `Removed from remote users array: ${beforeCount} -> ${afterCount}`);
	log(
		"👤",
		"Current remote users:",
		remoteUsers.value.map((u) => `${u.uid} (${typeof u.uid})`),
	);

	// If the focused user left, reset focus
	if (focusedUser.value === user.uid) {
		log("👤", `Focused user ${user.uid} left, resetting focus`);
		focusedUser.value = null;
	}
}

// Enhanced onPublished with better error handling and retry
async function onPublished(user, mediaType) {
	try {
		if (!client.value) {
			log("⚠️", "Client not initialized in onPublished");
			return;
		}

		log("🔄", `Remote user ${user.uid} published ${mediaType}`);
		log("🔄", `Local UID: ${client.value.uid}, Remote UID: ${user.uid}`);
		log("🔄", `Connection state: ${client.value.connectionState}`);

		// Check if user exists in remoteUsers
		const existsInAgora = client.value.remoteUsers.some((u) =>
			isSameUid(u.uid, user.uid),
		);

		log(
			"👤",
			`User ${user.uid} exists in Agora remote users: ${existsInAgora}`,
		);

		// Log all remote users for debugging
		log(
			"👤",
			"Current Agora remote users:",
			client.value.remoteUsers.map((u) => `${u.uid} (${typeof u.uid})`),
		);

		if (!existsInAgora) {
			log("⚠️", `WARNING: User ${user.uid} not found in client's remote users!`);

			// Wait longer for the channel to synchronize
			log("⏱️", "Waiting before subscription attempt...");
			await new Promise((resolve) => setTimeout(resolve, 22));

			// Check again
			const existsNow = client.value.remoteUsers.some((u) =>
				isSameUid(u.uid, user.uid),
			);

			log(
				"👤",
				`After delay, user ${user.uid} exists in Agora remote users: ${existsNow}`,
			);

			if (!existsNow) {
				log("⚠️", "Still can't find user, subscription may fail");

				// Add user to remoteUsers array anyway (prepare structure)
				log("👤", `Adding user ${user.uid} to remoteUsers preemptively`);
				const newUser = {
					uid: user.uid,
					hasVideo: mediaType === "video",
					hasAudio: mediaType === "audio",
					videoTrack: null,
					audioTrack: null,
				};

				const userExists = remoteUsers.value.some((u) =>
					isSameUid(u.uid, user.uid),
				);
				if (!userExists) {
					remoteUsers.value = [...remoteUsers.value, newUser];
				}
			}
		}

		try {
			log("🔄", `Subscribing to ${user.uid}'s ${mediaType}...`);

			// Implement retry mechanism for subscription
			let retryCount = 0;
			const maxRetries = 3;

			while (retryCount < maxRetries) {
				try {
					await client.value.subscribe(user.uid, mediaType);
					log("🔄", `Successfully subscribed to ${user.uid}'s ${mediaType}`);
					break; // Success, exit the loop
				} catch (subscribeError) {
					retryCount++;
					if (retryCount >= maxRetries) {
						throw subscribeError; // Throw on final retry
					}

					log(
						"⚠️",
						`Retry #${retryCount} for subscribing to ${user.uid}'s ${mediaType}`,
					);
					// Wait before retrying
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}
		} catch (subscribeError) {
			console.error(`❌ Subscription error for ${mediaType}:`, subscribeError);
			log("🐛", "Subscription error details:", {
				message: subscribeError.message,
				code: subscribeError.code,
				uid: user.uid,
				mediaType,
			});
			return; // Exit early on subscription error
		}

		if (mediaType === "video") {
			const remoteVideoTrack = user.videoTrack;
			log(
				"🎬",
				`Remote video track for ${user.uid}:`,
				remoteVideoTrack ? "✅ Available" : "❌ Not available",
			);

			if (remoteVideoTrack) {
				log("🎬", `Processing video track for user ${user.uid}`);

				// Create a copy of the array for Vue reactivity
				const updatedUsers = [...remoteUsers.value];
				log(
					"👤",
					"Current remote users before update:",
					updatedUsers.map((u) => `${u.uid} (${typeof u.uid})`),
				);

				// Find if user already exists
				const idx = updatedUsers.findIndex((u) => isSameUid(u.uid, user.uid));
				log("👤", `User index in remote array: ${idx}`);

				// Create a new user object that specifically includes the videoTrack
				const updatedUser = {
					uid: user.uid,
					videoTrack: remoteVideoTrack, // Explicitly reference the track
					hasVideo: true,
					// Include other properties from the original user if needed
					hasAudio: idx >= 0 ? updatedUsers[idx].hasAudio : false,
					audioTrack: idx >= 0 ? updatedUsers[idx].audioTrack : null,
				};

				if (idx >= 0) {
					// Update existing user
					log("👤", `Updating existing user at index ${idx}`);
					updatedUsers[idx] = updatedUser;
				} else {
					// Add new user
					log("👤", `Adding new user ${user.uid} to remote users array`);
					updatedUsers.push(updatedUser);
				}

				// Set the updated array
				remoteUsers.value = updatedUsers;
				isVideoSubed.value = true;
				log(
					"👤",
					"Remote users after update:",
					remoteUsers.value.map((u) => `${u.uid} (${typeof u.uid})`),
				);
				log("🎬", `Video track for ${user.uid} successfully processed`);

				// Add a debug log to confirm track is properly included
				if (debug) {
					log(
						"🎬",
						`Remote video track added for ${user.uid}`,
						remoteVideoTrack,
					);
				}
			}
		}

		if (mediaType === "audio") {
			const remoteAudioTrack = user.audioTrack;
			log(
				"🎤",
				`Remote audio track for ${user.uid}:`,
				remoteAudioTrack ? "✅ Available" : "❌ Not available",
			);

			if (remoteAudioTrack) {
				log("🎤", `Playing audio for user ${user.uid}`);
				remoteAudioTrack.play();

				// Also update the user in the remoteUsers array to include audio info
				const updatedUsers = [...remoteUsers.value];
				const idx = updatedUsers.findIndex((u) => isSameUid(u.uid, user.uid));
				log("👤", `User index in remote array for audio: ${idx}`);

				if (idx >= 0) {
					// Update existing user's audio properties
					log("👤", `Updating audio for existing user at index ${idx}`);
					updatedUsers[idx] = {
						...updatedUsers[idx],
						audioTrack: remoteAudioTrack,
						hasAudio: true,
					};

					// Update remoteUsers array
					remoteUsers.value = updatedUsers;
					log(
						"👤",
						"Remote users after audio update:",
						remoteUsers.value.map((u) => `${u.uid} (${typeof u.uid})`),
					);
				} else {
					// If user doesn't exist yet, add a new entry
					log("👤", `User ${user.uid} not found, adding to remoteUsers array`);
					remoteUsers.value = [
						...remoteUsers.value,
						{
							uid: user.uid,
							audioTrack: remoteAudioTrack,
							hasAudio: true,
							hasVideo: false,
							videoTrack: null,
						},
					];
				}

				// Add track to recorder
				if (enableLocalAudioRecording) {
					log("🎤", `Adding audio track to recorder for user ${user.uid}`);
					const mediaStream = remoteAudioTrack.getMediaStreamTrack();
					audioRecorderService.addAudioStream(mediaStream);
					userAudioMap[user.uid] = mediaStream;
					isAudioSubed.value = true;
				}

				log("🎤", `Audio track for ${user.uid} successfully processed`);
			}
		}
	} catch (error) {
		console.error("❌ Error in onPublished:", error);
		log("🐛", "onPublished error details:", {
			message: error.message,
			stack: error.stack,
			user: user?.uid,
			mediaType,
		});
	}
}

// Also update the onUnPublished function for consistency
async function onUnPublished(user, mediaType) {
	try {
		if (!client.value) {
			log("⚠️", "Client not initialized in onUnPublished");
			return;
		}

		log("🔄", `Remote user ${user.uid} unpublished ${mediaType}`);

		try {
			await client.value.unsubscribe(user, mediaType);
			log("🔄", `Successfully unsubscribed from ${user.uid}'s ${mediaType}`);
		} catch (error) {
			log(
				"⚠️",
				`Error unsubscribing from ${user.uid}'s ${mediaType}:`,
				error.message,
			);
			// Continue processing even if unsubscribe fails
		}

		if (mediaType === "video") {
			// Update the remote users array
			const idx = remoteUsers.value.findIndex((u) =>
				isSameUid(u.uid, user.uid),
			);
			log("👤", `User index in remote array for video removal: ${idx}`);

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
				log("👤", `Updated user ${user.uid} to remove video track`);
			}

			// If there are no more video tracks, set isVideoSubed to false
			const hasVideoTracks = remoteUsers.value.some((u) => u.videoTrack);
			if (!hasVideoTracks) {
				isVideoSubed.value = false;
				log(
					"🎬",
					"No more video tracks available, setting isVideoSubed to false",
				);
			}

			// Add debug log
			log("🎬", `Remote video track removed for ${user.uid}`);
		}

		if (mediaType === "audio") {
			// Also update the user in the remoteUsers array
			const idx = remoteUsers.value.findIndex((u) =>
				isSameUid(u.uid, user.uid),
			);
			log("👤", `User index in remote array for audio removal: ${idx}`);

			if (idx >= 0) {
				const updatedUser = {
					...remoteUsers.value[idx],
					audioTrack: null,
					hasAudio: false,
				};

				const updatedUsers = [...remoteUsers.value];
				updatedUsers[idx] = updatedUser;
				remoteUsers.value = updatedUsers;
				log("👤", `Updated user ${user.uid} to remove audio track`);
			}

			// If no more audio tracks, set isAudioSubed to false
			const hasAudioTracks = remoteUsers.value.some((u) => u.audioTrack);
			if (!hasAudioTracks) {
				isAudioSubed.value = false;
				log(
					"🎤",
					"No more audio tracks available, setting isAudioSubed to false",
				);
			}

			// Remove stream from recorder
			const mediaStream = userAudioMap[user.uid];
			if (mediaStream && enableLocalAudioRecording) {
				log("🎤", `Removing audio stream from recorder for user ${user.uid}`);
				audioRecorderService.removeAudioStream(mediaStream);
				delete userAudioMap[user.uid];
			}
		}
	} catch (error) {
		console.error("❌ Error in onUnPublished:", error);
		log("🐛", "onUnPublished error details:", {
			message: error.message,
			stack: error.stack,
			user: user?.uid,
			mediaType,
		});
	}
}

// Toggle camera state with initialization if needed
async function toggleCamera() {
	try {
		if (!isServiceReady.value) {
			log("⚠️", "Service not ready, cannot toggle camera");
			return;
		}

		log(
			"🎬",
			`Toggling camera. Current state: ${isCameraOn.value ? "ON" : "OFF"}`,
		);

		if (!videoTrack) {
			log("🎬", "Video track not initialized, creating...");
			videoTrack = await agoraService.createCameraVideoTrack();
			log("🎬", "Publishing video track...");
			await client.value.publish(videoTrack);
			log("🎬", "Video track published successfully");
		}

		if (!isCameraOn.value) {
			log("🎬", "Turning camera ON");
			videoTrack.setMuted(false);
		} else {
			log("🎬", "Turning camera OFF");
			videoTrack.setMuted(true);
		}

		isCameraOn.value = !isCameraOn.value;
		log("🎬", `Camera state toggled to: ${isCameraOn.value ? "ON" : "OFF"}`);
	} catch (error) {
		console.error("❌ Failed to toggle camera:", error);
		log("🐛", "Camera toggle error details:", {
			message: error.message,
			stack: error.stack,
		});
	}
}

// Toggle microphone state with initialization if needed
async function toggleMicrophone() {
	try {
		if (!isServiceReady.value) {
			log("⚠️", "Service not ready, cannot toggle microphone");
			return;
		}

		log(
			"🎤",
			`Toggling microphone. Current state: ${isMicrophoneOn.value ? "ON" : "OFF"}`,
		);

		if (!audioTrack) {
			log("🎤", "Audio track not initialized, creating...");
			audioTrack = await agoraService.createMicrophoneAudioTrack();
			log("🎤", "Publishing audio track...");
			await client.value.publish(audioTrack);
			log("🎤", "Audio track published successfully");
		}

		if (!isMicrophoneOn.value) {
			log("🎤", "Turning microphone ON");
			await audioTrack.setMuted(false);
		} else {
			log("🎤", "Turning microphone OFF");
			await audioTrack.setMuted(true);
		}

		isMicrophoneOn.value = !isMicrophoneOn.value;
		log(
			"🎤",
			`Microphone state toggled to: ${isMicrophoneOn.value ? "ON" : "OFF"}`,
		);
	} catch (error) {
		console.error("❌ Failed to toggle microphone:", error);
		log("🐛", "Microphone toggle error details:", {
			message: error.message,
			stack: error.stack,
		});
	}
}

// Handle user leaving the meeting
async function leave() {
	/// TODO: navigate to meet/done?meetingId=124
	log("🚪", "User leaving meeting");
	// TODO: hide the current view, lots of JANK
	router.push({
		name: "meetDone",
		query: {
			meetingId: props.meetingId,
			roomId: props.channel,
		},
	});
	/*
  try {
    log("🚪", "User initiating leave from meeting");
    await cleanup();
    log("🚪", "Emitting 'left' event");
    emit("left");
  } catch (error) {
    console.error("❌ Failed to leave channel:", error);
    log("🐛", "Leave error details:", {
      message: error.message,
      stack: error.stack,
    });
    emit("left");
  }*/
}

// Handle view mode changes
function handleViewModeChange(newMode) {
	log("👁️", `View mode changed: ${viewMode.value} -> ${newMode}`);
	viewMode.value = newMode;
}

// Handle focused user changes
function handleFocusedUserChange(userId) {
	log("👁️", `Focused user changed: ${focusedUser.value} -> ${userId}`);
	focusedUser.value = userId;
}
// Handle fullscreen toggle
function handleFullscreenToggle(isFullscreen) {
	log("📺", `Fullscreen toggled: ${isFullscreen}`);
}

// Modified joinMeeting function to ensure consistent UID type handling
async function joinMeeting() {
	try {
		log("🚀", "Starting join meeting process");

		// App ID check
		log("🔑", "App ID check:", {
			length: props.appId?.length || 0,
			firstChars: props.appId?.substring(0, 4) || "none",
			lastChars: props.appId?.substring(props.appId?.length - 4) || "none",
		});

		if (!props.appId || props.appId.length < 10) {
			console.error("❌ Invalid App ID detected!");
			throw new Error("Invalid Agora App ID");
		}

		// First initialize the Agora service and client
		log("🚀", "Initializing Agora service...");
		const initialized = await initializeAgoraService();
		if (!initialized) {
			throw new Error("Failed to initialize Agora service");
		}

		// Initialize recording services for host
		await initializeRecordingServices();
		log("🚀", "Recording services initialized");

		// Generate a numeric user ID - must be a NUMBER, not a string
		const numericUserId = Math.floor(Math.random() * 900000) + 100000;
		log(
			"👤",
			`Generated numeric user ID: ${numericUserId} (type: ${typeof numericUserId})`,
		);

		// Important: Convert to string for RTM but keep as number for RTC
		//const rtmUserId = String(numericUserId);
		const rtmUserId = numericUserId;
		log("👤", `RTM user ID (string): ${rtmUserId} (type: ${typeof rtmUserId})`);

		// Initialize RTM client with string ID
		log("🚀", "Initializing RTM client...");
		await agoraService.initializeRTMClient(
			props.appId,
			rtmUserId, // RTM uses string IDs
		);
		agoraService.addRTMEventListener("presence", onPresence);
		log("🚀", "RTM client initialized successfully");

		// Get tokens with numeric ID
		const channelName = props.channel.trim();
		log(
			"🔑",
			`Fetching tokens for channel: "${channelName}" with ID: ${numericUserId}`,
		);

		try {
			const { rtcToken, rtmToken } = await tokenService.fetchRTETokens(
				channelName,
				numericUserId, // Pass as a number
			);
			log("🔑", "Token fetch successful", {
				rtcTokenLength: rtcToken?.length || 0,
				rtmTokenLength: rtmToken?.length || 0,
			});

			// Add delay before joining to ensure token is processed
			log("⏱️", "Adding brief delay before channel join...");
			await new Promise((resolve) => setTimeout(resolve, 100));

			// IMPORTANT: Join RTC with the same numeric ID
			log(
				"🔌",
				`Joining channel "${channelName}" with App ID and numeric user ID: ${numericUserId}`,
			);

			// Add logging for client options
			log("🔌", "Client options before join:", {
				mode: client.value.mode,
				codec: client.value.codec,
				role: client.value.role,
			});

			await client.value.join(
				props.appId,
				channelName,
				rtcToken,
				numericUserId, // MUST be the same number as used for the token
			);

			log("🔌", "Channel join successful!", {
				uid: client.value.uid,
				uidType: typeof client.value.uid,
				channelName: client.value.channelName,
				connectionState: client.value.connectionState,
			});

			// Add longer delay after joining to ensure connection stabilizes (increased from 2s to 5s)
			log("⏱️", "Waiting for connection to stabilize...");
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Check remote users after joining
			log(
				"👤",
				"Remote users after join:",
				client.value.remoteUsers?.map((u) => `${u.uid} (${typeof u.uid})`) ||
					[],
			);

			// Join RTM with string ID
			log("🔌", `Logging in to RTM with token and ID: ${rtmUserId}`);
			await agoraService.loginRTM(rtmToken);
			log("🔌", "Subscribing to RTM channel");
			await agoraService.subscribeToChannel(channelName);

			// Store local user ID for debugging
			log(
				"👤",
				`Local user ID after joining: ${client.value.uid} (type: ${typeof client.value.uid})`,
			);

			// Use string ID for RTM but ensure we're consistent with the numeric ID used elsewhere
			await agoraService.setPresenceState(channelName, "MESSAGE", {
				name: props.user?.user_metadata?.full_name ?? "Guest",
				uid: numericUserId, // Use numeric ID for consistency
				uidString: String(numericUserId), // Also include string version for debugging
				role: props.isHost ? "Coach" : "Participant",
			});
			log("👤", "Presence state set in RTM");

			// Initialize media devices with retry mechanism
			log("🚀", "Initializing media devices...");
			await retryMediaDeviceInitialization(3);
			log("🚀", "Media devices initialized successfully");

			return true;
		} catch (tokenError) {
			console.error("❌ Token error:", tokenError);
			log("🔑", "Token error details:", {
				message: tokenError.message,
				stack: tokenError.stack,
			});
			throw tokenError;
		}
	} catch (error) {
		console.error("❌ Failed to join channel:", error);
		log("🐛", "Join error details:", {
			message: error.message,
			stack: error.stack,
		});
		await cleanup();
		return false;
	}
}

// Component lifecycle hooks
onMounted(async () => {
	log("🔄", "Component mounted, joining meeting");
	await joinMeeting();
});

// Cleanup when component unmounts
onBeforeUnmount(async () => {
	log("🔄", "Component unmounting, cleaning up");
	await cleanup();
});

const navigationGuardActive = ref(true); /// OFF - while we figure out the back button issue.
const isNavigationGuardOpen = ref(false);
const navigationGuardAction = ref(false);

async function onNavigationConfirmed(e) {
	navigationGuardActive.value = false;
	isNavigationGuardOpen.value = false;

	await cleanup();
	// If a navigation was stored, navigate using the function provided
	if (navigationGuardAction.value) {
		log("🚪", "Navigation confirmed, executing action");
		log("🚪", "navigationGuardAction.value", navigationGuardAction.value);
		navigationGuardAction.value(); //TODO: DON'T WORK FOR BACK BUTTON events
	}
}
/*
async function handleConfirmNavigation() {
  // Clean up resources, close connections, etc.
  log("🚪", "Navigation guard triggered, cleaning up");
  await cleanup();
  return Promise.resolve(); // Must return a promise
}async function leaveExample() {
  log("🚪", "Leave example triggered");
  navigationGuardActive.value = false; // Disable guard to prevent double cleanup
  await cleanup();
  log("🚪", "Ready to navigate away");
  // Navigate away...
}*/

function onNavigationAttempted(e) {
	isNavigationGuardOpen.value = true;

	if (e.action && typeof e.action === "function") {
		navigationGuardAction.value = e.action;
	}
}
function onNavigationCancelled(e) {
	isNavigationGuardOpen.value = false;
	navigationGuardAction.value = null;
}
</script>

<template>
  <!-- Navigation Guard, for back button, but Going to settings works, we could fine tune later the behavior -->
  <NavigationGuard
    v-if="navigationGuardActive"
    message="Si vous quittez cette réunion, votre connexion sera interrompue et vous devrez la rejoindre à nouveau."
    title="Quitter la réunion?"
    confirmText="Quitter la réunion"
    cancelText="Rester dans la réunion"
    :interceptBackButton="true"
    :interceptPageClose="false"
    :interceptNavigation="true"
    :isOpen="isNavigationGuardOpen"
    @navigationConfirmed="onNavigationConfirmed"
    @navigationCancelled="onNavigationCancelled"
    @navigationAttempted="onNavigationAttempted"
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
