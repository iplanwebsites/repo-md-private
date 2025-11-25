<!-- VideoMosaic.vue -->

<script setup>
import { ref, onMounted, watch, computed, nextTick } from "vue";

const props = defineProps({
	localVideoTrack: {
		type: Object,
		default: null,
	},
	remoteVideoTracks: {
		type: Array,
		default: () => [],
	},
	isLocalCameraOn: {
		type: Boolean,
		default: false,
	},
	participants: {
		type: Array,
		default: () => [],
	},
	viewMode: {
		type: String,
		default: "grid", // Options: 'grid', 'focus'
		validator: (value) => ["grid", "focus"].includes(value),
	},
	focusedUser: {
		type: String, // User ID to focus on
		default: null,
	},
	debug: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits([
	"update:viewMode",
	"update:focusedUser",
	"toggleFullscreen",
]);

// Variables and refs
const videoRefs = ref([]);
const isFullscreen = ref(false);
const showDebugPanel = ref(true);
const mountingStatus = ref({});

// Debug logging function
const log = (message, type = "info", emoji = "🔍") => {
	if (!props.debug) return;

	const emojis = {
		info: "🔍",
		success: "✅",
		warning: "⚠️",
		error: "❌",
		track: "🎥",
		layout: "📐",
		fullscreen: "🖥️",
		mount: "🔌",
		user: "👤",
	};

	const selectedEmoji = emoji || emojis[type] || emojis.info;
	console.log(`${selectedEmoji} [VideoMosaic] ${message}`);
};

// Computed properties for responsive layouts and video rendering
const allTracks = computed(() => {
	const tracks = [];

	// Add local track if camera is on
	if (props.localVideoTrack && props.isLocalCameraOn) {
		tracks.push({
			id: "local",
			track: props.localVideoTrack,
			isLocal: true,
			participant:
				props.participants && props.participants.length > 0
					? props.participants.find((p) => p && p.uid === "local") || {
							name: "Me",
						}
					: { name: "Me" },
		});
	}

	// Add remote tracks - ensure we safely handle potentially undefined values
	if (props.remoteVideoTracks && Array.isArray(props.remoteVideoTracks)) {
		props.remoteVideoTracks.forEach((track, index) => {
			if (track) {
				const trackUid = track.uid || `remote-${index}`;
				const participant =
					props.participants && props.participants.length > 0
						? props.participants.find((p) => p && p.uid === trackUid) || {
								name: `Remote ${index + 1}`,
							}
						: { name: `Remote ${index + 1}` };

				tracks.push({
					id: trackUid,
					track: track.videoTrack,
					isLocal: false,
					participant,
				});
			}
		});
	}

	if (props.debug) {
		log(`Tracks total: ${tracks.length}`, "track", "🎥");
		tracks.forEach((t, i) =>
			log(`Track ${i + 1}: ${t.id} (${t.participant.name})`, "track", "📹"),
		);
	}

	return tracks;
});

// Computed property for the displayed tracks
const displayedTracks = computed(() => {
	if (props.viewMode === "focus" && props.focusedUser) {
		// In focus mode, show the focused user first, then others
		return allTracks.value.sort((a, b) => {
			if (a.id === props.focusedUser) return -1;
			if (b.id === props.focusedUser) return 1;
			return 0;
		});
	}
	return allTracks.value;
});

// Computed property for video containers with validation
const videoPanels = computed(() => {
	// Start with displayedTracks which is already derived from allTracks
	const panels = displayedTracks.value.map((item, index) => {
		const isMainPanel = props.viewMode === "focus" && index === 0;

		return {
			id: `video-${item.id}-${index}`,
			item,
			index,
			isMain: isMainPanel,
			containerClasses: [
				"video-container relative overflow-hidden rounded-lg",
				isMainPanel ? "main-video" : "secondary-video",
				item.isLocal ? "local-video" : "remote-video",
			],
			debugStatus: mountingStatus.value[item.id] || "pending",
		};
	});

	if (props.debug) {
		log(`Video panels created: ${panels.length}`, "layout", "📐");
		if (props.viewMode === "focus") {
			log(
				`Focus mode: Main user is ${panels[0]?.item.participant.name || "none"}`,
				"layout",
				"🔎",
			);
		}
	}

	return panels;
});

const gridClass = computed(() => {
	const count = displayedTracks.value.length;

	let gridClass;
	if (count <= 1) gridClass = "grid-cols-1";
	else if (count <= 2) gridClass = "grid-cols-2";
	else if (count <= 4) gridClass = "grid-cols-2";
	else if (count <= 9) gridClass = "grid-cols-3";
	else gridClass = "grid-cols-4";

	if (props.debug) {
		log(
			`Grid class selected: ${gridClass} for ${count} videos`,
			"layout",
			"📏",
		);
	}

	return gridClass;
});

// Debug info computed property
const debugInfo = computed(() => {
	return {
		mode: props.viewMode,
		tracks: allTracks.value.length,
		focusedUser: props.focusedUser || "None",
		isFullscreen: isFullscreen.value,
		localCamera: props.isLocalCameraOn ? "On" : "Off",
		remoteUsers: props.remoteVideoTracks.length,
		gridLayout: gridClass.value,
		mountStatus: mountingStatus.value,
	};
});

// Methods
const toggleView = () => {
	const newMode = props.viewMode === "grid" ? "focus" : "grid";
	emit("update:viewMode", newMode);

	log(`View toggled to ${newMode} mode`, "layout", "🔄");

	// If switching to focus mode and no user is focused, focus on the first remote user
	if (
		newMode === "focus" &&
		!props.focusedUser &&
		props.remoteVideoTracks &&
		props.remoteVideoTracks.length > 0 &&
		props.remoteVideoTracks[0]
	) {
		emit("update:focusedUser", props.remoteVideoTracks[0].uid);
		log(
			`Auto-focusing on first remote user: ${props.remoteVideoTracks[0].uid}`,
			"user",
			"👤",
		);
	}
};

const focusOn = (userId) => {
	if (props.viewMode === "grid") {
		emit("update:viewMode", "focus");
		log(`Switching to focus mode`, "layout", "🔄");
	}
	emit("update:focusedUser", userId);
	log(`Set focus on user: ${userId}`, "user", "👁️");
};

const toggleFullscreenMode = () => {
	isFullscreen.value = !isFullscreen.value;
	emit("toggleFullscreen", isFullscreen.value);

	log(
		`Fullscreen toggled: ${isFullscreen.value ? "on" : "off"}`,
		"fullscreen",
		"🖥️",
	);

	// You might need to implement browser-specific fullscreen API here
	const mosaicElement = document.getElementById("video-mosaic");
	if (isFullscreen.value) {
		if (mosaicElement.requestFullscreen) {
			mosaicElement.requestFullscreen();
		} else if (mosaicElement.webkitRequestFullscreen) {
			mosaicElement.webkitRequestFullscreen();
		} else if (mosaicElement.msRequestFullscreen) {
			mosaicElement.msRequestFullscreen();
		}
	} else {
		if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if (document.webkitExitFullscreen) {
			document.webkitExitFullscreen();
		} else if (document.msExitFullscreen) {
			document.msExitFullscreen();
		}
	}
};

const toggleDebugPanel = () => {
	showDebugPanel.value = !showDebugPanel.value;
	log(
		`Debug panel toggled: ${showDebugPanel.value ? "visible" : "hidden"}`,
		"info",
		"🛠️",
	);
};

// Watch for changes that require updating video displays
watch(
	[
		() => props.localVideoTrack,
		() => props.remoteVideoTracks,
		() => props.viewMode,
		() => props.focusedUser,
		() => props.isLocalCameraOn,
	],
	() => {
		log(
			"Detected change in video properties, re-mounting videos",
			"info",
			"🔄",
		);
		nextTick(() => mountVideos());
	},
	{ deep: true },
);

// Handle fullscreen change events from browser
onMounted(() => {
	log("VideoMosaic component mounted", "success", "🚀");
	// Mount videos on initial load
	nextTick(() => mountVideos());

	document.addEventListener("fullscreenchange", () => {
		isFullscreen.value = !!document.fullscreenElement;
		log(
			`Fullscreen changed: ${isFullscreen.value ? "on" : "off"}`,
			"fullscreen",
			"🖥️",
		);
	});

	document.addEventListener("webkitfullscreenchange", () => {
		isFullscreen.value = !!document.webkitFullscreenElement;
		log(
			`Webkit fullscreen changed: ${isFullscreen.value ? "on" : "off"}`,
			"fullscreen",
			"🖥️",
		);
	});

	document.addEventListener("mozfullscreenchange", () => {
		isFullscreen.value = !!document.mozFullscreenElement;
		log(
			`Mozilla fullscreen changed: ${isFullscreen.value ? "on" : "off"}`,
			"fullscreen",
			"🖥️",
		);
	});

	document.addEventListener("MSFullscreenChange", () => {
		isFullscreen.value = !!document.msFullscreenElement;
		log(
			`MS fullscreen changed: ${isFullscreen.value ? "on" : "off"}`,
			"fullscreen",
			"🖥️",
		);
	});
});

// Replace the existing watch block in VideoMosaic.vue with this one
// that includes debouncing and prevents infinite loops

// Import lodash's debounce function at the top of your script if not already there
import { debounce } from "lodash";

// Add these variables for tracking changes
const lastTracksSignature = ref("");
const isUpdating = ref(false);

// Create a debounced version of mountVideos to prevent rapid re-renders
const debouncedMountVideos = debounce(async () => {
	if (isUpdating.value) return; // Prevent re-entry

	try {
		isUpdating.value = true;

		// Generate a signature of the current tracks to compare
		const currentSignature = JSON.stringify(
			allTracks.value.map((t) => ({ id: t.id, hasTrack: !!t.track })),
		);

		// Only proceed if something has actually changed
		if (currentSignature === lastTracksSignature.value) {
			log(
				"No significant track changes detected, skipping remount",
				"info",
				"⏭️",
			);
			isUpdating.value = false;
			return;
		}

		// Update the signature
		lastTracksSignature.value = currentSignature;

		// Now proceed with the actual mounting
		log("Significant track changes detected, re-mounting videos", "info", "🔄");
		await mountVideos();
	} catch (error) {
		log(`Error in debounced mount videos: ${error.message}`, "error", "❌");
	} finally {
		isUpdating.value = false;
	}
}, 300); // 300ms debounce

// Replace the existing watch function with this improved version
watch(
	[
		() => props.localVideoTrack,
		() => props.remoteVideoTracks,
		() => props.viewMode,
		() => props.focusedUser,
		() => props.isLocalCameraOn,
	],
	(newValues, oldValues) => {
		// Check if the tracks have actually changed
		const [newLocalTrack, newRemoteTracks] = newValues;
		const [oldLocalTrack, oldRemoteTracks] = oldValues;

		// Skip if we're already processing an update
		if (isUpdating.value) return;

		// Simple equality check for localVideoTrack
		const localTrackChanged = newLocalTrack !== oldLocalTrack;

		// Deep check for remote tracks array to prevent unnecessary updates
		let remoteTracksChanged = false;

		if (oldRemoteTracks && newRemoteTracks) {
			// Compare length
			if (oldRemoteTracks.length !== newRemoteTracks.length) {
				remoteTracksChanged = true;
			} else {
				// Compare each track's uid and if it has a valid videoTrack
				for (let i = 0; i < newRemoteTracks.length; i++) {
					const oldTrack = oldRemoteTracks[i];
					const newTrack = newRemoteTracks[i];

					if (
						!oldTrack ||
						!newTrack ||
						oldTrack.uid !== newTrack.uid ||
						!!oldTrack.videoTrack !== !!newTrack.videoTrack
					) {
						remoteTracksChanged = true;
						break;
					}
				}
			}
		} else if (oldRemoteTracks !== newRemoteTracks) {
			// One is null/undefined and the other isn't
			remoteTracksChanged = true;
		}

		// Only trigger update if there's an actual change in the video tracks
		if (
			localTrackChanged ||
			remoteTracksChanged ||
			newValues[2] !== oldValues[2] || // viewMode changed
			newValues[3] !== oldValues[3] || // focusedUser changed
			newValues[4] !== oldValues[4] // isLocalCameraOn changed
		) {
			log(
				"Detected change in video properties, scheduling remount",
				"info",
				"📅",
			);
			debouncedMountVideos();
		} else {
			log("No relevant changes detected, skipping remount", "info", "⏭️");
		}
	},
	{ deep: true },
);

// Also update the mountVideos function to be more resilient
const mountVideos = async () => {
	try {
		if (isUpdating.value) {
			log("Already updating, skipping redundant mount request", "warning", "⚠️");
			return;
		}

		if (!videoRefs.value || !videoRefs.value.length) {
			log("No video refs available for mounting", "warning", "⚠️");
			return;
		}

		isUpdating.value = true;
		await nextTick();

		// Only add a small delay for the first mount after a change
		await new Promise((resolve) => setTimeout(resolve, 50));

		const trackCount = videoPanels.value.length;
		log(`Attempting to mount ${trackCount} videos`, "mount", "🔌");

		// Rest of the mounting logic remains the same...
		// Reset mounting status
		const newMountingStatus = {};
		allTracks.value.forEach((track) => {
			newMountingStatus[track.id] = "pending";
		});
		mountingStatus.value = newMountingStatus;

		// IMPORTANT: Now mount videos directly without timeouts
		for (let i = 0; i < videoPanels.value.length; i++) {
			const panel = videoPanels.value[i];
			if (
				i < videoRefs.value.length &&
				videoRefs.value[i] &&
				panel.item.track
			) {
				try {
					// Clear the container first (important!)
					const container = videoRefs.value[i];
					while (container.firstChild) {
						container.removeChild(container.firstChild);
					}

					// Play the track
					panel.item.track.play(container, { fit: "cover" });
					mountingStatus.value[panel.item.id] = "success";
					log(
						`Mounted video for ${panel.item.participant.name}`,
						"success",
						"✅",
					);
				} catch (err) {
					mountingStatus.value[panel.item.id] = "error";
					log(`Error playing track ${panel.id}: ${err.message}`, "error", "❌");
				}
			} else {
				if (!videoRefs.value[i]) {
					log(`Missing video ref for index ${i}`, "error", "❌");
				}
				if (!panel.item.track) {
					log(`Missing track for ${panel.id}`, "error", "❌");
				}
				mountingStatus.value[panel.item.id] = "missing-ref";
			}
		}
	} catch (error) {
		log(`Critical error mounting videos: ${error.message}`, "error", "❌");
	} finally {
		isUpdating.value = false;
	}
};

// If you've added the retry mechanism, modify it to respect the isUpdating flag:
const setupRetryMechanism = () => {
	// Clear any existing interval
	if (retryMountInterval.value) {
		clearInterval(retryMountInterval.value);
	}

	// Set up a new interval that checks for failed mounts every 3 seconds
	retryMountInterval.value = setInterval(() => {
		if (isUpdating.value) return; // Skip if we're already updating

		const hasFailedMounts = Object.values(mountingStatus.value).some(
			(status) =>
				status === "error" ||
				status === "missing-track" ||
				status === "invalid-track",
		);

		if (hasFailedMounts && allTracks.value.length > 0) {
			log("Detected failed mounts, attempting retry...", "info", "🔄");
			debouncedMountVideos(); // Use the debounced version
		}
	}, 3000);
};
</script>

<template>
  <div class="video-mosaic-wrapper">
    <!-- Debug Tools - Moved outside of the video container completely -->
    <div v-if="props.debug" class="debug-tools-container mb-3">
      <div class="bg-gray-800 rounded-lg overflow-hidden">
        <!-- Debug Header with Toggle -->
        <div
          class="debug-header bg-gray-700 px-3 py-2 flex justify-between items-center cursor-pointer"
          @click="toggleDebugPanel"
        >
          <h3 class="font-bold text-white text-sm">
            🛠️ Video Mosaic Debug Panel
          </h3>
          <span class="text-white">{{ showDebugPanel ? "▲" : "▼" }}</span>
        </div>

        <!-- Debug Content -->
        <div v-if="showDebugPanel" class="p-3">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-white">
            <div class="bg-gray-700 p-2 rounded">
              <div class="font-bold mb-1">🎛️ Mode</div>
              <div>{{ debugInfo.mode }}</div>
            </div>
            <div class="bg-gray-700 p-2 rounded">
              <div class="font-bold mb-1">🎥 Tracks</div>
              <div>{{ debugInfo.tracks }}</div>
            </div>
            <div class="bg-gray-700 p-2 rounded">
              <div class="font-bold mb-1">👁️ Focused</div>
              <div>{{ debugInfo.focusedUser }}</div>
            </div>
            <div class="bg-gray-700 p-2 rounded">
              <div class="font-bold mb-1">🖥️ Fullscreen</div>
              <div>{{ debugInfo.isFullscreen ? "Yes" : "No" }}</div>
            </div>
            <div class="bg-gray-700 p-2 rounded">
              <div class="font-bold mb-1">📹 Local Camera</div>
              <div>{{ debugInfo.localCamera }}</div>
            </div>
            <div class="bg-gray-700 p-2 rounded">
              <div class="font-bold mb-1">👥 Remote Users</div>
              <div>{{ debugInfo.remoteUsers }}</div>
            </div>
            <div class="bg-gray-700 p-2 rounded">
              <div class="font-bold mb-1">📏 Grid</div>
              <div>{{ debugInfo.gridLayout }}</div>
            </div>
          </div>

          <!-- Debug Controls -->
          <div class="flex mt-3 space-x-2">
            <button
              @click="emit('update:viewMode', 'grid')"
              class="px-3 py-1 rounded text-white text-xs flex-grow"
              :class="viewMode === 'grid' ? 'bg-blue-600' : 'bg-gray-600'"
            >
              📊 Grid Mode
            </button>
            <button
              @click="emit('update:viewMode', 'focus')"
              class="px-3 py-1 rounded text-white text-xs flex-grow"
              :class="viewMode === 'focus' ? 'bg-blue-600' : 'bg-gray-600'"
            >
              🔎 Focus Mode
            </button>
            <button
              @click="toggleFullscreenMode"
              class="px-3 py-1 bg-gray-600 rounded text-white text-xs flex-grow"
            >
              {{ isFullscreen ? "🪟 Exit Fullscreen" : "🖥️ Fullscreen" }}
            </button>
          </div>

          <!-- Manual Video Remount Button -->
          <div class="mt-3">
            <button
              @click="mountVideos"
              class="w-full py-2 bg-blue-600 rounded text-white text-xs"
            >
              🔄 Force Remount Videos
            </button>
          </div>

          <!-- Mounting Status -->
          <div class="mt-3 bg-gray-700 p-2 rounded">
            <div class="font-bold mb-1 text-white text-xs">
              🔌 Mounting Status
            </div>
            <div class="grid grid-cols-1 gap-1 text-xs">
              <div
                v-for="panel in videoPanels"
                :key="panel.id"
                class="flex justify-between items-center py-1 px-2 rounded"
                :class="{
                  'bg-green-800 bg-opacity-30':
                    mountingStatus[panel.item.id] === 'success',
                  'bg-red-800 bg-opacity-30':
                    mountingStatus[panel.item.id] === 'error',
                  'bg-yellow-800 bg-opacity-30':
                    mountingStatus[panel.item.id] === 'pending',
                  'bg-gray-800':
                    mountingStatus[panel.item.id] === 'missing-ref',
                }"
              >
                <span class="text-white">{{
                  panel.item.participant.name
                }}</span>
                <span class="text-white">
                  <span v-if="mountingStatus[panel.item.id] === 'success'"
                    >✅</span
                  >
                  <span v-else-if="mountingStatus[panel.item.id] === 'error'"
                    >❌</span
                  >
                  <span v-else-if="mountingStatus[panel.item.id] === 'pending'"
                    >⏱️</span
                  >
                  <span v-else>⚠️</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Video Container -->
    <div id="video-mosaic" class="w-full h-full relative">
      <!-- Video Grid -->
      <div
        :class="[
          'video-grid transition-all duration-300',
          viewMode === 'grid' ? gridClass : 'focus-mode',
          isFullscreen ? 'fullscreen' : '',
        ]"
      >
        <div
          v-for="(panel, index) in videoPanels"
          :key="panel.id"
          :class="[
            ...panel.containerClasses,
            props.debug
              ? mountingStatus[panel.item.id] === 'success'
                ? 'debug-success-border'
                : mountingStatus[panel.item.id] === 'error'
                  ? 'debug-error-border'
                  : mountingStatus[panel.item.id] === 'pending'
                    ? 'debug-pending-border'
                    : 'debug-missing-border'
              : '',
          ]"
          @click="focusOn(panel.item.id)"
        >
          <!-- Simple video container with ref -->
          <div
            :id="panel.id"
            class="w-full h-full bg-neutral-900"
            ref="videoRefs"
          ></div>

          <!-- User name overlay -->
          <div
            class="absolute bottom-2 left-2 px-2 py-1 bg-neutral-800 bg-opacity-70 text-white text-sm rounded"
          >
            {{ panel.item.participant.name }}
            <span v-if="panel.item.isLocal">(You)</span>
          </div>

          <!-- Subtle Debug overlay (only when debug is true) -->
          <div
            v-if="props.debug"
            class="absolute top-2 right-2 px-2 py-1 bg-black bg-opacity-30 text-white text-xs rounded"
          >
            {{ panel.item.id }}
          </div>
        </div>
      </div>

      <!-- User Controls (Remain in video container for usability) -->
      <div class="absolute top-4 right-4 z-10 flex space-x-2">
        <!-- Layout Toggle Button -->
        <button
          @click="toggleView"
          class="p-2 bg-neutral-800 bg-opacity-70 rounded-full"
          :title="
            viewMode === 'grid' ? 'Switch to Focus View' : 'Switch to Grid View'
          "
        >
          <span v-if="viewMode === 'grid'" class="text-white">
            <i class="fas fa-th-large"></i>
          </span>
          <span v-else class="text-white">
            <i class="fas fa-user"></i>
          </span>
        </button>

        <!-- Fullscreen Toggle Button -->
        <button
          @click="toggleFullscreenMode"
          class="p-2 bg-neutral-800 bg-opacity-70 rounded-full"
          :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
        >
          <span v-if="isFullscreen" class="text-white">
            <i class="fas fa-compress"></i>
          </span>
          <span v-else class="text-white">
            <i class="fas fa-expand"></i>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-grid {
  @apply grid gap-2 w-full h-full p-2;
}

.focus-mode {
  @apply grid;
  grid-template-columns: 3fr 1fr;
  grid-template-rows: repeat(auto-fill, 1fr);
}

.focus-mode .main-video {
  @apply col-span-1 row-span-full;
  grid-column: 1;
}

.focus-mode .secondary-video {
  @apply col-span-1;
  grid-column: 2;
}

.fullscreen {
  @apply p-0;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.video-container {
  @apply transition-all duration-300 ease-in-out;
  aspect-ratio: 16/9;
}

/* Make sure video containers stay within bounds */
.video-container > div {
  @apply w-full h-full object-cover;
}

/* Debug styling with colored borders instead of overlays */
.debug-success-border {
  box-shadow: inset 0 0 0 2px rgba(72, 187, 120, 0.5);
}

.debug-error-border {
  box-shadow: inset 0 0 0 2px rgba(245, 101, 101, 0.5);
}

.debug-pending-border {
  box-shadow: inset 0 0 0 2px rgba(236, 201, 75, 0.5);
}

.debug-missing-border {
  box-shadow: inset 0 0 0 2px rgba(160, 174, 192, 0.5);
}

/* Debug Container Styles */
.debug-tools-container {
  width: 100%;
}
</style>
