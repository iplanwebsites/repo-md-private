<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import WebhookEventsTable from "@/components/WebhookEventsTable.vue";
import PageHeadingBar from "@/components/PageHeadingBar.vue";

const route = useRoute();
const orgId = computed(() => route.params.orgId);
</script>

<template>
  <div>
    <PageHeadingBar
      title="Organization Webhook Events"
      subtitle="GitHub webhook events and automated deployments for all projects in this organization"
    />

    <div class="container">
      <WebhookEventsTable
        scope="organization"
        :org-id="orgId"
        :show-repository="true"
      />
    </div>
  </div>
</template>