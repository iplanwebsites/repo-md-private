/**
 * AgoraTokenClient.js
 * Based on https://github.com/AgoraIO-Community/Agora-Node-TokenServer/
 */

export class AgoraTokenClient {
	constructor(tokenServerUrl = null) {
		this.tokenServerUrl = tokenServerUrl;
	}

	setTokenServerUrl(url) {
		this.tokenServerUrl = url;
	}

	async ping() {
		if (!this.tokenServerUrl) throw new Error("Token server URL not set");

		try {
			const response = await fetch(`${this.tokenServerUrl}/ping`);
			if (!response.ok) throw new Error("Network error");
			return await response.json();
		} catch (error) {
			console.error("Error pinging token server:", error);
			throw error;
		}
	}

	async fetchRTCToken(
		channel,
		uid,
		role = "publisher",
		tokenType = "uid",
		expiry = 3600,
	) {
		if (!this.tokenServerUrl) throw new Error("Token server URL not set");
		if (!channel) throw new Error("Channel name is required");
		if (!uid) throw new Error("User ID is required");

		try {
			const endpoint = `${this.tokenServerUrl}/rtc/${channel}/${role}/${tokenType}/${uid}?expiry=${expiry}`;
			const response = await fetch(endpoint);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to fetch RTC token");
			}

			return await response.json();
		} catch (error) {
			console.error("Error fetching RTC token:", error);
			throw error;
		}
	}

	async fetchRTMToken(uid, expiry = 3600) {
		if (!this.tokenServerUrl) throw new Error("Token server URL not set");
		if (!uid) throw new Error("User ID is required");

		try {
			const endpoint = `${this.tokenServerUrl}/rtm/${uid}?expiry=${expiry}`;
			const response = await fetch(endpoint);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to fetch RTM token");
			}

			return await response.json();
		} catch (error) {
			console.error("Error fetching RTM token:", error);
			throw error;
		}
	}
	/*
  async fetchRTETokens(
    channel,
    uid,
    role = "publisher",
    tokenType = "uid",
    expiry = 3600
  ) {
    if (!this.tokenServerUrl) throw new Error("Token server URL not set");
    if (!channel) throw new Error("Channel name is required");
    if (!uid) throw new Error("User ID is required");

    try {
      const endpoint = `${this.tokenServerUrl}/rte/${channel}/${role}/${tokenType}/${uid}?expiry=${expiry}`;
      const response = await fetch(endpoint);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch RTE tokens");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching RTE tokens:", error);
      throw error;
    }
  }*/

	async fetchRTETokens(
		channel,
		uid,
		role = "publisher",
		tokenType = "uid",
		expiry = 3600,
	) {
		if (!this.tokenServerUrl) throw new Error("Token server URL not set");
		if (!channel) throw new Error("Channel name is required");
		if (uid === undefined || uid === null)
			throw new Error("User ID is required");

		// Ensure uid is numeric for RTC connections
		const numericUid = parseInt(uid, 10);
		const uidToUse = !isNaN(numericUid) ? numericUid : uid;

		console.log(
			`Token request for channel: ${channel}, using UID: ${uidToUse} (type: ${typeof uidToUse})`,
		);

		try {
			const endpoint = `${this.tokenServerUrl}/rte/${channel}/${role}/${tokenType}/${uidToUse}?expiry=${expiry}`;
			console.log(`Token request endpoint: ${endpoint}`);

			const response = await fetch(endpoint);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to fetch RTE tokens");
			}

			const tokens = await response.json();
			console.log("Tokens received successfully");
			return tokens;
		} catch (error) {
			console.error("Error fetching RTE tokens:", error);
			throw error;
		}
	}
}

export default AgoraTokenClient;
