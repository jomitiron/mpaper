<script setup lang="ts">
import { Button, Logo } from '@motopapers/ui';
</script>

<template>
  <div class="bare-card">
    <Logo to="/" />
    <h1>Page not found</h1>
    <p class="muted">We couldn't find that page. Check the address, or go back to Home.</p>
    <Button to="/" size="lg">Go to Home</Button>
  </div>
</template>
