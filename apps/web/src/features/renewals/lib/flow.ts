import { formatNaira, type Renewal } from '@motopapers/api';
import type { RenewalRequest } from './requests';

/**
 * The renew page, as a state machine.
 *
 * Paying (renewals API on, and the paper has a set price):
 *
 *   editing ──PAY wallet──▶ paying ──CREATED─────▶ started     renewal made, wallet charged
 *           ──PAY card────▶ paying ──REDIRECTING─▶ leaving     off to Paystack; the payment
 *                                                              return page takes it from there
 *                           paying ──FAILED──────▶ editing     with the problem; a short wallet
 *                                                              switches to card
 *   leaving ──RETURNED (Back from Paystack)──────▶ editing
 *
 * Requesting (renewals API off, or the team quotes for this paper):
 *
 *   editing ──REQUEST──▶ requesting ──REQUESTED──▶ requested   "the team will call you"
 *                                   ──FAILED─────▶ editing
 *
 * `started` and `requested` are final. Both paths save the delivery address to the profile first.
 */

export type RenewMode = 'pay' | 'request';
export type PayMethod = 'wallet' | 'card';

/** Pay through the renewals API when it's on and the paper has a set price; otherwise ask the team. */
export function renewMode(input: { renewalsApi: boolean; price: number | null }): RenewMode {
  return input.renewalsApi && input.price !== null ? 'pay' : 'request';
}

export interface WalletOption {
  /** The wallet can pay for this renewal. */
  usable: boolean;
  /** There isn't enough in it. */
  short: boolean;
  /** "₦8,500 available", "₦8,500 available. Not enough for this renewal." */
  note: string;
}

export function walletOption(input: {
  price: number | null | undefined;
  balance: number | null | undefined;
  failed?: boolean;
}): WalletOption {
  const { price, balance } = input;
  if (input.failed) return { usable: false, short: false, note: "We couldn't check your balance" };
  if (balance === null || balance === undefined) {
    return { usable: false, short: false, note: 'Checking your balance…' };
  }
  const available = `${formatNaira(balance)} available`;
  if (price === null || price === undefined)
    return { usable: false, short: false, note: available };
  const short = balance < price;
  return {
    usable: !short,
    short,
    note: short ? `${available}. Not enough for this renewal.` : available,
  };
}

/** The wallet when it can pay, unless the driver picked the card. */
export function payMethod(chosen: PayMethod | null, wallet: WalletOption): PayMethod {
  return chosen === 'card' || !wallet.usable ? 'card' : 'wallet';
}

export type RenewProblem =
  | { kind: 'insufficient' }
  | { kind: 'profile'; message: string }
  | { kind: 'paystack'; message: string }
  | { kind: 'payment'; message: string }
  | { kind: 'request'; message: string };

export function problemText(problem: RenewProblem): string {
  switch (problem.kind) {
    case 'insufficient':
      return 'Not enough in your wallet. Pay by card or bank transfer instead.';
    case 'profile':
      return `We couldn't save your delivery details. ${problem.message}`;
    case 'paystack':
      return `We couldn't open Paystack. ${problem.message}`;
    case 'payment':
      return `We couldn't start your renewal. ${problem.message}`;
    case 'request':
      return `We couldn't send your request. ${problem.message}`;
  }
}

export type RenewState =
  | { status: 'editing'; chosen: PayMethod | null; problem: RenewProblem | null }
  | { status: 'paying'; method: PayMethod; chosen: PayMethod | null }
  | { status: 'leaving' }
  | { status: 'started'; renewal: Renewal }
  | { status: 'requesting' }
  | { status: 'requested'; request: RenewalRequest };

export type RenewEvent =
  | { type: 'CHOOSE'; method: PayMethod }
  | { type: 'PAY'; method: PayMethod }
  | { type: 'CREATED'; renewal: Renewal }
  | { type: 'REDIRECTING' }
  | { type: 'RETURNED' }
  | { type: 'REQUEST' }
  | { type: 'REQUESTED'; request: RenewalRequest }
  | { type: 'FAILED'; problem: RenewProblem };

export const initialRenewState: RenewState = { status: 'editing', chosen: null, problem: null };

export function renewTransition(state: RenewState, event: RenewEvent): RenewState {
  switch (event.type) {
    case 'CHOOSE':
      return state.status === 'editing' ? { ...state, chosen: event.method, problem: null } : state;
    case 'PAY':
      return state.status === 'editing'
        ? { status: 'paying', method: event.method, chosen: state.chosen }
        : state;
    case 'CREATED':
      return state.status === 'paying' && state.method === 'wallet'
        ? { status: 'started', renewal: event.renewal }
        : state;
    case 'REDIRECTING':
      return state.status === 'paying' && state.method === 'card' ? { status: 'leaving' } : state;
    case 'RETURNED':
      return state.status === 'leaving'
        ? { status: 'editing', chosen: 'card', problem: null }
        : state;
    case 'REQUEST':
      return state.status === 'editing' ? { status: 'requesting' } : state;
    case 'REQUESTED':
      return state.status === 'requesting'
        ? { status: 'requested', request: event.request }
        : state;
    case 'FAILED':
      if (state.status === 'paying') {
        // A short wallet sends the driver to the card; anything else keeps what they chose.
        const chosen = event.problem.kind === 'insufficient' ? 'card' : state.chosen;
        return { status: 'editing', chosen, problem: event.problem };
      }
      if (state.status === 'requesting') {
        return { status: 'editing', chosen: null, problem: event.problem };
      }
      return state;
  }
}

/** The page is busy: the form is locked and the button spins. */
export function isBusy(state: RenewState): boolean {
  return state.status === 'paying' || state.status === 'leaving' || state.status === 'requesting';
}
