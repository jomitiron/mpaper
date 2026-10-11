<script setup lang="ts">
import { Eye, EyeOff } from '@lucide/vue';
import { FIELD_CONTEXT } from '@motopapers/ui';
import { computed, inject, ref } from 'vue';

/** Password box with a show/hide button. Inside a <Field> it takes the field's id, hint and error. */

defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ default: '' });
const field = inject(FIELD_CONTEXT, null);
const shown = ref(false);

const invalid = computed(() => field?.invalid.value ?? false);
</script>

<template>
  <div class="pw">
    <input
      v-bind="$attrs"
      :id="field?.id.value"
      v-model="model"
      class="inp"
      :type="shown ? 'text' : 'password'"
      autocapitalize="off"
      spellcheck="false"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-describedby="field?.describedBy.value"
    />
    <button
      type="button"
      class="pw-toggle"
      :aria-pressed="shown ? 'true' : 'false'"
      aria-label="Show password"
      @click="shown = !shown"
    >
      <EyeOff v-if="shown" class="ic" aria-hidden="true" />
      <Eye v-else class="ic" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.pw {
  position: relative;
}
.pw .inp {
  padding-right: 52px;
}
.pw-toggle {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  color: var(--muted);
}
.pw-toggle:hover {
  color: var(--ink);
  background: var(--idle);
}
</style>
