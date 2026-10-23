import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countStatementRows, normalizeCurrency, STATEMENT_MIN_ROWS } from './statement.ts';

describe('countStatementRows', () => {
  it('counts dated rows with an amount in Swiss formats', () => {
    const text = [
      '01.10.2026 Coop Pronto -12.40',
      '04.10.2026 Salary Example AG 4\'250.00',
      '2026-10-05 Swisscom CHF -49.00',
      '06/10/2026 Volg Musterdorf 5.75',
      '07.10.26 Apotheke -18,90',
    ].join('\n');
    assert.equal(countStatementRows(text), 5);
  });

  it('does not count balance lines as transactions', () => {
    assert.equal(countStatementRows("Closing balance 30.10.2026 2'139.10\nSaldo 30.10.2026 2'139.10"), 0);
  });

  it('does not count an invoice with one date and many items', () => {
    const text = [
      'Invoice date: 21.10.2026',
      'Labour, hours 3 270.00',
      'Replacement valve 1 45.50',
      'Pipe fittings 4 32.00',
      'Total due CHF 432.40',
    ].join('\n');
    assert.ok(countStatementRows(text) < STATEMENT_MIN_ROWS);
  });
});

describe('normalizeCurrency', () => {
  it('maps printed symbols and codes to ISO codes', () => {
    assert.equal(normalizeCurrency('chf'), 'CHF');
    assert.equal(normalizeCurrency('Fr.'), 'CHF');
    assert.equal(normalizeCurrency('SFr.'), 'CHF');
    assert.equal(normalizeCurrency('€'), 'EUR');
    assert.equal(normalizeCurrency('$'), 'USD');
  });

  it('returns null for missing or unknown currencies', () => {
    assert.equal(normalizeCurrency(null), null);
    assert.equal(normalizeCurrency(''), null);
    assert.equal(normalizeCurrency('money'), null);
  });
});
