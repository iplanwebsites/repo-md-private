<script setup>
import { ref, computed } from "vue";
import { useOrgStore } from "@/store/orgStore";
import { RefreshCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { useRouter } from "vue-router";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import LogViewer from "@/components/LogViewer.vue";

// Define props from parent
const props = defineProps({
	deployment: {
		type: Object,
		required: true,
	},
	isLoading: {
		type: Boolean,
		default: false,
	},
	error: {
		type: [String, Object, null],
		default: null,
	},
});

// Define emits to parent
const emit = defineEmits(["refresh"]);

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);
</script>

<template>
  <PageHeadingBar
    title="Logs"
    subtitle="Internal logs of the Repo.md converter"
  >
    <Button @click="emit('refresh')" variant="outline" class="mr-2">
      <RefreshCw class="mr-1 h-4 w-4" />
      Refresh
    </Button>
  </PageHeadingBar>

  <div class="container px-4 py-4">
    <!-- Loading state -->
    <div v-if="isLoading" class="py-8 flex justify-center">
      <div
        class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"
      ></div>
    </div>

    <!-- Log viewer component -->
    <LogViewer
      v-else
      :logs="deployment.logs || []"
      :jobInfo="deployment"
      title="Deployment Logs"
      subtitle="Internal logs of the repository conversion process"
      :showInfo="true"
      maxHeight="8500px"
    />
  </div>
</template>
