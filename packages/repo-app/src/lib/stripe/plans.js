/**
 * Centralized Stripe plan definitions for the application
 * This file provides a single source of truth for pricing plans data
 */

/**
 * Format price with currency
 * @param {number} price - The price value
 * @param {string} currency - The currency code (default: 'USD')
 * @returns {string} - Formatted price string
 */
export const formatPrice = (price, currency = "USD") => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency,
		minimumFractionDigits: 0,
	}).format(price);
};

/**
 * Calculate annual savings percentage
 * @param {Object} plan - Pricing plan object with monthly and annual prices
 * @returns {number} - Savings percentage rounded to nearest integer
 */
export const getSavingsPercent = (plan) => {
	const monthlyYearly = plan.price.monthly; // * 12;
	const annual = plan.price.annual;
	if (monthlyYearly <= 0 || annual <= 0) return 0;
	return Math.round(((monthlyYearly - annual) / monthlyYearly) * 100);
};

/**
 * Comprehensive pricing plans data with all details needed by both
 * the BillingTab and PricingTable components
 */
export const pricingPlans = [
	/*
	{
		id: "starter",
		name: "Starter",
		description: "Perfect for getting started with basic publishing needs",
		priceId: {
			monthly: "", // Free plan has no Stripe price ID
			annual: "",
		},
		price: {
			monthly: 0,
			annual: 0,
		},
		features: [
			{ name: "1 repository", included: true },
			{ name: "Basic Markdown processing", included: true },
			{ name: "Standard deployment", included: true },
			{ name: "Community support", included: true },
			{ name: "Custom domain", included: false },
			{ name: "Advanced processing", included: false },
			{ name: "Priority support", included: false },
		],
		featuresList: [
			"1 repository",
			"Basic Markdown processing",
			"Standard deployment",
			"Community support",
		],
		cta: "Start for Free",
		highlighted: false,
		popular: false,
	},*/

	{
		id: "tiny",
		name: "Tiny",
		description: "Perfect for getting started with basic publishing needs",
		priceId: {
			monthly: "", // Free plan has no Stripe price ID
			annual: "",
		},
		price: {
			monthly: 8,
			annual: 6,
		},
		features: [
			{ name: "1 repository", included: true },
			{ name: "Site themes & templates", included: true },
			{ name: "Unlimited editors", included: true },
			//	{ name: "Image optimization", included: true },

			// Edge content delivery with global CDN
			{ name: "Edge content delivery", included: true },
			{ name: "Content API ", included: true },
			{ name: "Github sync", included: true },

			{ name: "100 pages", included: true },
			{ name: "100 images", included: true },
			{ name: "10,000 requests", included: true },
			{ name: "Community support", included: true },
			//
			{ name: "Custom domain", included: false },
			{ name: "MCP servers", included: false },
			{ name: "Priority support", included: false },
		],
		cta: "Select this plan",
		highlighted: false,
		popular: false,
	},
	{
		id: "smol",
		name: "Smol",
		description: "Perfect for getting started with basic publishing needs",
		priceId: {
			monthly: "", // Free plan has no Stripe price ID
			annual: "",
		},
		price: {
			monthly: 28,
			annual: 35,
		},
		features: [
			//	{ name: "Previous plan features", included: true },
			{ name: "5 repos", included: true },
			//	{ name: "Site themes & templates", included: true },
			//	{ name: "Image optimization", included: true },
			{ name: "500 pages", included: true },
			{ name: "950 images", included: true },
			{ name: "25,000 requests", included: true },
			{ name: "Custom domains", included: true },
			{ name: "AI search", included: true },
			{ name: "MCP server", included: true },

			//	{ name: "Priority support", included: true },
			{ name: "Sqlite databases", included: true },
			//

			//	{ name: "Advanced processing", included: false },
			//{ name: "Priority support", included: false },
		],
		cta: "Select this plan",
		highlighted: false,
		popular: false,
	},
	{
		id: "plus",
		name: "Plus",
		description: "Enhanced features for professional content creators",
		priceId: {
			monthly: "price_1RNCr3IRrTX86OzoniAhEfm7", // Replace with actual Stripe price ID
			annual: "price_1RNCr3IRrTX86OzoniAhEfm7", // Replace with actual Stripe price ID
		},
		price: {
			monthly: 120,
			annual: 96,
		},
		features: [
			{ name: "Unlimited repos", included: true },
			{ name: "5,000 pages", included: true },
			{ name: "10,000 images", included: true },
			{ name: "100,000 requests", included: true },

			//	{ name: "Advanced Markdown processing", included: true },
			{ name: "AI agents", included: true },
			{ name: "Priority deployments", included: true },
			{ name: "Priority support", included: true },
			{ name: "Graph & vector databases", included: true },
			//	{ name: "Custom domain", included: true },
			//	{ name: "API access", included: true },
			//	{ name: "Analytics dashboard", included: true },
		],
		cta: "Upgrade to Plus",
		highlighted: true,
		popular: true,
	},
	/*
	{
		id: "enterprise",
		name: "Enterprise",
		description: "For large organizations with advanced needs",
		priceId: {
			monthly: "", // No Stripe price ID for Enterprise plan
			annual: "", // No Stripe price ID for Enterprise plan
		},
		price: {
			monthly: 100,
			annual: 120,
		},
		features: [
			{ name: "Everything in Pro", included: true },
			{ name: "Unlimited storage", included: true },
			{ name: "Dedicated support", included: true },
			{ name: "SLA guarantee", included: true },
			{ name: "Custom integrations", included: true },
			{ name: "Advanced security", included: true },
			{ name: "Custom reporting", included: true },
			{ name: "Multiple teams", included: true },
		],
		cta: "Contact Sales",
		highlighted: false,
		popular: false,
		contactEmail: "sales@repo.md",
		isContactPlan: true,
	},*/
];

/**
 * Get Stripe price ID based on plan ID and billing cycle
 * @param {string} planId - The plan identifier
 * @param {string} cycle - Billing cycle ('monthly' or 'annual')
 * @returns {string|null} - Stripe price ID or null if not found
 */
export const getStripePriceId = (planId, cycle = "monthly") => {
	const plan = pricingPlans.find((p) => p.id === planId);
	if (!plan) return null;
	return plan.priceId[cycle] || null;
};

/**
 * Get plan by Stripe price ID
 * @param {string} priceId - Stripe price ID to look up
 * @returns {Object|null} - The matching plan or null if not found
 */
export const getPlanByPriceId = (priceId) => {
	if (!priceId) return null;

	return (
		pricingPlans.find(
			(plan) =>
				plan.priceId.monthly === priceId || plan.priceId.annual === priceId,
		) || null
	);
};

/**
 * Create a checkout URL for a specific plan
 * @param {string} priceId - Stripe price ID
 * @param {string} returnUrl - URL to return to after checkout
 * @returns {Promise<Object>} - Checkout response with URL
 */
export const createCheckoutUrl = async (priceId, returnUrl, trpc) => {
	try {
		return await trpc.stripe.createCheckoutSession.mutate({
			priceId,
			quantity: 1,
			successUrl: `${returnUrl}?billing_success=true`,
			cancelUrl: `${returnUrl}?billing_canceled=true`,
		});
	} catch (error) {
		console.error("Failed to create checkout session:", error);
		throw error;
	}
};

/**
 * Create a customer portal URL
 * @param {string} returnUrl - URL to return to after using the portal
 * @returns {Promise<Object>} - Portal response with URL
 */
export const createPortalUrl = async (returnUrl, trpc) => {
	try {
		return await trpc.stripe.createPortalSession.mutate({
			returnUrl,
		});
	} catch (error) {
		console.error("Failed to create portal session:", error);
		throw error;
	}
};
