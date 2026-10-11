<script setup lang="ts">
import { errorMessage, forgotPassword } from '@motopapers/api';
import { Button, Field, Input } from '@motopapers/ui';
import { ref, useTemplateRef } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AuthShell from '../components/AuthShell.vue';
import FormAlert from '../components/FormAlert.vue';
import { useCooldown } from '../composables/useCooldown';
import { focusFirstInvalid } from '../lib/focus';
import { authEmail } from '../lib/handoff';
import { checkEmail } from '../lib/validation';

/** Asks for a reset code by email, then moves on to /reset-password. */

const router = useRouter();
const formEl = useTemplateRef<HTMLFormElement>('formRoot');
const cooldown = useCooldown('reset-password');

const email = ref(authEmail.get());
const error = ref<string | undefined>();
const problem = ref<string | null>(null);
const loading = ref(false);

async function send() {
  problem.value = null;
  error.value = checkEmail(email.value);
  if (error.value) return focusFirstInvalid(formEl.value);

  loading.value = true;
  try {
    await forgotPassword({ email: email.value.trim() });
    authEmail.set(email.value);
    cooldown.start();
    await router.push('/reset-password');
  } catch (caught) {
    problem.value = errorMessage(caught);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthShell headline="Let's get you back in.">
    <div class="intro">
      <h1>Forgot your password?</h1>
      <p class="muted">
        Enter the email you signed up with. We'll send you a 6-digit code to choose a new password.
      </p>
    </div>

    <form ref="formRoot" novalidate @submit.prevent="send">
      <Field label="Email" :error="error">
        <Input
          v-model="email"
          type="email"
          autocomplete="email"
          inputmode="email"
          autocapitalize="off"
          spellcheck="false"
        />
      </Field>
      <FormAlert v-if="problem" :message="problem" />
      <Button type="submit" size="lg" block :loading="loading">Send code</Button>
    </form>

    <p class="muted center">
      Remembered it? <RouterLink class="link" to="/sign-in">Sign in</RouterLink>
    </p>
  </AuthShell>
</template>
