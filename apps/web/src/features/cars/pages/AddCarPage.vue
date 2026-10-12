<script setup lang="ts">
import { DocReaderError, isAbortError, readVehicleLicence } from '@motopapers/api';
import { Stepper } from '@motopapers/ui';
import { useQuery } from '@tanstack/vue-query';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  provide,
  reactive,
  ref,
  shallowRef,
  watch,
  type Component,
} from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import { env } from '@/env';
import { vehiclesQuery } from '@/lib/queries';
import CarPanel from '../components/CarPanel.vue';
import DetailsStep from '../add/DetailsStep.vue';
import PapersStep from '../add/PapersStep.vue';
import UploadStep from '../add/UploadStep.vue';
import { ADD_CAR_CONTEXT } from '../add/context';
import { detailsErrors, draftFromReading, emptyDraft, papersErrors } from '../add/draft';
import {
  ADD_CAR_STEPS,
  DETAILS,
  initialFlow,
  PAPERS,
  REVIEW,
  transition,
  UPLOAD,
  type FlowEvent,
  type StepIndex,
} from '../add/flow';
import { prepareLicenceImage } from '../add/licenceFile';
import { onReadyToPay } from '../add/onReadyToPay';
import { useCarSaver } from '../add/useCarSaver';
import '../cars.css';

/** The licence reader gets this long before we suggest typing the details instead. */
const READ_TIMEOUT_MS = 45_000;
/** Any non-empty image will do: the mock reader always returns the design's sample licence. */
const SAMPLE_IMAGE_BASE64 = 'c2FtcGxlLWxpY2VuY2U=';

const vehicleList = useQuery(vehiclesQuery());
const vehicles = computed(() => vehicleList.data.value ?? []);

const draft = reactive(emptyDraft());
provide(ADD_CAR_CONTEXT, { draft, vehicles });

const flow = ref(initialFlow());
const guards = computed(() => ({
  detailsValid: Object.keys(detailsErrors(draft, vehicles.value)).length === 0,
  papersValid: Object.keys(papersErrors(draft)).length === 0,
}));

function send(event: FlowEvent) {
  flow.value = transition(flow.value, event, guards.value);
}

const saver = useCarSaver(() => draft);
const payStep = shallowRef<Component | null>(null);
const carSaved = computed(() => saver.vehicle.value !== null);

// ---------------------------------------------------------------- step 1: reading the licence

let reader: AbortController | null = null;

async function read(fileName: string, load: () => Promise<Blob | { base64: string }>) {
  send({ type: 'READ_START', fileName });
  if (!flow.value.reading) return;
  const controller = new AbortController();
  reader = controller;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, READ_TIMEOUT_MS);
  try {
    const reading = await readVehicleLicence(await load(), { signal: controller.signal });
    Object.assign(draft, draftFromReading(reading, draft));
    send({ type: 'READ_DONE' });
  } catch (error) {
    if (isAbortError(error) && !timedOut) return send({ type: 'READ_CANCEL' });
    const reason =
      error instanceof DocReaderError
        ? error
        : new DocReaderError(timedOut ? 'http' : 'unreadable');
    send({ type: 'READ_FAILED', error: reason.message });
  } finally {
    clearTimeout(timer);
    if (reader === controller) reader = null;
  }
}

function onFile(file: File) {
  void read(file.name, () => prepareLicenceImage(file));
}

function onSample() {
  void read('sample-licence.jpg', async () => ({ base64: SAMPLE_IMAGE_BASE64 }));
}

function onManual() {
  if (draft.source === null) draft.source = 'manual';
  send({ type: 'MANUAL' });
}

onBeforeUnmount(() => reader?.abort());

// ---------------------------------------------------------------- steps 2–4

function next() {
  const from = flow.value.step;
  send({ type: 'NEXT' });
  if (from === PAPERS && flow.value.step === REVIEW) payStep.value = onReadyToPay(draft);
}

function goTo(step: StepIndex) {
  if (carSaved.value) return;
  send({ type: 'GO', step });
}

function onDuplicate() {
  send({ type: 'GO', step: DETAILS });
}

function restart() {
  Object.assign(draft, emptyDraft());
  saver.reset();
  payStep.value = null;
  send({ type: 'RESET' });
}

// "View it" on the duplicate warning opens that car's panel over this page, keeping the draft.
const viewing = ref<number | null>(null);

// ---------------------------------------------------------------- focus

const card = ref<HTMLElement | null>(null);
watch(
  () => flow.value.step,
  async () => {
    await nextTick();
    card.value?.querySelector<HTMLElement>('[data-step-heading]')?.focus();
  },
);

const stepperCurrent = computed(() => (saver.status.value === 'saved' ? 4 : flow.value.step));
</script>

<template>
  <PageHeader
    title="Add a car"
    sub="Upload your vehicle licence and we'll fill in the details."
    :back="{ to: '/cars', label: 'My cars' }"
  />

  <Stepper
    :steps="ADD_CAR_STEPS"
    :current="stepperCurrent"
    label="Add a car steps"
    :clickable="!carSaved && !flow.reading"
    @select="goTo($event as StepIndex)"
  />

  <div ref="card" class="wz-card">
    <UploadStep
      v-if="flow.step === UPLOAD"
      :reading="flow.reading"
      :file-name="flow.fileName"
      :error="flow.readError"
      :sample="env.useMocks"
      @file="onFile"
      @sample="onSample"
      @manual="onManual"
    />
    <DetailsStep
      v-else-if="flow.step === DETAILS"
      @next="next"
      @back="send({ type: 'BACK' })"
      @view="viewing = $event"
    />
    <PapersStep v-else-if="flow.step === PAPERS" @next="next" @back="send({ type: 'BACK' })" />
    <component
      :is="payStep"
      v-else-if="flow.step === REVIEW && payStep"
      :draft="draft"
      :saver="saver"
      @back="send({ type: 'BACK' })"
      @duplicate="onDuplicate"
      @restart="restart"
    />
  </div>

  <CarPanel :vehicle-id="viewing" @close="viewing = null" @deleted="viewing = null" />
</template>
