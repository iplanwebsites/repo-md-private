export class AudioRecorderService {
	// Private static instance variable
	static #instance = null;

	#streams = [];
	#mediaRecorder = null;
	#audioContext = null;
	#mediaStreamAudioDestinationNode = null;
	#mediaStreamAudioSourceNode = null;
	#isDebugMode = false;

	constructor(debug = false) {
		// Ensure this constructor is only used once
		if (AudioRecorderService.#instance) {
			return AudioRecorderService.#instance;
		}

		this.#isDebugMode = debug || true;
		AudioRecorderService.#instance = this;

		if (this.#isDebugMode) {
			this.#log("🚀 Initializing AudioRecorderService (Singleton)");
		}
	}

	// Static method to get the instance
	static getInstance(debug = false) {
		if (!AudioRecorderService.#instance) {
			AudioRecorderService.#instance = new AudioRecorderService(debug);
		}
		return AudioRecorderService.#instance;
	}

	// Internal logging method with emoji for clarity
	#log(message, data = null) {
		if (!this.#isDebugMode) return;

		const timestamp = new Date().toISOString();
		if (data) {
			console.log(`${timestamp} ${message}:`, data);
		} else {
			console.log(`${timestamp} ${message}`);
		}
	}

	async initializeMediaRecorder() {
		const options = {
			mimeType: "audio/webm;codecs=opus",
			audioBitsPerSecond: 64000,
		};

		this.#audioContext = new AudioContext();
		this.#mediaStreamAudioDestinationNode = new MediaStreamAudioDestinationNode(
			this.#audioContext,
		);

		try {
			this.#mediaRecorder = new MediaRecorder(
				this.#mediaStreamAudioDestinationNode.stream,
				options,
			);
		} catch (e) {
			this.#log("Requested codec not supported, using default codec", e);
			this.#mediaRecorder = new MediaRecorder(
				this.#mediaStreamAudioDestinationNode.stream,
			);
		}
	}

	addAudioStream(stream) {
		// Add stream to available streams
		this.#streams.push(stream);
		this.#updateAudioStream();
		this.#log("Added new audio stream", stream);
	}

	removeAudioStream(oldStream) {
		this.#streams = this.#streams.filter(
			(stream) => stream.id !== oldStream.id,
		);
		this.#updateAudioStream();
		this.#log("Removed audio stream", oldStream);
	}

	#updateAudioStream() {
		// Create new Source Node
		const mediaStream = new MediaStream(
			this.#streams.map((stream) => stream.clone()),
		);

		const mediaStreamAudioSourceNode = new MediaStreamAudioSourceNode(
			this.#audioContext,
			{ mediaStream: mediaStream },
		);

		// Connect new stream and disconnect old stream
		if (this.#mediaStreamAudioSourceNode) {
			this.#mediaStreamAudioSourceNode.disconnect();
		}

		mediaStreamAudioSourceNode.connect(this.#mediaStreamAudioDestinationNode);
		this.#mediaStreamAudioSourceNode = mediaStreamAudioSourceNode;
	}

	async startRecording() {
		return new Promise((resolve, reject) => {
			if (!this.isRecordingReady()) {
				reject(new Error("No streams provided for recording"));
				return;
			}

			if (this.getRecordingState() === "recording") {
				reject(new Error("Recording already running"));
				return;
			}

			// Request data at 1 second intervals for more frequent chunks
			this.#mediaRecorder.start(1000);
			this.#log("Recording started");
			resolve(true);
		});
	}

	stopRecording() {
		return new Promise((resolve, reject) => {
			if (!this.#mediaRecorder) {
				reject(new Error("No active recorder"));
				return;
			}

			this.#mediaRecorder.stop();
			this.#log("Recording stopped");
			resolve(true);
		});
	}

	pauseRecording() {
		if (this.#mediaRecorder && this.#mediaRecorder.state === "recording") {
			this.#mediaRecorder.pause();
			return true;
		}

		return false;
	}

	resumeRecording() {
		if (this.#mediaRecorder && this.#mediaRecorder.state === "paused") {
			this.#mediaRecorder.resume();
			return true;
		}

		return false;
	}

	addEventListener(event, callback = () => {}) {
		if (this.#mediaRecorder) {
			this.#mediaRecorder.addEventListener(event, callback);
		}
	}
	clearEventListeners() {
		if (!this.#mediaRecorder) {
			this.#log("⚠️ Cannot clear event listeners: mediaRecorder is null");
			return;
		}

		try {
			this.#mediaRecorder.ondataavailable = null;
			this.#mediaRecorder.onstop = null;
			this.#mediaRecorder.onstart = null;
			this.#mediaRecorder.onresume = null;

			this.#log("🧹 Event listeners cleared");
		} catch (err) {
			this.#log("❌ Error clearing event listeners:", err);
		}
	}

	isRecordingReady() {
		return this.#streams.length > 0;
	}

	getRecordingState() {
		return this.#mediaRecorder ? this.#mediaRecorder.state : "inactive";
	}

	cleanup() {
		this.#log("🧹 Cleaning up AudioRecorderService resources");

		// Use a series of independent try/catch blocks to ensure partial cleanup still works

		// 1. Stop recording if active
		try {
			if (this.#mediaRecorder && this.#mediaRecorder.state === "recording") {
				this.#mediaRecorder.stop();
			}
		} catch (err) {
			this.#log("⚠️ Error stopping mediaRecorder", err);
		}

		// 2. Disconnect audio nodes
		try {
			if (this.#mediaStreamAudioSourceNode) {
				this.#mediaStreamAudioSourceNode.disconnect();
			}
		} catch (err) {
			this.#log("⚠️ Error disconnecting audio nodes", err);
		}

		// 3. Stop all tracks in all streams
		try {
			for (const stream of this.#streams) {
				if (stream && typeof stream.getTracks === "function") {
					try {
						const tracks = stream.getTracks();
						for (const track of tracks) {
							track.stop();
						}
					} catch (trackErr) {
						this.#log("⚠️ Error stopping track", trackErr);
					}
				}
			}
		} catch (err) {
			this.#log("⚠️ Error stopping stream tracks", err);
		}

		// 4. Close audio context last (after disconnecting nodes)
		try {
			if (this.#audioContext && this.#audioContext.state !== "closed") {
				this.#audioContext.close();
			}
		} catch (err) {
			this.#log("⚠️ Error closing audio context", err);
		}

		// 5. Clear all event listeners - do this AFTER stopping recording
		try {
			if (this.#mediaRecorder) {
				this.#mediaRecorder.ondataavailable = null;
				this.#mediaRecorder.onstop = null;
				this.#mediaRecorder.onstart = null;
				this.#mediaRecorder.onresume = null;
			}
		} catch (err) {
			this.#log("⚠️ Error clearing event listeners", err);
		}

		// Finally, clear arrays and references
		this.#streams = [];
		this.#mediaRecorder = null;
		this.#audioContext = null;
		this.#mediaStreamAudioDestinationNode = null;
		this.#mediaStreamAudioSourceNode = null;

		this.#log("✅ AudioRecorderService cleanup complete");
		return true;
	}

	// Method to dispose of all resources when the service is no longer needed
	dispose() {
		this.cleanup();
		// Remove any other global listeners or references if needed
	}
}

// Create and export a default instance
export const audioRecorderService = AudioRecorderService.getInstance();
