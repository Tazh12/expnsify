import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isUsableScan, reviewCurrency } from './scanResult';

describe('isUsableScan', () => {
  it('rejects a zero, negative or missing amount', () => {
    assert.equal(isUsableScan({ amount: 0, confidence: 0 }), false);
    assert.equal(isUsableScan({ amount: -4, confidence: 0.9 }), false);
    assert.equal(isUsableScan({ amount: Number.NaN, confidence: 0.9 }), false);
  });

  it('accepts a real amount', () => {
    assert.equal(isUsableScan({ amount: 5.75, confidence: 0.9 }), true);
  });
});

describe('reviewCurrency', () => {
  const supported = ['USD', 'EUR', 'CHF', 'GBP'];

  it('uses the currency read from the document', () => {
    assert.equal(reviewCurrency({ scanned: 'CHF', lineCurrencies: ['EUR'], preferred: 'USD', supported }), 'CHF');
  });

  it('falls back to the currency most budget lines use', () => {
    assert.equal(reviewCurrency({ scanned: null, lineCurrencies: ['CHF', 'CHF', 'EUR'], preferred: 'USD', supported }), 'CHF');
  });

  it('ignores a currency it cannot convert', () => {
    assert.equal(reviewCurrency({ scanned: 'XYZ', lineCurrencies: ['CHF'], preferred: 'USD', supported }), 'CHF');
  });

  it('uses the preferred currency without budget lines', () => {
    assert.equal(reviewCurrency({ scanned: null, lineCurrencies: [], preferred: 'CHF', supported }), 'CHF');
  });
});
