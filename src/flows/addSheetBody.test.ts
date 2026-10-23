import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sheetBody, type SheetState } from './addSheetBody';

const base: SheetState = {
  phase: 'pick',
  blocked: false,
  listening: false,
  isVoice: false,
  completeOpen: false,
  canComplete: false,
  hasScanError: false,
  saving: false,
};

describe('sheetBody', () => {
  it('shows the payment confirmation inside the sheet, not as an empty review', () => {
    assert.equal(sheetBody({ ...base, phase: 'review', completeOpen: true, canComplete: true }), 'complete');
  });

  it('falls back to the review when the confirmation has no line or scan', () => {
    assert.equal(sheetBody({ ...base, phase: 'review', completeOpen: true, canComplete: false }), 'review');
  });

  it('reports nothing to draw for an error phase without an error', () => {
    assert.equal(sheetBody({ ...base, phase: 'error' }), 'none');
  });

  it('keeps the existing phases', () => {
    assert.equal(sheetBody({ ...base, phase: 'pick', blocked: true }), 'blocked');
    assert.equal(sheetBody({ ...base, phase: 'pick' }), 'pick');
    assert.equal(sheetBody({ ...base, phase: 'coach' }), 'coach');
    assert.equal(sheetBody({ ...base, phase: 'scan' }), 'scan');
    assert.equal(sheetBody({ ...base, phase: 'scan', isVoice: true, listening: true }), 'listening');
    assert.equal(sheetBody({ ...base, phase: 'error', hasScanError: true }), 'error');
    assert.equal(sheetBody({ ...base, phase: 'review' }), 'review');
  });

  it('counts the save overlay as content', () => {
    assert.equal(sheetBody({ ...base, phase: 'error', saving: true }), 'saving');
  });
});
