<script setup>
import { ref, computed } from "vue";
</script>

<template>
  <router-view :key="$route.path" />
</template>
