import { request } from '../client';
import { envelope } from '../schemas/common';
import { walletDebitSchema, type WalletDebit, type WalletDebitBody } from '../schemas/gaps';
import { walletSchema, type Wallet } from '../schemas/wallet';

interface Options {
  signal?: AbortSignal;
}

/** `GET /wallets/balance`. */
export async function getWalletBalance(options: Options = {}): Promise<Wallet> {
  const res = await request('/wallets/balance', { schema: envelope(walletSchema), ...options });
  return res.data;
}

/**
 * `POST /wallets/debit`. **Not built yet** (api-gaps.md, `VITE_FLAG_WALLET_PAY`). A 400 with
 * "Insufficient balance" means the wallet is short.
 */
export async function debitWallet(
  body: WalletDebitBody,
  options: Options = {},
): Promise<WalletDebit> {
  const res = await request('/wallets/debit', {
    method: 'POST',
    body,
    schema: envelope(walletDebitSchema),
    ...options,
  });
  return res.data;
}
