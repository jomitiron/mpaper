import type { CarSaver } from '../../cars/add/useCarSaver';

/**
 * Remembers that the tracking fee for the car on Add a car has been paid from the wallet, for as
 * long as the page is open.
 *
 * Step 4 can be left and entered again (Back, or the stepper) and its component is made afresh
 * each time, so the payment can't live in the component. It's kept against Add a car's saver,
 * which lasts as long as the page, and forgotten when the driver starts another car.
 */

export interface WalletPayment {
  amount: number;
  /** The wallet transaction's reference, for support. */
  reference: string;
}

const payments = new WeakMap<CarSaver, WalletPayment>();

export const paidFromWallet = {
  get: (saver: CarSaver): WalletPayment | undefined => payments.get(saver),
  set: (saver: CarSaver, payment: WalletPayment): void => {
    payments.set(saver, payment);
  },
  forget: (saver: CarSaver): void => {
    payments.delete(saver);
  },
};
