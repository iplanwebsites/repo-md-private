<script setup>
import { ArrowRight } from "lucide-vue-next";
import { defineProps, computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
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

const hasOrg = computed(() => {
	return route.query.orgId || props.orgId;
});

const repoLink = computed(() => {
	return hasOrg.value ? `/new?orgId=${hasOrg.value}` : "/new";
});

const templatesLink = computed(() => {
	return hasOrg.value ? `/new/${hasOrg.value}/templates` : "/templates";
});
</script>

<template>
  <div class="mt-8 text-center">
    <router-link :to="repoLink">
      <button
        class="text-muted-foreground hover:text-foreground flex items-center justify-center mx-auto mb-2"
      >
        Choose Another Repository
        <ArrowRight class="w-4 h-4 ml-1" />
      </button>
    </router-link>
    <router-link :to="templatesLink">
      <button
        class="text-muted-foreground hover:text-foreground flex items-center justify-center mx-auto"
      >
        Browse Templates <ArrowRight class="w-4 h-4 ml-1" />
      </button>
    </router-link>
  </div>
</template>
