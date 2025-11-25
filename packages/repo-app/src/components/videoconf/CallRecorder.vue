<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from "vue";
import { AudioRecorderService } from "@/lib/audioRecorderService";
import { AudioStorageService } from "@/lib/audioStorageService";
import {
	Mic,
	MicOff,
	Pause,
	Play,
	Save,
	AlertCircle,
	Upload,
	RefreshCw,
	Trash2,
	FileText,
	Loader,
	User,
	Users,
	Copy,
	Download,
} from "lucide-vue-next";
import trpc from "@/trpc";

const props = defineProps({
	audioRecorderService: {
		type: AudioRecorderService,
		required: true,
	},
	audioStorageService: {
		type: AudioStorageService,
		required: true,
	},
	autoStart: {
		type: Boolean,
		default: false,
	},
	meetingId: {
		type: String,
		default: null,
	},
	participants: {
		type: Array,
		default: () => [],
	},
	isRecordingReady: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits([
	"recording-started",
	"recording-stopped",
	"recording-saved",
	"recording-uploaded",
	"recording-recovered",
	"transcription-ready",
	"error",
]);

const isRecording = ref(false);
const isPaused = ref(false);
const recordingUrl = ref(null);
const recordingBlob = ref(null);
const recordingId = ref(null);
const error = ref(null);
const isUploading = ref(false);
const isTranscribing = ref(false);
const incompleteRecordings = ref([]);
const isCheckingIncomplete = ref(false);
const showRecoveryOptions = ref(false);
const transcriptText = ref(null);
const transcriptFormat = ref("all");
const showTranscript = ref(false);
const speakerInfo = ref([]);
const copySuccess = ref(false);
const transcriptObject = ref(null);

const { audioRecorderService, audioStorageService } = props;
let chunkCounter = 0;

const hasIncompleteRecordings = computed(() => {
	return incompleteRecordings.value.length > 0;
});

// Format participants as speaker info
const formatSpeakerInfo = () => {
	if (!props.participants || props.participants.length === 0) {
		// No speakers when empty
		return [];
	}

	return props.participants.map((participant, index) => ({
		id: participant?.uid || index + 1,
		name: participant?.name || `Speaker ${index + 1}`,
		role: participant?.role || "Participant",
	}));
};

const onStart = async (e) => {
	console.log("Recording started event");
	// Check if incomplete recording from this meeting can be restored
	try {
		const incompleteRecording =
			await audioStorageService.getIncompleteRecordings(props.meetingId);
		if (incompleteRecording && incompleteRecording.length > 0) {
			const recording = incompleteRecording[0];
			audioStorageService.setRecordingId(recording.id);
			chunkIndex = recording.chunks.length;
		} else {
			// Only create new entry if no incomplete recording found
			await audioStorageService.saveRecordingSession();
		}
	} catch (err) {
		error.value = err.message;
		emit("error", err);
	}

	// Hide recovery options when starting a new recording
	showRecoveryOptions.value = false;
	showTranscript.value = false;
	transcriptText.value = null;

	// Update speaker info from current participants
	isRecording.value = true;
	isPaused.value = false;
	recordingUrl.value = null;
	recordingBlob.value = null;
	recordingId.value = null;
	error.value = null;
	emit("recording-started");
	console.log("started event");
};

const onDataAvailable = async (e) => {
	if (e.data.size > 0) {
		const chunk = event.data;
		await audioStorageService.addChunk(chunk, chunkCounter++);
		console.log("data event");
	}
};

const onStop = async (e) => {
	// First, complete the recording and get the data
	try {
		// Close current recording session in DB
		await audioStorageService.completeRecording();

		// Retrieve recorded audio in a Blob
		const result = await audioStorageService.getRecording();
		isRecording.value = false;
		isPaused.value = false;
		recordingUrl.value = result.url;
		recordingBlob.value = result.blob;
		recordingId.value = result.recordingId;
		chunkCounter = 0;
		audioStorageService.generateNextRecordingId();
		emit("recording-stopped", result);
		await uploadRecording();
	} catch (err) {
		error.value = err.message;
		emit("error", err);
	}

	// Reset recorder for next recording
	audioRecorderService.clearEventListeners();
};

const addEventListeners = () => {
	console.log("added event listeners");
	audioRecorderService.addEventListener("start", onStart);
	audioRecorderService.addEventListener("dataavailable", onDataAvailable);
	audioRecorderService.addEventListener("stop", onStop);
};

const startRecording = async () => {
	console.log("Starting recording...");

	try {
		await audioRecorderService.startRecording();
	} catch (err) {
		error.value = err.message;
		emit("error", err);
	}
};

const stopRecording = async () => {
	try {
		await audioRecorderService.stopRecording();
	} catch (err) {
		error.value = err.message;
		emit("error", err);
	}
};

const pauseRecording = () => {
	if (audioRecorderService.pauseRecording()) {
		isPaused.value = true;
	}
};

const resumeRecording = () => {
	if (audioRecorderService.resumeRecording()) {
		isPaused.value = false;
	}
};

const saveRecording = () => {
	if (recordingUrl.value) {
		const a = document.createElement("a");
		a.style.display = "none";
		a.href = recordingUrl.value;
		a.download = `call-recording-${new Date().toISOString()}.webm`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		emit("recording-saved", recordingUrl.value);
	}
};

const downloadSingleFormat = (formatName, content, extension) => {
	const filename = `transcript-${props.meetingId}-${formatName}-${new Date().toISOString()}.${extension}`;
	const blob = new Blob([content], { type: "text/plain" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.style.display = "none";
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
};

const downloadTranscript = () => {
	if (!transcriptText.value) return;

	if (transcriptFormat.value === "all" && transcriptObject.value) {
		// For "all" format, create a zip file with all formats
		// Since we don't have a zip library in this example, we'll download each format individually

		// Download plain text
		if (transcriptObject.value.plain) {
			downloadSingleFormat("plain", transcriptObject.value.plain, "txt");
		}

		// Download SRT
		if (transcriptObject.value.srt) {
			downloadSingleFormat("srt", transcriptObject.value.srt, "srt");
		}

		// Download VTT
		if (transcriptObject.value.vtt) {
			downloadSingleFormat("vtt", transcriptObject.value.vtt, "vtt");
		}

		// Download JSON
		if (transcriptObject.value.json) {
			downloadSingleFormat("json", transcriptObject.value.json, "json");
		}
	} else {
		// Original behavior for single format
		const extension =
			transcriptFormat.value === "plain" ? "txt" : transcriptFormat.value;
		const filename = `transcript-${props.meetingId}-${new Date().toISOString()}.${extension}`;
		const blob = new Blob([transcriptText.value], { type: "text/plain" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.style.display = "none";
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
};

const copyTranscriptToClipboard = async () => {
	if (!transcriptText.value) return;

	try {
		await navigator.clipboard.writeText(transcriptText.value);
		copySuccess.value = true;
		setTimeout(() => {
			copySuccess.value = false;
		}, 2000);
	} catch (err) {
		console.error("Failed to copy transcript", err);
	}
};

const uploadRecording = async () => {
	if (!recordingBlob.value || !props.meetingId) {
		error.value = "Cannot upload: Missing recording data or meeting ID";
		emit("error", new Error(error.value));
		return;
	}

	isUploading.value = true;
	isTranscribing.value = true;
	error.value = null;
	transcriptText.value = null;
	showTranscript.value = false;

	try {
		// Convert blob to base64
		const base64Data = await blobToBase64(recordingBlob.value);

		// Send to server using tRPC
		const result = await trpc.saveMeetAudio.mutate({
			id: props.meetingId,
			audioData: base64Data,
			mimeType: recordingBlob.value.type,
			fileName: `call-recording-${new Date().toISOString()}.webm`,
			speakerInfo: speakerInfo.value, // This is the good value, but is wrong in transcript
			transcriptFormat: transcriptFormat.value,
		});

		// After successful upload, delete the local copy if we have a recording ID
		if (recordingId.value) {
			await audioStorageService.deleteRecording(recordingId.value);
		}

		// Display transcript if available
		if (result.success && result.transcript) {
			// Store the entire transcript object
			transcriptObject.value = result.transcript;

			// Set the display text based on the current format
			if (transcriptFormat.value === "all") {
				// For "all" format, display the plain text version by default
				transcriptText.value = result.transcript.plain || result.transcript.all;
			} else {
				// For specific format, display that format
				transcriptText.value = result.transcript[transcriptFormat.value];
			}

			showTranscript.value = true;
			emit("transcription-ready", result.transcript);
		}

		emit("recording-uploaded", result);
		isUploading.value = false;
		isTranscribing.value = false;

		return result;
	} catch (err) {
		error.value = `Upload failed: ${err.message}`;
		emit("error", err);
		isUploading.value = false;
		isTranscribing.value = false;
		return { success: false, error: err.message };
	}
};

// Helper function to convert blob to base64
const blobToBase64 = (blob) => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const base64String = reader.result.split(",")[1];
			resolve(base64String);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
};

const checkForIncompleteRecordings = async () => {
	isCheckingIncomplete.value = true;
	try {
		const incomplete = await audioStorageService.getIncompleteRecordings(
			props.meetingId,
		);
		incompleteRecordings.value = incomplete;

		// If there are incomplete recordings, show recovery options
		if (incomplete.length > 0) {
			showRecoveryOptions.value = true;
		}
	} catch (err) {
		console.error("Error checking for incomplete recordings:", err);
	} finally {
		isCheckingIncomplete.value = false;
	}
};

const recoverRecording = async (recordingToRecover) => {
	try {
		const recoveryResult = await audioStorageService.getRecording(
			recordingToRecover.id,
		);

		if (recoveryResult) {
			recordingUrl.value = recoveryResult.url;
			recordingBlob.value = recoveryResult.blob;
			recordingId.value = recoveryResult.recordingId;
			showRecoveryOptions.value = false;
			emit("recording-recovered", recoveryResult);

			return true;
		}

		return false;
	} catch (err) {
		error.value = `Recovery failed: ${err.message}`;
		emit("error", err);
		return false;
	}
};

const deleteIncompleteRecording = async (recordingToDelete) => {
	try {
		await audioStorageService.deleteRecording(recordingToDelete.id);

		// Remove from the list
		incompleteRecordings.value = incompleteRecordings.value.filter(
			(r) => r.id !== recordingToDelete.id,
		);

		// Hide recovery options if no more incomplete recordings
		if (incompleteRecordings.value.length === 0) {
			showRecoveryOptions.value = false;
		}

		return true;
	} catch (err) {
		error.value = `Delete failed: ${err.message}`;
		emit("error", err);
		return false;
	}
};

const cleanupOldRecordings = async () => {
	try {
		// Default to cleaning up recordings older than 7 days
		const result = await audioStorageService.cleanupOldRecordings(7);
		console.log(`Cleaned up ${result.deletedCount} old recordings`);
		return result;
	} catch (err) {
		console.error("Error cleaning up old recordings:", err);
		return { success: false, error: err.message };
	}
};

// Toggle transcript visibility
const toggleTranscript = () => {
	showTranscript.value = !showTranscript.value;
};

// Change transcript format
const changeTranscriptFormat = (format) => {
	transcriptFormat.value = format;
	// If we already have a recording, try to regenerate the transcript
	if (recordingBlob.value && props.meetingId) {
		uploadRecording();
	}
};

// Watch for changes in participants to update speaker info
watch(
	() => props.participants,
	() => (speakerInfo.value = formatSpeakerInfo()),
	{ deep: true },
);

watch(
	() => props.isRecordingReady,
	async () => {
		if (props.isRecordingReady && props.autoStart && !isRecording.value) {
			await startRecording();
		}
	},
	{ immediate: true },
);

onMounted(async () => {
	// Init recorder
	audioRecorderService.initialize();
	console.log("init audio service");

	// Add audio record event listeners
	audioRecorderService.addEventListeners(onStart, onDataAvailable, onStop);

	// Check if incomplete recordings exist in local DB
	// Clean up old recordings
	await Promise.all([checkForIncompleteRecordings(), cleanupOldRecordings()]);
});

onUnmounted(async () => {
	// Check if we're currently recording
	if (isRecording.value) {
		await stopRecording();
	}

	// Always ensure proper cleanup
	try {
		audioRecorderService.cleanup();
	} catch (err) {
		console.error("Error during cleanup:", err);
	}
});
</script>

<template>
  <div class="call-recorder">
    <div v-if="error" class="recorder-error">
      <AlertCircle class="error-icon" size="16" />
      <span>{{ error }}</span>
    </div>

    <!-- Recovery options for incomplete recordings -->
    <div
      v-if="showRecoveryOptions && hasIncompleteRecordings"
      class="recovery-options"
    >
      <h3 class="recovery-title">
        Found incomplete recording{{
          incompleteRecordings.length > 1 ? "s" : ""
        }}
      </h3>
      <p class="recovery-description">
        We found {{ incompleteRecordings.length }} incomplete recording{{
          incompleteRecordings.length > 1 ? "s" : ""
        }}
        from a previous session. Would you like to recover?
      </p>

      <div
        v-for="recording in incompleteRecordings"
        :key="recording.id"
        class="incomplete-recording"
      >
        <div class="recording-info">
          <span class="recording-date">
            Started: {{ new Date(recording.startTime).toLocaleString() }}
          </span>
          <span class="recording-duration">
            Duration:
            {{
              Math.round(
                (new Date(recording.lastUpdated) -
                  new Date(recording.startTime)) /
                  1000
              )
            }}
            seconds
          </span>
        </div>

        <div class="recording-actions">
          <button
            @click="recoverRecording(recording)"
            class="recorder-button recover-button"
            title="Recover this recording"
          >
            <RefreshCw size="16" />
            <span>Recover</span>
          </button>

          <button
            @click="deleteIncompleteRecording(recording)"
            class="recorder-button delete-button"
            title="Delete this recording"
          >
            <Trash2 size="16" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <button
        @click="showRecoveryOptions = false"
        class="recorder-button dismiss-button"
      >
        Dismiss
      </button>
    </div>

    <!-- Transcript display section -->
    <div v-if="transcriptText" class="transcript-section">
      <div class="transcript-header" @click="toggleTranscript">
        <FileText size="16" />
        <h3 class="transcript-title">Transcript</h3>
        <div class="transcript-actions">
          <div class="format-selector">
            <label for="transcript-format">Format:</label>
            <select
              id="transcript-format"
              v-model="transcriptFormat"
              @change="changeTranscriptFormat(transcriptFormat)"
            >
              <option value="all">All format</option>
              <option value="plain">Plain Text</option>
              <option value="srt">SRT</option>
              <option value="vtt">VTT</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <button
            @click.stop="copyTranscriptToClipboard"
            class="recorder-button icon-button"
            title="Copy transcript"
          >
            <Copy size="16" />
            <span v-if="copySuccess" class="copy-success">Copied!</span>
          </button>
          <button
            @click.stop="downloadTranscript"
            class="recorder-button icon-button"
            title="Download transcript"
          >
            <Download size="16" />
          </button>
          <button
            class="recorder-button toggle-button"
            :title="showTranscript ? 'Hide transcript' : 'Show transcript'"
          >
            {{ showTranscript ? "Hide" : "Show" }}
          </button>
        </div>
      </div>
      <div v-if="showTranscript" class="transcript-content">
        <pre>{{ transcriptText }}</pre>
      </div>
    </div>

    <!-- Speaker info section -->
    <div v-if="speakerInfo.length > 0" class="speaker-info-section">
      <div class="speaker-info-header">
        <Users size="16" />
        <h3 class="speaker-info-title">Speakers</h3>
      </div>
      <div class="speaker-info-content">
        <div
          v-for="speaker in speakerInfo"
          :key="speaker.id"
          class="speaker-item"
        >
          <User size="14" />
          <span>{{ speaker.name }}</span>
          <span v-if="speaker.role" class="speaker-role"
            >({{ speaker.role }})</span
          >
        </div>
      </div>
    </div>

    <div class="recorder-controls">
      <button
        v-if="!isRecording"
        @click="startRecording"
        class="recorder-button start-button"
        title="Start Recording"
      >
        <Mic size="20" />
        <span>Record</span>
      </button>

      <template v-else>
        <button
          v-if="!isPaused"
          @click="pauseRecording"
          class="recorder-button pause-button"
          title="Pause Recording"
        >
          <Pause size="20" />
          <span>Pause</span>
        </button>

        <button
          v-else
          @click="resumeRecording"
          class="recorder-button resume-button"
          title="Resume Recording"
        >
          <Play size="20" />
          <span>Resume</span>
        </button>

        <button
          @click="stopRecording"
          class="recorder-button stop-button"
          title="Stop Recording"
        >
          <MicOff size="20" />
          <span>Stop</span>
        </button>
      </template>

      <button
        v-if="recordingUrl"
        @click="saveRecording"
        class="recorder-button save-button"
        title="Save Recording"
      >
        <Save size="20" />
        <span>Save</span>
      </button>

      <button
        v-if="recordingBlob && props.meetingId"
        @click="uploadRecording"
        class="recorder-button upload-button"
        :disabled="isUploading"
        title="Upload & Transcribe"
      >
        <template v-if="isUploading || isTranscribing">
          <Loader size="20" class="spin" />
          <span>{{ isTranscribing ? "Transcribing..." : "Uploading..." }}</span>
        </template>
        <template v-else>
          <Upload size="20" />
          <span>Transcribe</span>
        </template>
      </button>

      <button
        v-if="!isRecording && !isCheckingIncomplete"
        @click="checkForIncompleteRecordings"
        class="recorder-button check-button"
        :disabled="isCheckingIncomplete"
        title="Check for incomplete recordings"
      >
        <RefreshCw size="20" :class="{ spin: isCheckingIncomplete }" />
        <span>{{
          isCheckingIncomplete ? "Checking..." : "Check Incomplete"
        }}</span>
      </button>
    </div>

    <audio
      v-if="recordingUrl"
      controls
      :src="recordingUrl"
      class="recording-preview"
    ></audio>
  </div>
</template>

<style scoped>
.call-recorder {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recorder-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.recorder-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 4px;
  border: none;
  background-color: #f1f1f1;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.recorder-button:hover {
  background-color: #e0e0e0;
}

.recorder-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-button {
  padding: 4px 8px;
}

.start-button {
  background-color: #4caf50;
  color: white;
}

.start-button:hover {
  background-color: #43a047;
}

.stop-button {
  background-color: #f44336;
  color: white;
}

.stop-button:hover {
  background-color: #e53935;
}

.pause-button,
.resume-button {
  background-color: #2196f3;
  color: white;
}

.pause-button:hover,
.resume-button:hover {
  background-color: #1e88e5;
}

.save-button {
  background-color: #ff9800;
  color: white;
}

.save-button:hover {
  background-color: #fb8c00;
}

.upload-button {
  background-color: #673ab7;
  color: white;
}

.upload-button:hover {
  background-color: #5e35b1;
}

.check-button {
  background-color: #009688;
  color: white;
}

.check-button:hover {
  background-color: #00897b;
}

.recover-button {
  background-color: #00bcd4;
  color: white;
}

.recover-button:hover {
  background-color: #00acc1;
}

.delete-button {
  background-color: #f44336;
  color: white;
}

.delete-button:hover {
  background-color: #e53935;
}

.dismiss-button {
  background-color: #9e9e9e;
  color: white;
}

.dismiss-button:hover {
  background-color: #757575;
}

.toggle-button {
  background-color: #607d8b;
  color: white;
}

.toggle-button:hover {
  background-color: #546e7a;
}

.recorder-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background-color: #ffebee;
  border-radius: 4px;
  color: #d32f2f;
  font-size: 14px;
}

.recording-preview {
  width: 100%;
  margin-top: 8px;
}

.recovery-options {
  background-color: #e3f2fd;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 12px;
}

.recovery-title {
  font-size: 16px;
  margin: 0 0 8px 0;
}

.recovery-description {
  font-size: 14px;
  margin: 0 0 12px 0;
}

.incomplete-recording {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #fff;
  border-radius: 4px;
  margin-bottom: 8px;
}

.recording-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recording-date,
.recording-duration {
  font-size: 12px;
}

.recording-actions {
  display: flex;
  gap: 8px;
}

.transcript-section {
  margin-top: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.transcript-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #f5f5f5;
  cursor: pointer;
  gap: 8px;
}

.transcript-title {
  margin: 0;
  font-size: 16px;
  flex-grow: 1;
}

.transcript-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.format-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.format-selector select {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.transcript-content {
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  background-color: #fff;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.transcript-content pre {
  margin: 0;
  font-family: inherit;
  white-space: pre-wrap;
}

.speaker-info-section {
  margin-top: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.speaker-info-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #f5f5f5;
  gap: 8px;
}

.speaker-info-title {
  margin: 0;
  font-size: 16px;
}

.speaker-info-content {
  padding: 8px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.speaker-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #f1f1f1;
  border-radius: 4px;
  font-size: 14px;
}

.speaker-role {
  color: #757575;
  font-size: 12px;
}

.spin {
  animation: spin 1s linear infinite;
}

.copy-success {
  position: absolute;
  background-color: #4caf50;
  color: white;
  padding: 2px 4px;
  border-radius: 2px;
  font-size: 12px;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  animation: fadeOut 2s forwards;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@keyframes fadeOut {
  0% {
    opacity: 1;
  }

  80% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}
</style>
