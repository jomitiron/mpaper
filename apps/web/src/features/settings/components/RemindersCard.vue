<script setup lang="ts">
import { Bell, Mail, MessageCircle, MessageSquareText, RefreshCw } from '@lucide/vue';
import { Button, Card, Chip, Switch } from '@motopapers/ui';
import { computed, ref } from 'vue';
import { useSessionStore } from '@/stores/session';
import { formatPhone } from '@/features/renewals/lib/delivery';
import {
  LEAD_DAY_OPTIONS,
  SWITCH_NAMES,
  toggleLeadDay,
  useReminderSettings,
  type SwitchKey,
} from '../lib/reminders';

/**
 * Reminders (VITE_FLAG_REMINDER_SETTINGS): email, SMS and WhatsApp, which days before each expiry
 * date, and auto-renew. Every change saves straight away.
 */

const session = useSessionStore();
const { prefs, change } = useReminderSettings();

const phone = computed(() => formatPhone(session.user?.phone));
const lastDay = ref<number | null>(null);

function setSwitch(key: SwitchKey, on: boolean) {
  change((current) => ({ ...current, [key]: on }));
}

function toggleDay(day: number) {
  const days = prefs.data.value?.lead_days ?? [];
  const next = toggleLeadDay(days, day);
  lastDay.value = next ? null : day;
  if (next) change((current) => ({ ...current, lead_days: next }));
}

const allOff = computed(() => {
  const p = prefs.data.value;
  return p ? !p.email && !p.sms && !p.whatsapp : false;
});
</script>

<template>
  <Card
    as="section"
    title="Reminders"
    subtitle="How and when we tell you a paper is about to expire."
  >
    <div v-if="prefs.isPending.value" class="set-loading" aria-busy="true">
      <span v-for="n in 3" :key="n" class="skeleton" />
      <span class="visually-hidden">Loading your reminder settings…</span>
    </div>
    <div v-else-if="prefs.isError.value || !prefs.data.value" class="set-note">
      <p>We couldn't load your reminder settings.</p>
      <Button size="sm" variant="white" @click="prefs.refetch()">Try again</Button>
    </div>
    <template v-else>
      <div class="set-row">
        <span class="si d-licence" aria-hidden="true"><Mail class="ic" /></span>
        <div>
          <b>Email</b>
          <span class="s">{{ session.user?.email }}</span>
        </div>
        <Switch
          :model-value="prefs.data.value.email"
          :label="SWITCH_NAMES.email"
          @update:model-value="setSwitch('email', $event)"
        />
      </div>
      <div class="set-row">
        <span class="si d-insurance" aria-hidden="true"><MessageSquareText class="ic" /></span>
        <div>
          <b>SMS</b>
          <span class="s" :class="{ num: phone }">{{
            phone || 'Add a phone number to your profile first'
          }}</span>
        </div>
        <Switch
          :model-value="prefs.data.value.sms"
          :label="SWITCH_NAMES.sms"
          :disabled="!phone && !prefs.data.value.sms"
          @update:model-value="setSwitch('sms', $event)"
        />
      </div>
      <div class="set-row">
        <span class="si d-insurance" aria-hidden="true"><MessageCircle class="ic" /></span>
        <div>
          <b>WhatsApp</b>
          <span class="s">{{ phone ? 'Same number as SMS' : 'Uses your phone number' }}</span>
        </div>
        <Switch
          :model-value="prefs.data.value.whatsapp"
          :label="SWITCH_NAMES.whatsapp"
          :disabled="!phone && !prefs.data.value.whatsapp"
          @update:model-value="setSwitch('whatsapp', $event)"
        />
      </div>
      <p v-if="allOff" class="set-warn" role="status">
        Every reminder is off, so we won't tell you before a paper expires.
      </p>
      <div class="set-row set-row-wrap">
        <span class="si d-road" aria-hidden="true"><Bell class="ic" /></span>
        <div>
          <b id="remind-days">Remind me</b>
          <span class="s">Before each expiry date</span>
        </div>
        <div class="chips" role="group" aria-labelledby="remind-days">
          <Chip
            v-for="day in LEAD_DAY_OPTIONS"
            :key="day"
            :pressed="prefs.data.value.lead_days.includes(day)"
            @update:pressed="toggleDay(day)"
          >
            {{ day }} {{ day === 1 ? 'day' : 'days' }}
          </Chip>
        </div>
      </div>
      <p v-if="lastDay !== null" class="set-warn" role="status">
        Keep at least one reminder day. Pick another before turning off {{ lastDay }}
        {{ lastDay === 1 ? 'day' : 'days' }}.
      </p>
      <div class="set-row">
        <span class="si si-coral" aria-hidden="true"><RefreshCw class="ic" /></span>
        <div>
          <b>Renew automatically</b>
          <span class="s">Pay from your wallet when a paper is 14 days from expiry.</span>
        </div>
        <Switch
          :model-value="prefs.data.value.auto_renew"
          :label="SWITCH_NAMES.auto_renew"
          @update:model-value="setSwitch('auto_renew', $event)"
        />
      </div>
    </template>
  </Card>
</template>
