import { onBeforeUnmount, onMounted, watch } from "vue";
import AudioStorageService from "../../lib/audioStorageService";

export default function useCallRecorder(
	meetingId,
	canRecord = false,
	autoStart = false,
) {
	let tracks = null;
	let mediaRecorder = null;
	let audioContext = null;
	let mediaStreamAudioDestinationNode = null;
	let mediaStreamAudioSourceNode = null;
	let audioStorageService = null;
	let chunkCounter = 0;

	const isRecordingReady = ref(false);
	const isPaused = ref(true);
	const recordingUrl = ref(null);
	const recordingBlob = ref(null);
	const recordingId = ref(null);

	function initializeMediaRecorder() {
		if (!canRecord) return;

		const options = {
			mimeType: "audio/webm;codecs=opus",
			audioBitsPerSecond: 64000,
		};

		audioStorageService = new AudioStorageService();
		audioContext = new AudioContext();
		mediaStreamAudioDestinationNode = new MediaStreamAudioDestinationNode(
			audioContext,
		);

		try {
			mediaRecorder = new MediaRecorder(
				mediaStreamAudioDestinationNode.stream,
				options,
			);
		} catch (e) {
			console.log("Requested codec not supported, using default codec", e);
			mediaRecorder = new MediaRecorder(mediaStreamAudioDestinationNode.stream);
		}

		mediaStreamAudioSourceNode = new MediaStreamAudioSourceNode(audioContext, {
			mediaStream: new MediaStream(),
		});

		mediaRecorder.onstart = onStart;
		mediaRecorder.ondataavailable = onDataAvailable;
		mediaRecorder.onstop = onStop;
		isRecordingReady.value = true;
		console.log("MediaRecorder initialized", mediaRecorder);
	}

	async function onStart() {
		// Check if incomplete recording from this meeting can be restored
		try {
			const incompleteRecording =
				await audioStorageService.getIncompleteRecordings(meetingId);
			if (incompleteRecording && incompleteRecording.length > 0) {
				const recording = incompleteRecording[0];
				audioStorageService.setRecordingId(recording.id);
				chunkIndex = recording.chunks.length;
			} else {
				// Only create new entry if no incomplete recording found
				await audioStorageService.saveRecordingSession();
			}

			isPaused.value = false;
		} catch (err) {
			console.error("Error getting incomplete recordings", err);
		}
	}

	async function onDataAvailable(e) {
		if (e.data.size > 0) {
			const chunk = e.data;
			await audioStorageService.addChunk(chunk, chunkCounter++);
			console.log("Chunk added", chunkCounter, chunk);
		}
	}

	async function onStop(e) {
		// First, complete the recording and get the data
		try {
			// Close current recording session in DB
			await audioStorageService.completeRecording();

			// Retrieve recorded audio in a Blob
			const result = await audioStorageService.getRecording();
			isPaused.value = true;
			recordingUrl.value = result.url;
			recordingBlob.value = result.blob;
			recordingId.value = result.recordingId;
			chunkCounter = 0;
			audioStorageService.generateNextRecordingId();
			await uploadRecording();
		} catch (err) {
			console.error("unable to close and upload recording", err);
		}
	}

	function recoverIncompleteRecordings() {}

	function setTracks(tracks = []) {
		tracks.value = tracks;
	}

	function updateTracks(newTracks = [], oldTracks = []) {
		const tracks = newTracks.length > 0 ? newTracks : null;
		const mediaStream = new MediaStream(newTracks);
		const audioSourceNode = new MediaStreamAudioSourceNode(audioContext, {
			mediaStream,
		});

		mediaStreamAudioSourceNode.disconnect(mediaStreamAudioDestinationNode);
		audioSourceNode.connect(mediaStreamAudioDestinationNode);
		mediaStreamAudioSourceNode = audioSourceNode;

		oldTracks.forEach((track) => track.stop());
		console.log("Tracks updated", oldTracks, newTracks);
	}

	function startRecording() {
		if (!canRecord) return;

		return new Promise((resolve, reject) => {
			if (this.getRecordingState() === "recording") {
				reject(new Error("Recording already running"));
				return;
			}

			// Request data at 1 second intervals for more frequent chunks
			mediaRecorder.start(1000);
			isPaused.value = false;
			console.log("Recording started");
			resolve(true);
		});
	}

	function stopRecording() {
		if (!canRecord) return;

		return new Promise((resolve, reject) => {
			if (!mediaRecorder) {
				reject(new Error("No active recorder"));
				return;
			}

			mediaRecorder.stop();
			console.log("Recording stopped");
			resolve(true);
		});
	}

	function pauseRecording() {
		if (!canRecord) return;

		if (mediaRecorder && mediaRecorder.state === "recording") {
			mediaRecorder.pause();
			return true;
		}

		return false;
	}

	function resumeRecording() {
		if (!canRecord) return;

		if (mediaRecorder && mediaRecorder.state === "paused") {
			mediaRecorder.resume();
			return true;
		}

		return false;
	}

	function saveRecording() {
		if (recordingUrl.value) {
			const a = document.createElement("a");
			a.style.display = "none";
			a.href = recordingUrl.value;
			a.download = `call-recording-${new Date().toISOString()}.webm`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		}
	}

	function removeEventListener() {
		if (mediaRecorder) {
			mediaRecorder.ondataavailable = null;
			mediaRecorder.onstop = null;
			mediaRecorder.onstart = null;
			mediaRecorder.onresume = null;
		}
	}

	function getRecordingState() {
		return mediaRecorder ? mediaRecorder.state : "inactive";
	}

	function releaseResources() {
		if (mediaRecorder) {
			mediaRecorder.stream.getTracks().forEach((track) => track.stop());
			mediaRecorder = null;
		}

		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
	}

	watch(
		() => tracks.value,
		(newTracks, oldTracks) => updateTracks(newTracks, oldTracks),
		{ immediate: true },
	);

	onMounted(() => {
		try {
			initializeMediaRecorder();
		} catch (error) {
			console.error("Error initializing MediaRecorder:", error);
		}
	});

	onBeforeUnmount(() => {
		releaseResources();
	});

	return {
		recoverIncompleteRecordings,
		startRecording,
		stopRecording,
		pauseRecording,
		resumeRecording,
		saveRecording,
		setTracks,
		getRecordingState,
		addEventListener,
		removeEventListener,
		isRecordingReady,
	};
}
