<script setup>
import { ref, onMounted } from "vue";
import Blocks from "@/components/pushmd/Blocks.vue";
import { careersBlocks } from "@/brochureContent/careersContent";
</script>

<template>
  <div class="min-h-screen bg-background">
    <main>
      <!-- Use the Blocks component to render content -->
      <Blocks :blocks="careersBlocks" />
    </main>
  </div>
</template>