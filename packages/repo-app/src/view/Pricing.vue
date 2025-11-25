// Pricing.vue
<script setup>
import { ref, computed, defineProps } from "vue";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Sparkles,
	CheckCircle,
	ArrowUpCircle,
	Star,
	Shield,
	Calendar,
	Clock,
	FileText,
	Github,
	Terminal,
	Rocket,
  RefreshCcw,
  Zap,ImagePlus,GitBranch
} from "lucide-vue-next";
import PricingTable from "@/components/PricingTable.vue";

import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";


// Define props for the component
const props = defineProps({
  session: {
    type: Object,
    default: null
  }
});

// Compute user login state from session prop
const isUserLoggedIn = computed(() => !!props.session);

// Toggle between monthly and annual billing
const billingCycle = ref("annual"); // Default to annual billing for better value

// Payment methods array
const paymentMethods = ref([
  { name: "VISA", id: "visa" },
  { name: "MASTER", id: "master" },
  //{ name: "PAYPAL", id: "paypal" },
 // { name: "Link", id: "paypal" },
 { name: "AMERICAN", id: "apple" },
  { name: "APPLE", id: "apple" }
]);

 
const coreFeatures = ref([
  //RefreshCcw
  {
		icon: Zap,
		title: "Edge content delivery",
		description:  "Fast and reliable content delivery with a global CDN. Perfect for edge-hosted blogs & apps.",
	},

  {
		icon: RefreshCcw,//GitBranch,//RefreshCcw,
		title: "Github sync",
		description: "Collaborate with your team using Github. Get backups and versioning for free.",
	},
	{
		icon: FileText,
		title: "Markdown processing",
		description: "Fast-loading HTML,  with rich embeds, optimized images, code highlighting, dynamic link resolution and more.",
	},
	{
		icon: ImagePlus,
		title: "Media optimization",
		description:  "Automatic image optimization for faster loading times. ",
	},

  /*
	{
		icon: Calendar,
		title: "Unlimited Repositories",
		description: "Connect and publish from as many repositories as you need",
	},
	{
		icon: Clock,
		title: "Advanced Processing",
		description: "Enhanced image optimization, code rendering, and more",
	},
	{
		icon: Terminal,
		title: "Custom Deployments",
		description: "Deploy to your own domain with custom configuration",
	},
	{
		icon: Shield,
		title: "Priority Support",
		description: "Dedicated assistance with faster response times",
	},*/
]);



// Customer testimonials
const testimonials = ref([
	{
		name: "David Chen",
		role: "Technical Writer",
		content:
			"Switching to Repo.md  has transformed how I manage documentation. The seamless publishing workflow means I can focus on writing, not fighting with complex CMS systems.",
		avatar: "/avatars/david.jpg",
	},
	{
		name: "Sarah Johnson",
		role: "Content Creator",
		content:
			"My digital garden now has the structure it needs without sacrificing the flexibility of Markdown. Best investment I've made for my content strategy.",
		avatar: "/avatars/sarah.jpg",
	},
]);

// FAQ
const faqs = ref([
	{
		question: "Can I change plans at any time?",
		answer:
			"Yes, you can upgrade to a higher plan at any time. If you downgrade, the change will take effect at the end of your current billing period.",
	},
  /*
	{
		question: "What's the difference between the plans?",
		answer:
			"Premium plans offer more repositories, enhanced processing features, custom domain deployments, API access, and priority support for more advanced publishing needs.",
	},*/
	{
		question: "Is there a commitment period?",
		answer:
			"Our subscriptions are commitment-free. You can cancel anytime and maintain access until the end of your billing period.",
	},
	{
		question: "Can I export my content if I decide to leave?",
		answer:
			"Absolutely! Your content remains in your own repositories as standard Markdown files. You always maintain complete ownership and can take your content anywhere.",
	},
]);

// Toggle billing cycle
const toggleBillingCycle = () => {
	billingCycle.value = billingCycle.value === "monthly" ? "annual" : "monthly";
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-[#eef6ff] to-background">
    <!-- Hero Section -->

  
    <div class="container mx-auto px-4 py-16">
      <div class="max-w-5xl mx-auto text-center space-y-6">
        <div class="inline-flex items-center justify-center mb-4">
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary"
          >
            <Sparkles class="h-4 w-4 mr-2" />
            Get started with Repo.md
          </span>
        </div>

        <h1
          class="text-4xl md:text-5xl font-bold text-center mb-4 tracking-tight"
        >
        Feature-packed & affordable plans
        </h1>

        <p class="text-xl text-muted-foreground max-w-3xl mx-auto">
          Start using a content platform that grows with you. 
        </p>

        <div
          class="mt-8 inline-flex items-center p-1 rounded-full border bg-muted"
        >
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
      </div>
    </div>

    <!-- Pricing Table -->
    <div class="container mx-auto px-4 py-8">
      <PricingTable :cycle="billingCycle" :userLoggedIn="isUserLoggedIn"  />
    </div>

    <!-- Features Section -->
    <div class="container mx-auto px-4 py-16">
      <div class="max-w-5xl mx-auto space-y-12">
        <div class="text-center space-y-4">
          <h2 class="text-3xl font-bold">Included in all plans</h2>
          <p class="text-muted-foreground max-w-2xl mx-auto">
             We'd love to provide our service for free, but we need to strike a blance between community and sustainability. 
           
             Here are some of our most loved core features.
             
             <!-- , they're included in every plans. -->
      
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div
            v-for="feature in coreFeatures"
            :key="feature.title"
            class="bg-background rounded-xl p-6 shadow-sm border hover:shadow-md transition-all"
          >
            <div class="flex items-start gap-4">
              <div class="p-2 rounded-lg bg-primary/10 text-primary">
                <component :is="feature.icon" class="h-6 w-6" />
              </div>
              <div>
                <h3 class="font-medium text-lg mb-2">{{ feature.title }}</h3>
                <p class="text-muted-foreground">{{ feature.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Testimonials -->
    <div class="container mx-auto px-4 py-16 bg-muted/30 rounded-3xl my-16">
      <div class="max-w-5xl mx-auto space-y-12">
        <div class="text-center space-y-4">
          <span class="text-primary font-medium">TESTIMONIALS</span>
          <h2 class="text-3xl font-bold">What Repo.md users say</h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card
            v-for="testimonial in testimonials"
            :key="testimonial.name"
            class="bg-background shadow hover:shadow-md transition-all"
          >
            <CardContent class="pt-6">
              <div class="space-y-4">
                <p class="italic text-muted-foreground">
                  "{{ testimonial.content }}"
                </p>
                <div class="flex items-center gap-3">
                  <div
                    class="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center"
                  >
                    <Star class="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 class="font-medium">{{ testimonial.name }}</h4>
                    <p class="text-sm text-muted-foreground">
                      {{ testimonial.role }}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    <!-- FAQ Section -->
    <div class="container mx-auto px-4 py-16">
      <div class="max-w-3xl mx-auto space-y-12">
        <div class="text-center space-y-4">
          <h2 class="text-3xl font-bold">Frequently Asked Questions</h2>
          <p class="text-muted-foreground">
            Have questions about our premium plans? We've got answers.
          </p>
        </div>

        <div class="space-y-6">
          <Card
            v-for="(faq, index) in faqs"
            :key="index"
            class="bg-background shadow-sm"
          >
            <CardHeader>
              <CardTitle class="text-lg">{{ faq.question }}</CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-muted-foreground">{{ faq.answer }}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="container mx-auto px-4 py-16">
      <Card
        class="bg-primary text-primary-foreground shadow-xl max-w-4xl mx-auto overflow-hidden"
      >
        <div class="relative">
          <!-- Background decoration -->
          <div
            class="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10"
          ></div>
          <div
            class="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-white/10"
          ></div>

          <CardContent class="pt-8 pb-8 relative z-10">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div class="space-y-4">
                <h2 class="text-3xl font-bold tracking-tight">
                  Ready to take your content to the next level?
                </h2>
                <p class="opacity-90">
                  Invest in your content strategy and unlock your publishing
                  potential with our premium plans.
                </p>
                <div class="pt-4">
                  <Button
                    size="lg"
                    class="bg-white text-primary hover:bg-white/90"
                    :to="isUserLoggedIn ? '#pricing-plans' :  HERO_BTN_CTA"
                  >
                    <ArrowUpCircle class="h-5 w-5 mr-2" />
                    {{ isUserLoggedIn ? 'Upgrade to Premium' : 'Sign Up to Get Started' }}
                  </Button>
                </div>
              </div>

              <div class="bg-white/10 p-6 rounded-xl">
                <h3 class="text-xl font-medium mb-4">What you'll get</h3>
                <ul class="space-y-3">
                  <li class="flex items-start gap-3">
                    <CheckCircle class="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span>Unlimited repositories</span>
                  </li>
                  <li class="flex items-start gap-3">
                    <CheckCircle class="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span>Advanced content processing</span>
                  </li>
                  <li class="flex items-start gap-3">
                    <CheckCircle class="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span>Custom domain deployments</span>
                  </li>
                  <li class="flex items-start gap-3">
                    <CheckCircle class="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span>Priority support</span>
                  </li>
                  <li class="flex items-start gap-3">
                    <CheckCircle class="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span>Satisfaction guaranteed or money back</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>

    <!-- Trust Signals -->
    <div class="container mx-auto px-4 py-16 border-t">
      <div class="max-w-4xl mx-auto text-center space-y-8">
        <p
          class="text-muted-foreground uppercase text-sm font-medium tracking-wider"
        >
          Secure payment via
        </p>
        <div class="flex flex-wrap justify-center gap-8 items-center">
          <div
            v-for="method in paymentMethods"
            :key="method.id"
            class="h-8 px-4 py-2 bg-muted rounded flex items-center justify-center text-muted-foreground"
          >
            {{ method.name }}
          </div>
        </div>
        <p class="text-sm text-muted-foreground">
          Your satisfaction is our priority. If you're not satisfied within 14
          days, we'll refund you in full, no questions asked.
        </p>
      </div>
    </div>

    <SiteFooter />
  </div>
</template>

<style scoped>
.bg-gradient-to-b {
  background-size: 100% 100%;
  background-position: 0px 0px;
}
</style>