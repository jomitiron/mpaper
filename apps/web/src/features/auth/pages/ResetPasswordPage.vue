<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import { errorMessage, forgotPassword, resetPassword } from '@motopapers/api';
import { Button, Field, Input, useToast } from '@motopapers/ui';
import { reactive, ref, useId, useTemplateRef } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AuthShell from '../components/AuthShell.vue';
import FormAlert from '../components/FormAlert.vue';
import OtpInput from '../components/OtpInput.vue';
import PasswordInput from '../components/PasswordInput.vue';
import { useCooldown } from '../composables/useCooldown';
import { apiFieldErrors, CODE_MESSAGES, codeProblem } from '../lib/errors';
import { focusFirstInvalid } from '../lib/focus';
import { authEmail } from '../lib/handoff';
import {
  checkEmail,
  hasErrors,
  PASSWORD_HINT,
  validateReset,
  type FormErrors,
  type ResetValues,
} from '../lib/validation';

/**
 * The code from the reset email and a new password. The email comes from /forgot-password (kept
 * in this tab) or from the link in the email (`?email=…&otp=…`); without one, the driver types it.
 */

const route = useRoute();
const router = useRouter();
const toast = useToast();
const formEl = useTemplateRef<HTMLFormElement>('form');
const otp = useTemplateRef<InstanceType<typeof OtpInput>>('otp');
const cooldown = useCooldown('reset-password');
const codeErrorId = useId();

const fromQuery = (key: string) => (typeof route.query[key] === 'string' ? route.query[key] : '');

const form = reactive<ResetValues>({
  email: fromQuery('email') || authEmail.get(),
  otp: fromQuery('otp').replace(/\D/g, '').slice(0, 6),
  password: '',
});
/** Show the email as text when we already know it; otherwise ask for it. */
const knownEmail = ref(Boolean(form.email));
const errors = ref<FormErrors<keyof ResetValues>>({});
const problem = ref<string | null>(null);
const loading = ref(false);
const sending = ref(false);

function focusPassword() {
  if (!form.password) formEl.value?.querySelector<HTMLInputElement>('.pw input')?.focus();
}

async function submit() {
  problem.value = null;
  errors.value = validateReset(form);
  if (errors.value.email) knownEmail.value = false;
  if (hasErrors(errors.value)) {
    if (errors.value.otp && !errors.value.email) return otp.value?.focus();
    return focusFirstInvalid(formEl.value);
  }

  loading.value = true;
  try {
    const email = form.email.trim();
    await resetPassword({ email, otp: form.otp, password: form.password });
    authEmail.set(email); // Prefills sign-in.
    toast.success('Password changed. Sign in with your new password.');
    await router.replace('/sign-in');
  } catch (caught) {
    const kind = codeProblem(caught);
    const fields = apiFieldErrors(caught, ['email', 'password'] as const);
    if (kind) {
      errors.value = { otp: CODE_MESSAGES[kind] };
      form.otp = '';
      otp.value?.focus();
    } else if (hasErrors(fields)) {
      errors.value = fields;
      await focusFirstInvalid(formEl.value);
    } else {
      problem.value = errorMessage(caught);
    }
  } finally {
    loading.value = false;
  }
}

async function resend() {
  if (cooldown.active.value || sending.value) return;
  const emailError = checkEmail(form.email);
  if (emailError) {
    knownEmail.value = false;
    errors.value = { email: emailError };
    return focusFirstInvalid(formEl.value);
  }
  sending.value = true;
  problem.value = null;
  try {
    await forgotPassword({ email: form.email.trim() });
    authEmail.set(form.email);
    cooldown.start();
    errors.value = {};
    form.otp = '';
    toast.success(`A new code is on its way to ${form.email.trim()}.`);
    otp.value?.focus();
  } catch (caught) {
    problem.value = errorMessage(caught);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <AuthShell headline="Let's get you back in.">
    <div class="intro">
      <h1>Choose a new password</h1>
      <p v-if="knownEmail" class="muted">
        Enter the 6-digit code we sent to <b class="ink">{{ form.email }}</b
        >, then choose a new password.
        <RouterLink class="link" to="/forgot-password">Use another email</RouterLink>
      </p>
      <p v-else class="muted">Enter your email, the 6-digit code we sent you and a new password.</p>
    </div>

    <form ref="form" novalidate @submit.prevent="submit">
      <Field v-if="!knownEmail" label="Email" :error="errors.email">
        <Input
          v-model="form.email"
          type="email"
          autocomplete="email"
          inputmode="email"
          autocapitalize="off"
          spellcheck="false"
        />
      </Field>
      <div class="fld">
        <span class="lbl" aria-hidden="true">Code from the email</span>
        <OtpInput
          ref="otp"
          v-model="form.otp"
          label="Code from the email"
          :invalid="Boolean(errors.otp)"
          :described-by="errors.otp ? codeErrorId : undefined"
          @complete="focusPassword"
        />
        <span v-if="errors.otp" :id="codeErrorId" class="fld-error">
          <CircleAlert class="ic" aria-hidden="true" />{{ errors.otp }}
        </span>
      </div>
      <Field label="New password" :hint="PASSWORD_HINT" :error="errors.password">
        <PasswordInput v-model="form.password" autocomplete="new-password" />
      </Field>

      <FormAlert v-if="problem" :message="problem" />
      <Button type="submit" size="lg" block :loading="loading">Save new password</Button>
    </form>

    <p class="muted center" aria-live="polite">
      Didn't get it?
      <button
        type="button"
        class="link text-button"
        :disabled="cooldown.active.value || sending"
        @click="resend"
      >
        {{
          cooldown.active.value ? `Send a new code in ${cooldown.label.value}` : 'Send a new code'
        }}
      </button>
    </p>
    <p class="muted center">
      Remembered it? <RouterLink class="link" to="/sign-in">Sign in</RouterLink>
    </p>
  </AuthShell>
</template>

<style scoped>
.ink {
  color: var(--ink);
  overflow-wrap: anywhere;
}
</style>
