import { v4 as uuidv4 } from "uuid";

const DB_NAME = "callRecorderDB";
const STORE_NAME = "audioChunks";
const DB_VERSION = 1;

export class AudioStorageService {
	#meetingId = null;
	recordingId = null;

	constructor(meetingId) {
		this.db = null;
		this.#meetingId = meetingId;
		this.generateNextRecordingId();
	}

	async initDB() {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = (event) => {
				console.error("IndexedDB error:", event.target.error);
				reject(event.target.error);
			};

			request.onsuccess = (event) => {
				this.db = event.target.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = event.target.result;

				// Create object store for audio chunks
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
					store.createIndex("meetingId", "meetingId", { unique: false });
					store.createIndex("timestamp", "timestamp", { unique: false });
				}
			};
		});
	}

	async saveRecordingSession(metadata = {}) {
		await this.initDB();
		const transaction = this.db.transaction([STORE_NAME], "readwrite");
		const store = transaction.objectStore(STORE_NAME);

		const sessionData = {
			id: this.recordingId,
			meetingId: this.#meetingId,
			chunks: [],
			startTime: new Date().toISOString(),
			lastUpdated: new Date().toISOString(),
			metadata,
			completed: false,
		};

		return new Promise((resolve, reject) => {
			const request = store.add(sessionData);

			request.onsuccess = () => resolve(this.recordingId);
			request.onerror = (event) => reject(event.target.error);
		});
	}

	async addChunk(chunk, chunkIndex) {
		await this.initDB();

		// Convert blob to buffered array
		const bufferedChunk = await chunk.arrayBuffer();

		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			// Retrieve store and initiate db transaction
			const getRequest = store.get(this.recordingId);

			getRequest.onsuccess = (e) => {
				const sessionData = e.target.result;

				if (!sessionData) {
					reject(new Error(`Recording session ${this.recordingId} not found`));
					return;
				}

				sessionData.chunks.push({
					data: bufferedChunk,
					index: chunkIndex,
					timestamp: new Date().toISOString(),
				});

				// Add new chunks to DB
				const updateRequest = store.put(sessionData);
				updateRequest.onsuccess = () => resolve();
				updateRequest.onerror = (e) => reject(e.target.error);
			};

			getRequest.onerror = (e) => reject(e.target.error);
		});
	}

	async completeRecording() {
		await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const getRequest = store.get(this.recordingId);

			getRequest.onsuccess = (event) => {
				const sessionData = event.target.result;
				if (!sessionData) {
					reject(new Error(`Recording session ${this.recordingId} not found`));
					return;
				}

				sessionData.completed = true;
				sessionData.completedAt = new Date().toISOString();

				const updateRequest = store.put(sessionData);
				updateRequest.onsuccess = () => resolve();
				updateRequest.onerror = (e) => reject(e.target.error);
			};

			getRequest.onerror = (event) => reject(event.target.error);
		});
	}

	async getIncompleteRecordings(meetingId = null) {
		await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], "readonly");
			const store = transaction.objectStore(STORE_NAME);
			let request;

			if (meetingId) {
				const index = store.index("meetingId");
				request = index.getAll(meetingId);
			} else {
				request = store.getAll();
			}

			request.onsuccess = (event) => {
				const recordings = event.target.result.filter((r) => !r.completed);
				resolve(recordings);
			};

			request.onerror = (event) => reject(event.target.error);
		});
	}

	async getRecording(recordingId = null) {
		await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], "readonly");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get(recordingId ?? this.recordingId);

			request.onsuccess = (event) => {
				const recording = event.target.result;

				if (!recording) {
					resolve(null);
					return;
				}

				// Convert ArrayBuffers back to Blobs
				const blobChunks = recording.chunks.map((chunk) => chunk.data);
				const blob = new Blob(blobChunks, { type: "audio/webm" });
				const url = URL.createObjectURL(blob);
				resolve({ blob, url, recordingId });
			};

			request.onerror = (event) => reject(event.target.error);
		});
	}

	async deleteRecording(recordingId) {
		await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.delete(recordingId);

			request.onsuccess = () => resolve();
			request.onerror = (event) => reject(event.target.error);
		});
	}

	async cleanupOldRecordings(daysOld = 7) {
		await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], "readwrite");
			const store = transaction.objectStore(STORE_NAME);

			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - daysOld);
			const request = store.openCursor();
			let deletedCount = 0;

			request.onsuccess = (event) => {
				const cursor = event.target.result;
				if (cursor) {
					const recording = cursor.value;
					const lastUpdated = new Date(recording.lastUpdated);

					if (
						lastUpdated < cutoffDate ||
						(recording.completed &&
							recording.completedAt &&
							new Date(recording.completedAt) < cutoffDate)
					) {
						const deleteRequest = cursor.delete();
						deleteRequest.onsuccess = () => deletedCount++;
					}
					cursor.continue();
				} else {
					resolve(deletedCount);
				}
			};

			request.onerror = (event) => reject(event.target.error);
		});
	}

	setRecordingId(recordingId) {
		this.recordingId = recordingId;
	}

	generateNextRecordingId() {
		this.recordingId = `rec_${uuidv4()}`;
	}
}
