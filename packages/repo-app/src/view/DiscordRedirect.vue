<script setup>
import { onMounted } from "vue";
import { appConfigs } from "@/appConfigs.js";

onMounted(() => {
	window.location.href = appConfigs.DISCORD_URL;
});
</script>

<template>
  <div class="flex items-center justify-center h-screen">
    <p>Redirecting to Discord...</p>
  </div>
</template>