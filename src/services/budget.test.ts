import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchLine } from './budget';
import type { BudgetLine } from '../store/budgetTypes';

const rent = {
  id: 'l1', name: 'Rent', expected: 1650, dueDay: 1, section: 'bills', paid: false,
  month: '2026-10', templateKey: 'rent', currency: 'CHF',
} as unknown as BudgetLine;

describe('matchLine', () => {
  it('does not match any line by name when the merchant is empty', () => {
    assert.equal(matchLine('', 5.75, null, [rent]), null);
  });
});
