<script setup>
import { ref, onMounted } from "vue";
import brochureCopy from "./BrochureLandingCopy.json";
import {
	Brain,
	Target,
	BarChart,
	Clock,
	LineChart,
	Shield,
	Lock,
	Eye,
	Key,
	User,
	Lightbulb,
	ChevronRight,
	ChevronLeft,
	MessageCircle,
	Book,
	CheckCircle,
	Star,
	Users,
	Edit,
	Code,
	Image,
	Rocket,
	Puzzle,
	Circle,
} from "lucide-vue-next";

// Create a mapping for icons
const iconMap = {
	Brain,
	Target,
	BarChart,
	Clock,
	LineChart,
	Shield,
	Lock,
	Eye,
	Key,
	User,
	Lightbulb,
	ChevronRight,
	ChevronLeft,
	MessageCircle,
	Book,
	CheckCircle,
	Star,
	Users,
	Edit,
	Code,
	Image,
	Rocket,
	Puzzle,
	Circle,
};

// Import all copy from JSON file
const navigation = ref(brochureCopy.navigation);
const hero = ref(brochureCopy.hero);
const stats = ref(
	brochureCopy.stats.map((stat) => ({
		...stat,
		icon: iconMap[stat.icon],
	})),
);
const trustedBy = ref(brochureCopy.trustedBy);
const testimonials = ref(brochureCopy.testimonials);
const featuresTitle = ref(brochureCopy.featuresTitle);
const testimonialHeader = ref(brochureCopy.testimonialHeader);
const pricingSection = ref(brochureCopy.pricingSection);
const faqSection = ref(brochureCopy.faqSection);
const howItWorks = ref(brochureCopy.howItWorks);

// Process features to map string icon names to actual components
const features = ref(
	brochureCopy.features.map((feature) => {
		// Map main icon
		const processedFeature = {
			...feature,
			icon: iconMap[feature.icon],
		};

		// Map resource list icons if present
		if (feature.resourceList) {
			processedFeature.resourceList = feature.resourceList.map((resource) => ({
				...resource,
				icon: iconMap[resource.icon],
			}));
		}

		return processedFeature;
	}),
);

const securitySection = ref({
	...brochureCopy.securitySection,
	features: brochureCopy.securitySection.features.map((feature) => ({
		...feature,
		icon: iconMap[feature.icon],
	})),
});

// Use all 5 testimonials in the bottom block
const testimonialSlides = ref(
	brochureCopy.testimonials.map((testimonial) => ({
		quote: testimonial.messages.join(" "),
		name: testimonial.author.name,
		position: testimonial.author.position,
		company: testimonial.author.company,
		avatarUrl: testimonial.author.avatarUrl,
	})),
);
const bottomSection = ref(brochureCopy.bottomSection);

const ctaLink = "/login";
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Item One</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink>Link</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>

    <!-- Header section -->
    <header
      id="home"
      class="bg-white shadow"
      :style="
        hero.bg
          ? {
              backgroundImage: `url('${encodeURI(hero.bg)}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : {}
      "
    >
      <div class="max-w-7xl mx-auto px-4 py-6">
        <!-- Navigation -->
        <nav class="flex items-center justify-between">
          <div class="flex items-center">
            <logotype :title="navigation.logo" variant="light" :height="33" />
            <ul class="hidden md:flex ml-10 space-x-8">
              <li v-for="link in navigation.links" :key="link.name">
                <a
                  :href="link.href"
                  :class="
                    hero.whiteText
                      ? 'text-white hover:text-gray-200'
                      : 'text-black hover:text-gray-800'
                  "
                  >{{ link.name }}</a
                >
              </li>
            </ul>
          </div>
          <Button :to="ctaLink" class="hidden md:block">
            {{ hero.cta }}
          </Button>

          <!-- Mobile menu Button -->
          <Button class="md:hidden" aria-label="Menu">
            <ChevronRight class="w-6 h-6" />
          </Button>
        </nav>

        <!-- Hero content -->
        <div class="mt-16 max-w-3xl mx-auto text-center">
          <p
            :class="
              hero.whiteText
                ? 'text-sm text-white mb-2'
                : 'text-sm text-black mb-2'
            "
          >
            {{ hero.tagline }}
          </p>
          <h1
            :class="
              hero.whiteText
                ? 'text-4xl font-bold text-white mb-4'
                : 'text-4xl font-bold text-black mb-4'
            "
          >
            {{ hero.title }}
          </h1>
          <p
            :class="
              hero.whiteText
                ? 'text-lg text-white mb-8'
                : 'text-lg text-black mb-8'
            "
          >
            {{ hero.description }}
          </p>
          <Button :to="ctaLink">
            {{ hero.cta }}
          </Button>
        </div>
      </div>
    </header>

    <!-- Stats section -->
    <section class="py-16 bg-white">
      <div class="max-w-7xl mx-auto px-4">
        <div class="grid md:grid-cols-3 gap-8 text-center">
          <div v-for="(stat, index) in stats" :key="index" class="p-6">
            <div class="flex items-center justify-center mb-4">
              <component
                :is="stat.icon"
                class="w-8 h-8 text-blue-600 mx-auto"
              />
            </div>
            <div class="flex items-center justify-center">
              <span class="text-4xl font-bold text-blue-600">{{
                stat.value
              }}</span>
              <span class="text-xl text-gray-600">{{ stat.unit }}</span>
            </div>
            <p class="mt-2 text-gray-700">{{ stat.label }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Trusted by section -->
    <section class="py-16 bg-gray-50">
      <div
        class="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-8"
      >
        <img :src="trustedBy.imageSrc" alt="" class="w-full max-w-md" />
        <div class="text-center md:text-left">
          <p class="text-xl font-semibold text-gray-700">
            {{ trustedBy.title }}
          </p>
          <p
            class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600"
          >
            {{ trustedBy.count }}
          </p>
          <p class="text-xl font-semibold text-gray-700">
            {{ trustedBy.subtitle }}
          </p>
        </div>
      </div>
    </section>

    <!-- Features title -->
    <section id="features" class="py-16 bg-gray-50">
      <div class="max-w-3xl mx-auto px-4 text-center">
        <h2 class="text-3xl font-bold mb-4">
          <span
            class="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600"
          >
            {{ featuresTitle.title }}
          </span>
          <br />{{ featuresTitle.subtitle }}
        </h2>
        <p class="text-lg text-gray-600">{{ featuresTitle.description }}</p>
      </div>
    </section>

    <!-- Features -->
    <div v-for="(feature, fIndex) in features" :key="fIndex">
      <section
        class="py-16"
        :class="fIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'"
      >
        <div class="max-w-7xl mx-auto px-4">
          <div
            :class="[
              'flex flex-col md:flex-row items-center gap-12',
              fIndex % 2 === 1 ? 'md:flex-row-reverse' : '',
            ]"
          >
            <!-- Feature content -->
            <div class="md:w-1/2">
              <div class="mb-4 p-2 inline-block rounded-full bg-blue-100">
                <component :is="feature.icon" class="w-6 h-6 text-blue-600" />
              </div>
              <h3 class="text-2xl font-bold text-gray-900 mb-4">
                {{ feature.title }}
              </h3>
              <p class="text-gray-600 mb-8">{{ feature.description }}</p>
              <Button :to="ctaLink">
                {{ feature.cta }}
              </Button>
            </div>

            <!-- Feature image and widgets -->
            <div class="md:w-1/2 relative">
              <img
                :src="feature.imageSrc"
                alt=""
                class="w-full rounded-lg shadow-lg-DISABLD"
              />

              <!-- Feature specific widgets -->
              <template
                v-if="fIndex === 0 && feature.widgets && feature.widgets.length"
              >
                <!-- Simplified widgets for the first feature -->
                <div
                  v-show="false"
                  class="absolute top-4 right-4 bg-white rounded-lg shadow-md p-4 w-40"
                >
                  <p class="font-medium text-sm mb-2">
                    {{ feature.widgets[0].topText }}
                  </p>
                  <div class="flex justify-between items-center">
                    <div class="text-xl font-bold">
                      {{ feature.widgets[0].completed
                      }}<span class="text-blue-600"
                        >/{{ feature.widgets[0].total }}</span
                      >
                    </div>
                    <div class="text-xs text-gray-600">
                      {{ feature.widgets[0].status }}
                    </div>
                  </div>
                </div>

                <!-- Progress widget simplified -->
                <div
                  class="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-4 w-64"
                  v-show="false"
                >
                  <p class="font-medium text-sm mb-4">
                    {{ feature.widgets[1].title }}
                  </p>
                  <div class="space-y-3">
                    <div
                      v-for="(metric, mIndex) in feature.widgets[1].metrics"
                      :key="`chart-${mIndex}`"
                      class="flex items-center justify-between"
                    >
                      <span class="text-sm">{{ metric.category }}</span>
                      <div class="w-24 bg-gray-200 rounded-full h-2.5">
                        <div
                          class="bg-blue-600 h-2.5 rounded-full"
                          :style="`width: ${metric.value}%`"
                        ></div>
                      </div>
                      <span class="text-sm font-medium"
                        >{{ metric.value }}%</span
                      >
                    </div>
                  </div>
                </div>
              </template>

              <!-- Feature 2 specific messages -->
              <template v-if="fIndex === 1 && feature.messages">
                <div
                  class="absolute top-4 left-4 bg-white rounded-lg shadow-md p-4 w-64"
                >
                  <div
                    v-for="(message, mIndex) in feature.messages[0].topMessages"
                    :key="mIndex"
                    class="text-sm mb-2 last:mb-0"
                  >
                    {{ message }}
                  </div>
                </div>
                <div
                  class="absolute bottom-4 right-4 bg-white rounded-lg shadow-md p-4 w-64"
                >
                  <div
                    v-for="(message, mIndex) in feature.messages[0]
                      .bottomMessages"
                    :key="mIndex"
                    class="text-sm mb-2 last:mb-0"
                  >
                    {{ message }}
                  </div>
                </div>
              </template>

              <!-- Feature 3 specific resources -->
              <template v-if="fIndex === 2 && feature.resourceList">
                <div
                  class="absolute top-4 right-4 bg-white rounded-lg shadow-md p-4"
                >
                  <ul class="grid grid-cols-2 gap-3">
                    <li
                      v-for="(resource, rIndex) in feature.resourceList"
                      :key="rIndex"
                      class="flex items-center"
                    >
                      <component
                        :is="resource.icon"
                        class="w-4 h-4 mr-2 text-blue-600"
                      />
                      <span class="text-sm">{{ resource.text }}</span>
                    </li>
                  </ul>
                </div>

                <div
                  v-if="feature.readingPlan"
                  class="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-4 w-64"
                >
                  <p class="font-medium text-sm mb-3">
                    {{ feature.readingPlan.title }}
                  </p>
                  <div class="space-y-3">
                    <div
                      v-for="(item, iIndex) in feature.readingPlan.items"
                      :key="`exp-${iIndex}`"
                      class="flex"
                    >
                      <Book class="w-5 h-5 mr-2 text-blue-600" />
                      <div>
                        <p class="text-sm font-medium">{{ item.title }}</p>
                        <p class="text-xs text-gray-600">{{ item.author }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- How It Works section -->
    <section id="how-it-works" class="py-16 bg-white">
      <div class="max-w-7xl mx-auto px-4">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold mb-4">{{ howItWorks.title }}</h2>
        </div>

        <div class="grid md:grid-cols-4 gap-8">
          <div
            v-for="(step, index) in howItWorks.steps"
            :key="index"
            class="bg-gray-50 p-6 rounded-lg text-center"
          >
            <div
              class="mb-4 p-2 inline-block rounded-full bg-blue-600 text-white font-bold w-10 h-10 flex items-center justify-center"
            >
              {{ step.number }}
            </div>
            <h3 class="text-xl font-semibold mb-2">{{ step.title }}</h3>
            <p class="text-gray-600">{{ step.description }}</p>
          </div>
        </div>

        <div class="text-center mt-8">
          <p class="text-lg text-gray-700 italic">{{ howItWorks.tagline }}</p>
        </div>
      </div>
    </section>

    <!-- Pricing section -->
    <section id="pricing" class="py-16 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold mb-4">{{ pricingSection.title }}</h2>
          <p class="text-lg text-gray-600 max-w-3xl mx-auto">
            {{ pricingSection.description }}
          </p>
        </div>

        <div class="grid md:grid-cols-4 gap-8">
          <div
            v-for="(plan, index) in pricingSection.plans"
            :key="index"
            class="bg-white p-6 rounded-lg shadow-md"
            :class="{ 'ring-2 ring-blue-500': plan.popular }"
          >
            <div class="mb-4">
              <h3 class="text-xl font-semibold mb-2">{{ plan.name }}</h3>
              <div class="flex items-end mb-4">
                <span class="text-3xl font-bold">{{ plan.price }}</span>
                <span v-if="plan.period" class="text-gray-600 ml-1"
                  >/{{ plan.period }}</span
                >
              </div>
              <ul class="space-y-2 mb-6">
                <li
                  v-for="(feature, fIndex) in plan.features"
                  :key="fIndex"
                  class="flex items-start"
                >
                  <CheckCircle
                    class="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5"
                  />
                  <span>{{ feature }}</span>
                </li>
              </ul>
            </div>
            <Button :to="plan.ctaLink" :class="plan.popular ? '' : ''">
              {{ plan.cta }}
            </Button>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ section -->
    <section id="faq" class="py-16 bg-white">
      <div class="max-w-3xl mx-auto px-4">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold mb-4">{{ faqSection.title }}</h2>
        </div>

        <div class="space-y-6">
          <div
            v-for="(faq, index) in faqSection.faqs"
            :key="index"
            class="border-b border-gray-200 pb-6"
          >
            <h3 class="text-xl font-semibold mb-2">{{ faq.question }}</h3>
            <p class="text-gray-600">{{ faq.answer }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Security section -->
    <section id="security" class="py-16 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold mb-4">{{ securitySection.title }}</h2>
          <p class="text-lg text-gray-600 max-w-3xl mx-auto">
            {{ securitySection.description }}
          </p>
        </div>

        <div class="grid md:grid-cols-4 gap-8">
          <div
            v-for="(feature, index) in securitySection.features"
            :key="index"
            class="bg-white p-6 rounded-lg"
          >
            <div class="mb-4 p-2 inline-block rounded-full bg-blue-100">
              <component :is="feature.icon" class="w-6 h-6 text-blue-600" />
            </div>
            <h3 class="text-xl font-semibold mb-2">{{ feature.title }}</h3>
            <p class="text-gray-600">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Testimonials slider -->
    <section id="testimonials" class="py-16 bg-white">
      <div class="max-w-7xl mx-auto px-4">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold mb-2">
            {{ testimonialHeader.title }}
          </h2>
          <h2
            class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600"
          >
            {{ testimonialHeader.subtitle }}
          </h2>
        </div>

        <!-- Simplified slider -->
        <div class="relative">
          <div
            class="flex overflow-x-auto scrollbar-hide -mx-4 px-4 space-x-6 pb-8"
          >
            <div
              v-for="(slide, sIndex) in testimonialSlides"
              :key="sIndex"
              class="flex-shrink-0 w-full max-w-md bg-gray-50 rounded-xl shadow-md p-6"
            >
              <div
                class="w-12 h-12 rounded-full bg-gray-300 mb-4 flex items-center justify-center overflow-hidden"
              >
                <img
                  v-if="slide.avatarUrl"
                  :src="slide.avatarUrl"
                  alt="Avatar"
                  class="w-full h-full object-cover"
                />
                <User v-else class="w-6 h-6 text-gray-600" />
              </div>
              <blockquote class="text-xl italic text-gray-700 mb-4">
                {{ slide.quote }}
              </blockquote>
              <div>
                <p class="font-medium text-gray-900">{{ slide.name }}</p>
                <p class="text-sm text-gray-600">
                  <span class="text-gray-500">{{ slide.position }}</span>
                  {{ slide.company }}
                </p>
              </div>
            </div>
          </div>

          <!-- Navigation arrows -->
          <Button class="absolute top-1/2 left-0 -translate-y-1/2">
            <ChevronLeft class="w-6 h-6" />
          </Button>
          <Button class="absolute top-1/2 right-0 -translate-y-1/2">
            <ChevronRight class="w-6 h-6" />
          </Button>
        </div>
      </div>
    </section>

    <!-- Bottom section -->
    <section
      class="py-20 bg-gradient-to-br from-blue-600 to-purple-700 text-white"
    >
      <div
        class="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center"
      >
        <div class="md:w-2/3 text-center md:text-left">
          <p class="text-blue-200 mb-2">{{ bottomSection.tagline }}</p>
          <h2 class="text-4xl font-bold mb-4">{{ bottomSection.title }}</h2>
          <p class="text-blue-100 mb-8 max-w-2xl">
            {{ bottomSection.description }}
          </p>
          <Button :to="ctaLink">
            {{ bottomSection.cta }}
          </Button>
        </div>
        <div class="md:w-1/3 mt-8 md:mt-0 flex justify-center">
          <logotype />
        </div>
      </div>
    </section>
  </div>
</template>
