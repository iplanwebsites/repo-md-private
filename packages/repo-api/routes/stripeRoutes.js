import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, procedure } from "../lib/trpc/trpc.js";
import {
  protectedProcedure,
  adminProcedure,
  editorProcedure,
} from "../lib/trpc/procedures.js";
import Stripe from "stripe";
import { db } from "../db.js";

// Check if Stripe key is available
const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;

// Function to ensure Stripe key is available
const ensureStripeKey = () => {
  if (!hasStripeKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Missing Stripe Key on server",
    });
  }
};

// Initialize Stripe only if the key is available
const stripe = hasStripeKey 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-11-20.acacia", // Use the latest API version
    })
  : null;

async function findUserById(userId) {
  const find = { id: userId };
  const user = await db.users.findOne(find);
  return user;
}

async function findUserByStripeCustomerId(stripeCustomerId) {
  const find = { stripeCustomerId: stripeCustomerId };
  const user = await db.users.findOne(find);
  return user;
}

async function updateUserStripeCustomerId(userId, stripeCustomerId) {
  const result = await db.users.updateOne(
    { id: userId },
    { $set: { stripeCustomerId: stripeCustomerId } }
  );
  return result;
}

export const stripeRouter = router({
  // Create checkout session

  ok: procedure.input(z.any().optional()).query(({ input }) => {
    ensureStripeKey();
    return `ok!!! yes from stripe router!! ${input}`;
  }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        priceId: z.string(),
        quantity: z.number().default(1),
        successUrl: z.string().optional(),
        cancelUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      ensureStripeKey();
      try {
        const successUrl =
          input.successUrl ||
          `${process.env.FRONTEND_URL}/subscription/success`;
        const cancelUrl =
          input.cancelUrl ||
          `${process.env.FRONTEND_URL}/subscription/canceled`;

        const user = await findUserById(ctx.user.id);

        let customer;
        if (user?.stripeCustomerId) {
          customer = user.stripeCustomerId;
        } else {
          const newCustomer = await stripe.customers.create({
            email: ctx.user.email,
            metadata: {
              userId: ctx.user.id,
            },
          });

          await updateUserStripeCustomerId(ctx.user.id, newCustomer.id);
          customer = newCustomer.id;
        }

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card", "link"],
          line_items: [
            {
              price: input.priceId,
              quantity: input.quantity,
            },
          ],
          mode: "subscription",
          success_url: successUrl,
          cancel_url: cancelUrl,
          client_reference_id: ctx.user.id,
          customer: customer,
          customer_email: !customer ? ctx.user.email : undefined, // Pre-fill email for Link
          metadata: {
            userId: ctx.user.id,
          },
          // Enable Link and payment method saving
          payment_method_collection: "always", // Ensure payment methods are saved
          //   allow_promotion_codes: true, // Optional: enable promo codes
          billing_address_collection: "auto", // Collect billing address when needed
          // Enable saving payment method for future use
          subscription_data: {
            metadata: {
              userId: ctx.user.id,
            },
          },
          saved_payment_method_options: {
            allow_redisplay_filters: ["always"],
            payment_method_save: "enabled",
          },
        });

        return { url: session.url };
      } catch (error) {
        console.error("Error creating checkout session:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }
    }),

  // Create billing portal session
  createPortalSession: protectedProcedure
    .input(
      z.object({
        returnUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      ensureStripeKey();
      try {
        // First, get the Stripe customer ID for the user
        const user = await findUserById(ctx.user.id);

        if (!user?.stripeCustomerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No Stripe customer found for this user",
          });
        }

        const returnUrl =
          input.returnUrl || `${process.env.FRONTEND_URL}/account`;

        const portalSession = await stripe.billingPortal.sessions.create({
          customer: user.stripeCustomerId,
          return_url: returnUrl,
        });

        return { url: portalSession.url };
      } catch (error) {
        console.error("Error creating portal session:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create portal session",
        });
      }
    }),

  // Get subscription status
  getSubscriptionStatus: protectedProcedure.query(async ({ ctx }) => {
    ensureStripeKey();
    try {
      const user = await findUserById(ctx.user.id);

      if (!user?.stripeCustomerId) {
        return {
          isSubscribed: false,
          status: null,
          currentPeriodEnd: null,
        };
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        expand: ["data.default_payment_method"],
      });

      if (subscriptions.data.length === 0) {
        return {
          isSubscribed: false,
          status: null,
          currentPeriodEnd: null,
        };
      }

      const subscription = subscriptions.data[0];

      return {
        isSubscribed: true,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    } catch (error) {
      console.error("Error getting subscription status:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get subscription status",
      });
    }
  }),

  // Cancel subscription
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    ensureStripeKey();
    try {
      const user = await findUserById(ctx.user.id);

      if (!user?.stripeCustomerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No subscription found",
        });
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
      });

      if (subscriptions.data.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active subscription found",
        });
      }

      // Cancel at period end (allows access until current period expires)
      const subscription = await stripe.subscriptions.update(
        subscriptions.data[0].id,
        { cancel_at_period_end: true }
      );

      return {
        success: true,
        cancelAt: new Date(subscription.cancel_at * 1000),
      };
    } catch (error) {
      console.error("Error canceling subscription:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to cancel subscription",
      });
    }
  }),
});

export const stripeRoutes = {
  stripe: stripeRouter,
};
