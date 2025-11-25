<script setup>
import { ref, defineProps, computed, onMounted } from "vue";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-vue-next";
import { pricingPlans, formatPrice, getSavingsPercent, getStripePriceId } from "@/lib/stripe/plans";
import { subscribeToPlan } from "@/lib/stripe/stripe";
import trpc from "@/trpc";
import { useToast } from "@/components/ui/toast/use-toast";
import { appConfigs } from "@/appConfigs";

import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";


const { toast } = useToast();

const props = defineProps({
	cycle: {
		type: String,
		default: "monthly",
	},
	userLoggedIn: {
		type: Boolean,
		default: false,
	},
	session: {
		type: Object,
		default: null,
	},
});

const isProcessing = ref(false);
const processingPlanId = ref(null);
const isUserLoggedIn = computed(() => props.userLoggedIn || !!props.session);
const isWaitlistMode = computed(() => appConfigs.WAITLIST_MODE);

// No need for session check in onMounted since we're using computed property now
// which will reactively update based on the passed props

// Handle subscription or redirect to signup
const handleSubscribe = async (plan) => {
  if (plan.price[props.cycle] === 0) {
    // Free plan, no subscription needed
    return;
  }

  processingPlanId.value = plan.id;
  isProcessing.value = true;

  try {
    const priceId = getStripePriceId(plan.id, props.cycle);
    await subscribeToPlan(priceId, trpc);
  } catch (error) {
    toast({
      title: "Error",
      description: error.message || "Failed to start subscription process",
      variant: "destructive",
    });
  } finally {
    isProcessing.value = false;
    processingPlanId.value = null;
  }
};
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
    <Card
      v-for="plan in pricingPlans"
      :key="plan.name"
      class="border rounded-xl overflow-hidden transition-all"
      :class="{
        'shadow-lg border-primary/50 relative': plan.highlighted,
        'shadow-sm hover:shadow-md': !plan.highlighted
      }"
    >
      <!-- Popular badge -->
      <div v-if="plan.popular" class="absolute top-0 right-0 bg-primary text-white py-1 px-3 text-xs font-medium rounded-bl-lg">
        MOST POPULAR
      </div>

      <CardHeader :class="{ 'bg-primary/5': plan.highlighted }">
        <CardTitle class="text-2xl font-bold">{{ plan.name }}</CardTitle>
        <CardDescription class="mt-2">{{ plan.description }}</CardDescription>
      </CardHeader>

      <CardContent class="pt-6">
        <!-- Price -->
        <div class="mb-6">
          <div class="flex items-baseline">
            <span class="text-4xl font-bold">{{ formatPrice(plan.price[cycle]) }}</span>
            <span class="text-muted-foreground ml-2">
              {{ cycle === 'monthly' ? '/month' : '/month' }}
            </span>
          </div>

          <!-- Show savings for annual billing -->
          <div v-if="cycle === 'annual' && plan.price.annual > 0" class="mt-2 text-sm text-emerald-600 font-medium">
            Save {{ getSavingsPercent(plan) }}% with annual billing
          </div>
        </div>

        <!-- Features -->
        <div class="space-y-4">
          <h4 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            What's included
          </h4>
          <ul class="space-y-3">
            <li v-for="feature in plan.features" :key="feature.name" class="flex items-start gap-3">
              <CheckCircle v-if="feature.included" class="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <XCircle v-else class="h-5 w-5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
              <span :class="{ 'text-muted-foreground/70': !feature.included }">
                {{ feature.name }}
              </span>
            </li>
          </ul>
        </div>
      </CardContent>

      <CardFooter class="pt-2 pb-6">
        <!-- Contact Sales button for Enterprise plan (for both logged in and non-logged in users) -->
        <Button
          v-if="plan.isContactPlan"
          class="w-full"
          :variant="plan.highlighted ? 'default' : 'outline'"
          as="a"
          :href="`mailto:${plan.contactEmail}?subject=Enterprise%20Plan%20Inquiry&body=I'm%20interested%20in%20learning%20more%20about%20the%20Enterprise%20plan%20for%20Repo.md.`"
          target="_blank"
        >
          {{ plan.cta }}
        </Button>

        <!-- Waitlist button when in waitlist mode (non-contact plans) -->
        <Button
          v-else-if="isWaitlistMode"
          class="w-full"
          :variant="plan.highlighted ? 'default' : 'outline'"
          to="/waitlist"
        >
          Join Waitlist
        </Button>

        <!-- Subscription button for logged-in users (non-contact plans) -->
        <Button
          v-else-if="isUserLoggedIn"
          class="w-full"
          :variant="plan.highlighted ? 'default' : 'outline'"
          @click="handleSubscribe(plan)"
          :disabled="isProcessing"
        >
          <span v-if="isProcessing && processingPlanId === plan.id" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
          <span v-else>{{ plan.cta }}</span>
        </Button>

        <!-- Signup button for non-logged in users (non-contact plans) -->
        <Button
          v-else
          class="w-full"
          :variant="plan.highlighted ? 'default' : 'outline'"
          to="/signup"
        >
          {{ plan.price[cycle] === 0 ? 'Sign up for free' : plan.cta }}
        </Button>
      </CardFooter>
    </Card>
  </div>
</template>