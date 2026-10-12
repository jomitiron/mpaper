import { describe, expect, it } from 'vitest';
import {
  formatAmountInput,
  MIN_TOP_UP,
  parseAmount,
  topUpButtonLabel,
  topUpProblem,
} from '../lib/amount';

describe('parseAmount', () => {
  it.each([
    ['20000', 20_000],
    ['20,000', 20_000],
    ['₦20,000', 20_000],
    [' 5 000 ', 5_000],
    ['0050', 50],
    ['', 0],
    ['abc', 0],
    ['₦', 0],
  ])('reads %j as %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('drops kobo instead of reading them as more naira', () => {
    expect(parseAmount('1,500.50')).toBe(1_500);
    expect(parseAmount('100.99')).toBe(100);
    expect(parseAmount('.50')).toBe(0);
  });

  it('ignores digits past ₦999,999,999 so the number stays exact', () => {
    expect(parseAmount('12345678901234')).toBe(123_456_789);
  });
});

describe('formatAmountInput', () => {
  it('groups thousands for the input, and leaves it empty for nothing', () => {
    expect(formatAmountInput(20_000)).toBe('20,000');
    expect(formatAmountInput(1_250_000)).toBe('1,250,000');
    expect(formatAmountInput(100)).toBe('100');
    expect(formatAmountInput(0)).toBe('');
  });

  it('round-trips with parseAmount as the driver types', () => {
    let shown = '';
    for (const key of '25000') shown = formatAmountInput(parseAmount(shown + key));
    expect(shown).toBe('25,000');
  });
});

describe('top-up rules', () => {
  it('needs at least ₦100', () => {
    expect(MIN_TOP_UP).toBe(100);
    expect(topUpProblem(0)).toBe('Enter at least ₦100.');
    expect(topUpProblem(99)).toBe('Enter at least ₦100.');
    expect(topUpProblem(100)).toBeNull();
    expect(topUpProblem(50_000)).toBeNull();
  });

  it('shows the amount on the button once it can be paid', () => {
    expect(topUpButtonLabel(0)).toBe('Continue to Paystack');
    expect(topUpButtonLabel(99)).toBe('Continue to Paystack');
    expect(topUpButtonLabel(20_000)).toBe('Continue to Paystack · ₦20,000');
  });
});
