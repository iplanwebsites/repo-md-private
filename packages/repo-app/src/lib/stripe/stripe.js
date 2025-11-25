/**
 * Stripe services for handling checkout and billing operations
 */
import { loadScript } from "@/lib/utils/scriptLoader";
import { createCheckoutUrl, createPortalUrl } from "./plans";

/**
 * Load the Stripe Pricing Table script
 * @returns {Promise<void>}
 */
export const loadStripePricingTable = async () => {
  try {
    await loadScript("https://js.stripe.com/v3/pricing-table.js", {
      async: true,
    });
    return true;
  } catch (error) {
    console.error("Failed to load Stripe Pricing Table script:", error);
    return false;
  }
};

/**
 * Handle subscription to a plan
 * @param {string} priceId - Stripe price ID
 * @param {Object} trpc - TRPC client
 * @returns {Promise<void>}
 */
export const subscribeToPlan = async (priceId, trpc) => {
  if (!priceId) {
    throw new Error("Price ID is required");
  }
  
  const returnUrl = `${window.location.origin}${window.location.pathname}`;
  
  try {
    const data = await createCheckoutUrl(priceId, returnUrl, trpc);
    
    // Redirect to Stripe checkout
    if (data && data.url) {
      window.location.href = data.url;
    } else {
      throw new Error("Invalid response from checkout service");
    }
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    throw error;
  }
};

/**
 * Open the Stripe customer portal
 * @param {Object} trpc - TRPC client
 * @returns {Promise<void>}
 */
export const openCustomerPortal = async (trpc) => {
  const returnUrl = `${window.location.origin}${window.location.pathname}`;
  
  try {
    const data = await createPortalUrl(returnUrl, trpc);
    
    // Redirect to Stripe portal
    if (data && data.url) {
      window.location.href = data.url;
    } else {
      throw new Error("Invalid response from portal service");
    }
  } catch (error) {
    console.error("Failed to open customer portal:", error);
    throw error;
  }
};

/**
 * Cancel a subscription
 * @param {Object} trpc - TRPC client
 * @returns {Promise<Object>} - Cancellation details
 */
export const cancelSubscription = async (trpc) => {
  try {
    return await trpc.stripe.cancelSubscription.mutate();
  } catch (error) {
    console.error("Failed to cancel subscription:", error);
    throw error;
  }
};