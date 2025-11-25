<script setup>
</script>

<template>
  <div class="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-500 to-orange-400 rounded-3xl ">
    <!-- Background overlay -->
    <div class="absolute inset-0 bg-black/10"></div>
    
    <!-- Content -->
    <div class="relative z-10 px-8 py-12 lg:px-12 lg:py-16">
      <div class="grid lg:grid-cols-2 gap-8 items-center">
        
        <!-- Left side - Content and CTAs -->
        <div class="text-white space-y-6">
          <h2 class="text-3xl lg:text-4xl font-bold leading-tight">
            Ready to get started?
          </h2>
          <p class="text-lg opacity-90">
            Join hundreds of teams already using our platform to build cool stuff and stay productive.
          </p>
          
          <div class="flex flex-col sm:flex-row gap-4 pt-4">
            <Button to="/waitlist" size="lg">
              Get Started Free
            </Button>
            
            <Button to="/pricing" variant="secondary" size="lg">
              View Pricing
            </Button>
          </div>
        </div>
        
        <!-- Right side - Simple image -->
        <div class="hidden lg:block lg:pl-8">
          <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <img 
              src="/img/bg/bg15.png" 
              alt="Platform preview" 
              class="w-full h-auto rounded-lg opacity-90"
            />
          </div>
        </div>
        
      </div>
    </div>
  </div>
</template>

