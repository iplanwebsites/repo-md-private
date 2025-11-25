<script setup>
// Vous pouvez ajouter des props si nécessaire
defineProps({
	variant: {
		type: String,
		default: "default", // options: 'default', 'light', 'dark'
	},
	logoSize: {
		type: String,
		default: "md", // options: 'sm', 'md', 'lg'
	},
});
</script>

<template>
  <div class="powered-by-container" :class="[`variant-${variant}`]">
    <div class="powered-by-content">
      <div class="powered-by-text">Powered by</div>
      <div class="logo-container" :class="[`logo-${logoSize}`]">
        <Logotype :variant="variant === 'light' ? 'light' : 'dark'" />
      </div>
      <div class="powered-by-tagline">The AI CMS</div>
    </div>
  </div>
</template>

<style scoped>
.powered-by-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 1rem;
  margin-top: 2rem;
}

.powered-by-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.powered-by-text {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: var(--text-muted);
}

.logo-container {
  margin-bottom: 0.5rem;
}

.logo-sm {
  transform: scale(0.8);
}

.logo-md {
  transform: scale(1);
}

.logo-lg {
  transform: scale(1.2);
}

.powered-by-tagline {
  font-size: 0.75rem;
  font-style: italic;
  color: var(--text-muted);
}

.variant-light .powered-by-text,
.variant-light .powered-by-tagline {
  color: rgba(255, 255, 255, 0.8);
}

.variant-dark .powered-by-text,
.variant-dark .powered-by-tagline {
  color: rgba(0, 0, 0, 0.7);
}

/* Variables CSS pour s'adapter au thème */
:root {
  --text-muted: rgba(107, 114, 128, 0.9);
}

@media (prefers-color-scheme: dark) {
  :root {
    --text-muted: rgba(156, 163, 175, 0.9);
  }
}
</style>
