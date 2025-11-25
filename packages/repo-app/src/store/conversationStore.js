// store/conversationStore.js
import { defineStore } from "pinia";
import trpc from "@/trpc";
import { ref, computed, watch } from "vue";
import { conversationStarters } from "@/components/agent/data.js";
import { formatDateCustom } from "@/lib/utils/dateUtils";

export const useConversationStore = defineStore(
	"conversations",
	() => {
		// State
		const conversations = ref([]); // Start with empty array, persistence will populate it if available
		const isOpen = ref(false);
		const activeConversation = ref(null);
		const isLoading = ref(false);
		const aiError = ref(null);
		const newMessageInput = ref("");
		const isRecording = ref(false);
		const conversationStatus = ref({});
		const lastCleanupTime = ref(Date.now());
		const showPillsInsteadOfFirstMessage = ref(true);
		const suggestedPills = ref({
			patient: {}, // { patientId: [pills] }
			meeting: {}, // { meetingId: [pills] }
			isLoading: false,
			error: null,
		});

		// Computed
		const showActiveConversation = computed(
			() => activeConversation.value !== null,
		);

		// The persisted state will be loaded automatically
		// If there's no persisted state, we'll start with an empty array

		// Set up automatic cleanup every 10 minutes
		const setupAutomaticCleanup = () => {
			const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

			// Check if we need to run cleanup
			const checkAndCleanup = () => {
				const now = Date.now();
				if (now - lastCleanupTime.value >= CLEANUP_INTERVAL) {
					cleanupExpiredConversations();
					lastCleanupTime.value = now;
				}
			};

			// Setup interval
			const intervalId = setInterval(checkAndCleanup, CLEANUP_INTERVAL);

			// Clean up interval on page unload
			window.addEventListener("beforeunload", () => {
				clearInterval(intervalId);
			});

			// Run initial cleanup
			cleanupExpiredConversations();
		};

		// Call setup on store creation if in browser environment
		if (typeof window !== "undefined") {
			setupAutomaticCleanup();
		}

		// Function to clean up expired conversations
		function cleanupExpiredConversations() {
			const now = new Date();
			const EXPIRATION_TIME = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

			// Filter out conversations older than 30 days
			conversations.value = conversations.value.filter((convo) => {
				const lastActivity = new Date(convo.timestamp);
				const age = now - lastActivity;
				return age < EXPIRATION_TIME;
			});
		}

		// Actions
		function toggleBubble() {
			isOpen.value = !isOpen.value;
			if (!isOpen.value) {
				// Reset state when closing bubble
				activeConversation.value = null;
			}
		}

		function goBack() {
			activeConversation.value = null;
		}

		// Fetch suggested pills for a patient
		async function fetchPatientPills(patientId) {
			if (suggestedPills.value.patient[patientId]) {
				// Return cached pills if available
				return suggestedPills.value.patient[patientId];
			}

			suggestedPills.value.isLoading = true;
			suggestedPills.value.error = null;

			try {
				// Call the tRPC endpoint
				const response = await trpc.getPatientSuggestedPills.query({
					patientId,
				});

				console.log("RES4324", response);
				// Cache and return the pills
				if (response && Array.isArray(response.pills)) {
					suggestedPills.value.patient[patientId] = response.pills;
					return response.pills;
				}

				// Fallback to mock values if response is invalid
				return getMockPatientPills(patientId);
			} catch (error) {
				console.error("Error fetching patient pills:", error);
				suggestedPills.value.error = "Failed to load suggested questions";

				// Use mock values on error
				return getMockPatientPills(patientId);
			} finally {
				suggestedPills.value.isLoading = false;
			}
		}

		// Mock patient pills for fallback
		function getMockPatientPills(patientId) {
			// Default mock patient pills
			const mockPills = [
				{
					id: `patient-${patientId}-progress`,
					text: "Quels sont les progrès récents de ce client ?",
					icon: "📈",
				},
				{
					id: `patient-${patientId}-challenges`,
					text: "Quels défis ce client rencontre-t-il actuellement ?",
					icon: "🚧",
				},
				{
					id: `patient-${patientId}-next`,
					text: "Quelles devraient être les prochaines étapes pour ce client ?",
					icon: "👣",
				},
			];

			// Cache the mock pills
			suggestedPills.value.patient[patientId] = mockPills;
			return mockPills;
		}

		// Fetch suggested pills for a meeting
		async function fetchMeetingPills(meetingId) {
			if (suggestedPills.value.meeting[meetingId]) {
				// Return cached pills if available
				return suggestedPills.value.meeting[meetingId];
			}

			suggestedPills.value.isLoading = true;
			suggestedPills.value.error = null;

			try {
				// Call the tRPC endpoint
				const response = await trpc.getMeetingSuggestedPills.query({
					meetingId,
				});

				// Cache and return the pills
				if (response && Array.isArray(response.pills)) {
					suggestedPills.value.meeting[meetingId] = response.pills;
					return response.pills;
				}

				// Fallback to mock values if response is invalid
				return getMockMeetingPills(meetingId);
			} catch (error) {
				console.error("Error fetching meeting pills:", error);
				suggestedPills.value.error = "Failed to load suggested questions";

				// Use mock values on error
				return getMockMeetingPills(meetingId);
			} finally {
				suggestedPills.value.isLoading = false;
			}
		}

		// Mock meeting pills for fallback
		function getMockMeetingPills(meetingId) {
			// Default mock meeting pills
			const mockPills = [
				{
					id: `meeting-${meetingId}-prepare`,
					text: "Comment puis-je préparer efficacement ce RDV?",
					icon: "📝",
				},
				{
					id: `meeting-${meetingId}-review`,
					text: "Pouvez-vous m'aider à analyser ce RDV ?",
					icon: "🔍",
				},
				{
					id: `meeting-${meetingId}-follow`,
					text: "Quels points de suivi recommandez-vous après ce RDV ?",
					icon: "📋",
				},
			];

			// Cache the mock pills
			suggestedPills.value.meeting[meetingId] = mockPills;
			return mockPills;
		}

		function startNewConversation(starter) {
			const newId = `conv-${Date.now()}`;
			const newConversation = {
				id: newId,
				title: starter.title,
				lastMessage: "",
				timestamp: new Date(),
				messages: showPillsInsteadOfFirstMessage.value
					? []
					: [
							{
								id: 1,
								content: `Bonjour ! Comment puis-je vous aider concernant ${starter.title.toLowerCase()} ?`,
								sender: "ai",
								timestamp: new Date(),
							},
						],
				status: "active",
				starter: starter, // Store the starter for pill display if needed
			};

			// Add conversation to the list
			conversations.value = [newConversation, ...conversations.value];

			// Set as active conversation
			activeConversation.value = newConversation;

			// Initialize conversation status
			conversationStatus.value[newId] = {
				isTyping: false,
				unreadCount: 0,
			};
		}

		function startPatientConversation(patient) {
			const newId = `patient-${patient.id}-${Date.now()}`;
			const patientMemory = patient.memory || "";
			const context = `The client the coach(end user chatting) wants to discuss is named: ${patient.name}\n\nFor context, here are information we remember about the client: ${patientMemory}`;
			const newConversation = {
				id: newId,
				title: `Discussion: ${patient.name}`,
				patientId: patient.id,
				patientName: patient.name,
				lastMessage: "",
				timestamp: new Date(),
				context,
				messages: showPillsInsteadOfFirstMessage.value
					? []
					: [
							{
								id: 1,
								content: `Bonjour ! Je suis prêt à discuter du cas de ${patient.name}. Que souhaitez-vous explorer à propos de ce client ?`,
								sender: "ai",
								timestamp: new Date(),
							},
						],
				status: "active",
				type: "patient",
			};

			// Add conversation to the list
			conversations.value = [newConversation, ...conversations.value];

			// Set as active conversation
			activeConversation.value = newConversation;

			// Initialize conversation status
			conversationStatus.value[newId] = {
				isTyping: false,
				unreadCount: 0,
			};

			// Fetch pills for this patient if using pills mode
			if (showPillsInsteadOfFirstMessage.value) {
				fetchPatientPills(patient.id);
			}

			// Ensure the chat bubble is open
			if (!isOpen.value) {
				isOpen.value = true;
			}
		}

		function startMeetingConversation(meeting) {
			const newId = `meeting-${meeting.id}-${Date.now()}`;

			// Extract relevant information from the meeting
			const meetingTitle = meeting.title || "Consultation";
			const patientName = meeting.patientName || "client";
			const meetingDate = meeting.startTime
				? new Date(meeting.startTime)
				: new Date();
			const formattedDate = new Intl.DateTimeFormat("en-US", {
				dateStyle: "full",
				timeStyle: "short",
			}).format(meetingDate);
			const transcript = meeting.transcript || "";
			const meetingNotes = meeting.notes || "";
			const meetingDuration = meeting.duration || 0;
			const meetingStatus = meeting.status || "scheduled";

			// Create context string
			const context = `
Informations sur la consultation:
- Titre: ${meetingTitle}
- Client: ${patientName}
- Date: ${formattedDate}
- Durée: ${meetingDuration} minutes
- Statut: ${meetingStatus}

${meetingNotes ? `Notes de consultation:\n${meetingNotes}\n\n` : ""}
${transcript ? `Transcription de la consultation:\n${transcript}` : ""}
    `.trim();

			const isPast = new Date() > meetingDate;

			const firstMessageContent = isPast
				? `Bonjour ! Je suis prêt à discuter de votre consultation "${meetingTitle}" du ${formattedDate} avec ${patientName}. Comment puis-je vous aider à analyser cette séance ?`
				: `Bonjour ! Je suis prêt à vous aider à préparer votre prochaine consultation "${meetingTitle}" avec ${patientName} prévue le ${formattedDate}. Que souhaitez-vous aborder ?`;

			// Create the new conversation
			const newConversation = {
				id: newId,
				title: `Consultation: ${meetingTitle}`,
				meetingId: meeting.id,
				patientName,
				lastMessage: "",
				timestamp: new Date(),
				context,
				messages: showPillsInsteadOfFirstMessage.value
					? []
					: [
							{
								id: 1,
								content: firstMessageContent,
								sender: "ai",
								timestamp: new Date(),
							},
						],
				status: "active",
				type: "meeting",
				firstMessageContent: firstMessageContent, // Store for pill display if needed
			};
			console.log("NEW MEETING CONVERSATION", newConversation);

			// Add conversation to the list
			conversations.value = [newConversation, ...conversations.value];

			// Set as active conversation
			activeConversation.value = newConversation;

			// Initialize conversation status
			conversationStatus.value[newId] = {
				isTyping: false,
				unreadCount: 0,
			};

			// Fetch pills for this meeting if using pills mode
			if (showPillsInsteadOfFirstMessage.value) {
				fetchMeetingPills(meeting.id);
			}

			// Ensure the chat bubble is open
			if (!isOpen.value) {
				isOpen.value = true;
			}
		}

		async function sendMessage(pillContent) {
			// If pill content is provided, use it instead of the input field
			const messageContent = pillContent || newMessageInput.value.trim();
			if (!messageContent || !activeConversation.value) return;

			// Add user message
			const userMessage = {
				id: Date.now(),
				content: messageContent,
				sender: "user",
				timestamp: new Date(),
			};

			activeConversation.value.messages.push(userMessage);
			activeConversation.value.lastMessage = userMessage.content;
			activeConversation.value.timestamp = new Date();

			// Clear input
			newMessageInput.value = "";

			// Set typing status
			if (conversationStatus.value[activeConversation.value.id]) {
				conversationStatus.value[activeConversation.value.id].isTyping = true;
			}

			try {
				isLoading.value = true;
				aiError.value = null;

				// Format messages for the API
				const formattedMessages = [];

				// Add system message with patient context if applicable
				let systemContent = "Assistant coaching";

				// Add patient context if this is a patient conversation
				if (activeConversation.value.patientId) {
					systemContent = `Assistant coaching discutant du patient ${activeConversation.value.patientName}. 
Utilisez ces informations pour personnaliser vos conseils tout en maintenant une approche professionnelle.`;
				}

				/// if context, append it to system prompt.
				if (activeConversation.value.context) {
					systemContent += `\n\nContexte: ${activeConversation.value.context}`;
				}

				formattedMessages.push({
					role: "system",
					content: systemContent,
				});

				// Add conversation history
				activeConversation.value.messages.forEach((msg) => {
					formattedMessages.push({
						role: msg.sender === "user" ? "user" : "assistant",
						content: msg.content,
					});
				});

				// Call the tRPC mutation with properly formatted messages
				const options = {
					messages: formattedMessages,
					conversationId: activeConversation.value.id,
					systemPrompt: systemContent,
				};

				const response = await trpc.openAiCompletion.mutate(options);

				// Add AI response
				if (response && response.content) {
					const aiResponse = {
						id: Date.now() + 1,
						content: response.content,
						sender: "ai",
						timestamp: new Date(),
					};

					activeConversation.value.messages.push(aiResponse);
					activeConversation.value.lastMessage = aiResponse.content;
					activeConversation.value.timestamp = new Date();
				} else {
					throw new Error("Empty response from AI");
				}
			} catch (err) {
				console.error("Error getting AI response:", err);
				aiError.value =
					"Échec de l'obtention d'une réponse. Veuillez réessayer.";

				// Add error message to conversation
				const errorMessage = {
					id: Date.now() + 1,
					content:
						"Je suis désolé, mais je n'ai pas pu traiter votre demande. Veuillez réessayer.",
					sender: "ai",
					timestamp: new Date(),
					isError: true,
				};

				activeConversation.value.messages.push(errorMessage);
				activeConversation.value.lastMessage = errorMessage.content;
				activeConversation.value.timestamp = new Date();
			} finally {
				isLoading.value = false;

				// Reset typing status
				if (conversationStatus.value[activeConversation.value.id]) {
					conversationStatus.value[activeConversation.value.id].isTyping =
						false;
				}
			}
		}

		function formatDate(date) {
			return formatDateCustom(date);
		}

		function handleNewVoiceInput(text) {
			// Ensure text is a string
			const newText = String(text).trim();
			if (!newText) return;

			// Update the input value directly
			newMessageInput.value = newMessageInput.value.trim()
				? `${newMessageInput.value.trim()} ${newText}`
				: newText;
		}

		function updateVoiceInput(value) {
			newMessageInput.value = value;
		}

		function clearAllConversations() {
			conversations.value = [];
			activeConversation.value = null;
		}

		return {
			// State
			conversations,
			isOpen,
			activeConversation,
			isLoading,
			aiError,
			newMessageInput,
			isRecording,
			conversationStatus,
			conversationStarters,
			showPillsInsteadOfFirstMessage,
			suggestedPills,

			// Computed
			showActiveConversation,

			// Actions
			toggleBubble,
			goBack,
			startNewConversation,
			startPatientConversation,
			startMeetingConversation,
			sendMessage,
			formatDate,
			handleNewVoiceInput,
			updateVoiceInput,
			clearAllConversations,
			cleanupExpiredConversations,
		};
	},
	{
		// Persistence configuration
		persist: {
			// Use localStorage by default
			storage: localStorage,

			// Only persist these fields
			pick: ["conversations", "lastCleanupTime", "isOpen"],
			// suggestedPills - igonre

			// Custom serialization to handle Date objects properly
			serializer: {
				serialize: (state) => {
					return JSON.stringify(state, (key, value) => {
						// Convert Date objects to ISO strings
						if (value instanceof Date) {
							return { __isDate: true, iso: value.toISOString() };
						}
						return value;
					});
				},
				deserialize: (state) => {
					return JSON.parse(state, (key, value) => {
						// Convert ISO strings back to Date objects
						if (value && typeof value === "object" && value.__isDate === true) {
							return new Date(value.iso);
						}
						return value;
					});
				},
			},
		},
	},
);
