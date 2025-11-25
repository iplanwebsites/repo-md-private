// Account settings routes configuration
const accountSettingsRoutes = [
	{
		path: "/settings",
		name: "accountSettings",
		component: () =>
			import("@/view/account-settings/AccountSettingsLayout.vue"),
		redirect: { name: "accountSettingsTab", params: { tab: "account" } },
		meta: { title: "Account Settings" },

		children: [
			{
				path: "", ///general
				name: "accountSettings.account",
				component: () => import("@/view/account-settings/AccountTab.vue"),
				meta: { title: "Account Settings" },
			},
			{
				path: "billing",
				name: "accountSettings.billing",
				component: () => import("@/view/account-settings/BillingTab.vue"),
				meta: { title: "Billing" },
			},
			{
				path: "apikeys",
				name: "accountSettings.apikeys",
				component: () => import("@/view/account-settings/ApiKeysTab.vue"),
				meta: { title: "API Keys" },
			},
			{
				path: "notifications",
				name: "accountSettings.notifications",
				component: () => import("@/view/account-settings/NotificationsTab.vue"),
				meta: { title: "Notifications" },
			},
			{
				path: "integrations",
				name: "accountSettings.integrations",
				component: () => import("@/view/account-settings/IntegrationsTab.vue"),
				meta: { title: "Integrations" },
			},
		],
	},
];

export default accountSettingsRoutes;
