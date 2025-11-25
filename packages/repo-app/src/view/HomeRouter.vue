// Homerouter.vue
<script setup>
import { defineProps, onMounted, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { useOrgStore } from "@/store/orgStore";
import { appConfigs } from "@/appConfigs";

import BrochureLanding from "./brochure/BrochureHome.vue";

const props = defineProps({
	session: {
		type: Object,
		default: null,
	},
});

const router = useRouter();
const orgStore = useOrgStore();
const isWaitlistMode = computed(() => appConfigs.WAITLIST_MODE);

const redirectToOrg = async () => {
	if (!props.session) return;

	// Allow all authenticated users regardless of waitlist mode

	if (orgStore.orgs.length === 0 && !orgStore.orgsLoading) {
		await orgStore.fetchOrgs();
	}

	// Wait until orgs are loaded
	if (orgStore.orgsLoading) {
		// If still loading, watch for changes
		watch(
			() => orgStore.orgsLoading,
			(isLoading) => {
				if (!isLoading && orgStore.orgs.length > 0) {
					const personalOrg = orgStore.personalOrg;
					if (personalOrg) {
						router.replace(`/${personalOrg.handle}`);
					} else if (orgStore.orgs[0]) {
						router.replace(`/${orgStore.orgs[0].handle}`);
					}
				}
			},
		);
	} else if (orgStore.orgs.length > 0) {
		// Orgs already loaded
		const personalOrg = orgStore.personalOrg;
		if (personalOrg) {
			router.replace(`/${personalOrg.handle}`);
		} else if (orgStore.orgs[0]) {
			router.replace(`/${orgStore.orgs[0].handle}`);
		}
	}
};

onMounted(() => {
	// Allow homepage to display even in waitlist mode
	if (props.session) {
		redirectToOrg();
	}
});

// Watch for session changes
watch(
	() => props.session,
	(newSession) => {
		if (newSession) {
			redirectToOrg();
		}
		// Allow unauthenticated users to see the homepage even in waitlist mode
	},
	{ immediate: true },
);
</script>

<template>
  <BrochureLanding v-if="!session" />
  <!-- Loading state while redirecting logged-in users -->
  <div v-else-if="session" class="flex items-center justify-center min-h-screen bg-surface">
    <div class="spinner"></div>
  </div>
</template>

<style scoped>
.bg-surface {
  background-color: hsl(var(--background));
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #09f;
  animation: spin 1s ease infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
