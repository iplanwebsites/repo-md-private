<script setup>
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Button } from "@/components/ui/button";
import {
	ChevronRight,
	Link2,
	Drill,
	File,
	AudioLines,
	MessageSquare,
	Info,
} from "lucide-vue-next";
import { useToast } from "@/components/ui/toast/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CardTitle from "@/components/CardTitle.vue";
import InfoTooltip from "@/components/InfoTooltip.vue";

const props = defineProps({
	patientId: {
		type: String,
		required: true,
	},
	activities: {
		type: Array,
		required: true,
	},
});

const router = useRouter();
const route = useRoute();
const { toast } = useToast();

const selectedActivityTab = ref("available");
const showAllActivities = ref(false);

// Computed
const filteredActivities = computed(() => {
	switch (selectedActivityTab.value) {
		case "completed":
			return props.activities.filter((activity) => activity.completed);
		case "available":
			return props.activities.filter(
				(activity) => !activity.completed && !activity.isLocked,
			);
		default: // 'all'
			return props.activities;
	}
});

const shownActivities = computed(() => {
	const filtered = filteredActivities.value;
	return showAllActivities.value ? filtered : filtered.slice(0, 4);
});

const hasMoreActivities = computed(() => {
	return filteredActivities.value.length > 3;
});

// Methods
const handleActivityClick = async (activity) => {
	if (activity.completed) {
		router.push(
			`/client/${props.patientId}/convo/${activity?.lastCompletedConvo?.id}`,
		);
	} else {
		try {
			console.log("Copying invite link for activity:", activity);
			const inviteUrl = `${window.location.origin}${activity.inviteUrl}`;
			await navigator.clipboard.writeText(inviteUrl);

			toast({
				title: "Lien copié !",
				description:
					"Le lien d'invitation a été copié dans votre presse-papiers.",
			});
		} catch (err) {
			toast({
				title: "Erreur",
				description: "Impossible de copier le lien.",
				variant: "destructive",
			});
		}
	}
};

// Utility function to determine tag color based on activity type
const getTagColor = (activity) => {
	if (activity.adminDemo) return "yellow";
	if (activity.type === "realtime") return "purple";
	if (activity.type === "form") return "green";
	if (activity.activitySequence && activity.activitySequence > 100)
		return "red";
	return "blue";
};

// Utility function to determine tag text
const getTagText = (activity) => {
	if (activity.adminDemo) return "Admin";
	if (activity.type === "realtime") return "Realtime";
	if (activity.type === "form") return "Form";
	if (activity.activitySequence && activity.activitySequence > 100)
		return "TESTS";
	return null;
};

// Utility function to determine status
const getStatus = (activity) => {
	if (activity.completed) return "completed";
	if (activity.isLocked) return "locked";
	return "available";
};

// Utility function to determine button text
const getButtonText = (activity) => {
	return activity.completed ? "Voir les résultats" : "Copier le lien";
};

// Utility function to determine button icon
const getButtonIcon = (activity) => {
	return activity.completed ? ChevronRight : Link2;
};

// Utility function to determine tag icon based on activity type
const getTagIcon = (activity) => {
	if (activity.type === "form") return File;
	if (activity.type === "realtime") return AudioLines;
	if (activity.type === "chat") return MessageSquare;
	return null;
};
</script>

<template>
  <div class="p-6 w-full">
    <!-- CardTitle component for the header section -->
    <CardTitle
      title="Explorations"
      titleNo="Explorations et résultats"
      :icon="Drill"
      tooltipText="Les activités que votre client complète avec Repo.md"
    >
      <template #right>
        <Tabs v-model="selectedActivityTab" class="w-full">
          <TabsList>
            <TabsTrigger value="available">Disponibles</TabsTrigger>
            <TabsTrigger value="completed">Complétés</TabsTrigger>
          </TabsList>
          <TabsContent value="account"></TabsContent>
          <TabsContent value="password"></TabsContent>
        </Tabs>
      </template>
    </CardTitle>

    <!-- Activities using PrettyContentListItem -->
    <div>
      <div class="space-y-4">
        <PrettyContentListItem
          v-for="activity in shownActivities"
          :key="activity.id"
          :title="activity.activityName || activity.activityId + '⚠️' || 'N/A'"
          :img="activity.introImg"
          :status="getStatus(activity)"
          :tag-text="getTagText(activity)"
          :tag-color="getTagColor(activity)"
          :tag-icon="getTagIcon(activity)"
          :button-text="getButtonText(activity)"
          :button-icon="getButtonIcon(activity)"
          :active="
            activity.lastCompletedConvo &&
            route.params.convoId === activity.lastCompletedConvo.id
          "
          :disabled="!activity.completed && activity.isLocked"
          @click="handleActivityClick(activity)"
          :infoTooltip="activity.activityDesc"
        />

        <Button
          size="sm"
          variant="secondary"
          v-if="hasMoreActivities && !showAllActivities"
          @click="showAllActivities = !showAllActivities"
        >
          Voir tout...
        </Button>
      </div>
    </div>
  </div>
</template>
