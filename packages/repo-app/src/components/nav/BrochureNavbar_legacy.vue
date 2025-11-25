<script setup>
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

const session = ref(null);
async function a() {
	const s = await getSession();
	console.log(s);
	session.value = s;
}
a();
</script>

<template>
  <div
    class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div class="container mx-auto px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-6">
          <router-link to="/" class="font-bold text-xl">
            <Logotype />
          </router-link>

          <NavbarBrochureMenu />
        </div>

        <!--   {{ session }}
       -->

        <NavbarLoginCta v-if="!session" />
        <NavbarLoggedMenu :session="session" v-else />
      </div>
    </div>
  </div>
</template>
