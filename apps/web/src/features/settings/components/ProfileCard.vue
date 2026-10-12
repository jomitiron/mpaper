<script setup lang="ts">
import { errorMessage, isUnauthorized } from '@motopapers/api';
import { Button, Card, Field, Input, StatusPill, useToast } from '@motopapers/ui';
import { computed, nextTick, reactive, ref } from 'vue';
import { useSessionStore } from '@/stores/session';
import FormAlert from '@/features/auth/components/FormAlert.vue';
import { apiFieldErrors } from '@/features/auth/lib/errors';
import { focusFirstInvalid } from '@/features/auth/lib/focus';
import type { FormErrors } from '@/features/auth/lib/validation';
import { ADDRESS_HINT, formatPhone } from '@/features/renewals/lib/delivery';
import {
  profileBody,
  profileValues,
  saveProfile,
  validateProfile,
  type ProfileField,
} from '../lib/profile';

/**
 * The profile card: name, email (verified), phone and delivery address, with "Edit profile".
 * Saving is optimistic: the form closes with the new details, and opens again with them if the
 * API says no.
 */

const session = useSessionStore();
const toast = useToast();

const user = computed(() => session.user);
const fullName = computed(() =>
  [user.value?.first_name, user.value?.last_name].filter(Boolean).join(' '),
);
const initials = computed(() =>
  [user.value?.first_name, user.value?.last_name]
    .map((part) => part?.trim()[0] ?? '')
    .join('')
    .toUpperCase(),
);

const editing = ref(false);
const values = reactive(profileValues(null));
const errors = ref<FormErrors<ProfileField>>({});
const problem = ref<string | null>(null);
const saving = ref(false);
const form = ref<HTMLFormElement | null>(null);
const editButton = ref<InstanceType<typeof Button> | null>(null);

async function edit() {
  Object.assign(values, profileValues(session.user));
  errors.value = {};
  problem.value = null;
  editing.value = true;
  await nextTick();
  form.value?.querySelector<HTMLInputElement>('input')?.focus();
}

async function close() {
  editing.value = false;
  await nextTick();
  (editButton.value?.$el as HTMLElement | undefined)?.focus();
}

async function save() {
  if (saving.value) return;
  problem.value = null;
  errors.value = validateProfile(values, session.user);
  if (Object.keys(errors.value).length) {
    await focusFirstInvalid(form.value);
    return;
  }
  const body = profileBody(session.user, values);
  if (!body) {
    await close();
    return;
  }
  const attempted = { ...values };
  saving.value = true;
  void close(); // Optimistic: show the new details now.
  try {
    await saveProfile(session, body);
    toast.success('Profile saved.');
  } catch (error) {
    if (isUnauthorized(error)) return; // Signed out; the app sends them to sign in.
    // The old details are back. Open the form again with what they typed, and say why.
    Object.assign(values, attempted);
    errors.value = apiFieldErrors(error, ['first_name', 'last_name', 'phone', 'address']);
    problem.value = `We couldn't save your changes. ${errorMessage(error)}`;
    editing.value = true;
    await nextTick();
    form.value?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Card as="section" class="profile" aria-labelledby="profile-name">
    <div class="prof">
      <span class="avatar lg" aria-hidden="true">{{ initials }}</span>
      <div class="who">
        <b id="profile-name">{{ fullName }}</b>
        <span class="muted">{{ user?.email }}</span>
      </div>
      <Button
        v-if="!editing"
        ref="editButton"
        variant="white"
        size="sm"
        :loading="saving"
        @click="edit"
      >
        Edit profile
      </Button>
    </div>

    <dl v-if="!editing" class="dl" :aria-busy="saving ? 'true' : undefined">
      <div>
        <dt>First name</dt>
        <dd>{{ user?.first_name }}</dd>
      </div>
      <div>
        <dt>Last name</dt>
        <dd>{{ user?.last_name }}</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>
          {{ user?.email }}
          <StatusPill :tone="user?.email_verified ? 'ok' : 'warn'">{{
            user?.email_verified ? 'Verified' : 'Not verified'
          }}</StatusPill>
        </dd>
      </div>
      <div>
        <dt>Phone number</dt>
        <dd :class="{ num: user?.phone, muted: !user?.phone }">
          {{ user?.phone ? formatPhone(user.phone) : 'Not added' }}
        </dd>
      </div>
      <div class="dl-wide">
        <dt>Delivery address</dt>
        <dd :class="{ muted: !user?.address }">
          {{ user?.address || 'Not added. We deliver renewed papers here.' }}
        </dd>
      </div>
    </dl>

    <form v-else ref="form" class="prof-form" novalidate @submit.prevent="save">
      <FormAlert v-if="problem" :message="problem" tabindex="-1" />
      <div class="two">
        <Field label="First name" :error="errors.first_name">
          <Input v-model="values.first_name" autocomplete="given-name" />
        </Field>
        <Field label="Last name" :error="errors.last_name">
          <Input v-model="values.last_name" autocomplete="family-name" />
        </Field>
      </div>
      <Field label="Phone number" :error="errors.phone">
        <Input
          v-model="values.phone"
          prefix="+234"
          type="tel"
          inputmode="tel"
          autocomplete="tel-national"
        />
      </Field>
      <Field label="Delivery address" :hint="ADDRESS_HINT" :error="errors.address">
        <template #default="{ id, describedBy, invalid }">
          <textarea
            :id="id"
            v-model="values.address"
            class="inp prof-address"
            rows="2"
            autocomplete="street-address"
            :aria-describedby="describedBy"
            :aria-invalid="invalid ? 'true' : undefined"
          />
        </template>
      </Field>
      <p class="hint">To change your email, contact support. It's used to sign in.</p>
      <div class="prof-acts">
        <Button type="submit">Save changes</Button>
        <Button variant="quiet" @click="close">Cancel</Button>
      </div>
    </form>
  </Card>
</template>
