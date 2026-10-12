<script setup lang="ts">
import { CircleAlert, ScanLine, Upload } from '@lucide/vue';
import { Button } from '@motopapers/ui';
import { ref } from 'vue';
import { ACCEPTED_FILES } from './licenceFile';

/** Step 1: drop, choose or (with mocks) sample a licence, or type the details instead. */

defineProps<{
  reading: boolean;
  fileName: string | null;
  error: string | null;
  /** "Use a sample licence" is only for the mock API. */
  sample: boolean;
}>();

const emit = defineEmits<{ file: [file: File]; sample: []; manual: [] }>();

const input = ref<HTMLInputElement | null>(null);
const over = ref(false);

function choose() {
  input.value?.click();
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) emit('file', file);
  target.value = '';
}

function onDrop(event: DragEvent) {
  over.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) emit('file', file);
}
</script>

<template>
  <div>
    <h2 class="wz-title" tabindex="-1" data-step-heading>Upload your vehicle licence</h2>
    <p class="wz-sub">
      We read the plate number, make, model, colour, engine and chassis numbers, so you don't have
      to type them.
    </p>

    <div
      class="drop"
      :class="{ over }"
      @dragenter.prevent="over = true"
      @dragover.prevent="over = true"
      @dragleave.prevent="over = false"
      @drop.prevent="onDrop"
    >
      <span class="drop-ic" aria-hidden="true"><Upload class="ic" /></span>
      <b>Drop a photo or PDF here</b>
      <span class="muted drop-note">JPG, PNG or PDF, up to 4 MB</span>
      <div class="acts">
        <Button :disabled="reading" @click="choose">Choose file</Button>
        <Button v-if="sample" variant="white" :disabled="reading" @click="emit('sample')">
          Use a sample licence
        </Button>
      </div>
      <input
        ref="input"
        type="file"
        class="visually-hidden"
        tabindex="-1"
        aria-hidden="true"
        :accept="ACCEPTED_FILES"
        @change="onChange"
      />
    </div>

    <div v-if="reading" class="scan" role="status">
      <span class="si" aria-hidden="true"><ScanLine class="ic" /></span>
      <div>
        <b>Reading your licence…</b>
        <span class="muted scan-file">{{ fileName }}</span>
        <div class="pbar" aria-hidden="true"><span /></div>
      </div>
    </div>

    <p v-else-if="error" class="form-error" role="alert">
      <CircleAlert class="ic" aria-hidden="true" />{{ error }}
    </p>

    <div class="wz-foot">
      <span class="hint">No licence to hand? You can type the details instead.</span>
      <Button variant="quiet" :disabled="reading" @click="emit('manual')">
        Enter details by hand
      </Button>
    </div>
  </div>
</template>
