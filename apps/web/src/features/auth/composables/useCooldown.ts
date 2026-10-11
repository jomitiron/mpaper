import { computed, onScopeDispose, ref } from 'vue';

/**
 * A wait before a code can be sent again ("Send a new code in 0:42"). The end time is kept in
 * sessionStorage under `key`, so a refresh doesn't reset it.
 */
export function useCooldown(key: string, seconds = 60) {
  const storageKey = `motopapers:cooldown:${key}`;
  const until = ref(readUntil(storageKey));
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | undefined;

  const remaining = computed(() => Math.max(0, Math.ceil((until.value - now.value) / 1000)));
  const active = computed(() => remaining.value > 0);
  const label = computed(
    () => `${Math.floor(remaining.value / 60)}:${String(remaining.value % 60).padStart(2, '0')}`,
  );

  function tick(): void {
    now.value = Date.now();
    if (remaining.value === 0) stop();
  }

  function run(): void {
    stop();
    now.value = Date.now();
    if (remaining.value > 0) timer = setInterval(tick, 1000);
  }

  function stop(): void {
    clearInterval(timer);
    timer = undefined;
  }

  /** Starts the wait (call it when a code has just been sent). */
  function start(): void {
    until.value = Date.now() + seconds * 1000;
    try {
      sessionStorage.setItem(storageKey, String(until.value));
    } catch {
      // Storage blocked: the wait lasts for this page only.
    }
    run();
  }

  run();
  onScopeDispose(stop);

  return { remaining, active, label, start };
}

function readUntil(key: string): number {
  try {
    const value = Number(sessionStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}
