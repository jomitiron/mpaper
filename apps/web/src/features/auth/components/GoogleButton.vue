<script setup lang="ts">
import { ApiError, errorMessage } from '@motopapers/api';
import { Button, useToast } from '@motopapers/ui';
import { ref } from 'vue';
import type { OAuthState } from '../lib/handoff';
import { continueWithGoogle } from '../lib/google';

/** "Continue with Google" / "Sign up with Google". Leaves the app for Google's sign-in page. */

const props = defineProps<{
  label: string;
  /** What to do when Google sends the driver back. Read at click time. */
  state: () => OAuthState;
}>();

const toast = useToast();
const loading = ref(false);

async function go() {
  loading.value = true;
  try {
    await continueWithGoogle(props.state());
    // Stays "loading" while the browser leaves for Google.
  } catch (error) {
    loading.value = false;
    toast.error(
      error instanceof ApiError
        ? errorMessage(error)
        : "We couldn't open Google sign-in. Try again, or use your email.",
    );
  }
}
</script>

<template>
  <Button variant="white" size="lg" block :loading="loading" @click="go">
    <svg v-if="!loading" class="ic" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.6z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z"
      />
    </svg>
    {{ label }}
  </Button>
</template>

<style scoped>
svg.ic {
  stroke: none;
}
</style>
