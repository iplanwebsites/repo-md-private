<script setup>
import { Card } from '@/components/ui/card';
import { CreditCard, DollarSign, TrendingUp, Users, Calendar, PieChart } from 'lucide-vue-next';
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Revenue Analytics</h1>
      <p class="text-muted-foreground">Financial metrics and subscription analytics</p>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card class="p-6 text-center">
        <DollarSign class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 class="text-lg font-semibold mb-2">Revenue Dashboard Coming Soon</h3>
        <p class="text-sm text-muted-foreground">
          This dashboard will display monthly recurring revenue (MRR), 
          annual recurring revenue (ARR), and revenue growth trends.
        </p>
      </Card>
      
      <Card class="p-6 text-center">
        <CreditCard class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 class="text-lg font-semibold mb-2">Subscription Analytics</h3>
        <p class="text-sm text-muted-foreground">
          Monitor subscription tiers, upgrade/downgrade patterns, and churn rates.
        </p>
      </Card>
      
      <Card class="p-6 text-center">
        <Users class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 class="text-lg font-semibold mb-2">Customer Metrics</h3>
        <p class="text-sm text-muted-foreground">
          Track customer lifetime value (CLV), acquisition costs, and retention.
        </p>
      </Card>
      
      <Card class="p-6 text-center">
        <Calendar class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 class="text-lg font-semibold mb-2">Billing Cycles</h3>
        <p class="text-sm text-muted-foreground">
          View upcoming renewals, payment schedules, and billing history.
        </p>
      </Card>
      
      <Card class="p-6 text-center">
        <TrendingUp class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 class="text-lg font-semibold mb-2">Growth Projections</h3>
        <p class="text-sm text-muted-foreground">
          Forecast revenue growth based on current trends and conversion rates.
        </p>
      </Card>
      
      <Card class="p-6 text-center">
        <PieChart class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 class="text-lg font-semibold mb-2">Revenue Breakdown</h3>
        <p class="text-sm text-muted-foreground">
          Analyze revenue by plan type, geographic region, and customer segment.
        </p>
      </Card>
    </div>
  </div>
</template>