<script setup>
import { ref, computed } from "vue";
import { useOrgStore } from "@/store/orgStore";
import {
  Search,
  Database,
  FileText,
  Code,
  Brain,
  Server,
  Sparkles,
  ExternalLink,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "vue-router";

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);

// Props
defineProps({
  project: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <PageHeadingBar title="AI" subtitle="AI features and configuration">
    <!--  
    <template #secondary>
      <div>
        <router-link :to="`/{currentOrg.handle}/~/settings`">
          <Button class="flex items-center" size="sm" variant="ghost">
            <CornerLeftUp class="w-4 h-4 mr-2" />
            Go to Team settings
          </Button>
        </router-link>
      </div>
    </template>-->
  </PageHeadingBar>

  <div class="flex container">
    <div class="w-full p-6 bg-white rounded-lg shadow-sm">
      <div class="flex items-center gap-2 mb-4">
        <Brain class="w-5 h-5 text-primary" />
        <h2 class="text-xl font-semibold">AI Features</h2>
      </div>
      <div class="p-8 text-center">
        <Sparkles class="w-12 h-12 mx-auto mb-4 text-primary/50" />
        <p class="text-lg text-muted-foreground">AI features coming soon</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styling can be added here if needed */
</style>