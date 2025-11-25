export class OpenAIRealtimeClient {
	constructor(token, config = {}) {
		if (!token)
			throw new Error(
				"Token is required - get yourself an ephemeral token from the server...",
			);

		this.token = token;
		this.config = {
			baseUrl: "https://api.openai.com/v1/realtime",
			model: "gpt-4o-realtime-preview-2024-12-17",
			debug: true,
			...config,
		};

		this.peerConnection = null;
		this.dataChannel = null;
		this.audioElement = null;
		this.mediaStream = null;
		this.isConnected = false;
		this.eventHandlers = new Map();
		this.tools = new Map();

		this.log("Initialized OpenAIRealtimeClient with config:", this.config);
	}

	log(...args) {
		if (this.config.debug) {
			console.log("[OpenAIRealtimeClient]", ...args);
		}
	}

	on(eventType, handler) {
		if (!this.eventHandlers.has(eventType)) {
			this.eventHandlers.set(eventType, new Set());
		}
		this.eventHandlers.get(eventType).add(handler);
		this.log(`Registered handler for event: ${eventType}`);
		return this;
	}

	off(eventType, handler) {
		const handlers = this.eventHandlers.get(eventType);
		if (handlers) {
			handlers.delete(handler);
			this.log(`Removed handler for event: ${eventType}`);
		}
		return this;
	}

	emit(eventType, data) {
		const handlers = this.eventHandlers.get(eventType);
		if (handlers) {
			this.log(`Emitting event: ${eventType}`, data);
			handlers.forEach((handler) => {
				try {
					handler(data);
				} catch (error) {
					this.log("Error in event handler:", error);
				}
			});
		}
	}

	registerTools(toolsHandlers) {
		// Convert the object of handlers into array of tool objects
		const tools = Object.entries(toolsHandlers).map(([name, handler]) => ({
			name,
			handler,
			description: `Handler for ${name}`, // Optional default description
			/*
      parameters: {
        // Default parameters schema
        type: "object",
        properties: {},
      },*/
		}));

		// Register each tool
		tools.forEach((tool) => this.registerTool(tool));
		return this;
	}

	registerTool(tool) {
		if (!tool.name || !tool.handler) {
			console.log(tool);
			throw new Error("Tool must have a name and handler");
		}

		this.tools.set(tool.name, tool);
		this.log(`Registered tool: ${tool.name}`, tool);

		if (this.isConnected) {
			this.log("Updating session with new tool configuration");
			this.updateSession().catch((error) => {
				this.log("Error updating session:", error);
			});
		}
		return this;
	}

	async updateSession() {
		const toolsArray = Array.from(this.tools.values()).map(
			({ handler, ...tool }) => tool,
		);
		this.log("Updating session with tools:", toolsArray);

		await this.sendEvent({
			type: "session.update",
			session: {
				tools: toolsArray,
				tool_choice: "auto",
			},
		});
	}

	async connect() {
		if (this.isConnected) {
			this.log("Already connected, skipping connection");
			return;
		}

		try {
			this.log("Initializing WebRTC connection");
			this.peerConnection = new RTCPeerConnection();

			// Log ICE connection state changes
			this.peerConnection.oniceconnectionstatechange = () => {
				this.log(
					"ICE connection state:",
					this.peerConnection.iceConnectionState,
				);
			};

			// Log signaling state changes
			this.peerConnection.onsignalingstatechange = () => {
				this.log("Signaling state:", this.peerConnection.signalingState);
			};

			// Log ICE candidate gathering
			this.peerConnection.onicecandidate = (event) => {
				this.log("ICE candidate:", event.candidate);
			};

			this.log("Setting up audio element");
			this.audioElement = document.createElement("audio");
			this.audioElement.autoplay = true;

			this.peerConnection.ontrack = (e) => {
				this.log("Received remote track:", e.track.kind);
				this.audioElement.srcObject = e.streams[0];
				this.emit("track", e);
			};

			this.log("Requesting microphone access");
			this.mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});

			this.log("Adding local audio tracks");
			this.mediaStream.getTracks().forEach((track) => {
				this.log("Adding track:", track.kind, track.label);
				this.peerConnection.addTrack(track);
			});

			this.log("Creating data channel");
			this.dataChannel = this.peerConnection.createDataChannel("oai-events");
			this.setupDataChannel();

			this.log("Creating offer");
			const offer = await this.peerConnection.createOffer();
			this.log("Local SDP:", offer.sdp);

			await this.peerConnection.setLocalDescription(offer);
			this.log("Set local description");

			this.log("Sending offer to OpenAI");
			const response = await fetch(
				`${this.config.baseUrl}?model=${this.config.model}`,
				{
					method: "POST",
					body: offer.sdp,
					headers: {
						Authorization: `Bearer ${this.token}`,
						"Content-Type": "application/sdp",
					},
				},
			);

			if (!response.ok) {
				throw new Error(`Failed to connect: ${response.statusText}`);
			}

			const answerSdp = await response.text();
			this.log("Received answer SDP:", answerSdp);

			const answer = {
				type: "answer",
				sdp: answerSdp,
			};

			await this.peerConnection.setRemoteDescription(answer);
			this.log("Set remote description");

			this.isConnected = true;
			this.emit("connected");
			this.log("Connection established successfully");
		} catch (error) {
			this.log("Connection failed:", error);
			this.emit("error", error);
			throw error;
		}
	}

	setupDataChannel() {
		if (!this.dataChannel) return;

		this.dataChannel.onmessage = (e) => {
			try {
				const data = JSON.parse(e.data);
				this.log("Received raw message:", e.data);
				this.log("Parsed message:", data);

				// Detailed logging for each message type
				switch (data.type) {
					case "response.start":
						this.log("Response started", data);
						break;

					case "response.content":
						this.log("Content received:", {
							content: data.response?.content,
							responseId: data.response?.id,
							full: data,
						});
						break;

					case "response.done":
						this.log("Response completed:", {
							output: data.response?.output,
							responseId: data.response?.id,
							full: data,
						});
						break;

					case "conversation.item.created":
						this.log("Message created:", {
							itemId: data.item?.id,
							role: data.item?.role,
							content: data.item?.content,
							full: data.item,
						});
						break;

					case "request.completion.created":
						this.log("Completion request created:", data);
						break;

					case "error":
						this.log("Error received:", data.error);
						break;

					default:
						this.log(`Unhandled message type: ${data.type}`, data);
				}

				this.emit("message", data);

				if (data.type === "response.done" && data.response?.output) {
					data.response.output.forEach((output) => {
						if (output.type === "function_call") {
							this.handleFunctionCall(output);
						}
					});
				}
			} catch (error) {
				this.log("Error processing message:", error);
			}
		};

		this.dataChannel.onopen = () => {
			this.log("Data channel opened");
			this.emit("datachannel_open");
		};

		this.dataChannel.onclose = () => {
			this.log("Data channel closed");
			this.emit("datachannel_close");
			this.isConnected = false;
			this.emit("disconnected");
		};

		this.dataChannel.onerror = (error) => {
			this.log("Data channel error:", error);
			this.emit("datachannel_error", error);
		};
	}

	async handleFunctionCall(functionCall) {
		this.log("Handling function call:", functionCall);

		const tool = this.tools.get(functionCall.name);
		if (!tool) {
			const error = new Error(`Tool ${functionCall.name} not found`);
			this.log("Tool not found:", error);
			this.emit("function_error", {
				name: functionCall.name,
				error,
			});
			return;
		}

		try {
			const params = JSON.parse(functionCall.arguments);
			this.log(`Executing tool ${functionCall.name} with params:`, params);

			const result = await tool.handler(params);
			this.log(`Tool ${functionCall.name} execution result:`, result);

			this.emit("function_result", {
				name: functionCall.name,
				result,
			});
		} catch (error) {
			this.log(`Tool ${functionCall.name} execution failed:`, error);
			this.emit("function_error", {
				name: functionCall.name,
				error,
			});
		}
	}

	async sendEvent(event) {
		if (!this.isConnected || !this.dataChannel) {
			throw new Error("Not connected");
		}

		event.event_id = event.event_id || crypto.randomUUID();
		this.log("Sending event:", event);

		try {
			this.dataChannel.send(JSON.stringify(event));
			this.emit("sent_event", event);
			return event.event_id;
		} catch (error) {
			this.log("Failed to send event:", error);
			this.emit("error", error);
			throw error;
		}
	}

	async requestResponse(prompt) {
		// Then create a response with minimal parameters
		const responseEventId = await this.sendEvent({
			type: "response.create",
			response: {
				temperature: 0.7,
			},
		});
		this.log("Response requested with event ID:", responseEventId);
	}

	async sendMessage(text) {
		this.log("Sending message:", text);

		try {
			// First send the user message
			const messageEventId = await this.sendEvent({
				type: "conversation.item.create",
				item: {
					type: "message",
					role: "user",
					content: [
						{
							type: "input_text",
							text,
						},
					],
				},
			});
			this.log("Message sent with event ID:", messageEventId);

			// Wait a bit to ensure message is processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Then create a response with minimal parameters
			const responseEventId = await this.sendEvent({
				type: "response.create",
				response: {
					temperature: 0.7,
				},
			});
			this.log("Response requested with event ID:", responseEventId);

			return messageEventId;
		} catch (error) {
			this.log("Error in sendMessage:", error);
			throw error;
		}
	}

	disconnect() {
		this.log("Initiating disconnect");

		if (this.mediaStream) {
			this.log("Stopping media tracks");
			this.mediaStream.getTracks().forEach((track) => {
				this.log(`Stopping track: ${track.kind} (${track.label})`);
				track.stop();
			});
		}

		if (this.dataChannel) {
			this.log("Closing data channel");
			this.dataChannel.close();
		}

		if (this.peerConnection) {
			this.log("Closing peer connection");
			this.peerConnection.close();
		}

		this.isConnected = false;
		this.emit("disconnected");
		this.log("Disconnect complete");
	}
}
