// agoraService.js

/// Comprehensive service managing both RTC and RTM functionality
// Uses singleton pattern with truly lazy initialization (dynamic imports)

export class AgoraService {
	// Private static instance variable
	static #instance = null;

	// Private module loaders
	#AgoraRTC = null;
	#AgoraRTM = null;

	// Load state
	#isLoading = false;
	#loadPromise = null;

	constructor() {
		// Ensure this constructor is only used once
		if (AgoraService.#instance) {
			return AgoraService.#instance;
		}

		// RTC properties
		this.client = null;
		this.localTracks = [];
		this.isInitialized = false;

		// RTM properties
		this.rtmClient = null;
		this.activeChannels = new Set();

		// Store the instance
		AgoraService.#instance = this;

		console.log("🚀 AgoraService instance created (modules not loaded yet)");
	}

	// Static method to get the instance
	static getInstance() {
		if (!AgoraService.#instance) {
			AgoraService.#instance = new AgoraService();
			// AgoraService.setLogLevel(3);
		}
		return AgoraService.#instance;
	}

	// Load the Agora modules on demand
	async loadModules() {
		// If already loaded, return resolved promise
		if (this.#AgoraRTC && this.#AgoraRTM) {
			return Promise.resolve();
		}

		// If already loading, return existing promise
		if (this.#isLoading) {
			return this.#loadPromise;
		}

		// Start loading
		this.#isLoading = true;

		// Create and store the loading promise
		this.#loadPromise = Promise.all([
			import("agora-rtc-sdk-ng").then((module) => {
				this.#AgoraRTC = module.default;
				console.log("✅📦 AgoraRTC module loaded");
			}),
			import("agora-rtm-sdk").then((module) => {
				this.#AgoraRTM = module.default;
				console.log("✅📦 AgoraRTM module loaded");
			}),
		])
			.then(() => {
				this.#isLoading = false;
				console.log("✅ All Agora modules loaded");
			})
			.catch((error) => {
				this.#isLoading = false;
				console.error("❌ Failed to load Agora modules:", error);
				throw error;
			});

		return this.#loadPromise;
	}

	//
	// RTC (Real-Time Communication) Methods
	//

	async createClient(config) {
		await this.loadModules();
		this.client = this.#AgoraRTC.createClient(config);
		return this.client;
	}

	getClient() {
		return this.client;
	}

	addTrack(track) {
		if (track) {
			this.localTracks.push(track);
		}
		return track;
	}

	addTracks(tracks) {
		if (Array.isArray(tracks)) {
			this.localTracks = [
				...this.localTracks,
				...tracks.filter((track) => track),
			];
		}
		return tracks;
	}

	async createCameraVideoTrack(config = {}) {
		try {
			await this.loadModules();
			const videoTrack = await this.#AgoraRTC.createCameraVideoTrack(config);
			this.addTrack(videoTrack);
			return videoTrack;
		} catch (error) {
			console.error("Failed to create camera video track:", error);
			throw error;
		}
	}

	async createMicrophoneAudioTrack(config = {}) {
		try {
			await this.loadModules();
			const audioTrack =
				await this.#AgoraRTC.createMicrophoneAudioTrack(config);
			this.addTrack(audioTrack);
			return audioTrack;
		} catch (error) {
			console.error("Failed to create microphone audio track:", error);
			throw error;
		}
	}

	async joinChannel(appId, channel, token, uid) {
		if (!this.client) {
			throw new Error("RTC client not initialized");
		}

		try {
			await this.client.join(appId, channel, token, uid);
			console.log(`✅ Joined RTC channel: ${channel} as ${uid}`);
			return true;
		} catch (error) {
			console.error(`❌ Error joining RTC channel: ${error.message}`);
			throw error;
		}
	}

	async leaveChannel() {
		if (this.client) {
			try {
				await this.client.leave();
				console.log("✅ Left RTC channel");
				return true;
			} catch (error) {
				console.error(`❌ Error leaving RTC channel: ${error.message}`);
				throw error;
			}
		}
		return false;
	}

	//
	// RTM (Real-Time Messaging) Methods
	//

	async initializeRTMClient(appId, userId) {
		await this.loadModules();

		// Convert userId to string if it's a number
		// RTM API requires string, but we'll track the numeric value internally
		const rtmUserId = String(userId);

		if (!this.rtmClient) {
			this.rtmClient = new this.#AgoraRTM.RTM(appId, rtmUserId);
			// Store the original numeric ID if applicable
			this.rtmClient._numericUserId =
				typeof userId === "number" ? userId : parseInt(userId, 10);
			console.log(
				`✅ RTM client initialized for user: ${rtmUserId} (numeric: ${this.rtmClient._numericUserId})`,
			);
		}
		return this.rtmClient;
	}

	getRTMClient() {
		return this.rtmClient;
	}

	// Helper to ensure consistent ID format in RTM state
	ensureNumericId(state) {
		if (state && typeof state === "object") {
			// Make sure uid is numeric if present
			if (state.uid !== undefined) {
				state.uid =
					typeof state.uid === "string" ? parseInt(state.uid, 10) : state.uid;
			}

			// Remove string UID if present to avoid confusion
			if (state.uidString !== undefined) {
				delete state.uidString;
			}
		}
		return state;
	}

	async loginRTM(token) {
		if (!this.rtmClient) {
			throw new Error("RTM client not initialized");
		}
		await this.rtmClient.login({ token });
		console.log("✅ RTM login successful");
	}

	async logoutRTM() {
		if (this.rtmClient) {
			await this.rtmClient.logout();
			console.log("✅ RTM logout successful");
		}
	}

	async subscribeToChannel(channelId) {
		if (!this.rtmClient) {
			throw new Error("RTM client not initialized");
		}
		await this.rtmClient.subscribe(channelId);
		this.activeChannels.add(channelId);
		console.log(`✅ Subscribed to channel: ${channelId}`);
	}

	async unsubscribeFromChannel(channelId) {
		if (this.rtmClient) {
			await this.rtmClient.unsubscribe(channelId);
			this.activeChannels.delete(channelId);
			console.log(`✅ Unsubscribed from channel: ${channelId}`);
		}
	}

	async setPresenceState(channelId, messageType, state) {
		if (!this.rtmClient) {
			throw new Error("RTM client not initialized");
		}

		// Ensure state uses numeric ID format
		const normalizedState = this.ensureNumericId(state);

		await this.rtmClient.presence.setState(channelId, messageType, {
			state: normalizedState,
		});
		console.log(
			`✅ State set in channel: ${channelId} with numeric UID: ${normalizedState.uid}`,
		);
	}

	async getOnlineUsers(channelId, messageType = "MESSAGE") {
		if (!this.rtmClient) {
			throw new Error("RTM client not initialized");
		}
		const { occupants } = await this.rtmClient.presence.getOnlineUsers(
			channelId,
			messageType,
		);
		return occupants;
	}

	async getUserStates(occupants, channelId, messageType = "MESSAGE") {
		if (!this.rtmClient) {
			throw new Error("RTM client not initialized");
		}

		return Promise.all(
			occupants.map(async (user) => {
				return await this.rtmClient.presence.getState(
					user.userId,
					channelId,
					messageType,
				);
			}),
		);
	}

	async getParticipants(channelId, messageType = "MESSAGE") {
		try {
			// Get online users
			const occupants = await this.getOnlineUsers(channelId, messageType);

			// Get states for all users
			const states = await this.getUserStates(
				occupants,
				channelId,
				messageType,
			);

			// Map to a more usable format with numeric UIDs
			return states.map((state) => {
				const userData = state.states.state;
				// Ensure UIDs are numeric for consistency
				if (userData && userData.uid && typeof userData.uid === "string") {
					userData.uid = parseInt(userData.uid, 10);
				}
				return userData;
			});
		} catch (error) {
			console.error("Failed to get participants:", error);
			return [];
		}
	}

	addRTMEventListener(eventType, callback) {
		if (this.rtmClient) {
			this.rtmClient.addEventListener(eventType, callback);
			console.log(`✅ Added ${eventType} event listener`);
		}
	}

	removeRTMEventListener(eventType, callback) {
		if (this.rtmClient) {
			this.rtmClient.removeEventListener(eventType, callback);
			console.log(`✅ Removed ${eventType} event listener`);
		}
	}

	async joinRTMChannel(appId, channelId, token, userId, initialState = null) {
		try {
			// Convert userId to number if it's a string
			const numericUserId =
				typeof userId === "string" ? parseInt(userId, 10) : userId;

			await this.initializeRTMClient(appId, numericUserId);
			await this.loginRTM(token);
			await this.subscribeToChannel(channelId);

			if (initialState) {
				// Ensure initialState has numeric UID
				initialState = this.ensureNumericId(initialState);
				await this.setPresenceState(channelId, "MESSAGE", initialState);
			}

			console.log(
				`✅ Successfully joined RTM channel: ${channelId} with numeric UID: ${numericUserId}`,
			);
			return true;
		} catch (error) {
			console.error(`❌ Error joining RTM channel: ${error.message}`);
			throw error;
		}
	}

	async leaveRTMChannel(channelId) {
		try {
			if (this.rtmClient) {
				await this.unsubscribeFromChannel(channelId);
				await this.logoutRTM();
				console.log(`✅ Successfully left RTM channel: ${channelId}`);
			}
			return true;
		} catch (error) {
			console.error(`❌ Error leaving RTM channel: ${error.message}`);
			return false;
		}
	}

	// Combined RTM and RTC cleanup
	async cleanup() {
		try {
			// Clean up RTC resources
			// Close all local tracks
			for (const track of this.localTracks) {
				if (track) {
					// Stop track
					track.close();
				}
			}

			// Clear tracks array
			this.localTracks = [];

			// Leave RTC channel if in one
			if (this.client) {
				try {
					await this.client.leave();
				} catch (rtcError) {
					console.error("Error leaving RTC channel:", rtcError);
				}
			}

			// Clean up RTM resources
			if (this.rtmClient) {
				try {
					// Unsubscribe from all channels
					for (const channelId of this.activeChannels) {
						await this.unsubscribeFromChannel(channelId);
					}

					// Logout from RTM
					await this.rtmClient.logout();
					this.rtmClient = null;
				} catch (rtmError) {
					console.error("❌ Error cleaning up RTM client:", rtmError);
				}
			}

			console.log("✅ All Agora resources cleaned up");
			return true;
		} catch (error) {
			console.error("❌ Error in complete cleanup:", error);
			return false;
		}
	}

	// Set log level for Agora SDK
	async setLogLevel(level) {
		await this.loadModules();
		this.#AgoraRTC.setLogLevel(level);
	}
}

// Export the class but don't create an instance by default
export default AgoraService;

// Helper function to get the instance when needed
export const getAgoraService = () => {
	return AgoraService.getInstance();
};
