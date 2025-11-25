// stores/settingsStore.js
import { defineStore } from "pinia";
import { ref, reactive, computed } from "vue";
import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";

export const useSettingsStore = defineStore("settings", () => {
	const { toast } = useToast();
	const isLoading = ref(false);
	const isSaving = ref(false);

	// Account settings state
	const account = reactive({
		name: "",
		email: "",
		timezone: "",
		language: "",
		profileImage: "",
		notificationPreferences: {
			email: false,
			push: false,
			sms: false,
		},
		github: null,
		githubHandle: "",
	});

	// État pour les paramètres de facturation
	const billing = reactive({
		currentPlan: "",
		expiryDate: "",
		autoRenew: false,
		paymentMethod: {
			type: "",
			last4: "",
			expiryDate: "",
		},
	});

	// État pour les paramètres de réunions
	const meetings = reactive({
		processAudioTranscripts: false,
		saveAudioFor30Days: false,
	});

	// État pour les notifications
	const notifications = reactive({
		email: false,
		browser: false,
		clientSignup: false,
		sessionReminder: false,
	});

	// Plans disponibles
	const availablePlans = reactive([]);

	// Calcul du plan actuel
	const currentPlanDetails = computed(() => {
		return (
			availablePlans.find((plan) => plan.id === billing.currentPlan) ||
			(availablePlans.length > 0 ? availablePlans[0] : null)
		);
	});

	// Charger les paramètres depuis le serveur
	async function loadSettings() {
		try {
			isLoading.value = true;

			// Load account settings using the new endpoint
			const accountResult = await trpc.getAccountSettings.query();
			console.log("Account Result:", accountResult);

			if (accountResult && accountResult.user) {
				// Map API response to our store structure
				const userData = accountResult.user;

				// Update account state
				account.name = userData.name || "";
				account.email = userData.email || "";
				account.timezone = userData.timezone || "";
				account.language = userData.language || "";
				account.profileImage = userData.profileImage || "";
				account.github = userData.github || null;
				account.githubHandle = userData.githubHandle || "";

				if (userData.notificationPreferences) {
					account.notificationPreferences = {
						...account.notificationPreferences,
						...userData.notificationPreferences,
					};
				}

				// Load other settings if needed - these might be moved to separate endpoints
				// in the future to match the account settings pattern
				try {
					// For now, legacy method for other settings
					const otherSettings = await trpc.getAccountSettings.query();

					if (otherSettings.billing) {
						Object.assign(billing, otherSettings.billing);
					}

					if (otherSettings.meetings) {
						Object.assign(meetings, otherSettings.meetings);
					}

					if (otherSettings.notifications) {
						Object.assign(notifications, otherSettings.notifications);
					}

					if (otherSettings.availablePlans) {
						availablePlans.splice(
							0,
							availablePlans.length,
							...otherSettings.availablePlans,
						);
					}
				} catch (otherError) {
					console.error("Error loading additional settings:", otherError);
					// Continue with just account settings
				}
			} else {
				console.error("Invalid account data structure:", accountResult);
				throw new Error("Invalid response format from server");
			}
		} catch (error) {
			console.error("Error loading settings:", error);
			toast({
				title: "Error",
				description: "Failed to load your settings. Please try again.",
				variant: "destructive",
			});
		} finally {
			isLoading.value = false;
		}
	}

	// Save account settings
	async function saveAccountSettings() {
		try {
			isSaving.value = true;

			// Map account state to API expected format
			// Note: we don't include email since it's not editable
			const accountData = {
				name: account.name,
				// email is omitted intentionally as it's not editable by the user
				timezone: account.timezone,
				language: account.language,
				profileImage: account.profileImage,
				notificationPreferences: account.notificationPreferences,
			};

			// Only include properties that have values
			const filteredData = Object.fromEntries(
				Object.entries(accountData).filter(([_, value]) => {
					// Special handling for objects like notificationPreferences
					if (typeof value === "object" && value !== null) {
						return Object.keys(value).length > 0;
					}
					return value !== undefined && value !== null && value !== "";
				}),
			);

			// Call the updateAccountSettings endpoint
			const updatedUser = await trpc.updateAccountSettings.mutate(filteredData);
			console.log("Update result:", updatedUser);

			if (updatedUser) {
				toast({
					title: "Settings saved",
					description: "Your account settings have been updated successfully.",
					duration: 3000,
				});

				// Update local state with returned user data
				if (updatedUser) {
					account.name = updatedUser.name || account.name;
					account.email = updatedUser.email || account.email;
					account.timezone = updatedUser.timezone || account.timezone;
					account.language = updatedUser.language || account.language;
					account.profileImage =
						updatedUser.profileImage || account.profileImage;

					if (updatedUser.notificationPreferences) {
						account.notificationPreferences = {
							...account.notificationPreferences,
							...updatedUser.notificationPreferences,
						};
					}
				}
			} else {
				throw new Error("No data returned from server");
			}
		} catch (error) {
			console.error("Error saving account settings:", error);
			toast({
				title: "Error",
				description: "Failed to save your account settings. Please try again.",
				variant: "destructive",
			});
		} finally {
			isSaving.value = false;
		}
	}

	// Sauvegarder les paramètres sur le serveur - legacy method for non-account settings
	async function saveSettings(section) {
		try {
			isSaving.value = true;

			// Handle account settings using the new dedicated function
			if (section === "account") {
				await saveAccountSettings();
				return;
			}

			let dataToSave = {};

			// Déterminer quelles données envoyer selon la section
			if (section === "billing") {
				dataToSave = { billing };
			} else if (section === "meetings") {
				dataToSave = { meetings };
			} else if (section === "notifications") {
				dataToSave = { notifications };
			} else {
				// Si aucune section spécifiée, envoyer tous les paramètres
				dataToSave = { billing, meetings, notifications };
			}

			// Appel API pour sauvegarder les paramètres
			await trpc.updateUserSettings.mutate(dataToSave);

			toast({
				title: "Modifications enregistrées",
				description: "Vos paramètres ont été mis à jour avec succès.",
				duration: 3000,
			});
		} catch (error) {
			console.error("Erreur lors de la sauvegarde des paramètres:", error);
			toast({
				title: "Erreur",
				description:
					"Impossible d'enregistrer vos modifications. Veuillez réessayer.",
				variant: "destructive",
			});
		} finally {
			isSaving.value = false;
		}
	}

	// Changer de forfait
	async function changePlan(planId) {
		try {
			isSaving.value = true;

			// Appel API pour changer de forfait
			await trpc.changeBillingPlan.mutate({ planId });

			// Mise à jour de l'état local
			billing.currentPlan = planId;

			toast({
				title: "Forfait modifié",
				description: `Vous êtes maintenant sur le forfait ${availablePlans.find((p) => p.id === planId).name}.`,
				duration: 3000,
			});
		} catch (error) {
			console.error("Erreur lors du changement de forfait:", error);
			toast({
				title: "Erreur",
				description:
					"Impossible de modifier votre forfait. Veuillez réessayer.",
				variant: "destructive",
			});
		} finally {
			isSaving.value = false;
		}
	}

	// Modifier les paramètres d'auto-renouvellement
	async function toggleAutoRenew() {
		try {
			isSaving.value = true;

			// Inverser l'état actuel
			billing.autoRenew = !billing.autoRenew;

			// Appel API pour mettre à jour l'auto-renouvellement
			await trpc.updateAutoRenew.mutate({ autoRenew: billing.autoRenew });

			toast({
				title: billing.autoRenew
					? "Auto-renouvellement activé"
					: "Auto-renouvellement désactivé",
				description: billing.autoRenew
					? "Votre abonnement sera automatiquement renouvelé à l'échéance."
					: "Votre abonnement expirera à la date indiquée.",
				duration: 3000,
			});
		} catch (error) {
			console.error("Erreur lors de la modification du renouvellement:", error);

			// Restaurer l'état précédent en cas d'erreur
			billing.autoRenew = !billing.autoRenew;

			toast({
				title: "Erreur",
				description:
					"Impossible de modifier le paramètre d'auto-renouvellement. Veuillez réessayer.",
				variant: "destructive",
			});
		} finally {
			isSaving.value = false;
		}
	}

	return {
		isLoading,
		isSaving,
		account,
		billing,
		meetings,
		notifications,
		availablePlans,
		currentPlanDetails,
		loadSettings,
		saveSettings,
		saveAccountSettings,
		changePlan,
		toggleAutoRenew,
	};
});
