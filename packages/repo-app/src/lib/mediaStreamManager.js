// MediaStreamManager.js
export class MediaStreamManager {
	static #instance = null;

	#streams = [];
	#debug = true;

	constructor(debug = true) {
		if (MediaStreamManager.#instance) {
			return MediaStreamManager.#instance;
		}

		this.#debug = debug;
		MediaStreamManager.#instance = this;

		if (this.#debug) {
			console.log("MediaStreamManager initialized");
		}
	}

	static getInstance(debug = true) {
		if (!MediaStreamManager.#instance) {
			MediaStreamManager.#instance = new MediaStreamManager(debug);
		}
		return MediaStreamManager.#instance;
	}

	/**
	 * Add a media stream to the manager
	 * @param {MediaStream} stream - The stream to manage
	 * @returns {MediaStream} The added stream
	 */
	addStream(stream) {
		if (!stream) return null;

		this.#streams.push(stream);

		if (this.#debug) {
			console.log(`💧💧 Stream added, total streams: ${this.#streams.length}`);
		}

		return stream;
	}

	/**
	 * Remove a specific stream
	 * @param {MediaStream} stream - The stream to remove
	 */
	removeStream(stream) {
		if (!stream) return;

		this.#streams = this.#streams.filter((s) => s !== stream);

		// Stop all tracks
		try {
			stream.getTracks().forEach((track) => track.stop());
		} catch (err) {
			if (this.#debug) {
				console.error("💧💧 Error stopping tracks:", err);
			}
		}

		if (this.#debug) {
			console.log(
				`💧💧 Stream removed, remaining streams: ${this.#streams.length}`,
			);
		}
	}

	/**
	 * Get all managed streams
	 * @returns {Array<MediaStream>} All managed streams
	 */
	getStreams() {
		return [...this.#streams];
	}

	/**
	 * Stop and clear all streams
	 */
	cleanup() {
		if (this.#debug) {
			console.log(
				`💧💧🧹 🧹🧹 🧹🧹 🧹  Cleaning up LOCAL MEDIA ${this.#streams.length} streams`,
			);
		}

		// Stop all tracks in all streams
		this.#streams.forEach((stream) => {
			try {
				stream.getTracks().forEach((track) => track.stop());
			} catch (err) {
				if (this.#debug) {
					console.error("Error stopping tracks:", err);
				}
			}
		});

		// Clear the array
		this.#streams = [];

		if (this.#debug) {
			console.log("💧💧 All streams cleared");
		}
	}

	/**
	 * Dispose of all resources
	 */
	dispose() {
		this.cleanup();
		MediaStreamManager.#instance = null;

		if (this.#debug) {
			console.log("💧💧 MediaStreamManager disposed");
		}
	}
}

// Create and export default instance
export const mediaStreamManager = MediaStreamManager.getInstance();
