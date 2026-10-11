<script setup lang="ts">
import { errorMessage, isHttpError, resendVerificationEmail, signIn } from '@motopapers/api';
import { Button, Field, Input } from '@motopapers/ui';
import { computed, reactive, ref, useTemplateRef } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { env } from '@/env';
import { safeNext } from '@/router/next';
import { useSessionStore } from '@/stores/session';
import AuthShell from '../components/AuthShell.vue';
import FormAlert from '../components/FormAlert.vue';
import GoogleButton from '../components/GoogleButton.vue';
import PasswordInput from '../components/PasswordInput.vue';
import { useCooldown } from '../composables/useCooldown';
import { mightBeUnverified, signInError } from '../lib/errors';
import { focusFirstInvalid } from '../lib/focus';
import { authEmail, type OAuthState } from '../lib/handoff';
import { hasErrors, validateSignIn, type FormErrors, type SignInValues } from '../lib/validation';

const session = useSessionStore();
const route = useRoute();
const router = useRouter();
const formEl = useTemplateRef<HTMLFormElement>('form');
const verifyCooldown = useCooldown('verify-email');

const form = reactive<SignInValues>({ email: authEmail.get(), password: '' });
const remember = ref(false);
const errors = ref<FormErrors<keyof SignInValues>>({});
const problem = ref<string | null>(null);
const unverified = ref(false);
const loading = ref(false);
const sending = ref(false);

const next = computed(() => safeNext(route.query.next));
/** Keeps `?next=` on the links to sign up, so a new driver still lands where they were going. */
const nextQuery = computed(() => (route.query.next ? { next: next.value } : {}));

const googleState = (): OAuthState => ({
  action: 'signin',
  next: next.value,
  remember: remember.value,
});

async function submit() {
  problem.value = null;
  unverified.value = false;
  errors.value = validateSignIn(form);
  if (hasErrors(errors.value)) return focusFirstInvalid(formEl.value);

  loading.value = true;
  try {
    const result = await signIn({ email: form.email.trim(), password: form.password });
    session.setSession(result, { remember: remember.value });
    authEmail.clear();
    await router.replace(next.value);
  } catch (error) {
    unverified.value = mightBeUnverified(error);
    problem.value = unverified.value
      ? "We couldn't sign you in. If you've just created your account, verify your email first."
      : signInError(error);
  } finally {
    loading.value = false;
  }
}

/** Sends a fresh code and opens the verify step of sign-up. */
async function verifyEmail() {
  sending.value = true;
  try {
    await resendVerificationEmail({ email: form.email.trim() });
    authEmail.set(form.email);
    verifyCooldown.start();
    await router.push({ path: '/sign-up', query: { step: 'verify', ...nextQuery.value } });
  } catch (error) {
    unverified.value = false;
    problem.value =
      isHttpError(error) && /already been verified/i.test(error.message)
        ? "Your email is already verified. Something went wrong on our side, so try signing in again in a moment."
        : errorMessage(error);
  } finally {
    sending.value = false;
  }
}

async function useSampleAccount() {
  const { SAMPLE_EMAIL, SAMPLE_PASSWORD } = await import('@motopapers/api/mocks');
  form.email = SAMPLE_EMAIL;
  form.password = SAMPLE_PASSWORD;
}
</script>

<template>
  <AuthShell headline="Welcome back. Your papers are waiting.">
    <div class="intro">
      <h1>Sign in</h1>
      <p class="muted">Pick up where you left off.</p>
    </div>

    <GoogleButton label="Continue with Google" :state="googleState" />
    <div class="or">or use your email</div>

    <form ref="form" novalidate @submit.prevent="submit">
      <Field label="Email" :error="errors.email">
        <Input
          v-model="form.email"
          type="email"
          autocomplete="email"
          inputmode="email"
          autocapitalize="off"
          spellcheck="false"
        />
      </Field>
      <Field label="Password" :error="errors.password">
        <template #aside>
          <RouterLink class="link small" to="/forgot-password" @click="authEmail.set(form.email)">
            Forgot password?
          </RouterLink>
        </template>
        <PasswordInput v-model="form.password" autocomplete="current-password" />
      </Field>
      <label class="check">
        <input v-model="remember" type="checkbox" />
        Keep me signed in
      </label>

      <FormAlert v-if="problem" :message="problem">
        <Button v-if="unverified" variant="white" size="sm" :loading="sending" @click="verifyEmail">
          Verify my email
        </Button>
      </FormAlert>

      <Button type="submit" size="lg" block :loading="loading">Sign in</Button>
    </form>

    <p class="muted center">
      New to MotoPapers?
      <RouterLink class="link" :to="{ path: '/sign-up', query: nextQuery }">
        Create an account
      </RouterLink>
    </p>

    <div v-if="env.useMocks" class="mock-note">
      The mock API is on.
      <button type="button" class="link" @click="useSampleAccount">Use the sample account</button>
      to sign in as Ada Okafor.
    </div>
  </AuthShell>
</template>
