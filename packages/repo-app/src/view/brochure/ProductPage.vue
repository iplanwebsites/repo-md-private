<script setup>
import { ref } from "vue";
import Blocks from "@/components/pushmd/Blocks.vue";
import { productBlocks } from "@/brochureContent";

// Use the imported blocks content, wrapped in ref to make it reactive
const blocks = ref(productBlocks);
</script>

<template>
  <div class="min-h-screen bg-background">
    <main>
      <Blocks :blocks="blocks" />
    </main>
  </div>
</template>