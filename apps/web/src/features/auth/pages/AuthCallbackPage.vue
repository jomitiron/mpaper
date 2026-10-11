<script setup lang="ts">
import { errorMessage, isHttpError, signIn, signUp, type OAuthAction } from '@motopapers/api';
import { Button, Stepper } from '@motopapers/ui';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { safeNext } from '@/router/next';
import { useSessionStore } from '@/stores/session';
import AuthShell from '../components/AuthShell.vue';
import FormAlert from '../components/FormAlert.vue';
import GoogleButton from '../components/GoogleButton.vue';
import { isDuplicateEmail } from '../lib/errors';
import { continueWithGoogle } from '../lib/google';
import { oauthState, type OAuthState } from '../lib/handoff';
import FirstCarStep from '../signup/FirstCarStep.vue';

/**
 * Where Google sends the driver back, with `code` (and `action`, from the API's redirect address).
 * Also served at /complete-onboard, the old app's address that the API redirects to today.
 *
 * - Sign in: trade the code for a session and go on to `next`.
 * - Sign up: the API creates the account but returns no token, and a code works once, so we go
 *   straight back to Google to sign in (Google doesn't ask twice), then show "Add your first car".
 */

const STEPS = [{ title: 'Account' }, { title: 'Verify email' }, { title: 'First car' }];

type Status = 'working' | 'failed' | 'new-account';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const status = ref<Status>('working');
const message = ref('Signing you in with Google…');
const problem = ref('');
/** Show "Sign up with Google" with the error (Google account with no MotoPapers account). */
const offerSignUp = ref(false);
const saved = ref<OAuthState | null>(null);

const next = computed(() => safeNext(saved.value?.next));
const signupState = (): OAuthState => ({ action: 'signup', next: next.value, remember: false });

function queryValue(key: string): string {
  const value = route.query[key];
  return typeof value === 'string' ? value : '';
}

function fail(text: string, options: { offerSignUp?: boolean } = {}) {
  status.value = 'failed';
  problem.value = text;
  offerSignUp.value = options.offerSignUp ?? false;
}

async function signInWith(code: string) {
  try {
    const result = await signIn({ oauth_code: code, oauth_type: 'google' });
    session.setSession(result, { remember: saved.value?.remember ?? false });
    if (saved.value?.newAccount) status.value = 'new-account';
    else await router.replace(next.value);
  } catch (error) {
    if (isHttpError(error, 401)) {
      fail("We couldn't find a MotoPapers account for that Google account. Create one first.", {
        offerSignUp: true,
      });
    } else {
      fail(errorMessage(error));
    }
  }
}

async function signUpWith(code: string) {
  message.value = 'Creating your account…';
  let newAccount = true;
  try {
    await signUp({ oauth_code: code, oauth_type: 'google' });
  } catch (error) {
    if (!isDuplicateEmail(error)) return fail(errorMessage(error));
    newAccount = false; // Already signed up with this Google account: just sign in.
  }
  message.value = newAccount ? 'Your account is ready. Signing you in…' : 'Signing you in…';
  try {
    await continueWithGoogle({
      action: 'signin',
      next: next.value,
      remember: saved.value?.remember ?? false,
      newAccount,
    });
  } catch (error) {
    fail(errorMessage(error));
  }
}

onMounted(async () => {
  saved.value = oauthState.take();
  const code = queryValue('code');
  const googleError = queryValue('error');
  const fromQuery = queryValue('action');
  const action: OAuthAction =
    fromQuery === 'signin' || fromQuery === 'signup'
      ? fromQuery
      : (saved.value?.action ?? 'signin');

  // A code works once: take it out of the address so a refresh doesn't try it again.
  if (code || googleError) await router.replace({ path: route.path });

  if (!code) {
    return fail(
      googleError === 'access_denied'
        ? 'You cancelled signing in with Google.'
        : "Google didn't send us back a sign-in code. Try again.",
    );
  }
  if (action === 'signup') await signUpWith(code);
  else await signInWith(code);
});
</script>

<template>
  <AuthShell
    :headline="
      status === 'new-account'
        ? 'Three quick steps and you\'re covered.'
        : 'Welcome back. Your papers are waiting.'
    "
    :art="status === 'new-account' ? 'steps' : 'phone'"
  >
    <template v-if="status === 'working'">
      <div class="intro" role="status">
        <h1>One moment</h1>
        <p class="muted working"><span class="spin" aria-hidden="true" />{{ message }}</p>
      </div>
    </template>

    <template v-else-if="status === 'failed'">
      <div class="intro">
        <h1>That didn't work</h1>
      </div>
      <FormAlert :message="problem" />
      <GoogleButton v-if="offerSignUp" label="Sign up with Google" :state="signupState" />
      <Button variant="white" size="lg" block to="/sign-in">Back to sign in</Button>
    </template>

    <template v-else>
      <Stepper :steps="STEPS" :current="2" variant="bars" label="Sign-up progress" />
      <FirstCarStep :skip-to="next" />
    </template>
  </AuthShell>
</template>

<style scoped>
.working {
  display: flex;
  align-items: center;
  gap: 10px;
}
.working .spin {
  color: var(--coral);
}
</style>
