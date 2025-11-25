// store/meetingStore.js
import { defineStore } from "pinia";
import trpc from "@/trpc";
import {
	formatDate,
	formatDateTime,
	formatTime,
	formatISOString,
	timeUntil,
} from "@/lib/utils/dateUtils";

export const useMeetingStore = defineStore("meetings", {
	state: () => ({
		patients: [],
		meets: [],
		currentMeeting: null,
		patientsLoading: false,
		meetsLoading: false,
		meetingLoading: false,
		error: null,
		saveNoteStatus: "idle", // idle, saving, success, error
	}),
	// ...existing code...

	getters: {
		upcomingMeetingsCount() {
			const now = new Date();
			return this.meets.filter((m) => {
				const meetingStart = new Date(m.startTime);
				return m.status === "scheduled" && meetingStart >= now;
			}).length;
		},

		availableRoomsCount() {
			return this.patients.filter((p) => p.roomStatus === "available").length;
		},

		nextScheduledPatient() {
			if (this.meets.length === 0) return null;

			const now = new Date();

			// Filter out past meetings and sort by date
			const sortedMeets = [...this.meets]
				.filter((meet) => {
					const meetingStart = new Date(meet.startTime);
					return meet.status === "scheduled" && meetingStart >= now;
				})
				.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

			if (sortedMeets.length > 0) {
				const nextMeet = sortedMeets[0];
				const patient = this.patients.find((p) => p.id === nextMeet.patientId);

				if (patient) {
					return {
						...patient,
						meetingTime: this.formatDate(nextMeet.startTime),
						agenda: nextMeet.title,
					};
				}
			}

			return null;
		},

		// Find patient for the current meeting
		currentMeetingPatient() {
			if (!this.currentMeeting || !this.patients.length) return null;
			return (
				this.patients.find((p) => p.id === this.currentMeeting.patientId) ||
				null
			);
		},

		// Calculate meeting status
		meetingStatus() {
			if (!this.currentMeeting) return "loading";

			const now = new Date();
			const meetingStart = new Date(this.currentMeeting.startTime);
			const meetingEnd = new Date(meetingStart);
			meetingEnd.setMinutes(
				meetingEnd.getMinutes() + this.currentMeeting.duration,
			);

			if (this.currentMeeting.status === "canceled") {
				return "canceled";
			}

			if (this.currentMeeting.transcript) {
				return "completed";
			}

			if (now > meetingEnd) {
				return "past";
			}

			if (now >= meetingStart && now <= meetingEnd) {
				return "in-progress";
			}

			// Calculate time difference in minutes
			const timeDiff = (meetingStart - now) / (1000 * 60);

			if (timeDiff <= 15) {
				return "imminent";
			}

			return "upcoming";
		},

		// Format meeting status for display
		formattedStatus() {
			const statusMap = {
				loading: "Chargement...",
				upcoming: "À venir",
				imminent: "Imminent",
				"in-progress": "En cours",
				past: "Terminé",
				completed: "Terminé",
				canceled: "Annulé",
			};

			return statusMap[this.meetingStatus] || this.meetingStatus;
		},

		// Status badge style
		statusBadgeClass() {
			const classMap = {
				upcoming: "bg-blue-100 text-blue-800",
				imminent: "bg-yellow-100 text-yellow-800",
				"in-progress": "bg-green-100 text-green-800",
				past: "bg-gray-100 text-gray-800",
				completed: "bg-green-100 text-green-800",
				canceled: "bg-red-100 text-red-800",
			};

			return classMap[this.meetingStatus] || "bg-gray-100 text-gray-800";
		},

		// Calculate meeting end time
		meetingEndTime() {
			if (!this.currentMeeting) return "";

			const startTime = new Date(this.currentMeeting.startTime);
			const endTime = new Date(startTime);
			endTime.setMinutes(endTime.getMinutes() + this.currentMeeting.duration);

			return this.formatTime(endTime);
		},

		// Calculate time until meeting
		timeUntilMeeting() {
			if (!this.currentMeeting) return "";
			return timeUntil(this.currentMeeting.startTime);
		},

		// Get all upcoming meetings including the current one
		upcomingMeetings() {
			const now = new Date();
			return this.meets
				.map((meet) => {
					const meetingStart = new Date(meet.startTime);
					const meetingEnd = new Date(meetingStart);
					meetingEnd.setMinutes(meetingEnd.getMinutes() + meet.duration);

					return {
						...meet,
						isNow: now >= meetingStart && now <= meetingEnd,
						isPast: now > meetingEnd,
						isFuture: now < meetingStart,
					};
				})
				.filter(
					(meet) => (meet.isFuture || meet.isNow) && meet.status !== "canceled",
				);
		},
	},

	actions: {
		// Get a patient by ID, loading patients if needed
		async getPatient(patientId) {
			// Make sure patients are loaded
			if (this.patients.length === 0) {
				await this.fetchPatients();
			}

			// Find and return the patient
			return this.patients.find((p) => p.id === patientId) || null;
		},

		// Load patients data
		async fetchPatients() {
			// Skip if already loading
			if (this.patientsLoading) return;

			try {
				this.patientsLoading = true;
				this.error = null;

				// Fetch patients from API
				const data = await trpc.listMyPatients.query({
					includeActivities: false,
				});

				// Process patient data
				this.patients = data.map((patient) => ({
					...patient,
					roomName: `${patient.name}`,
					roomStatus: patient.status === "active" ? "available" : "scheduled",
					completedActivities:
						patient.activities?.filter((a) => a.completed).length || 0,
				}));

				// Update patients with meeting info
				this.updatePatientsWithMeetings();
			} catch (err) {
				console.error("Error loading patients:", err);
				this.error = "Impossible de charger les données des patients";
			} finally {
				this.patientsLoading = false;
			}
		},

		// Load a single meeting by ID
		async fetchMeetingById(meetId) {
			try {
				this.meetingLoading = true;
				this.error = null;

				const response = await trpc.getMeet.query({ meetId });

				if (response.success) {
					this.currentMeeting = response.meet;
					return response.meet;
				} else {
					this.error = "Impossible de charger les détails du rendez-vous";
					return null;
				}
			} catch (err) {
				console.error("Error loading meeting details:", err);
				this.error = err.message || "Une erreur s'est produite";
				return null;
			} finally {
				this.meetingLoading = false;
			}
		},

		// Load meetings data
		async fetchMeetings() {
			// Skip if already loading
			if (this.meetsLoading) return;

			try {
				this.meetsLoading = true;

				// Get all scheduled meetings from API
				const meetsData = await trpc.getMeets.query({});

				if (meetsData.success) {
					this.meets = meetsData.meets;

					//add some props
					this.meets.forEach((meet) => {
						meet.link = "/meets/" + meet.id;
					});

					console.log("Loaded meetings:", this.meets);

					// Update patients with their meeting info
					this.updatePatientsWithMeetings();
				} else {
					console.error("Failed to load meetings:", meetsData);
					this.error = "Impossible de charger les données des rendez-vous";
				}
			} catch (err) {
				console.error("Error loading meetings:", err);
				this.error = "Erreur lors du chargement des rendez-vous";
			} finally {
				this.meetsLoading = false;
			}
		},

		// Update patients with their next meeting info
		updatePatientsWithMeetings() {
			if (!this.patients.length || !this.meets.length) return;

			const now = new Date();

			this.patients.forEach((patient) => {
				// Find the next meeting for this patient (only future meetings)
				const patientMeets = this.meets
					.filter((meet) => {
						const meetingStart = new Date(meet.startTime);
						return (
							meet.patientId === patient.id &&
							meet.status === "scheduled" &&
							meetingStart >= now
						);
					})
					.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

				const nextMeet = patientMeets[0];

				if (nextMeet) {
					patient.nextMeeting = nextMeet.startTime;
					patient.agenda = nextMeet.title;
					patient.roomStatus = "scheduled";
				} else {
					patient.nextMeeting = null;
					patient.agenda = "Aucun rendez-vous planifié";
				}
			});
		},

		// Schedule a new meeting
		async scheduleMeeting(meetingData) {
			try {
				// Format the startTime as ISO string
				const formattedMeetingData = {
					...meetingData,
					startTime: this.formatISOString(meetingData.startTime),
					// ownerName: meetingData.ownerName || "Dr. John Doe",
				};

				// Create meeting via TRPC
				const result = await trpc.scheduleMeet.mutate(formattedMeetingData);

				if (result.success) {
					console.log("Meeting scheduled:", result.meet);

					// Reload meetings and update patients
					await this.fetchMeetings();
					return { success: true, meet: result.meet };
				} else {
					return {
						success: false,
						error: "Erreur lors de la planification du rendez-vous",
					};
				}
			} catch (err) {
				console.error("Error scheduling meeting:", err);
				return {
					success: false,
					error: err.message || "Une erreur est survenue",
				};
			}
		},

		// Save meeting notes
		async saveNotes(meetId, notes) {
			try {
				this.saveNoteStatus = "saving";

				await trpc.updateMeet.mutate({
					meetData: { notes },
					meetId,
				});

				if (this.currentMeeting && this.currentMeeting.id === meetId) {
					this.currentMeeting.notes = notes;
				}

				this.saveNoteStatus = "success";

				// Reset status after 3 seconds
				setTimeout(() => {
					this.saveNoteStatus = "idle";
				}, 3000);

				return { success: true };
			} catch (err) {
				console.error("Error saving notes:", err);
				this.saveNoteStatus = "error";
				return { success: false, error: err.message };
			}
		},

		// Cancel a meeting
		async cancelMeeting(meetId, reason) {
			try {
				const result = await trpc.cancelMeet.mutate({
					meetId,
					reason,
				});

				if (result.success) {
					// Update the current meeting if it's loaded
					if (this.currentMeeting && this.currentMeeting.id === meetId) {
						this.currentMeeting.status = "canceled";
						this.currentMeeting.cancelReason = reason;
					}

					// Also update in the meetings list if it exists there
					const meetIndex = this.meets.findIndex((m) => m.id === meetId);
					if (meetIndex >= 0) {
						this.meets[meetIndex].status = "canceled";
						this.meets[meetIndex].cancelReason = reason;
					}

					return { success: true };
				}

				return {
					success: false,
					error: "Erreur lors de l'annulation du rendez-vous",
				};
			} catch (err) {
				console.error("Error canceling meeting:", err);
				return {
					success: false,
					error: err.message || "Une erreur est survenue",
				};
			}
		},

		// Helper functions for date/time formatting are imported from dateUtils
		formatISOString(date) {
			return formatISOString(date);
		},

		// Format date for display
		formatDate(date) {
			return formatDate(date);
		},

		// Format date and time with weekday
		formatDateTime(date) {
			return formatDateTime(date);
		},

		// Format time only
		formatTime(date) {
			return formatTime(date);
		},

		// Get badge class based on status
		getBadgeClass(status) {
			const classes = {
				available: "bg-green-100 text-green-800",
				scheduled: "bg-yellow-100 text-yellow-800",
				inactive: "bg-gray-100 text-gray-800",
			};
			return classes[status] || "";
		},

		// Format status for display
		formatStatus(status) {
			const statusTranslations = {
				available: "Disponible",
				scheduled: "Programmé",
				inactive: "Inactif",
			};
			return statusTranslations[status] || status;
		},
	},
});
