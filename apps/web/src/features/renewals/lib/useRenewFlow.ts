import {
  errorMessage,
  isHttpError,
  isUnauthorized,
  updateUser,
  type PaperKind,
  type Vehicle,
} from '@motopapers/api';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { queryKeys } from '@/lib/queries';
import { useSessionStore } from '@/stores/session';
import type { FormErrors } from '@/features/auth/lib/validation';
import { renewByCard, renewFromWallet } from './actions';
import { profileChanges, validateDelivery, type DeliveryValues } from './delivery';
import {
  initialRenewState,
  isBusy,
  payMethod,
  renewTransition,
  type RenewEvent,
  type RenewMode,
  type RenewState,
  type WalletOption,
} from './flow';
import { requestStore } from './requests';

/**
 * Runs the renew page's state machine (lib/flow.ts): saves the delivery details to the profile,
 * then pays from the wallet, sends the driver to Paystack, or records a request for the team.
 */

export interface RenewFlowInput {
  vehicle: () => Vehicle | undefined;
  kind: PaperKind;
  /** Naira, null when the team quotes, undefined while prices load. */
  price: () => number | null | undefined;
  mode: () => RenewMode;
  wallet: () => WalletOption;
  /** This page's address, for the way back from Paystack. */
  returnTo: () => string;
  /** Tests swap these. */
  deps?: {
    renewFromWallet?: typeof renewFromWallet;
    renewByCard?: typeof renewByCard;
    updateUser?: typeof updateUser;
  };
}

export function useRenewFlow(input: RenewFlowInput) {
  const session = useSessionStore();
  const queryClient = useQueryClient();
  const deps = {
    renewFromWallet: input.deps?.renewFromWallet ?? renewFromWallet,
    renewByCard: input.deps?.renewByCard ?? renewByCard,
    updateUser: input.deps?.updateUser ?? updateUser,
  };

  const state = shallowRef<RenewState>(initialRenewState);
  const errors = ref<FormErrors<'address' | 'phone'>>({});
  const send = (event: RenewEvent) => {
    state.value = renewTransition(state.value, event);
  };

  const chosen = computed(() => {
    const s = state.value;
    return s.status === 'editing' || s.status === 'paying' ? s.chosen : null;
  });
  const method = computed(() => payMethod(chosen.value, input.wallet()));
  const busy = computed(() => isBusy(state.value));

  /** Saves a new delivery address (or phone number) to the profile. */
  async function saveProfile(values: DeliveryValues): Promise<void> {
    const body = profileChanges(session.user, values);
    if (!body) return;
    const user = await deps.updateUser(body);
    // Keep anything the response leaves out (the wallet, say).
    if (session.user) session.setUser({ ...session.user, ...user });
  }

  function validate(values: DeliveryValues): boolean {
    errors.value = validateDelivery(values);
    return Object.keys(errors.value).length === 0;
  }

  async function submit(values: DeliveryValues): Promise<void> {
    if (busy.value || state.value.status !== 'editing') return;
    const vehicle = input.vehicle();
    if (!vehicle || !validate(values)) return;
    if (input.mode() === 'request') return request(vehicle, values);

    const amount = input.price();
    if (amount === null || amount === undefined) return;
    const via = method.value;
    send({ type: 'PAY', method: via });

    try {
      await saveProfile(values);
    } catch (error) {
      if (isUnauthorized(error)) return;
      send({ type: 'FAILED', problem: { kind: 'profile', message: errorMessage(error) } });
      return;
    }

    const order = {
      vehicleId: vehicle.id,
      plate: vehicle.plate_number,
      kind: input.kind,
      amount,
      deliveryAddress: values.address.trim(),
      returnTo: input.returnTo(),
    };
    try {
      if (via === 'card') {
        await deps.renewByCard(order);
        send({ type: 'REDIRECTING' }); // On the way to Paystack.
        return;
      }
      const renewal = await deps.renewFromWallet(order);
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.renewals });
      send({ type: 'CREATED', renewal });
    } catch (error) {
      if (isUnauthorized(error)) return;
      if (isHttpError(error, 400) && /insufficient/i.test(error.message)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
        send({ type: 'FAILED', problem: { kind: 'insufficient' } });
      } else {
        const kind = via === 'card' ? 'paystack' : 'payment';
        send({ type: 'FAILED', problem: { kind, message: errorMessage(error) } });
      }
    }
  }

  async function request(vehicle: Vehicle, values: DeliveryValues): Promise<void> {
    send({ type: 'REQUEST' });
    try {
      await saveProfile(values);
    } catch (error) {
      if (isUnauthorized(error)) return;
      send({ type: 'FAILED', problem: { kind: 'request', message: errorMessage(error) } });
      return;
    }
    const user = session.user;
    if (!user) return;
    const recorded = {
      vehicleId: vehicle.id,
      kind: input.kind,
      plate: vehicle.plate_number,
      deliveryAddress: values.address.trim(),
      phone: user.phone ?? values.phone ?? '',
      price: input.price() ?? null,
      requestedAt: new Date().toISOString(),
      expiryAtRequest: vehicle[input.kind]?.expiry_date ?? null,
    };
    requestStore().add(user.id, recorded);
    send({ type: 'REQUESTED', request: recorded });
  }

  function choose(next: 'wallet' | 'card') {
    send({ type: 'CHOOSE', method: next });
  }

  // Back from Paystack can restore this page as it was, spinner and all.
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) send({ type: 'RETURNED' });
  };
  onMounted(() => window.addEventListener('pageshow', onPageShow));
  onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow));

  return { state, errors, method, busy, submit, choose };
}
