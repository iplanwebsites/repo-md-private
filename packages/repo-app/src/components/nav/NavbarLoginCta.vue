<script setup>
import { appConfigs } from '@/appConfigs';
import { Button } from '@/components/ui/button';
import { computed } from 'vue';

const isWaitlistMode = computed(() => appConfigs.WAITLIST_MODE);
</script>

<template>
  <div class="flex items-center gap-3">
    <template v-if="isWaitlistMode">
      <Button
        to="/waitlist"
       
      >
        Join Waitlist
      </Button>
    </template>
    <template v-else>
      <Button
        to="/login"
        variant="ghost"
        class="text-muted-foreground hover:text-foreground transition-colors"
      >
        Login
      </Button>

      <Button to="/signup">Get started</Button>
    </template>
  </div>
</template>
