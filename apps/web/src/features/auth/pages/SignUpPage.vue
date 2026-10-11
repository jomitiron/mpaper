<script setup lang="ts">
import { errorMessage, signUp, type Session } from '@motopapers/api';
import { Button, Field, Input, Stepper } from '@motopapers/ui';
import { computed, reactive, ref, useTemplateRef, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { safeNext } from '@/router/next';
import { useSessionStore } from '@/stores/session';
import AuthShell from '../components/AuthShell.vue';
import FormAlert from '../components/FormAlert.vue';
import GoogleButton from '../components/GoogleButton.vue';
import PasswordInput from '../components/PasswordInput.vue';
import { useCooldown } from '../composables/useCooldown';
import FirstCarStep from '../signup/FirstCarStep.vue';
import VerifyStep from '../signup/VerifyStep.vue';
import { apiFieldErrors, isDuplicateEmail } from '../lib/errors';
import { focusFirstInvalid, focusHeading } from '../lib/focus';
import { authEmail, type OAuthState } from '../lib/handoff';
import {
  hasErrors,
  normalisePhone,
  PASSWORD_HINT,
  validateSignUp,
  type FormErrors,
  type SignUpValues,
} from '../lib/validation';

/**
 * Sign up in three steps: Account → Verify email → First car. `?step=verify` (with the email kept
 * in this tab) reopens step 2 after a refresh, or from sign-in for an unverified account.
 */

const STEPS = [{ title: 'Account' }, { title: 'Verify email' }, { title: 'First car' }];
const FIELDS = ['first_name', 'last_name', 'phone', 'email', 'password'] as const;
type Step = 0 | 1 | 2;

const session = useSessionStore();
const route = useRoute();
const router = useRouter();
const card = useTemplateRef<HTMLElement>('card');
const formEl = useTemplateRef<HTMLFormElement>('form');
const verifyCooldown = useCooldown('verify-email');

const form = reactive<SignUpValues>({
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  password: '',
});
const errors = ref<FormErrors<keyof SignUpValues>>({});
const problem = ref<string | null>(null);
const loading = ref(false);
/** The email being verified. */
const email = ref(authEmail.get());
/** The email an account was created for on this page, so going back doesn't sign up twice. */
const created = ref<string | null>(null);
const step = ref<Step>(route.query.step === 'verify' && email.value ? 1 : 0);

const next = computed(() => safeNext(route.query.next));
const nextQuery = computed(() => (route.query.next ? { next: next.value } : {}));

const googleState = (): OAuthState => ({ action: 'signup', next: next.value, remember: false });

// Browser Back from "Check your email" returns to the account form, and Forward goes again.
watch(
  () => route.query.step,
  (value) => {
    if (step.value === 2) return;
    step.value = value === 'verify' && email.value ? 1 : 0;
  },
);

watch(step, () => focusHeading(card.value));

function sameEmail(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function toVerify(address: string) {
  email.value = address;
  authEmail.set(address);
  await router.push({ path: '/sign-up', query: { ...nextQuery.value, step: 'verify' } });
}

async function createAccount() {
  problem.value = null;
  errors.value = validateSignUp(form);
  if (hasErrors(errors.value)) return focusFirstInvalid(formEl.value);

  const address = form.email.trim();
  if (created.value && sameEmail(created.value, address)) return toVerify(address);

  loading.value = true;
  try {
    await signUp({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: address,
      phone: normalisePhone(form.phone) ?? form.phone,
      password: form.password,
    });
    created.value = address;
    verifyCooldown.start(); // Sign-up sends the first code.
    await toVerify(address);
  } catch (error) {
    const fields = apiFieldErrors(error, FIELDS);
    if (isDuplicateEmail(error)) {
      errors.value = { email: "There's already an account with this email." };
    } else if (hasErrors(fields)) {
      errors.value = fields;
    } else {
      problem.value = errorMessage(error);
      return;
    }
    await focusFirstInvalid(formEl.value);
  } finally {
    loading.value = false;
  }
}

function onVerified(result: Session) {
  session.setSession(result);
  authEmail.clear();
  step.value = 2;
}

function changeEmail() {
  if (!form.email) form.email = email.value;
  void router.push({ path: '/sign-up', query: nextQuery.value });
}
</script>

<template>
  <AuthShell headline="Three quick steps and you're covered." art="steps">
    <div ref="card" class="steps-card">
      <Stepper
        :steps="STEPS"
        :current="step"
        variant="bars"
        label="Sign-up progress"
        :clickable="step === 1"
        @select="changeEmail"
      />

      <template v-if="step === 0">
        <div class="intro">
          <h1 tabindex="-1">Create your account</h1>
          <p class="muted">Track and renew your car papers in one place.</p>
        </div>

        <GoogleButton label="Sign up with Google" :state="googleState" />
        <div class="or">or use your email</div>

        <form ref="form" novalidate @submit.prevent="createAccount">
          <div class="two">
            <Field label="First name" :error="errors.first_name">
              <Input v-model="form.first_name" autocomplete="given-name" autocapitalize="words" />
            </Field>
            <Field label="Last name" :error="errors.last_name">
              <Input v-model="form.last_name" autocomplete="family-name" autocapitalize="words" />
            </Field>
          </div>
          <Field label="Phone number" :error="errors.phone">
            <Input
              v-model="form.phone"
              prefix="+234"
              type="tel"
              inputmode="tel"
              autocomplete="tel-national"
              placeholder="803 555 0142"
            />
          </Field>
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
          <Field label="Password" :hint="PASSWORD_HINT" :error="errors.password">
            <PasswordInput v-model="form.password" autocomplete="new-password" />
          </Field>

          <FormAlert v-if="problem" :message="problem" />
          <Button type="submit" size="lg" block :loading="loading">Create account</Button>
        </form>

        <p class="muted center">
          Already have an account?
          <RouterLink
            class="link"
            :to="{ path: '/sign-in', query: nextQuery }"
            @click="authEmail.set(form.email)"
          >
            Sign in
          </RouterLink>
        </p>
      </template>

      <VerifyStep
        v-else-if="step === 1"
        :email="email"
        @verified="onVerified"
        @change-email="changeEmail"
      />

      <FirstCarStep v-else :skip-to="next" />
    </div>
  </AuthShell>
</template>

<style scoped>
.steps-card {
  display: grid;
  gap: 18px;
}
</style>
