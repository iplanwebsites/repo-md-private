<script setup>
import { computed, ref } from 'vue'
import { Linkedin, Facebook, Link, Minus, Check } from 'lucide-vue-next'
import { XIcon } from '@/lib/MyIcons.js'
import { toast } from '@/components/ui/toast'

const props = defineProps({
  blog: {
    type: Object,
    required: true
  }
})

const hasHeroImage = computed(() => props.blog.cover || props.blog.featuredImage)
const heroImageUrl = computed(() => props.blog.cover || props.blog.featuredImage)
const hasHeaderCta = computed(() => props.blog.headerCta)

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

const getReadingTime = (content) => {
  if (!content) return '5min read'
  const wordsPerMinute = 200
  const words = content.split(' ').length
  const minutes = Math.ceil(words / wordsPerMinute)
  return `${minutes}min read`
}

const isCopied = ref(false)

const copyToClipboard = async () => {
  try {
    if (typeof window !== 'undefined') {
      await navigator.clipboard.writeText(window.location.href)
      isCopied.value = true
      toast({
        title: 'Copied!',
        description: 'Link copied to clipboard',
      })
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        isCopied.value = false
      }, 2000)
    }
  } catch (err) {
    console.error('Failed to copy link:', err)
    toast({
      title: 'Error',
      description: 'Failed to copy link',
      variant: 'destructive'
    })
  }
}

const getCurrentUrl = () => {
  return typeof window !== 'undefined' ? window.location.href : ''
}
</script>

<template>
  <div class="single-content__hero-wrap">
    <div class="single-content__hero-container">
      <div 
        class="single-content__thumbnail"
        :class="{ 'single-content__thumbnail--custom-hero': hasHeroImage }"
      >
        <!-- Hero Image Section -->
        <div v-if="hasHeroImage" class="single-content__hero-image-wrap">
          <div class="single-content__hero-image-thumb">
            <img 
              :src="heroImageUrl" 
              :alt="blog.title" 
              class="lazyloaded" 
              data-ll-status="loaded"
            />
          </div>
        </div>

        <!-- Header CTA Button -->
        <a 
          v-if="hasHeaderCta"
          class="single-content__video-cta" 
          :href="blog.headerCta.url"
          :target="blog.headerCta.target || '_blank'"
        >
          {{ blog.headerCta.text }}
        </a>

        <!-- Blog Header Content -->
        <div class="single-content__content">
          <div class="single-content__header">
            <!-- Category -->
            <h2 
              v-if="blog.category" 
              class="single-content__category"
              :style="blog.categoryColor ? `--text-color: ${blog.categoryColor}` : '--text-color: var(--color-pink)'"
            >
              <a v-if="blog.categoryUrl" :href="blog.categoryUrl">
                {{ blog.category }}
              </a>
              <span v-else>{{ blog.category }}</span>
            </h2>

            <!-- Title -->
            <h1 class="single-content__title">{{ blog.title }}</h1>

            <!-- Meta Information -->
            <div class="meta single-content__meta">
              <div class="meta__group spread">
                <!-- Author -->
                <div v-if="blog.author" class="author-display">
                  <a href="#" class="center justify-start between">
                    <img 
                      v-if="blog.authorAvatar"
                      class="avatar image skip-lazy author-display__image" 
                      :alt="blog.author"
                      :src="blog.authorAvatar"
                    />
                    <div v-else class="author-display__image author-display__image--fallback">
                      {{ blog.author.charAt(0) }}
                    </div>
                    <div class="author-display__group">
                      <p class="author-display__name">{{ blog.author }}</p>
                      <p v-if="blog.authorTitle" class="author-display__position">
                        {{ blog.authorTitle }}
                      </p>
                    </div>
                  </a>
                </div>

                <!-- Separator -->
                <Minus class="hidden-mobile vertical-bar rotate-90" :size="20" />

                <!-- Date and Reading Time -->
                <div class="meta__info spread between">
                  <p class="meta__date center">
                    <span>{{ formatDate(blog.publishedAt || blog.date) }}</span>
                  </p>
                  <Minus class="vertical-bar rotate-90" :size="20" />
                  <p class="meta__reading center">
                    <span>{{ getReadingTime(blog.content || blog.html) }}</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Social Share -->
            <div class="single-content__share-desktop-wrap hidden md:block">
              <ul class="list-reset share__list share__list--top" role="list">
                <li class="share__list-item">
                  <a 
                    class="share__link" 
                    rel="nofollow noopener" 
                    target="_blank" 
                    :href="`https://twitter.com/share?url=${encodeURIComponent(getCurrentUrl())}&text=${encodeURIComponent(blog.title)}`"
                  >
                    <XIcon :size="20" />
                  </a>
                </li>
                <li class="share__list-item">
                  <a 
                    class="share__link" 
                    rel="nofollow noopener" 
                    target="_blank" 
                    :href="`https://www.linkedin.com/shareArticle?url=${encodeURIComponent(getCurrentUrl())}&title=${encodeURIComponent(blog.title)}`"
                  >
                    <Linkedin :size="20" />
                  </a>
                </li>
                <li class="share__list-item">
                  <a 
                    class="share__link" 
                    rel="nofollow noopener" 
                    target="_blank" 
                    :href="`https://www.facebook.com/sharer.php?u=${encodeURIComponent(getCurrentUrl())}`"
                  >
                    <Facebook :size="20" />
                  </a>
                </li>
                <li class="share__list-item">
                  <button 
                    class="share__link button-reset" 
                    :class="{ 'share__link--copied': isCopied }"
                    @click="copyToClipboard"
                  >
                    <Check v-if="isCopied" :size="20" />
                    <Link v-else :size="20" />
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avatar{
  background:#999;
}
.single-content__hero-wrap {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(168, 85, 247, 0.03) 50%, rgba(236, 72, 153, 0.03) 100%);
  padding: 4rem 0;
  width: 100vw;
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
}

.single-content__hero-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

@media (min-width: 640px) {
  .single-content__hero-container {
    padding: 0 1.5rem;
  }
}

@media (min-width: 1024px) {
  .single-content__hero-container {
    padding: 0 2rem;
  }
}

.single-content__thumbnail {
  position: relative;
}

.single-content__thumbnail--custom-hero {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: flex-start;
}

@media (min-width: 1024px) {
  .single-content__thumbnail--custom-hero {
    flex-direction: row;
  }
}

.single-content__hero-image-wrap {
  flex-shrink: 0;
}

@media (min-width: 1024px) {
  .single-content__hero-image-wrap {
    width: 50%;
  }
}

@media (min-width: 1280px) {
  .single-content__hero-image-wrap {
    width: 40%;
  }
}

.single-content__hero-image-thumb {
  position: relative;
  overflow: hidden;
  border-radius: 0.5rem;
  aspect-ratio: 16 / 9;
}

.single-content__hero-image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.single-content__video-cta {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background-color: #9333ea;
  color: white;
  font-weight: 600;
  border-radius: 0.5rem;
  text-decoration: none;
  transition: background-color 0.2s;
  order: 3;
}

.single-content__video-cta:hover {
  background-color: #7c3aed;
}

.single-content__content {
  flex-grow: 1;
}

@media (min-width: 1024px) {
  .single-content__content {
    width: 50%;
  }
}

@media (min-width: 1280px) {
  .single-content__content {
    width: 60%;
  }
}

.single-content__header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.single-content__category {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-color, #ec4899);
}

.single-content__category a {
  color: inherit;
  text-decoration: none;
  transition: opacity 0.2s;
}

.single-content__category a:hover {
  opacity: 0.8;
}

.single-content__title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.25;
}

@media (min-width: 1024px) {
  .single-content__title {
    font-size: 2.25rem;
  }
}

@media (min-width: 1280px) {
  .single-content__title {
    font-size: 3rem;
  }
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 640px) {
  .meta {
    flex-direction: row;
    align-items: center;
  }
}

.meta__group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.spread {
  justify-content: space-between;
}

.between {
  justify-content: space-between;
}

.center {
  display: flex;
  align-items: center;
}

.justify-start {
  justify-content: flex-start;
}

.author-display {
  --author-img-size: 40px;
}

.author-display a {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: inherit;
}

.author-display__image {
  border-radius: 50%;
  object-fit: cover;
  width: var(--author-img-size);
  height: var(--author-img-size);
}

.author-display__image--fallback {
  background-color: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
  font-weight: 600;
}

.author-display__group {
  display: flex;
  flex-direction: column;
}

.author-display__name {
  font-weight: 600;
  color: #111827;
  font-size: 0.875rem;
}

.author-display__position {
  font-size: 0.75rem;
  color: #4b5563;
}

.vertical-bar {
  color: #d1d5db;
}

.hidden-mobile {
  display: none;
}

@media (min-width: 640px) {
  .hidden-mobile {
    display: block;
  }
}

.meta__info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.meta__date span,
.meta__reading span {
  font-size: 0.875rem;
  color: #4b5563;
}

.single-content__share-desktop-wrap {
  margin-top: 1.5rem;
}

.share__list {
  display: flex;
  gap: 0.75rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.share__list-item {
  list-style: none;
}

.share__link {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: #f3f4f6;
  transition: all 0.2s;
  color: #4b5563;
  text-decoration: none;
}

.share__link:hover {
  background-color: #e5e7eb;
  color: #1f2937;
}

.share__link--copied.button-reset {
  background-color: #22c55e !important;
  color: white;
}

.share__link--copied.button-reset:hover {
  background-color: #16a34a !important;
  color: white;
}

.button-reset {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.share__link.button-reset {
  background-color: #f3f4f6;
}

/* Mobile responsive adjustments */
@media (max-width: 640px) {
  .single-content__thumbnail--custom-hero {
    flex-direction: column;
  }
  
  .single-content__hero-image-wrap {
    width: 100%;
  }
  
  .single-content__content {
    width: 100%;
  }
  
  .single-content__title {
    font-size: 1.5rem;
  }
  
  .meta__group {
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }
  
  .meta__info {
    flex-direction: row;
  }
}
</style>