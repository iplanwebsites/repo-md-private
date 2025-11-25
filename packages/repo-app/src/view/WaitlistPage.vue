<script setup>
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast/use-toast.ts';
import trpc from '@/trpc.js';

const email = ref('');
const name = ref('');
const company = ref('');
const useCaseOther = ref('');

const useCases = ref([
  { id: 'developers', label: 'Developer Documentation', checked: false },
  { id: 'marketing', label: 'Marketing Website', checked: false },
  { id: 'blog', label: 'Blog Platform', checked: false },
  { id: 'knowledge', label: 'Knowledge Base', checked: false },
  { id: 'ai', label: 'AI-Powered Documentation', checked: false },
  { id: 'integration', label: 'Integration with Existing Tools', checked: false }
]);

const loading = ref(false);
const submitted = ref(false);

async function submitWaitlist() {
  if (!email.value) {
    toast({
      title: 'Error',
      description: 'Please enter your email address',
      variant: 'destructive'
    });
    return;
  }

  loading.value = true;

  try {
    // Get the selected use cases
    const selectedUseCases = useCases.value
      .filter(useCase => useCase.checked)
      .map(useCase => useCase.label);
    
    if (useCaseOther.value) {
      selectedUseCases.push(useCaseOther.value);
    }

    // Submit to waitlist using tRPC
    await trpc.waitlist.add.mutate({
      email: email.value,
      name: name.value,
      company: company.value,
      useCases: selectedUseCases
    });

    submitted.value = true;
    toast({
      title: 'Success!',
      description: 'You have been added to our waitlist. We\'ll be in touch soon!',
    });
  } catch (error) {
    console.error('Error submitting to waitlist:', error);
    toast({
      title: 'Something went wrong',
      description: 'Unable to join the waitlist. Please try again later.',
      variant: 'destructive'
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="container mx-auto py-12 px-4">
    <div class="max-w-3xl mx-auto text-center mb-10">
      <h1 class="text-4xl font-bold tracking-tight">Join Our Waitlist</h1>
      <p class="mt-4 text-lg text-muted-foreground">
        We're currently in private beta. Sign up to get early access to our platform.
      </p>
    </div>

    <Card class="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Request Access</CardTitle>
        <CardDescription>
          Fill out the form below to join our waitlist. We'll notify you when you're granted access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="!submitted">
          <div class="grid gap-6">
            <div class="grid gap-3">
              <Label for="email" required>Email</Label>
              <Input id="email" v-model="email" type="email" placeholder="you@example.com" required />
            </div>
            
            <div class="grid gap-3">
              <Label for="name">Full Name</Label>
              <Input id="name" v-model="name" placeholder="John Doe" />
            </div>
            
            <div class="grid gap-3">
              <Label for="company">Company</Label>
              <Input id="company" v-model="company" placeholder="Your Company" />
            </div>
            
            <div class="grid gap-3">
              <Label>What are your use cases? (Select all that apply)</Label>
              <div class="grid gap-2">
                <div v-for="useCase in useCases" :key="useCase.id" class="flex items-center space-x-2">
                  <Checkbox :id="useCase.id" v-model:checked="useCase.checked" />
                  <Label :for="useCase.id" class="cursor-pointer">{{ useCase.label }}</Label>
                </div>
              </div>
            </div>
            
            <div class="grid gap-3">
              <Label for="use-case-other">Other use case</Label>
              <Textarea 
                id="use-case-other" 
                v-model="useCaseOther" 
                placeholder="Tell us about your specific use case"
                rows="3"
              />
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8">
          <div class="text-3xl mb-2">🎉</div>
          <h3 class="text-xl font-medium mb-2">Thanks for joining our waitlist!</h3>
          <p class="text-muted-foreground">
            We'll be in touch soon with updates about your access to our platform.
          </p>
        </div>
      </CardContent>
      <CardFooter v-if="!submitted">
        <Button 
          class="w-full" 
          size="lg" 
          @click="submitWaitlist" 
          :disabled="loading"
        >
          <span v-if="!loading">Join Waitlist</span>
          <span v-else>
            <span class="inline-block animate-spin mr-2">⏳</span>
            Submitting...
          </span>
        </Button>
      </CardFooter>
    </Card>
  </div>
</template>