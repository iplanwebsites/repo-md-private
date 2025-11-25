<!-- ActionBar.vue -->
<script setup>
import { Button } from "@/components/ui/button";
import { Plus, Mail, Calendar, MoreVertical } from "lucide-vue-next";
import ElipsisMenu from "./ElipsisMenu.vue";
import { ref } from "vue";

const actionMenuItems = ref([
	{
		label: "Exporter les données",
		action: () => console.log("Exporter les données"),
	},
	{
		label: "Paramètres d'affichage",
		action: () => console.log("Paramètres d'affichage"),
	},
	{ sep: true },
	{
		label: "Aide",
		action: () => console.log("Aide"),
	},
]);

defineEmits(["newActivity", "planMeeting", "addClient"]);
</script>

<template>
  <div
    class="w-full bg-background border-b flex items-center justify-between px-4 py-2"
  >
    <h1 class="text-xl font-semibold">Tableau de bord</h1>

    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        class="flex items-center gap-2"
        @click="$emit('newActivity')"
      >
        <Mail class="h-4 w-4" />
        <span>Envoyer une activité</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        class="flex items-center gap-2"
        @click="$emit('planMeeting')"
      >
        <Calendar class="h-4 w-4" />
        <span>Planifier un rdv</span>
      </Button>

      <router-link to="/invite-client">
        <Button
          variant="default"
          size="sm"
          class="flex items-center gap-2 bg-primary text-primary-foreground"
          @click="$emit('addClient')"
        >
          <Plus class="h-4 w-4" />
          <span>Ajouter un client</span>
        </Button>
      </router-link>
      <ElipsisMenu :items="actionMenuItems" />
    </div>
  </div>
</template>
