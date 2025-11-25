<script setup>
import { Check } from 'lucide-vue-next'

const features = [
  'Manage all your content in one place',
  'Cut hosting costs',
  'Build on solid, open standards'
]

const featuresOLD = [
  { id: 1, text: 'Manage all your content in one place' },
  { id: 2, text: 'Collaborate with your team' },
  { id: 3, text: 'Use Repo.md for FREE—forever' }
]
</script>




<template>
  <div class="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
    <h1 class="text-2xl font-bold text-gray-900 mb-8">
      Start using Repo.md today
    </h1>
    
    <div class="space-y-4 mb-8">
      <div v-for="feature in features" :key="feature" class="flex items-center space-x-3">
        <div class="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <Check class="w-4 h-4 text-white" />
        </div>
        <span class="text-gray-800 text-left flex-1">{{ feature }}</span>
      </div>
    </div>
    
    <router-link to="/waitlist"> 
    <button class="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-lg">
      Get Started
    </button>
     </router-link>
  </div>
</template>




 