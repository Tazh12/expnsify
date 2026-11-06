import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { editableAmount, resolveLineAmounts } from './lineEditorCurrency';

// 1 CHF = 1.2227 USD, with CHF as the preferred currency.
const convert = (amount: number, from: string) => (from === 'USD' ? amount / 1.2227 : amount);
const usdRent = { expected: 300, actualOverride: null, currency: 'USD' };

function resolve(overrides: Partial<Parameters<typeof resolveLineAmounts>[0]>) {
  return resolveLineAmounts({
    target: usdRent,
    editing: true,
    untouched: false,
    expected: 0,
    actual: null,
    preferred: 'CHF',
    convert,
    ...overrides,
  });
}

describe('editableAmount', () => {
  it('shows a USD line converted to the preferred currency', () => {
    assert.equal(editableAmount(300, 'USD', 'CHF', convert), '245.36');
  });

  it('leaves a line already in the preferred currency alone', () => {
    assert.equal(editableAmount(245.3567, 'CHF', 'CHF', convert), '245.3567');
  });
});

describe('resolveLineAmounts', () => {
  it('saves a typed 300 on a USD line as 300 in the preferred currency', () => {
    const saved = resolve({ expected: 300 });
    assert.deepEqual(saved, { expected: 300, actualOverride: null, currency: 'CHF' });
  });

  it('keeps stored amounts and currency when no amount was edited', () => {
    const saved = resolve({ untouched: true, expected: 245.36 });
    assert.deepEqual(saved, { expected: 300, actualOverride: null, currency: 'USD' });
  });

  it('converts a retained actual when the line moves to the preferred currency', () => {
    const saved = resolve({
      target: { expected: 300, actualOverride: 100, currency: 'USD' },
      expected: 300,
    });
    assert.deepEqual(saved, { expected: 300, actualOverride: 81.79, currency: 'CHF' });
  });

  it('treats a typed actual as the preferred currency', () => {
    const saved = resolve({
      target: { expected: 300, actualOverride: 100, currency: 'USD' },
      expected: 300,
      actual: 150,
    });
    assert.deepEqual(saved, { expected: 300, actualOverride: 150, currency: 'CHF' });
  });

  it('saves a new line in the preferred currency', () => {
    const saved = resolve({ target: null, editing: false, expected: 50 });
    assert.deepEqual(saved, { expected: 50, actualOverride: null, currency: 'CHF' });
  });

  it('saves amounts typed over a line matched by name in the preferred currency', () => {
    const saved = resolve({ editing: false, untouched: true, expected: 50 });
    assert.deepEqual(saved, { expected: 50, actualOverride: null, currency: 'CHF' });
  });
});
