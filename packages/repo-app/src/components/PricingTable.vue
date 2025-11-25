<!-- PricingTable.vue -->
<script setup>
import { ref, onMounted, defineProps } from "vue";
import { loadStripePricingTable } from "@/lib/stripe";
import PricingCards from "@/components/PricingCards.vue";

const props = defineProps({
	cycle: {
		type: String,
		default: "monthly",
	},
	userLoggedIn: {
		type: Boolean,
		default: false,
	}, 
});

// Load Stripe pricing table script when component mounts
onMounted(async () => {
	await loadStripePricingTable();
});
</script>

<template>
  <div class="container mx-auto">
 
    <!-- Pricing Cards -->
    <PricingCards :cycle="cycle" :userLoggedIn="userLoggedIn  " />

    <!-- Stripe pricing table (for future use) -->
    <!--
    <div class="mt-16">
      <stripe-pricing-table
        pricing-table-id="prctbl_1Qq "
        publishable-key="pk_test_51Qq u"
      >
      </stripe-pricing-table>
    </div>
    -->
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}

:deep(.prose) {
  max-width: none;
}

.text-muted-foreground {
  color: hsl(var(--muted-foreground));
}
</style>
