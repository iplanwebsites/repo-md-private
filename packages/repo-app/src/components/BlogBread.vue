# ClientBreadcrumb.vue
<script setup>
import { ref, computed } from "vue";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Users, List } from "lucide-vue-next";

import { ChevronDown, Home } from "lucide-vue-next";

const props = defineProps({
	programName: {
		type: String,
		required: false,
		default: "",
	},
	title: {
		type: String,
		required: false,
		default: "",
	},
	clientId: {
		type: [String, Number],
		required: false,
	},
	programId: {
		type: [String, Number],
		required: false,
	},
	activityId: {
		type: [String, Number],
		required: false,
	},
	clients: {
		type: Array,
		required: false,
		default: () => [],
		//default: () => [{ name: 234 }],
	},
});

const filteredClients = computed(() => props.clients.filter((c) => true));
</script>

<template>
  <div class="hidden md:block">
    <Breadcrumb>
      <BreadcrumbList>
        <!-- Home -->
        <BreadcrumbItem>
          <BreadcrumbLink href="/">
            <Home class="w-4 h-4" />
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <!-- Clients -->
        <BreadcrumbItem>
          <BreadcrumbLink href="/blog">
            <!-- 
          <List class="w-4 h-4" /> -->
            Blog
          </BreadcrumbLink>
        </BreadcrumbItem>

        <!-- Activity Name -->
        <template v-if="title">
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span class="text-muted-foreground">{{ title }}</span>
          </BreadcrumbItem>
        </template>
      </BreadcrumbList>
    </Breadcrumb>

    <hr class="my-5" />
  </div>
</template>
