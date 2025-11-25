<script setup>
import { ref, computed, onMounted, watch } from "vue";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronDown, ChevronsUpDown, Home, BookUp } from "lucide-vue-next";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "vue-router";
import { useOrgStore } from "@/store/orgStore";

const router = useRouter();
const orgStore = useOrgStore();

const props = defineProps({
	session: {
		type: Object,
		required: false,
	},
	orgName: {
		type: String,
		required: false,
		default: "",
	},
	projectName: {
		type: String,
		required: false,
		default: "",
	},
	activityName: {
		type: String,
		required: false,
		default: "",
	},
	orgId: {
		type: [String, Number],
		required: true,
	},
	projectId: {
		type: [String, Number],
		required: false,
	},
	activityId: {
		type: [String, Number],
		required: false,
	},
	orgs: {
		type: Array,
		required: false,
		default: () => [],
	},
	deployId: {
		type: [String, Number],
		required: false,
	},
	deployStatus: {
		type: String, // "green", "yellow", "red", "gray"
		required: false,
		default: "gray",
	},
});

const user = computed(() => ({
	email: props.session?.user?.email || "",
	avatar: props.session?.user?.user_metadata?.avatar_url || "",
	name:
		props.session?.user?.user_metadata?.full_name ||
		props.session?.user?.email?.split("@")[0] ||
		"",
}));

const displayOrgName = computed(() => props.orgName || `${props.orgId}`);
const orgPlan = "basic";

const avatar = computed(() => {
	const org = orgStore.orgs.find((o) => o.id === props.orgId);
	return org ? org.avatar || user.value.avatar : user.value.avatar;
});

const displayProjectName = computed(
	() => props.projectName || (props.projectId ? `${props.projectId}` : ""),
);

const filteredOrgs = computed(() => {
	if (orgStore.orgs.length > 0) {
		return orgStore.orgs;
	}
	return props.orgs.filter((o) => true);
});

const deployStatusColor = computed(() => {
	const statusMap = {
		green: "bg-green-500",
		yellow: "bg-yellow-500",
		red: "bg-red-500",
		gray: "bg-gray-400",
	};
	return statusMap[props.deployStatus] || "bg-gray-400";
});

const navigateToHome = () => router.push("/");
const navigateToOrg = () => router.push(`/${props.orgId}`);
const navigateToProject = () => {
	if (props.deployId) {
		router.push(`/${props.orgId}/${props.projectId}/deployments`);
	} else {
		router.push(`/${props.orgId}/${props.projectId}`);
	}
};

const isLoading = computed(() => orgStore.orgsLoading || orgStore.orgLoading);
const orgExists = computed(() => {
	// If we're still loading, assume org exists (show breadcrumb while loading)
	if (isLoading.value) return true;
	
	// Check if the current org exists
	if (props.orgId) {
		// First check if it's in the current org
		if (orgStore.currentOrg && 
			(orgStore.currentOrg._id === props.orgId || 
			orgStore.currentOrg.handle === props.orgId)) {
			return true;
		}
		
		// Then check in all orgs
		const found = orgStore.orgs.some(org => 
			org._id === props.orgId || org.handle === props.orgId
		);
		return found;
	}
	
	return true; // Default to showing if no orgId is provided
});

// Check org when component mounts and when org changes
onMounted(async () => {
	if (orgStore.orgs.length === 0) {
		await orgStore.fetchOrgs();
	}
});
</script>

<template>
  <div v-if="orgExists" class="hidden md:block">
    <Breadcrumb>
      <BreadcrumbList>
        <!-- 
            <BookUp class="w-6 h-6" style="opacity: 100; color: black" />
      -->

        <!-- Home 
        <BreadcrumbItem>
          <BreadcrumbLink
            @click.prevent="navigateToHome"
            class="cursor-pointer"
          >
            <logotype height="20" variant="purple" />
            ></BreadcrumbLink>
        </BreadcrumbItem>
-->
        <BreadcrumbSeparator />

        <!-- Organization -->
        <BreadcrumbItem>
          <div class="flex items-center gap-1">
            <BreadcrumbLink
              @click.prevent="navigateToOrg"
              class="cursor-pointer"
            >
              <img
                :src="avatar"
                alt=""
                class="w-5 h-5 rounded-full inline mr-2"
              />
              {{ displayOrgName }}
              <span
                class="inline-flex items-center rounded-full border border-blue-500 bg-white px-2 py-0.5 text-xs font-medium text-blue-500"
              >
                {{ orgPlan }}
              </span>
            </BreadcrumbLink>
            <DropdownMenu
              v-if="!orgStore.orgsLoading && filteredOrgs.length > 0"
            >
              <DropdownMenuTrigger class="p-1 hover:bg-gray-100 rounded">
                <ChevronsUpDown class="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                class="max-h-64 overflow-y-auto"
              >
                <DropdownMenuItem
                  v-for="org in filteredOrgs"
                  :key="org._id || org.id"
                  @click="router.push(`/${org.handle || org.id}`)"
                  class="cursor-pointer"
                >
                  <div class="flex flex-col">
                    <span>{{ org.name }}</span>
                    <span class="text-xs text-gray-500" v-if="org.description">
                      {{ org.description }}
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </BreadcrumbItem>

        <!-- Project -->
        <template v-if="projectId">
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              @click.prevent="navigateToProject"
              class="cursor-pointer"
            >
              <img
                :src="avatar"
                alt=""
                class="w-5 h-5 rounded-full inline mr-2"
              />
              {{ displayProjectName }}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </template>

        <!-- Activity -->
        <template v-if="activityName">
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span class="text-muted-foreground">{{ activityName }}</span>
          </BreadcrumbItem>
        </template>

        <!-- Deploy -->
        <template v-if="deployId">
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span class="inline-flex items-center gap-2">
              <span :class="['w-2 h-2 rounded-full', deployStatusColor]"></span>
              <span class="text-muted-foreground"> {{ deployId }}</span>
            </span>
          </BreadcrumbItem>
        </template>
      </BreadcrumbList>
    </Breadcrumb>
  </div>
</template>
