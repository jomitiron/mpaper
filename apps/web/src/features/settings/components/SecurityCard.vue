<script setup lang="ts">
import { LockKeyhole, LogOut } from '@lucide/vue';
import { ApiError, errorMessage, isUnauthorized, updatePassword } from '@motopapers/api';
import { Button, Card, Field, useToast } from '@motopapers/ui';
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';
import FormAlert from '@/features/auth/components/FormAlert.vue';
import PasswordInput from '@/features/auth/components/PasswordInput.vue';
import { focusFirstInvalid } from '@/features/auth/lib/focus';
import { continueWithGoogle } from '@/features/auth/lib/google';
import { PASSWORD_HINT, type FormErrors } from '@/features/auth/lib/validation';
import { passwordErrors, validatePassword, type PasswordField } from '../lib/password';

/**
 * Sign-in and security: change password (inline form), connect Google, sign out.
 *
 * Google: the API can't link Google to an existing account yet, so Connect goes through Google
 * sign-in and back to Settings (see docs/backend-handoff.md).
 */

const session = useSessionStore();
const router = useRouter();
const toast = useToast();

// ---------------------------------------------------------------- password

const changing = ref(false);
const values = reactive({ old_password: '', new_password: '' });
const errors = ref<FormErrors<PasswordField>>({});
const problem = ref<string | null>(null);
const saving = ref(false);
const form = ref<HTMLFormElement | null>(null);
const changeButton = ref<InstanceType<typeof Button> | null>(null);

async function startChange() {
  Object.assign(values, { old_password: '', new_password: '' });
  errors.value = {};
  problem.value = null;
  changing.value = true;
  await nextTick();
  form.value?.querySelector<HTMLInputElement>('input')?.focus();
}

async function stopChange() {
  changing.value = false;
  await nextTick();
  (changeButton.value?.$el as HTMLElement | undefined)?.focus();
}

async function savePassword() {
  if (saving.value) return;
  problem.value = null;
  errors.value = validatePassword(values);
  if (Object.keys(errors.value).length) {
    await focusFirstInvalid(form.value);
    return;
  }
  saving.value = true;
  try {
    await updatePassword({ ...values });
    toast.success('Password changed. Use the new one next time you sign in.');
    await stopChange();
  } catch (error) {
    if (isUnauthorized(error)) return;
    errors.value = passwordErrors(error);
    if (Object.keys(errors.value).length) await focusFirstInvalid(form.value);
    else problem.value = `We couldn't change your password. ${errorMessage(error)}`;
  } finally {
    saving.value = false;
  }
}

// ---------------------------------------------------------------- Google

const connecting = ref(false);
const onPageShow = (event: PageTransitionEvent) => {
  if (event.persisted) connecting.value = false;
};
onMounted(() => window.addEventListener('pageshow', onPageShow));
onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow));

async function connectGoogle() {
  connecting.value = true;
  try {
    await continueWithGoogle({ action: 'signin', next: '/settings', remember: session.remember });
  } catch (error) {
    connecting.value = false;
    toast.error(
      error instanceof ApiError ? errorMessage(error) : "We couldn't open Google. Try again.",
    );
  }
}

// ---------------------------------------------------------------- sign out

async function signOut() {
  await session.signOut();
  await router.push('/sign-in');
}
</script>

<template>
  <Card as="section" title="Sign-in and security">
    <div class="set-row">
      <span class="si si-idle" aria-hidden="true"><LockKeyhole class="ic" /></span>
      <div>
        <b>Password</b>
        <span class="s">{{ PASSWORD_HINT }}</span>
      </div>
      <Button v-if="!changing" ref="changeButton" variant="white" size="sm" @click="startChange">
        Change<span class="visually-hidden"> password</span>
      </Button>
    </div>
    <form
      v-if="changing"
      ref="form"
      class="set-form"
      novalidate
      aria-label="Change password"
      @submit.prevent="savePassword"
    >
      <FormAlert v-if="problem" :message="problem" />
      <div class="two">
        <Field label="Current password" :error="errors.old_password">
          <PasswordInput v-model="values.old_password" autocomplete="current-password" />
        </Field>
        <Field label="New password" :hint="PASSWORD_HINT" :error="errors.new_password">
          <PasswordInput v-model="values.new_password" autocomplete="new-password" />
        </Field>
      </div>
      <div class="prof-acts">
        <Button type="submit" :loading="saving">Save password</Button>
        <Button variant="quiet" :disabled="saving" @click="stopChange">Cancel</Button>
      </div>
    </form>

    <div class="set-row">
      <span class="si si-idle" aria-hidden="true">
        <svg class="ic google" viewBox="0 0 24 24">
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
      </span>
      <div>
        <b>Google</b>
        <span class="s">Sign in with your Google account. Use the same email as here.</span>
      </div>
      <Button variant="white" size="sm" :loading="connecting" @click="connectGoogle">
        Connect<span class="visually-hidden"> Google</span>
      </Button>
    </div>

    <div class="set-row">
      <span class="si si-rose" aria-hidden="true"><LogOut class="ic" /></span>
      <div>
        <b>Sign out</b>
        <span class="s">You'll need your email and password, or Google, to sign back in.</span>
      </div>
      <Button variant="white" size="sm" @click="signOut">Sign out</Button>
    </div>
  </Card>
</template>
