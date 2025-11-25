<template>
  <div class="blocks-container">
    <template v-for="(block, index) in blocks" :key="index">
      <!-- Hero Block -->
      <section
        v-if="block.type === 'hero'"
        class="hero-block relative"
        :class="{ 'no-bg-filter': block.noBgFilter }"
        :style="block.bgImage ? `background-image: url(${block.bgImage})` : ''"
      >
        <div   class="container mx-auto px-4 py-24 md:py-32 relative z-10">
          <div class="max-w-3xl">
            <h1
              v-if="block.title"
              class="text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
              v-motion-fade
              visible
            >
              <template v-if="block.typrwriter && block.typrwriter.length > 0">
                <span v-html="block.title.replace(/class='typrwriter'[^>]*>([^<]*)<\/span>/, '<span class=\'typewriter-word\'>' + typewriterText + '</span>')"></span>
              </template>
              <template v-else>
                <span v-html="block.title"></span>
              </template>
            </h1>

            <div >


            <p          
          v-motion-fade
            visible 
  v-if="block.subtitle" v-html="block.subtitle" class="text-lg md:text-xl mb-8 opacity-90">

              
            </p>
            </div>
            <div v-if="block.btnLabel" class="mt-8">
              <Button
                v-if="block.btnHref || block.btnTo"
                :to="block.btnTo "
                :href="block.btnHref"
                class=" " 
                size="lg"
                variant="white"
              > 
                {{ block.btnLabel }}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <!-- Card Block -->
      <section v-else-if="block.type === 'cards'" class="cards-block py-16"   v-motion-fade
              hovered >
        <div class="container mx-auto px-4">
          <h2 v-if="block.title" class="text-3xl font-bold text-center mb-4">
            {{ block.title }}
          </h2>
          <p v-if="block.subtitle" class="text-xl text-center text-muted-foreground mb-12 max-w-3xl mx-auto">
            {{ block.subtitle }}
          </p>
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            :class="
              block.cards.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : ''
            "
          >
            <div
              v-for="(card, cardIndex) in block.cards"
              :key="cardIndex"
              class="card p-6 border rounded-lg shadow-sm"
             
            >
              <div
                v-if="card.metric"
                class="text-4xl font-bold text-primary mb-2"
              >
                {{ card.metric }}
              </div>
              <div v-if="card.icon" class="card-icon mb-4">
                <img
                  v-if="
                    typeof card.icon === 'string' &&
                    (card.icon.startsWith('http') || card.icon.startsWith('/'))
                  "
                  :src="card.icon"
                  alt="icon"
                  class="w-12 h-12"
                />
                <component
                  v-else-if="typeof card.icon !== 'string'"
                  :is="card.icon"
                  class="w-8 h-8 text-primary"
                />
                <i v-else :class="card.icon"></i>
              </div>
              <h3 v-if="card.title" class="text-xl font-semibold mb-2">
                {{ card.title }}
              </h3>
              <p v-if="card.description" class="text-muted-foreground">
                {{ card.description }}
              </p>
              <div v-if="card.btnLabel" class="mt-4">
                <Button
                  v-if="card.btnTo || card.btnHref"
                  :to="card.btnTo"
                  :href="card.btnHref"
                  variant="outline"
                  size="sm"
                >
                  {{ card.btnLabel }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Text Block -->
      <section v-else-if="block.type === 'text'" class="text-block py-12">
        <div class="container mx-auto px-4">
          <h2 v-if="block.title" class="text-3xl font-bold mb-6">
            {{ block.title }}
          </h2>
          <div v-if="block.content" class="prose lg:prose-xl mx-auto">
            <div v-html="block.content"></div>
          </div>
        </div>
      </section>

      <!-- Features Block -->
      <section
        v-else-if="block.type === 'features'"
        class="features-block py-16"
      >
        <div class="container mx-auto px-4">
          <h2 v-if="block.title" class="text-3xl font-bold text-center mb-4">
            {{ block.title }}
          </h2>
          <p v-if="block.subtitle" class="text-xl text-center text-muted-foreground mb-12 max-w-3xl mx-auto">
            {{ block.subtitle }}
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <RouterLink
              v-for="(feature, featureIndex) in block.features"
              :key="featureIndex"
              :to="feature.href || '#'"
              class="feature-item p-6 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
              :class="{ 'cursor-pointer': feature.href, 'cursor-default': !feature.href }"
            >
              <div class="flex items-center gap-4 mb-4">
                <div v-if="feature.icon" class="feature-icon">
                  <img
                    v-if="
                      typeof feature.icon === 'string' &&
                      (feature.icon.startsWith('http') ||
                        feature.icon.startsWith('/'))
                    "
                    :src="feature.icon"
                    alt="icon"
                    class="w-8 h-8"
                  />
                  <component
                    v-else-if="typeof feature.icon !== 'string'"
                    :is="feature.icon"
                    class="w-8 h-8 text-primary"
                  />
                  <i v-else :class="feature.icon"></i>
                </div>
                <h3 v-if="feature.title" class="text-xl font-semibold">
                  {{ feature.title }}
                </h3>
              </div>
              <p v-if="feature.description" class="text-muted-foreground">
                {{ feature.description }}
              </p>
              <div v-if="feature.href" class="mt-2 text-sm text-primary">Learn more →</div>
            </RouterLink>
          </div>
        </div>
      </section>

      <!-- Call to Action Block -->
      <section
        v-else-if="block.type === 'cta'"
        class="cta-block py-16 bg-muted/50"
      >
        <div class="container mx-auto px-4 text-center">
          <h2 v-if="block.title" class="text-3xl font-bold mb-6">
            {{ block.title }}
          </h2>
          <p v-if="block.subtitle" class="text-xl mb-8 max-w-2xl mx-auto">
            {{ block.subtitle }}
          </p>
          <div v-if="block.btnLabel" class="mt-8">
            <Button
              v-if="block.btnTo || block.btnHref"
              :to="block.btnTo || block.btnHref"
              class="px-6 py-3 rounded-md font-medium"
              target="_blank"
              rel="noopener"
            >
              {{ block.btnLabel }}
            </Button>
          </div>
        </div>
      </section>

      <!-- Contact Form Block -->
      <ContactFormBlock 
        v-else-if="block.type === 'contactForm'" 
        :block="block" 
      />

      <!-- Comparison Table Block -->
      <section
        v-else-if="block.type === 'comparisonTable'"
        class="comparison-table-block py-16"
      >
        <div class="container mx-auto px-4">
          <h2 v-if="block.title" class="text-3xl font-bold text-center mb-4">
            {{ block.title }}
          </h2>
          <p v-if="block.subtitle" class="text-xl text-center text-muted-foreground mb-12 max-w-3xl mx-auto">
            {{ block.subtitle }}
          </p>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr>
                  <th v-for="(column, colIndex) in block.columns" :key="colIndex" 
                      class="p-4 text-left border-b-2 border-primary/20 whitespace-nowrap"
                      :class="{
                        'bg-primary/5': block.highlightColumn === colIndex,
                        'font-semibold': column.isHeader || column.isOurs
                      }">
                    {{ column.title }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(feature, rowIndex) in block.features" :key="rowIndex" class="border-b border-muted">
                  <td class="p-4 font-medium">
                    <div class="flex items-center gap-1">
                      {{ feature.name }}
                      <InfoTooltip 
                        v-if="feature.info" 
                        :text="feature.info" 
                        button-class="inline-flex items-center p-0 m-0 cursor-help"
                        icon-class="h-4 w-4 text-muted-foreground ml-1"
                      />
                    </div>
                  </td>
                  <td v-for="(value, valueIndex) in feature.values" :key="valueIndex" 
                      class="p-4 text-center whitespace-nowrap"
                      :class="{ 'bg-primary/5': block.highlightColumn === valueIndex + 1 }">
                    <template v-if="typeof value === 'boolean'">
                      <span v-if="value" class="text-green-500 text-xl">✓</span>
                      <span v-else class="text-red-500 text-xl">✗</span>
                    </template>
                    <template v-else>
                      {{ value }}
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Fallback for unknown block types -->
      <div v-else class="unknown-block py-8">
        <div class="container mx-auto px-4">
          <p class="text-red-500">Unknown block type: {{ block.type }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { BLOCK_TYPES, validateBlock } from "./blockTypes";
import { Button } from "@/components/ui/button";
import ContactFormBlock from "./ContactFormBlock.vue";
import { RouterLink } from "vue-router";
import InfoTooltip from "@/components/InfoTooltip.vue";
import { useTypewriter } from "@/composables/useTypewriter.js";

const props = defineProps({
	blocks: {
		type: Array,
		required: true,
		default: () => [],
	},
});

// Get the first hero block's typewriter words
const heroBlock = computed(() => props.blocks.find(block => block.type === 'hero'));
const typewriterWords = computed(() => heroBlock.value?.typrwriter || []);

// Initialize typewriter effect
const { typewriterText } = useTypewriter(typewriterWords.value);

// Validate blocks and log warnings for invalid blocks
const validatedBlocks = computed(() => {
	return props.blocks.map((block) => {
		const validation = validateBlock(block);
		if (!validation.isValid) {
			console.warn(`Invalid block configuration:`, validation.errors, block);
		}
		return {
			...block,
			_isValid: validation.isValid,
		};
	});
});
</script>

<style scoped>
.hero-block {
  background-color: #333;
  background-image: url("/img/bg/bg5.png");
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
  color: white;
  color: antiquewhite;
  position: relative;
  min-height: min(70vh, 50vw, 610px); 
}

.hero-block:not(.no-bg-filter)::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1;
}

.hero-block > .container {
  position: relative;
  z-index: 2;
}

.typewriter-word {
  position: relative;
  color: #8b5cf6; /* purple-500 */
}

.typewriter-word::after {
  content: '|';
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>
