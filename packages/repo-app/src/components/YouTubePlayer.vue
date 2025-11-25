<!-- YouTubePlayer.vue -->
<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { Card } from "@/components/ui/card";

// Define default control settings with explanatory comments
const DEFAULT_CONTROLS = {
	// Basic playback controls
	autoplay: false, // Default to no autoplay to respect user preferences
	startMuted: false, // Start with sound unless autoplay is enabled
	showControls: true, // Show native YouTube controls by default
	loop: false, // Don't loop by default

	// Visual interface settings
	modestBranding: true, // Minimize YouTube branding for better integration
	showRelated: false, // Don't show related videos at the end
	showInfo: true, // Show video title and uploader info
	fullscreen: true, // Allow fullscreen viewing

	// Mobile and embedding optimization
	playsInline: true, // Better mobile experience
	annotations: false, // Disable annotations by default

	// Playback position
	startAt: 0, // Start from beginning by default
};

const props = defineProps({
	videoId: {
		type: String,
		required: true,
	},
	title: {
		type: String,
		default: "YouTube video player",
	},
	width: {
		type: [Number, String],
		default: "100%",
	},
	height: {
		type: [Number, String],
		default: "auto",
	},
	controls: {
		type: Object,
		default: () => ({}), // Empty object by default to allow partial override
	},
});

// Merge provided controls with defaults
const mergedControls = computed(() => {
	// Handle autoplay special case - if autoplay is enabled, force startMuted
	const finalControls = {
		...DEFAULT_CONTROLS,
		...props.controls,
	};

	// If autoplay is enabled, we must start muted due to browser policies
	if (finalControls.autoplay) {
		finalControls.startMuted = true;
	}

	return finalControls;
});

const isLoaded = ref(false);
const hasError = ref(false);
const playerContainer = ref(null);
const iframeElement = ref(null);
const isIntersecting = ref(false);
const isMuted = ref(mergedControls.value.startMuted);

// Compute video source URL with all parameters
const videoSrc = computed(() => {
	const controls = mergedControls.value;
	const shouldMute = controls.autoplay || isMuted.value;

	const params = new URLSearchParams({
		fs: controls.fullscreen ? "1" : "0",
		rel: controls.showRelated ? "1" : "0",
		modestbranding: controls.modestBranding ? "1" : "0",
		playsinline: controls.playsInline ? "1" : "0",
		showinfo: controls.showInfo ? "1" : "0",
		controls: controls.showControls ? "1" : "0",
		loop: controls.loop ? "1" : "0",
		mute: shouldMute ? "1" : "0",
		start: controls.startAt || undefined,
		autoplay: controls.autoplay && isIntersecting.value ? "1" : "0",
		iv_load_policy: controls.annotations ? "1" : "3",
	});

	return `https://www.youtube.com/embed/${props.videoId}?${params.toString()}`;
});

// Container style with responsive aspect ratio
const containerStyle = computed(() => ({
	position: "relative",
	paddingBottom: "56.25%", // 16:9 aspect ratio
	height: 0,
	overflow: "hidden",
	maxWidth: typeof props.width === "number" ? `${props.width}px` : props.width,
}));

// Initialize player with intersection observer
onMounted(() => {
	if ("IntersectionObserver" in window) {
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				isIntersecting.value = entry.isIntersecting;

				if (entry.isIntersecting) {
					loadVideo();
					// Keep observer active for autoplay behavior
					if (!mergedControls.value.autoplay) {
						observer.disconnect();
					}
				}
			},
			{
				threshold: 0.1,
				rootMargin: "50px",
			},
		);

		if (playerContainer.value) {
			observer.observe(playerContainer.value);
		}
	} else {
		isIntersecting.value = true;
		loadVideo();
	}
});

// Load video with proper permissions
const loadVideo = () => {
	if (iframeElement.value) {
		const allowAttribute = [
			"accelerometer",
			"autoplay",
			"clipboard-write",
			"encrypted-media",
			"gyroscope",
			"picture-in-picture",
		].join("; ");

		iframeElement.value.allow = allowAttribute;
		iframeElement.value.src = videoSrc.value;
		isLoaded.value = true;
	}
};

// Error handling
const handleError = (event) => {
	hasError.value = true;
	console.error("YouTube player error:", event);
};

// Watch for control changes and intersection state
watch(
	[mergedControls, isIntersecting],
	() => {
		if (isLoaded.value) {
			loadVideo();
		}
	},
	{ deep: true },
);

// Toggle mute state
const toggleMute = () => {
	isMuted.value = !isMuted.value;
	loadVideo();
};

// Expose methods for external control
defineExpose({
	reload: loadVideo,
	toggleMute,
});
</script>

<template>
  <Card class="youtube-player" :class="{ 'is-loaded': isLoaded }">
    <div ref="playerContainer" :style="containerStyle">
      <!-- Main video iframe -->
      <iframe
        ref="iframeElement"
        src="about:blank"
        :data-src="videoSrc"
        :title="title"
        class="absolute top-0 left-0 w-full h-full"
        :class="{ 'opacity-0': !isLoaded }"
        frameborder="0"
        loading="lazy"
        @error="handleError"
      ></iframe>

      <!-- JavaScript-disabled fallback -->
      <noscript>
        <iframe
          :src="videoSrc"
          :title="title"
          class="absolute top-0 left-0 w-full h-full"
          frameborder="0"
          :allow="'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'"
          :allowfullscreen="mergedControls.fullscreen"
        ></iframe>
      </noscript>

      <!-- Loading indicator -->
      <div
        v-if="!isLoaded && !hasError"
        class="placeholder absolute top-0 left-0 w-full h-full bg-muted flex items-center justify-center"
        role="status"
        aria-label="Loading video"
      >
        <div class="loading-indicator">
          <span class="loading-text">Loading video...</span>
        </div>
      </div>

      <!-- Error message with retry option -->
      <div
        v-if="hasError"
        class="error-message absolute top-0 left-0 w-full h-full bg-muted/90 flex items-center justify-center"
        role="alert"
      >
        <div class="text-center p-4">
          <p class="text-destructive">Unable to load video</p>
          <button
            @click="loadVideo"
            class="mt-2 text-sm text-primary hover:text-primary/80"
          >
            Try again
          </button>
        </div>
      </div>

      <!-- Custom controls overlay -->
      <div
        v-if="!mergedControls.showControls && isLoaded"
        class="custom-controls absolute bottom-0 left-0 right-0 p-2 bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
      >
        <button
          @click="toggleMute"
          class="text-white text-sm hover:text-primary"
          :aria-label="isMuted ? 'Unmute video' : 'Mute video'"
        >
          {{ isMuted ? "Unmute" : "Mute" }}
        </button>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.youtube-player {
  margin: 1rem 0;
}

.loading-text {
  color: var(--muted-foreground);
}

iframe {
  transition: opacity 0.3s ease-in-out;
}

iframe.opacity-0 {
  opacity: 0;
}

.loading-indicator {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}

.custom-controls {
  transition: opacity 0.2s ease-in-out;
}
</style>
