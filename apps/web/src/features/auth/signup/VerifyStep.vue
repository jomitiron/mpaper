<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import {
  errorMessage,
  isHttpError,
  resendVerificationEmail,
  verifyEmail,
  type Session,
} from '@motopapers/api';
import { Button, useToast } from '@motopapers/ui';
import { ref, useId, useTemplateRef } from 'vue';
import FormAlert from '../components/FormAlert.vue';
import OtpInput from '../components/OtpInput.vue';
import { useCooldown } from '../composables/useCooldown';
import { CODE_MESSAGES, codeProblem } from '../lib/errors';
import { checkCode } from '../lib/validation';

/** Step 2 of sign-up: the 6-digit code from the email. Emits the new session once verified. */

const props = defineProps<{ email: string }>();
const emit = defineEmits<{ verified: [session: Session]; changeEmail: [] }>();

const toast = useToast();
const cooldown = useCooldown('verify-email');
const otp = useTemplateRef<InstanceType<typeof OtpInput>>('otp');
const errorId = useId();

const code = ref('');
const error = ref<string | null>(null);
const problem = ref<string | null>(null);
const loading = ref(false);
const sending = ref(false);

async function verify() {
  if (loading.value) return;
  problem.value = null;
  error.value = checkCode(code.value) ?? null;
  if (error.value) return otp.value?.focus();

  loading.value = true;
  try {
    emit('verified', await verifyEmail({ email: props.email, otp: code.value }));
  } catch (caught) {
    const kind = codeProblem(caught);
    if (kind) {
      error.value = CODE_MESSAGES[kind];
      code.value = '';
      otp.value?.focus();
    } else {
      problem.value = errorMessage(caught);
    }
  } finally {
    loading.value = false;
  }
}

async function resend() {
  if (cooldown.active.value || sending.value) return;
  sending.value = true;
  problem.value = null;
  try {
    await resendVerificationEmail({ email: props.email });
    cooldown.start();
    error.value = null;
    code.value = '';
    toast.success(`A new code is on its way to ${props.email}.`);
    otp.value?.focus();
  } catch (caught) {
    problem.value =
      isHttpError(caught) && /already been verified/i.test(caught.message)
        ? 'This email is already verified. Sign in to carry on.'
        : errorMessage(caught);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="intro">
    <h1 tabindex="-1">Check your email</h1>
    <p class="muted">
      We sent a 6-digit code to <b class="ink">{{ email }}</b>. It expires in 10 minutes.
    </p>
  </div>
  <form novalidate @submit.prevent="verify">
    <div class="fld">
      <OtpInput
        ref="otp"
        v-model="code"
        :invalid="Boolean(error)"
        :described-by="error ? errorId : undefined"
        :disabled="loading"
        @complete="verify"
      />
      <span v-if="error" :id="errorId" class="fld-error">
        <CircleAlert class="ic" aria-hidden="true" />{{ error }}
      </span>
    </div>
    <FormAlert v-if="problem" :message="problem" />
    <Button type="submit" size="lg" block :loading="loading">Verify email</Button>
  </form>
  <p class="muted center" aria-live="polite">
    Didn't get it?
    <button
      type="button"
      class="link text-button"
      :disabled="cooldown.active.value || sending"
      @click="resend"
    >
      {{ cooldown.active.value ? `Send a new code in ${cooldown.label.value}` : 'Send a new code' }}
    </button>
  </p>
  <p class="muted center">
    Wrong email?
    <button type="button" class="link text-button" @click="emit('changeEmail')">Change it</button>
  </p>
</template>

<style scoped>
.ink {
  color: var(--ink);
  overflow-wrap: anywhere;
}
</style>
