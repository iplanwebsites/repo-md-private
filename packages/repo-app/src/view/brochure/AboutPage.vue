<script setup>
import { ref, onMounted } from "vue";
import Blocks from "@/components/pushmd/Blocks.vue";
import { aboutBlocks } from "@/brochureContent";
</script>

<template>
  <div class="min-h-screen bg-background">
    <main>
      <!-- Use the Blocks component to render content -->
      <Blocks :blocks="aboutBlocks" />
    </main>
  </div>
</template>
