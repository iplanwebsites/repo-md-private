// ClientDashboard.vue
<script setup>
import { ref, onMounted } from "vue";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import trpc from "@/trpc";
import { formatDate } from "@/lib/utils/dateUtils";
import { useMeetingStore } from "@/store/meetingStore";

// State management for data and loading
const clients = ref([]);
const loading = ref(true);
const error = ref(null);
const activeTab = ref("all");

// Load data from meeting store
onMounted(() => {
	try {
		loading.value = true;
		const meetingStore = useMeetingStore();
		// Keeping original property names from API response
		clients.value = meetingStore.patients.map((patient) => ({
			...patient,
			activities: patient.activities?.filter((a) => a.completed).length || 0,
			lastUpdate: patient.lastUpdate || new Date(),
			status: patient.status || "active",
			program: patient.program || "General Program",
		}));
	} catch (err) {
		console.error("Error loading patients:", err);
		error.value = "Unable to load client data";
	} finally {
		loading.value = false;
	}
});

// Get badge class based on status
const getBadgeClass = (status) => {
	const classes = {
		active: "bg-green-100 text-green-800",
		paused: "bg-yellow-100 text-yellow-800",
		new: "bg-blue-100 text-blue-800",
	};
	return classes[status] || "";
};

// Format status text
const formatStatus = (status) => {
	return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
};
</script>

<template>
  <div class="px-4 py-6 lg:px-8 bg-surface">
    <ClientBread :clientId="1" />

    <div class="container mx-auto">
      <!-- Header -->
      <div class="text-center my-16">
        <h1 class="text-4xl font-bold mb-4">Mes Clients</h1>
        <p class="text-xl text-muted-foreground mb-8">
          Gérez vos clients et leurs activités ici
        </p>
      </div>
      <router-link to="invite-client">
        <Button class="mb-8">Ajouter un client</Button>
      </router-link>

      <!-- Error message -->
      <div v-if="error" class="text-center mb-8 text-red-600">
        {{ error }}
      </div>

      <div class="flex flex-row gap-4">
        <!-- Client list -->
        <div class="flex-none w-full md:w-2/3">
          <!-- Loading state -->
          <div v-if="loading" class="grid gap-6">
            <Card v-for="i in 3" :key="i" class="p-6">
              <div class="animate-pulse">
                <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div class="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div class="h-4 bg-gray-200 rounded w-1/5"></div>
              </div>
            </Card>
          </div>

          <!-- Loaded client list -->
          <div v-else class="grid gap-6">
            <router-link
              v-for="client in clients"
              :key="client.id"
              :to="'/client/' + client.id"
            >
              <Card class="p-6 transition-shadow hover:shadow-lg">
                <div class="flex justify-between items-start">
                  <div>
                    <h2 class="text-2xl font-semibold mb-2">
                      {{ client.name }}
                    </h2>

                    <p class="text-sm mt-2">
                      Activités complétées:
                      <span class="font-semibold">
                        {{ client.nbCompletedActivities || "TBD" }}
                      </span>
                    </p>
                  </div>
                  <Badge :class="getBadgeClass(client.status)">
                    {{ formatStatus(client.status) }}
                  </Badge>
                </div>
                <div class="mt-4 text-sm text-muted-foreground">
                  Dernière mise à jour:
                  {{ formatDate(client.lastUpdate) }}
                </div>
              </Card>
            </router-link>
          </div>

          <EmptyStateMsg
            v-show="!loading && clients.length === 0"
            title="Your clients will appear here"
            description="Start by adding your first client"
            :primaryCta="{
              label: 'Add client',
            }"
            :secondaryCta="{
              label: 'How it works',
            }"
          />
        </div>

        <!-- Sidebar -->
        <div class="rightPane flex-none w-1/3 hidden md:block">
          <Tabs v-model="activeTab" class="space-y-6">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="paused">Paused</TabsTrigger>
            </TabsList>
          </Tabs>

          <Card class="p-6 mt-4">
            <h3 class="font-semibold mb-4">Summary</h3>
            <div class="space-y-2">
              <p class="text-sm text-muted-foreground">
                Total clients: {{ clients.length }}
              </p>
              <p class="text-sm text-muted-foreground">
                Active clients:
                {{ clients.filter((c) => c.status === "active").length }}
              </p>
              <p class="text-sm text-muted-foreground">
                New clients:
                {{ clients.filter((c) => c.status === "new").length }}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
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
</style>
