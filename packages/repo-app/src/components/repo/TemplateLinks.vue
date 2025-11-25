<script setup>
import { ArrowRight } from "lucide-vue-next";
import { defineProps } from "vue";

const props = defineProps({
	routePrefix: {
		type: String,
		default: "/new",
	},
	orgId: {
		type: String,
		default: "",
	},
});
</script>

<template>
  <div class="mt-4 pt-2">
    <div class="flex flex-col gap-2">
      <!-- 
      <router-link
        :to="`${routePrefix}/import`"
        class="text-muted-foreground hover:text-foreground flex items-center text-sm"
      >
        Import Third-Party Git Repository
        <ArrowRight class="h-4 w-4 ml-1" />
      </router-link> -->

      <router-link
        :to="orgId ? `${routePrefix}/${orgId}/templates` : '/templates'"
        class="text-muted-foreground hover:text-foreground flex items-center text-sm"
      >
        Browse All Templates
        <ArrowRight class="h-4 w-4 ml-1" />
      </router-link>
    </div>
  </div>
</template>
