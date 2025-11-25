<!-- MeetingToolbar.vue -->
<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import {
	Video,
	VideoOff,
	Mic,
	MicOff,
	MonitorUp,
	Users,
	MessageSquare,
	Settings,
	PhoneOff,
	Signal,
	Timer,
	NotebookPen,
	Fullscreen,
	Play,
	StopCircle,
	Pause,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import InfoTooltip from "@/components/InfoTooltip.vue";
import ConfirmationDialog from "./ConfirmationDialog.vue";

// Match the existing meeting component props
const {
	isWebcamMuted,
	isMicrophoneMuted,
	isMicrophoneReady,
	isWebcamReady,
	recordingState,
	isShareScreenReady,
	isFullscreen,
	isHost,
} = defineProps({
	isWebcamMuted: {
		type: Boolean,
		required: true,
	},
	isMicrophoneMuted: {
		type: Boolean,
		required: true,
	},
	isMicrophoneReady: {
		type: Boolean,
		default: false,
	},
	isWebcamReady: {
		type: Boolean,
		default: false,
	},
	isShareScreenReady: {
		type: Boolean,
		default: false,
	},
	recordingState: {
		type: String,
		default: "unavailable",
		validator: () => ["paused", "active", "unavailable"],
	},
	isFullscreen: {
		type: Boolean,
		required: true,
	},
	isHost: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits([
	"toggleRecording",
	"toggleWebcam",
	"toggleMicrophone",
	"toggleFullscreen",
	"leave",
]);

// State for toolbar visibility
const isVisible = ref(true);
const timeoutId = ref(null);
const meetingTime = ref("00:00");
let startTime = null;

// Handle mouse movement to show/hide toolbar
const handleMouseMove = () => {
	isVisible.value = true;
	if (timeoutId.value) clearTimeout(timeoutId.value);

	timeoutId.value = setTimeout(() => {
		isVisible.value = false;
	}, 3000);
};

// Update meeting duration
const updateMeetingTime = () => {
	if (!startTime) return;

	const diff = new Date().getTime() - startTime.getTime();
	const minutes = Math.floor(diff / 60000);
	const seconds = Math.floor((diff % 60000) / 1000);

	meetingTime.value = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

// Remove fullscreen before leaving meeting
const handleBeforeLeaving = () => {
	if (isFullscreen) emit("toggleFullscreen");
};

// Handle leaving the meeting with confirmation
const handleLeave = () => {
	// We emit the leave event when the user confirms
	emit("leave");
};

const handleFullscreen = () => {
	emit("toggleFullscreen");
};

const showPlayInactive = computed(() => {
	return recordingState !== "unavailable";
});

const showRecording = computed(() => {
	return recordingState !== "unavailable";
});

const showRecordingActive = computed(() => {
	return recordingState === "active";
});

const showRecordingSection = computed(() => {
	return showRecording.value;
});

onMounted(() => {
	document.addEventListener("mousemove", handleMouseMove);
	startTime = new Date();
	setInterval(updateMeetingTime, 1000);
});

onUnmounted(() => {
	document.removeEventListener("mousemove", handleMouseMove);
	if (timeoutId.value) clearTimeout(timeoutId.value);
});
</script>

<template>
  <div
    class="fixed z-50 bottom-0 left-0 right-0 flex justify-center items-center p-4 transition-all duration-300"
    :class="[
      isVisible
        ? 'opacity-100 transform translate-y-0'
        : 'opacity-0 transform translate-y-16',
      'bg-gradient-to-t from-black/50 to-transparent',
    ]"
  >
    <div
      class="flex items-center bg-background/95 rounded-lg p-2 shadow-lg backdrop-blur-sm"
    >
      <!-- Left group: Meeting info -->
      <div class="flex items-center px-4">
        <div class="flex items-center gap-2">
          <Signal
            class="w-4 h-4"
            :class="
              isMicrophoneReady || isWebcamReady
                ? 'text-green-500'
                : 'text-yellow-50'
            "
          />
          <span class="text-sm text-muted-foreground font-mono">
            {{ meetingTime }}
          </span>
        </div>
      </div>

      <!-- Center group: Additional features -->
      <!-- <div class="flex items-center gap-2 ps-2 border-l">
        <Button variant="ghost" size="icon" v-show="isHost">
          <Users class="w-5 h-5" />
          <InfoTooltip
            text="Participants"
            buttonClass="inline-flex items-center m-0 p-0"
            iconClass="hidden"
          />
        </Button>

        <Button variant="ghost" size="icon">
          <MessageSquare class="w-5 h-5" />
          <InfoTooltip
            text="Chat"
            buttonClass="inline-flex items-center m-0 p-0"
            iconClass="hidden"
          />
        </Button>

        <Button variant="ghost" size="icon" v-show="isHost">
          <NotebookPen class="w-5 h-5" />
          <InfoTooltip
            text="NotebookPen"
            buttonClass="inline-flex items-center m-0 p-0"
            iconClass="hidden"
          />
        </Button>

        <Button variant="ghost" size="icon">
          <Settings class="w-5 h-5" />
          <InfoTooltip
            text="Settings"
            buttonClass="inline-flex items-center m-0 p-0"
            iconClass="hidden"
          />
        </Button>
      </div> -->

      <!-- Recording controls -->
      <div
        class="flex items-center gap-1 border-l px-2"
        v-if="showRecordingSection"
      >
        <Button
          v-if="showRecording"
          variant="ghost"
          size="icon"
          @click="() => emit('toggleRecording')"
        >
          <StopCircle
            class="w-5 h-5 text-red-500 rounded-full"
            :class="{ 'bg-red-500': showRecordingActive }"
          />
          <InfoTooltip
            text="Terminer l'enregistrement audio"
            buttonClass="inline-flex items-center m-0 p-0"
            iconClass="hidden"
          />
        </Button>

        <!-- <Button variant="ghost" size="icon">
          <Settings class="w-5 h-5" />
          <InfoTooltip
            text="Settings"
            buttonClass="inline-flex items-center m-0 p-0"
            iconClass="hidden"
          />
        </Button> -->
      </div>

      <!-- Right group: Main controls -->
      <div class="flex items-center gap-1 px-2 border-l">
        <Button variant="ghost" size="icon" @click="emit('toggleWebcam')">
          <component
            :is="!isWebcamMuted ? Video : VideoOff"
            class="w-5 h-5"
            :class="!isWebcamMuted ? 'text-primary' : 'text-destructive'"
          />
          <InfoTooltip
            :text="!isWebcamMuted ? 'Turn Off Camera' : 'Turn On Camera'"
            buttonClass="inline-flex items-center m-0 p-0"
            iconClass="hidden"
          />
        </Button>

        <Button variant="ghost" size="icon" @click="emit('toggleMicrophone')">
          <component
            :is="!isMicrophoneMuted ? Mic : MicOff"
            class="w-5 h-5"
            :class="!isMicrophoneMuted ? 'text-primary' : 'text-destructive'"
          />
          <InfoTooltip
            :text="
              !isMicrophoneMuted ? 'Turn Off Microphone' : 'Turn On Microphone'
            "
            buttonClass="inline-flex items-center m-0 p-0"
            iconClass="hidden"
          />
        </Button>

        <Button variant="ghost" size="icon" v-if="isShareScreenReady">
          <MonitorUp class="w-5 h-5" />
          <InfoTooltip
            text="Share Screen"
            buttonClass="inline-flex items-center m-0 p-0"
            iconClass="hidden"
          />
        </Button>

        <Button variant="ghost" size="icon" @click="handleFullscreen">
          <Fullscreen class="w-5 h-5" />

          <InfoTooltip
            text="Leave Meeting"
            buttonClass="inline-flex items-center m-0 p-0"
            iconClass="hidden"
          />
        </Button>

        <!-- Leave Meeting Button with Confirmation Dialog -->
        <ConfirmationDialog @confirm="handleLeave">
          <Button variant="destructive" size="icon" class="mx-2">
            <PhoneOff class="w-5 h-5" @click="handleBeforeLeaving"/>

            <InfoTooltip
              text="Leave Meeting"
              buttonClass="inline-flex items-center m-0 p-0"
              iconClass="hidden"
            />
          </Button>
        </ConfirmationDialog>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-background\/95 {
  background-color: hsl(var(--background) / 0.95);
}
</style>
