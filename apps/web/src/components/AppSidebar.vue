<script setup lang="ts">
import { LogOut } from '@lucide/vue';
import { needsAttention } from '@motopapers/api';
import { Logo, useToast } from '@motopapers/ui';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { vehiclesQuery } from '@/lib/queries';
import { preloadRoute } from '@/router/preload';
import { useSessionStore } from '@/stores/session';
import { NAV_ITEMS } from './navigation';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const toast = useToast();

const vehicles = useQuery({
  ...vehiclesQuery(),
  enabled: computed(() => session.isSignedIn),
  meta: { silent: true },
});
const attention = computed(
  () => (vehicles.data.value ?? []).filter((v) => needsAttention(v)).length,
);

const name = computed(() =>
  [session.user?.first_name, session.user?.last_name].filter(Boolean).join(' '),
);
const initials = computed(() =>
  [session.user?.first_name, session.user?.last_name]
    .map((part) => part?.trim()[0] ?? '')
    .join('')
    .toUpperCase(),
);

function chat() {
  // TODO(manager): pick a live chat provider (the old app used Tidio).
  toast.info('Live chat is on its way. For help now, call +234 802 959 5069.');
}

async function signOut() {
  await session.signOut();
  await router.push('/sign-in');
}
</script>

<template>
  <aside class="side">
    <Logo to="/" />
    <nav class="side-nav" aria-label="Main">
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :to="item.to"
        class="nav"
        :aria-current="item.matches(route) ? 'page' : undefined"
        @mouseenter="preloadRoute(router, item.to)"
        @focus="preloadRoute(router, item.to)"
      >
        <component :is="item.icon" class="ic" aria-hidden="true" />
        {{ item.label }}
        <span
          v-if="item.to === '/cars' && attention > 0"
          class="badge num"
          title="Cars needing attention"
        >
          {{ attention }}<span class="visually-hidden"> need attention</span>
        </span>
      </RouterLink>
    </nav>

    <div class="side-help">
      <b>Need a hand?</b>
      Our team can renew any paper for you.
      <button type="button" @click="chat">Chat with us</button>
    </div>

    <div class="side-user">
      <span class="avatar" aria-hidden="true">{{ initials }}</span>
      <span class="who">
        <b>{{ name }}</b>
        <span>{{ session.user?.email }}</span>
      </span>
      <button
        type="button"
        class="icon-btn"
        aria-label="Sign out"
        title="Sign out"
        @click="signOut"
      >
        <LogOut class="ic" aria-hidden="true" />
      </button>
    </div>
  </aside>
</template>
