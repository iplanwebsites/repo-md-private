import { v4 as uuidv4 } from "uuid";
import { AudioStorageService } from "./audioStorageService";

export const useCallRecorder = () => {
	let mediaRecorder = null;
	let recordedChunks = [];
	let currentRecordingId = null;
	let chunkCounter = 0;
	let dataAvailableListener = null;

	const generateRecordingId = () => {
		return `rec_${uuidv4()}`;
	};

	const startRecording = async (streams, meetingId = null) => {
		if (!streams || streams.length === 0) {
			throw new Error("No streams provided for recording");
		}

		try {
			// Combine multiple streams if needed
			const combinedStream = new MediaStream([...streams]);

			// Set options to get better audio quality
			const options = {
				mimeType: "audio/webm;codecs=opus",
				audioBitsPerSecond: 64000,
			};

			// Reset state
			recordedChunks = [];
			chunkCounter = 0;

			// Generate a unique recording ID
			currentRecordingId = generateRecordingId();

			// Initialize recording session in storage
			await audioStorage.saveRecordingSession(meetingId, currentRecordingId, {
				streams: streams.length,
				mimeType: "audio/webm",
				started: new Date().toISOString(),
			});

			// Try with specified options first, fallback to default if not supported
			try {
				mediaRecorder = new MediaRecorder(combinedStream, options);
			} catch (e) {
				console.warn("Requested codec not supported, using default codec", e);
				mediaRecorder = new MediaRecorder(combinedStream);
			}

			// Remove previous listener if exists
			if (dataAvailableListener) {
				mediaRecorder.removeEventListener(
					"dataavailable",
					dataAvailableListener,
				);
			}

			// Define and add the new listener
			dataAvailableListener = async (event) => {
				if (event.data.size > 0) {
					const chunkIndex = chunkCounter++;
					recordedChunks.push(event.data);

					// Save chunk to IndexedDB
					try {
						await audioStorage.addChunk(
							currentRecordingId,
							event.data,
							chunkIndex,
						);
					} catch (err) {
						console.error("Error saving audio chunk to IndexedDB:", err);
					}
				}
			};

			mediaRecorder.addEventListener("dataavailable", dataAvailableListener);

			// Request data at 1 second intervals for more frequent chunks
			mediaRecorder.start(1000);
			return true;
		} catch (error) {
			console.error("Error starting recording:", error);
			return false;
		}
	};

	const stopRecording = async () => {
		return new Promise((resolve, reject) => {
			if (!mediaRecorder) {
				reject(new Error("No active recording"));
				return;
			}

			mediaRecorder.onstop = async () => {
				try {
					// Mark recording as completed in storage
					if (currentRecordingId) {
						await audioStorage.completeRecording(currentRecordingId);
					}

					const blob = new Blob(recordedChunks, { type: "audio/webm" });
					const url = URL.createObjectURL(blob);
					resolve({
						blob,
						url,
						mimeType: blob.type,
						recordingId: currentRecordingId,
					});
				} catch (err) {
					console.error("Error completing recording in storage:", err);

					// Still resolve with the recording even if storage fails
					const blob = new Blob(recordedChunks, { type: "audio/webm" });
					const url = URL.createObjectURL(blob);
					resolve({
						blob,
						url,
						mimeType: blob.type,
						recordingId: currentRecordingId,
						storageError: err.message,
					});
				}
			};

			mediaRecorder.stop();
		});
	};

	const pauseRecording = () => {
		if (mediaRecorder && mediaRecorder.state === "recording") {
			mediaRecorder.pause();
			return true;
		}
		return false;
	};

	const resumeRecording = () => {
		if (mediaRecorder && mediaRecorder.state === "paused") {
			mediaRecorder.resume();
			return true;
		}
		return false;
	};

	const getRecordingState = () => {
		return mediaRecorder ? mediaRecorder.state : "inactive";
	};

	const getRecordingBlob = () => {
		if (recordedChunks.length === 0) {
			return null;
		}
		return new Blob(recordedChunks, { type: "audio/webm" });
	};

	const getIncompleteRecordings = async (meetingId = null) => {
		try {
			return await audioStorage.getIncompleteRecordings(meetingId);
		} catch (err) {
			console.error("Error fetching incomplete recordings:", err);
			return [];
		}
	};

	const recoverRecording = async (recordingId) => {
		try {
			const recording = await audioStorageService.getRecording(recordingId);
			if (!recording) {
				return null;
			}

			// Restore chunks from storage
			recordedChunks = recording.chunksAsBlobs;
			currentRecordingId = recordingId;

			// Create a blob and URL from the chunks
			const blob = new Blob(recordedChunks, { type: "audio/webm" });
			const url = URL.createObjectURL(blob);

			return {
				blob,
				url,
				mimeType: "audio/webm",
				recordingId,
				metadata: recording.metadata,
				recoveredAt: new Date().toISOString(),
				startTime: recording.startTime,
				duration: new Date() - new Date(recording.startTime),
			};
		} catch (err) {
			console.error("Error recovering recording:", err);
			return null;
		}
	};

	const deleteRecording = async (recordingId) => {
		try {
			await audioStorage.deleteRecording(recordingId);
			return true;
		} catch (err) {
			console.error("Error deleting recording:", err);
			return false;
		}
	};

	const cleanupOldRecordings = async (daysOld = 7) => {
		try {
			const count = await audioStorage.cleanupOldRecordings(daysOld);
			return { success: true, deletedCount: count };
		} catch (err) {
			console.error("Error cleaning up old recordings:", err);
			return { success: false, error: err.message };
		}
	};

	return {
		startRecording,
		stopRecording,
		pauseRecording,
		resumeRecording,
		getRecordingState,
		getRecordingBlob,
		getIncompleteRecordings,
		recoverRecording,
		deleteRecording,
		cleanupOldRecordings,
	};
};
