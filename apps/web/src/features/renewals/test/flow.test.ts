import { describe, expect, it } from 'vitest';
import {
  initialRenewState,
  isBusy,
  payMethod,
  problemText,
  renewMode,
  renewTransition,
  walletOption,
  type RenewEvent,
  type RenewState,
} from '../lib/flow';
import { renewal } from './fixtures';

/** The renew page's state machine: wallet short, the card path, and when to call us instead. */

function run(events: RenewEvent[], from: RenewState = initialRenewState): RenewState {
  return events.reduce(renewTransition, from);
}

describe('renew mode', () => {
  it('pays through the renewals API when it is on and the paper has a price', () => {
    expect(renewMode({ renewalsApi: true, price: 18_500 })).toBe('pay');
  });

  it('asks the driver to call us with the API off, or when the team quotes', () => {
    expect(renewMode({ renewalsApi: false, price: 18_500 })).toBe('call');
    expect(renewMode({ renewalsApi: true, price: null })).toBe('call');
  });
});

describe('wallet option', () => {
  it('can pay when the balance covers the price', () => {
    expect(walletOption({ price: 6_500, balance: 8_500 })).toEqual({
      usable: true,
      short: false,
      note: '₦8,500 available',
    });
  });

  it('is short when the balance is less than the price', () => {
    expect(walletOption({ price: 18_500, balance: 8_500 })).toEqual({
      usable: false,
      short: true,
      note: '₦8,500 available. Not enough for this renewal.',
    });
  });

  it("can't be used while the balance loads, or when it failed to load", () => {
    expect(walletOption({ price: 6_500, balance: undefined })).toMatchObject({
      usable: false,
      note: 'Checking your balance…',
    });
    expect(walletOption({ price: 6_500, balance: 8_500, failed: true })).toMatchObject({
      usable: false,
      note: "We couldn't check your balance",
    });
  });

  it('picks the wallet when it can pay, unless the driver chose the card', () => {
    const enough = walletOption({ price: 6_500, balance: 8_500 });
    const short = walletOption({ price: 18_500, balance: 8_500 });
    expect(payMethod(null, enough)).toBe('wallet');
    expect(payMethod('card', enough)).toBe('card');
    expect(payMethod(null, short)).toBe('card');
    expect(payMethod('wallet', short)).toBe('card');
  });
});

describe('renew flow', () => {
  it('pays from the wallet and starts the renewal', () => {
    const paying = run([{ type: 'PAY', method: 'wallet' }]);
    expect(paying).toEqual({ status: 'paying', method: 'wallet', chosen: null });
    expect(isBusy(paying)).toBe(true);
    const started = renewTransition(paying, { type: 'CREATED', renewal: renewal() });
    expect(started).toEqual({ status: 'started', renewal: renewal() });
    expect(isBusy(started)).toBe(false);
  });

  it('sends a short wallet to the card, saying why', () => {
    const state = run([
      { type: 'CHOOSE', method: 'wallet' },
      { type: 'PAY', method: 'wallet' },
      { type: 'FAILED', problem: { kind: 'insufficient' } },
    ]);
    expect(state).toEqual({ status: 'editing', chosen: 'card', problem: { kind: 'insufficient' } });
    expect(problemText({ kind: 'insufficient' })).toBe(
      'Not enough in your wallet. Pay by card or bank transfer instead.',
    );
  });

  it('keeps the chosen method when anything else goes wrong', () => {
    const state = run([
      { type: 'CHOOSE', method: 'wallet' },
      { type: 'PAY', method: 'wallet' },
      { type: 'FAILED', problem: { kind: 'payment', message: 'Server error.' } },
    ]);
    expect(state).toMatchObject({ status: 'editing', chosen: 'wallet' });
  });

  it('goes to Paystack on the card path, and back to the form after Back', () => {
    const leaving = run([
      { type: 'CHOOSE', method: 'card' },
      { type: 'PAY', method: 'card' },
      { type: 'REDIRECTING' },
    ]);
    expect(leaving).toEqual({ status: 'leaving' });
    expect(isBusy(leaving)).toBe(true);
    // A card payment never "creates" on this page: the return page shows the receipt.
    expect(renewTransition(leaving, { type: 'CREATED', renewal: renewal() })).toBe(leaving);
    expect(renewTransition(leaving, { type: 'RETURNED' })).toEqual({
      status: 'editing',
      chosen: 'card',
      problem: null,
    });
  });

  it('reports a Paystack problem and lets the driver try again', () => {
    const failed = run([
      { type: 'PAY', method: 'card' },
      { type: 'FAILED', problem: { kind: 'paystack', message: 'Network error.' } },
    ]);
    expect(failed).toMatchObject({ status: 'editing', problem: { kind: 'paystack' } });
    expect(run([{ type: 'PAY', method: 'card' }], failed)).toMatchObject({ status: 'paying' });
  });

  it('ignores events that make no sense where it is', () => {
    const started: RenewState = { status: 'started', renewal: renewal() };
    for (const event of [
      { type: 'PAY', method: 'card' },
      { type: 'CHOOSE', method: 'card' },
      { type: 'FAILED', problem: { kind: 'insufficient' } },
    ] satisfies RenewEvent[]) {
      expect(renewTransition(started, event)).toBe(started);
    }
    // No paying twice while one payment is going.
    const paying = run([{ type: 'PAY', method: 'wallet' }]);
    expect(renewTransition(paying, { type: 'PAY', method: 'card' })).toBe(paying);
    expect(renewTransition(paying, { type: 'REDIRECTING' })).toBe(paying);
  });
});
