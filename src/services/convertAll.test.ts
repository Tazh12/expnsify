import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convertAllToCurrency, ConversionSaveError, type RateTable } from './convertAll';

const staleChf: RateTable = { base: 'CHF', rates: { EUR: 1.05, USD: 1.2227 } };
const freshEur: RateTable = { base: 'EUR', rates: { CHF: 0.95, USD: 1.16 } };

function setup(loadRates: (base: string) => Promise<RateTable>) {
  const calls: string[] = [];
  const expenseWrites: Record<string, unknown>[] = [];
  const lineWrites: Record<string, unknown>[] = [];
  return {
    calls,
    expenseWrites,
    lineWrites,
    run: () => convertAllToCurrency({
      target: 'EUR',
      expenses: [
        { id: 'chf', amount: 100, currency: 'CHF' },
        { id: 'eur', amount: 20, currency: 'EUR' },
      ],
      lines: [
        { id: 'rent', expected: 116, actualOverride: 58, currency: 'USD' },
        { id: 'gym', expected: 95, actualOverride: null, currency: 'CHF' },
      ],
      loadRates: async (base) => {
        calls.push('load');
        return loadRates(base);
      },
      updateExpense: async (id, patch) => {
        calls.push('write');
        expenseWrites.push({ id, ...patch });
      },
      updateLine: async (id, patch) => {
        calls.push('write');
        lineWrites.push({ id, ...patch });
      },
      setPreferred: async (currency) => {
        calls.push(`preferred:${currency}`);
      },
    }),
  };
}

describe('convertAllToCurrency', () => {
  it('does not turn 100 CHF into 100 EUR, and uses rates for the new currency', async () => {
    const t = setup(async () => freshEur);
    await t.run();
    assert.deepEqual(t.expenseWrites, [{ id: 'chf', amount: 105.26, currency: 'EUR' }]);
    assert.deepEqual(t.lineWrites, [
      { id: 'rent', expected: 100, actualOverride: 50, currency: 'EUR' },
      { id: 'gym', expected: 100, currency: 'EUR' },
    ]);
  });

  it('refuses stale rates for the old currency and writes nothing', async () => {
    const t = setup(async () => staleChf);
    await assert.rejects(t.run());
    assert.deepEqual(t.calls, ['load']);
  });

  it('writes nothing when rates fail to load', async () => {
    const t = setup(async () => { throw new Error('offline'); });
    await assert.rejects(t.run(), /offline/);
    assert.deepEqual(t.calls, ['load']);
  });

  it('writes nothing when a rate is missing for any row', async () => {
    const t = setup(async () => ({ base: 'EUR', rates: { CHF: 0.95 } }));
    await assert.rejects(t.run());
    assert.deepEqual(t.calls, ['load']);
  });

  it('waits for rates, saves, and only then changes the preferred currency', async () => {
    const t = setup(async () => freshEur);
    await t.run();
    assert.deepEqual(t.calls, ['load', 'write', 'write', 'write', 'preferred:EUR']);
  });

  it('keeps the preferred currency when a save fails', async () => {
    let preferredChanged = false;
    await assert.rejects(
      convertAllToCurrency({
        target: 'EUR',
        expenses: [{ id: 'chf', amount: 100, currency: 'CHF' }],
        lines: [],
        loadRates: async () => freshEur,
        updateExpense: async () => { throw new Error('offline'); },
        updateLine: async () => {},
        setPreferred: async () => { preferredChanged = true; },
      }),
      ConversionSaveError,
    );
    assert.equal(preferredChanged, false);
  });
});
