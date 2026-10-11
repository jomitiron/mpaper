<script setup lang="ts">
import { errorMessage, signIn } from '@motopapers/api';
import { Button, useToast } from '@motopapers/ui';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { env } from '@/env';
import { safeNext } from '@/router/next';
import { useSessionStore } from '@/stores/session';
import AuthPlaceholder from '../components/AuthPlaceholder.vue';

// Placeholder from phase 0. With mocks on, it signs in as the sample driver so the app can be used.
const session = useSessionStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const loading = ref(false);

async function signInWithSample() {
  loading.value = true;
  try {
    const { SAMPLE_EMAIL, SAMPLE_PASSWORD } = await import('@motopapers/api/mocks');
    session.setSession(await signIn({ email: SAMPLE_EMAIL, password: SAMPLE_PASSWORD }));
    await router.replace(safeNext(route.query.next));
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthPlaceholder
    title="Sign in"
    :items="['Email and password, or Google', 'Forgot password', 'Back to the page you were on']"
  >
    <template v-if="env.useMocks">
      <Button size="lg" block :loading="loading" @click="signInWithSample">
        Sign in with sample data
      </Button>
      <p class="hint">The mock API is on. This signs you in as Ada Okafor.</p>
    </template>
  </AuthPlaceholder>
</template>
