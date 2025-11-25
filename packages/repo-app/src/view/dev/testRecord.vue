<script setup>
import { ref, onMounted, computed } from "vue";
import trpc from "@/trpc";

const streams = ref([]);
const isLoadingMedia = ref(false);
const mediaError = ref(null);
const meetingId = ref("meeting-123"); // Replace with actual meeting ID from your app context
const uploadStatus = ref(null);
const uploadError = ref(null);

const transcriptResult = ref(null);
const showTranscript = ref(false);

// Computed property to extract speakers from the transcript result
const speakers = computed(() => {
	if (!transcriptResult.value?.transcript?.json?.speakers) {
		return [];
	}
	return transcriptResult.value.transcript.json.speakers;
});

// Computed property to get plain transcript text
const plainTranscript = computed(() => {
	if (!transcriptResult.value?.transcript?.plain) {
		return "";
	}
	return transcriptResult.value.transcript.plain;
});

// Computed property to get summary if available
const summary = computed(() => {
	if (!transcriptResult.value?.summary) {
		return "";
	}
	return transcriptResult.value.summary;
});

const getMediaStreams = async () => {
	isLoadingMedia.value = true;
	mediaError.value = null;

	try {
		// Get user microphone
		const userStream = await navigator.mediaDevices.getUserMedia({
			audio: true,
			video: false,
		});

		// In a real call scenario, the second stream might come from another user
		// For demo, we're just using the single stream
		streams.value = [userStream];
	} catch (error) {
		console.error("Error accessing media devices.", error);
		mediaError.value = `Error accessing your microphone: ${error.message}`;
	} finally {
		isLoadingMedia.value = false;
	}
};

const handleRecordingStarted = () => {
	console.log("Recording started");
	uploadStatus.value = null;
	uploadError.value = null;
	showTranscript.value = false;
};

const handleRecordingStopped = (result) => {
	console.log("Recording stopped", result);
};

const handleRecordingSaved = (url) => {
	console.log("Recording saved", url);
};

const handleRecordingUploaded = (result) => {
	console.log("Recording uploaded successfully", result);
	transcriptResult.value = result;
	uploadStatus.value = `Recording uploaded successfully.`;
	showTranscript.value = true;
};

const handleError = (error) => {
	console.error("Recording error:", error);
	if (error.message.includes("Upload failed")) {
		uploadError.value = error.message;
		uploadStatus.value = null;
	}
};

const toggleTranscript = () => {
	showTranscript.value = !showTranscript.value;
};

onMounted(() => {
	getMediaStreams();
});
</script>

<template>
  <div class="call-app">
    <h1 class="text-2xl font-bold mb-4">Call Recording Demo</h1>

    <div v-if="isLoadingMedia" class="loading-media">
      Loading media devices...
    </div>

    <div v-else-if="mediaError" class="media-error">
      {{ mediaError }}
    </div>

    <div v-else>
      <p class="mb-2">Microphone access granted. You can start recording.</p>
      <p v-if="meetingId" class="meeting-id mb-4">
        Meeting ID: {{ meetingId }}
      </p>

      <CallRecorder
        :streams="streams"
        :meetingId="meetingId"
        @recording-started="handleRecordingStarted"
        @recording-stopped="handleRecordingStopped"
        @recording-saved="handleRecordingSaved"
        @recording-uploaded="handleRecordingUploaded"
        @error="handleError"
      />

      <div v-if="uploadStatus" class="upload-status success">
        {{ uploadStatus }}

        <hr />

        <json-debug :data="transcriptResult" :expanded="true" />

        <pre v-if="transcriptResult?.transcript?.json">
 {{ transcriptResult.transcript.plain }}</pre
        >
      </div>

      <div v-if="uploadError" class="upload-status error">
        {{ uploadError }}
      </div>

      <!-- Transcript Display Section -->
      <div v-if="transcriptResult" class="transcript-container mt-6">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-xl font-semibold">Transcript</h2>
          <button
            @click="toggleTranscript"
            class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            {{ showTranscript ? "Hide Transcript" : "Show Transcript" }}
          </button>
        </div>

        <div v-if="showTranscript">
          <!-- Our new MeetTranscriptDisplay component -->
          <MeetTranscriptDisplay
            :plainTranscript="plainTranscript"
            :speakers="speakers"
            :summary="summary"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.call-app {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.loading-media {
  padding: 12px;
  background-color: #e3f2fd;
  border-radius: 4px;
  margin-bottom: 16px;
}

.media-error {
  padding: 12px;
  background-color: #ffebee;
  border-radius: 4px;
  color: #d32f2f;
  margin-bottom: 16px;
}

.meeting-id {
  font-size: 14px;
  color: #666;
}

.upload-status {
  margin-top: 16px;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
}

.upload-status.success {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.upload-status.error {
  background-color: #ffebee;
  color: #d32f2f;
}

.transcript-container {
  border-top: 1px solid #eee;
  padding-top: 1rem;
}
</style>
