<script setup lang="ts">
import { Upload } from '@lucide/vue';
import { Button } from '@motopapers/ui';

/** Step 3 of sign-up: add a car now (Add a car does the upload) or skip to Home. */
withDefaults(defineProps<{ skipTo?: string }>(), { skipTo: '/' });
</script>

<template>
  <div class="intro">
    <h1 tabindex="-1">Add your first car</h1>
    <p class="muted">Upload a photo of your vehicle licence. We'll read the details for you.</p>
  </div>
  <div class="drop">
    <span class="drop-ic" aria-hidden="true"><Upload class="ic" /></span>
    <b>Your vehicle licence</b>
    <span class="muted small">JPG, PNG or PDF, up to 4 MB</span>
    <div class="acts">
      <Button to="/cars/new">Upload licence</Button>
    </div>
  </div>
  <Button variant="quiet" block :to="skipTo">Skip for now</Button>
</template>

<style scoped>
.drop {
  border: 2px dashed #c9befa;
  border-radius: 26px;
  padding: 44px 24px;
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 10px;
  background: var(--lilac);
}
.drop-ic {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-xl);
  display: grid;
  place-items: center;
  background: #fff;
  color: var(--coral);
  box-shadow: var(--shadow-sm);
}
.drop-ic .ic {
  width: 28px;
  height: 28px;
}
.drop b {
  font-family: var(--f-head);
  font-size: 19px;
}
.small {
  font-size: 13.5px;
  color: var(--ink-2); /* --muted is 4.49:1 on lilac, just short of AA */
}
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 8px;
}
</style>
