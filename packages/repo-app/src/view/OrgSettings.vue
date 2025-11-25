<script setup>
import { ref, computed } from "vue";
import { useOrgStore } from "@/store/orgStore";
import {
	Search,
	User,
	CreditCard,
	FileText,
	Users,
	Lock,
	Shield,
	Server,
	BadgeAlert,
	Save,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "vue-router";

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();

// Active section state
const activeSection = ref("general");

// Form data
const orgName = ref("");
const orgHandle = ref("");
const maxNameLength = 32;
const maxHandleLength = 48;

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);

// Load org data
const loadOrgData = () => {
	if (currentOrg.value) {
		orgName.value = currentOrg.value.name || "";
		orgHandle.value = currentOrg.value.handle || "";
	}
};

// Initialize data
loadOrgData();

// Save organization settings
const saveSettings = () => {
	// Implementation would depend on your API and store structure
	orgStore.updateOrgSettings({
		name: orgName.value,
		handle: orgHandle.value,
	});
};

// Change active section
const setActiveSection = (section) => {
	activeSection.value = section;
};

// Navigation sections
const navSections = [
	{ id: "general", name: "General", icon: User },
	{ id: "billing", name: "Billing", icon: CreditCard },
	{ id: "invoices", name: "Invoices", icon: FileText },
	{ id: "members", name: "Members", icon: Users },
	//{ id: "accessGroups", name: "Access Groups", icon: BadgeAlert },
	//{ id: "logDrains", name: "Log Drains", icon: Server },
	// { id: "security", name: "Security & Privacy", icon: Lock },
	// { id: "deployment", name: "Deployment Protection", icon: Shield },
	//{ id: "compute", name: "Secure Compute", icon: Server },
];
</script>

<template>
  <PageHeadingBar title="Settings">
    <!-- Action Buttons Group 
      <div class="flex items-center gap-2">
        <router-link :to="`/client/${patientDetails.id}/memory`">
          <Button class="flex items-center gap-2" variant="outline">
            <Brain class="w-4 h-4" />
            Mémoire
          </Button>
        </router-link>

        <router-link
          :to="`/client/${patientDetails.id}/fiche`"
          v-show="patientDetails.fiche"
        >
          <Button class="flex items-center gap-2" variant="outline">
            <Eye class="w-4 h-4" />
            Fiche
          </Button>
        </router-link>

        <ElipsisMenu :items="elipsis" v-if="elipsis.length">
          <Button variant="ghost" size="icon" class="rounded-full">
            <MoreHorizontal class="w-5 h-5" />
          </Button>
        </ElipsisMenu>
      </div>-->
  </PageHeadingBar>
  <div class="flex container">
    <!-- Sticky sidebar navigation -->
    <div class="w-64 border-r sticky top-0 h-screen overflow-y-auto">
      <div class="p-4">
        <div class="relative mb-6">
          <Search
            class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"
          />
          <Input placeholder="Search..." class="pl-10 w-full" />
        </div>

        <div class="space-y-1">
          <div class="flex items-center p-2 mb-4">
            <div
              class="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs mr-2"
            >
              {{ currentOrg?.name?.charAt(0) || "O" }}
            </div>
            <span class="font-medium">{{
              currentOrg?.name || "Organization"
            }}</span>
          </div>

          <button
            v-for="section in navSections"
            :key="section.id"
            class="flex items-center w-full p-2 rounded-md text-sm transition-colors"
            :class="
              activeSection === section.id
                ? 'bg-secondary font-medium'
                : 'hover:bg-secondary/50'
            "
            @click="setActiveSection(section.id)"
          >
            <component :is="section.icon" class="h-4 w-4 mr-2" />
            {{ section.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Content area -->
    <div class="flex-1 p-6 max-w-5xl">
      <!-- General Settings Section -->
      <div v-if="activeSection === 'general'">
        <div class="mb-8">
          <h2 class="text-2xl font-semibold mb-2">Team Name</h2>
          <p class="text-muted-foreground mb-4">
            This is your team's visible name within Push. For example, the name
            of your company or department.
          </p>
          <Input v-model="orgName" class="max-w-md" />
          <p class="text-sm text-muted-foreground mt-2">
            Please use {{ maxNameLength }} characters at maximum.
          </p>
        </div>

        <div class="mb-8 pb-4 border-b">
          <h2 class="text-2xl font-semibold mb-2">Team URL</h2>
          <p class="text-muted-foreground mb-4">
            This is your team's URL namespace on Push. Within it, your team can
            inspect their projects, check out any recent activity, or configure
            settings to their liking.
          </p>
          <div class="flex items-center max-w-md">
            <span
              class="px-3 py-2 bg-muted border border-r-0 rounded-l-md text-muted-foreground"
            >
              repo.md/
            </span>
            <Input v-model="orgHandle" class="rounded-l-none" />
          </div>
          <p class="text-sm text-muted-foreground mt-2">
            Please use {{ maxHandleLength }} characters at maximum.
          </p>
        </div>

        <Button @click="saveSettings">
          <Save class="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>

      <!-- Billing Section -->
      <div v-else-if="activeSection === 'billing'">
        <h2 class="text-2xl font-semibold mb-4">Billing Settings</h2>
        <p class="text-muted-foreground">
          Manage your billing information and subscription plans.
        </p>
        <!-- Billing content would go here -->
      </div>

      <!-- Other sections would have similar structure -->
      <div v-else>
        <h2 class="text-2xl font-semibold mb-4">
          {{ navSections.find((s) => s.id === activeSection)?.name }}
        </h2>
        <p class="text-muted-foreground">This section is under development.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styling can be added here if needed */
</style>
