<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

import {
	supabase,
	refreshSupaSession,
	getSupaUser,
	getSession,
} from "@/lib/supabaseClient";

const DEFAULT_MENU = "brochure";

///props: menu, defaults to 'brochure'
const props = defineProps({
	menu: {
		type: [String, null, undefined],
		default: null,
	},
});

// Computed property to handle null/undefined menu values
const currentMenu = computed(() => props.menu || DEFAULT_MENU);

const session = ref(null);
async function a() {
	const s = await getSession();
	console.log(s);
	session.value = s;
}
a();

const route = useRoute();
// Route params for ProjectBreadcrumb
const orgId = computed(() => route.params.orgId);
const projectId = computed(() => route.params.projectId);
const deployId = computed(() => route.params.deployId);

const orgName = ref("");
const projectName = ref("");

// Get deployment status color from store
import { useDeploymentStatus } from "@/store/deploymentStore";
const { deploymentStatusColor } = useDeploymentStatus();
const deployStatus = computed(() => deploymentStatusColor.value);


const isLoggedIn = computed(() => {
  return session.value && session.value.user;
});


const logoLink = computed(() => {

const brochureHomePath = isLoggedIn.value
  ? "/home"
  : "/";

  return currentMenu.value === "brochure" ? brochureHomePath : `/${orgId.value || ""}`;

	return currentMenu.value === "brochure" ? "/home" : `/${orgId.value || ""}`;
});
</script>

<template>
  <div
    class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div :class="[currentMenu === 'brochure' ? 'container mx-auto' : '', 'px-4 py-3']">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Logotype :to="logoLink" />

          <NavbarBrochureMenu
            v-show="currentMenu === 'brochure'"
            class="ml-4"
          />
          <ProjectBread
            v-if="orgId"
            :session="session"
            :orgId="orgId"
            :projectId="projectId"
            :orgName="orgName"
            :projectName="projectName"
            :orgs="orgs"
            :deployId="deployId"
            :deployStatus="deployStatus"
            v-show="currentMenu === 'project'"
          />
        </div>

        <!--   {{ session }}
       -->

        <NavbarLoginCta v-if="!session" />
        <NavbarLoggedMenu :session="session" :menu="menu" v-else />
      </div>
    </div>
  </div>
</template>
