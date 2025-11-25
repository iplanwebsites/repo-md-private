<script setup>
import { ref, onMounted, computed } from "vue";
import { formatDateCustom } from "@/lib/utils/dateUtils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  RefreshCw,
  CheckCircle,
  XCircle,
  Calendar,
  ChevronRight,
  Receipt,
  AlertCircle,
  Loader2,
} from "lucide-vue-next";
import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";
import { pricingPlans, getPlanByPriceId, formatPrice } from "@/lib/stripe/plans";
import { subscribeToPlan, openCustomerPortal, cancelSubscription as cancelStripeSubscription } from "@/lib/stripe/stripe";

const { toast } = useToast();

// State management
const isLoadingSubscription = ref(true);
const isCreatingPortal = ref(false);
const isCreatingCheckout = ref(false);
const selectedPlanId = ref(null);
const subscriptionData = ref(null);
const billingCycle = ref("annual"); // Default to annual billing for better value

// Computed properties
const currentPlan = computed(() => {
  if (!subscriptionData.value?.isSubscribed || !subscriptionData.value?.priceId) return null;
  return getPlanByPriceId(subscriptionData.value.priceId);
});

const currentPeriodEnd = computed(() => {
  if (!subscriptionData.value?.currentPeriodEnd) return null;
  return new Date(subscriptionData.value.currentPeriodEnd);
});

const formattedExpiryDate = computed(() => {
  return currentPeriodEnd.value
    ? formatDateCustom(currentPeriodEnd.value)
    : "N/A";
});

const autoRenewButtonText = computed(() => {
  return subscriptionData.value?.cancelAtPeriodEnd
    ? "Reactivate auto-renewal"
    : "Disable auto-renewal";
});

// Methods
async function fetchSubscriptionStatus() {
  try {
    isLoadingSubscription.value = true;
    subscriptionData.value = await trpc.stripe.getSubscriptionStatus.query();
  } catch (error) {
    toast({
      title: "Error",
      description: error.message || "Failed to load subscription data",
      variant: "destructive",
    });
  } finally {
    isLoadingSubscription.value = false;
  }
}

async function handleSubscribeToPlan(plan) {
  // Skip for contact plans (enterprise) or free plans
  if (!plan || plan.isContactPlan || plan.price[billingCycle.value] === 0) {
    return;
  }

  selectedPlanId.value = plan.id;
  isCreatingCheckout.value = true;

  try {
    // Get Stripe price ID for the selected plan and billing cycle
    const priceId = plan.priceId[billingCycle.value];
    await subscribeToPlan(priceId, trpc);
  } catch (error) {
    toast({
      title: "Error",
      description: error.message || "Failed to create checkout session",
      variant: "destructive",
    });
  } finally {
    isCreatingCheckout.value = false;
    selectedPlanId.value = null;
  }
}

async function handleOpenCustomerPortal() {
  isCreatingPortal.value = true;

  try {
    await openCustomerPortal(trpc);
  } catch (error) {
    toast({
      title: "Error",
      description: error.message || "Failed to open billing portal",
      variant: "destructive",
    });
  } finally {
    isCreatingPortal.value = false;
  }
}

async function handleCancelSubscription() {
  try {
    const data = await cancelStripeSubscription(trpc);

    toast({
      title: "Subscription Cancelled",
      description: `Your subscription will remain active until ${new Date(data.cancelAt).toLocaleDateString()}`,
    });

    await fetchSubscriptionStatus();
  } catch (error) {
    toast({
      title: "Error",
      description: error.message || "Failed to cancel subscription",
      variant: "destructive",
    });
  }
}

async function toggleAutoRenew() {
  if (subscriptionData.value?.cancelAtPeriodEnd) {
    // Reactivate by opening the portal
    await handleOpenCustomerPortal();
  } else {
    // Cancel subscription
    if (confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
      await handleCancelSubscription();
    }
  }
}

// Toggle between monthly and annual billing
function toggleBillingCycle() {
  billingCycle.value = billingCycle.value === "monthly" ? "annual" : "monthly";
}

// Lifecycle hooks
onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('billing_success') === 'true') {
    toast({
      title: "Success!",
      description: "Your subscription has been activated successfully.",
    });
    const url = new URL(window.location);
    url.searchParams.delete('billing_success');
    window.history.replaceState({}, '', url);
  }

  if (urlParams.get('billing_canceled') === 'true') {
    toast({
      title: "Subscription Canceled",
      description: "You canceled the subscription process.",
      variant: "destructive",
    });
    const url = new URL(window.location);
    url.searchParams.delete('billing_canceled');
    window.history.replaceState({}, '', url);
  }

  // Fetch initial subscription data
  await fetchSubscriptionStatus();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Current Plan Card -->
    <Card class="shadow-md">
      <CardHeader>
        <CardTitle>Your Current Plan</CardTitle>
        <CardDescription>
          Manage your subscription options and track your payment deadlines.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <!-- Loading State -->
        <div v-if="isLoadingSubscription" class="text-center py-6">
          <Loader2 class="h-12 w-12 mx-auto mb-3 animate-spin opacity-60" />
          <p class="text-muted-foreground">Loading subscription details...</p>
        </div>

        <!-- No active plan -->
        <div
          v-else-if="!subscriptionData?.isSubscribed"
          class="text-center py-6"
        >
          <CreditCard class="h-12 w-12 mx-auto mb-3 opacity-60" />
          <h3 class="font-medium mb-2">No active plan</h3>
          <p class="text-sm text-muted-foreground mb-4">
            Choose a subscription plan to access our services.
          </p>
          <Button >
            Subscribe to a Plan
          </Button>
        </div>

        <!-- Active subscription -->
        <div v-else class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-lg">
                {{ currentPlan?.name || 'Active' }} Plan
              </h3>
              <Badge variant="secondary">
                {{ currentPlan?.price || '$0' }}
              </Badge>
              <Badge v-if="subscriptionData.cancelAtPeriodEnd" variant="destructive">
                Canceling
              </Badge>
            </div>
            <p class="text-sm text-muted-foreground">
              Expiration:
              <span class="font-medium">{{ formattedExpiryDate }}</span>
            </p>
            <div v-if="subscriptionData.cancelAtPeriodEnd" class="text-sm text-destructive">
              Your subscription will end on {{ formattedExpiryDate }}
            </div>
            <ul v-if="currentPlan" class="text-sm text-muted-foreground mt-2 space-y-1">
              <li
                v-for="feature in currentPlan.features.filter(f => f.included)"
                :key="feature.name"
                class="flex items-center gap-1"
              >
                <CheckCircle class="h-3.5 w-3.5 text-green-500" />
                <span>{{ feature.name }}</span>
              </li>
            </ul>
          </div>
          <div class="space-y-3">
            <Button
              variant="outline"
              class="w-full min-w-[150px]"
              @click="() => document.getElementById('pricing-plans')?.scrollIntoView({ behavior: 'smooth' })"
            >
              Change plan
              <ChevronRight class="ml-1 h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              class="w-full flex items-center gap-1"
              @click="toggleAutoRenew"
              :disabled="subscriptionData.cancelAtPeriodEnd && isCreatingPortal"
            >
              <RefreshCw
                class="h-4 w-4"
                :class="{ 'animate-spin': subscriptionData.cancelAtPeriodEnd && isCreatingPortal }"
              />
              <span>{{ autoRenewButtonText }}</span>
            </Button>
          </div>
        </div>

        <!-- Payment method -->
        <div class="pt-4 border-t">
          <h4 class="font-semibold text-base mb-2">Payment Method</h4>
          <div v-if="subscriptionData?.isSubscribed" class="flex items-center gap-3">
            <CreditCard class="h-5 w-5 text-muted-foreground" />
            <div>
              <p class="text-sm">Manage payment methods</p>
              <p class="text-xs text-muted-foreground">
                Update your cards and billing information
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              class="ml-auto"
              @click="handleOpenCustomerPortal"
              :disabled="isCreatingPortal"
            >
              {{ isCreatingPortal ? 'Opening...' : 'Manage' }}
            </Button>
          </div>
          <div v-else class="flex items-center gap-3">
            <CreditCard class="h-5 w-5 text-muted-foreground" />
            <div>
              <p class="text-sm">No payment method on file</p>
              <p class="text-xs text-muted-foreground">
                Add a payment method to subscribe to a plan
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              class="ml-auto"
              @click="() => document.getElementById('pricing-plans')?.scrollIntoView({ behavior: 'smooth' })"
            >
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Pricing Plans - always logged in here -->
    <Card id="pricing-plans" class="shadow-md">
      <CardHeader>
        <CardTitle>Available Plans</CardTitle>
        <CardDescription>
          Choose the plan that best fits your needs
        </CardDescription>

        <!-- Billing cycle toggle -->
        <div class="mt-4 inline-flex items-center p-1 rounded-full border bg-muted">
          <button
            @click="billingCycle = 'monthly'"
            class="px-4 py-2 rounded-full text-sm font-medium transition-all"
            :class="
              billingCycle === 'monthly'
                ? 'bg-background shadow-sm'
                : 'hover:bg-background/50'
            "
          >
            Monthly
          </button>
          <button
            @click="billingCycle = 'annual'"
            class="px-4 py-2 rounded-full text-sm font-medium transition-all"
            :class="
              billingCycle === 'annual'
                ? 'bg-background shadow-sm'
                : 'hover:bg-background/50'
            "
          >
            Annual
            <span class="ml-1 text-xs font-bold text-emerald-600">-20%</span>
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div class="grid gap-6 md:grid-cols-3">
          <div
            v-for="plan in pricingPlans"
            :key="plan.id"
            class="relative rounded-lg border p-6"
            :class="{
              'border-primary shadow-lg': plan.popular,
              'border-muted': !plan.popular,
            }"
          >
            <!-- Popular badge -->
            <div v-if="plan.popular" class="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge class="px-3 py-1">Most Popular</Badge>
            </div>

            <div class="space-y-4">
              <div>
                <h3 class="font-semibold text-lg">{{ plan.name }}</h3>
                <div class="mt-2">
                  <span class="text-2xl font-bold">{{ formatPrice(plan.price[billingCycle]) }}</span>
                  <span class="text-muted-foreground ml-2">
                    {{ billingCycle === 'monthly' ? '/month' : '/year' }}
                  </span>
                </div>
                <p class="mt-2 text-sm text-muted-foreground">{{ plan.description }}</p>
              </div>

              <ul class="space-y-2 text-sm">
                <li
                  v-for="feature in plan.features"
                  :key="feature.name"
                  class="flex items-start gap-2"
                >
                  <CheckCircle v-if="feature.included" class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <XCircle v-else class="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                  <span :class="{ 'text-muted-foreground/70': !feature.included }">
                    {{ feature.name }}
                  </span>
                </li>
              </ul>

              <!-- Contact Sales button for Enterprise plan -->
              <Button
                v-if="plan.isContactPlan"
                :variant="plan.popular ? 'default' : 'outline'"
                class="w-full"
                as="a"
                :href="`mailto:${plan.contactEmail}?subject=Enterprise%20Plan%20Inquiry&body=I'm%20interested%20in%20learning%20more%20about%20the%20Enterprise%20plan%20for%20Repo.md.`"
                target="_blank"
              >
                {{ plan.cta }}
              </Button>

              <!-- Subscription button for non-contact plans -->
              <Button
                v-else
                :variant="plan.popular ? 'default' : 'outline'"
                class="w-full"
                @click="handleSubscribeToPlan(plan)"
                :disabled="(currentPlan?.id === plan.id && !subscriptionData?.cancelAtPeriodEnd) ||
                           (isCreatingCheckout && selectedPlanId === plan.id)"
              >
                <span v-if="currentPlan?.id === plan.id && !subscriptionData?.cancelAtPeriodEnd">
                  Current Plan
                </span>
                <span v-else-if="isCreatingCheckout && selectedPlanId === plan.id">
                  <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </span>
                <span v-else>
                  {{ subscriptionData?.isSubscribed ? 'Switch to ' + plan.name : 'Get Started' }}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Billing history -->
    <Card class="shadow-md">
      <CardHeader>
        <CardTitle>Billing History</CardTitle>
        <CardDescription>
          View and download your invoices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="subscriptionData?.isSubscribed">
          <div class="text-center py-6 border rounded-lg">
            <Receipt class="mx-auto h-12 w-12 mb-3 text-muted-foreground" />
            <p class="text-muted-foreground mb-4">
              Access your invoices and billing history
            </p>
            <Button
              variant="outline"
              @click="handleOpenCustomerPortal"
              :disabled="isCreatingPortal"
            >
              <Receipt class="h-4 w-4 mr-2" />
              {{ isCreatingPortal ? 'Opening Portal...' : 'View Billing History' }}
            </Button>
          </div>
        </div>
        <div v-else class="text-center py-4 text-muted-foreground">
          <Calendar class="mx-auto h-12 w-12 mb-2 opacity-50" />
          <p>No invoices are available at this time.</p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
/* Add smooth scrolling for better UX */
html {
  scroll-behavior: smooth;
}
</style>