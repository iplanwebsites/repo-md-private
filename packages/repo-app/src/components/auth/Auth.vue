<script setup>
import { ref, computed } from "vue";
import { supabase } from "@/lib/supabaseClient";
import { useRoute } from "vue-router";

const loading = ref(false);
const email = ref("");
const route = useRoute();
const isLogin = computed(() => route.name === "login" || route.name === "beta-login");

import { appConfigs } from "@/appConfigs.js";
const { BRAND } = appConfigs;

// import UserAuthForm from "./components/UserAuthForm.vue";
import { cn } from "@/lib/utils";
//import { buttonVariants } from "@/lib/registry/new-york/ui/button";
</script>

<template>
  <div class="md:hidden">
    <VPImage
      alt="Authentication"
      width="1280"
      height="1214"
      class="block"
      :image="{
        dark: '/examples/authentication-dark.png',
        light: '/examples/authentication-light.png',
      }"
    />
  </div>

  <div
    class="container relative h-[800px] flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0"
  >
    <router-link
      :to="{ name: !isLogin ? (route.name === 'beta-signup' ? 'beta-login' : 'login') : (route.name === 'beta-login' ? 'beta-signup' : 'signup') }"
      class="absolute right-4 top-4 md:right-8 md:top-8"
    >
      <Button variant="outline" size="lg">
        {{ isLogin ? "Sign up" : "Log in" }}
      </Button>
    </router-link>

    <div
      class="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex"
    >
      <div class="absolute inset-0 bg-ski" />
      <div class="absolute inset-0 bg-purple-900/50" />
      <!-- Added purple overlay -->

      <router-link
        to="/"
        class="relative z-20 flex items-center text-lg font-medium"
      >
        <Logotype variant="light" />
      </router-link>
      <div class="relative z-20 mt-auto">
        <blockquote class="space-y-2">
          <p class="text-5xl">Publishing, <br />simplified.</p>
          <footer class="text-xl">Your content, everywhere</footer>
        </blockquote>
      </div>
    </div>
    <div class="lg:p-8">
      <div
        class="mx-auto flex w-full flex-col align-left space-y-6 sm:w-[350px]"
      >
        <div class="flex flex-col space-y-2 text-center">
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ isLogin ? "Welcome back!" : "Create an account" }}
            <span v-if="route.name.includes('beta-')" class="inline-block ml-2 px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full">PREVIEW</span>
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ isLogin ? "Log in to your account" : "Welcome to " + BRAND }}
          </p>
        </div>
        <UserAuthForm />
        <p class="px-8 text-center text-sm text-muted-foreground">
          By clicking continue, you agree to our

          <a href="/terms" class="underline-offset-4 hover:text-primary">
            Terms of Service
          </a>
          and our
          <a href="/privacy" class="underline-offset-4 hover:text-primary">
            Privacy Policy</a
          >.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-ski {
  background: url("https://static.repo.md/wiki/assets/img/Image-Background/Format_Web_BG_Repo.md_06-lg.webp")
    no-repeat center center;
  background-size: cover; /* Ensures the image fills the container */
}
</style>
