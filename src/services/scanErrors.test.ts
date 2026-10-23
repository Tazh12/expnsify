import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scanErrorKind, scanFailureCopy } from './scanErrors';

describe('scanErrorKind', () => {
  it('reads a busy Worker as busy, not a usage limit', () => {
    assert.equal(scanErrorKind(503, JSON.stringify({ error: 'ai_busy', retryAfter: 30 })), 'busy');
  });

  it('treats other failures as unavailable', () => {
    assert.equal(scanErrorKind(502, JSON.stringify({ error: 'ai_unavailable' })), 'unavailable');
    assert.equal(scanErrorKind(503, JSON.stringify({ error: 'usage_unconfigured' })), 'unavailable');
    assert.equal(scanErrorKind(500, 'not json'), 'unavailable');
    assert.equal(scanErrorKind(502, 'null'), 'unavailable');
  });

  it('asks to sign in again on auth failures', () => {
    assert.equal(scanErrorKind(401, JSON.stringify({ error: 'unauthorized' })), 'auth');
    assert.equal(scanErrorKind(403, ''), 'auth');
  });
});

describe('scanFailureCopy', () => {
  it('gives every kind a title and message', () => {
    for (const kind of ['auth', 'busy', 'unavailable'] as const) {
      const copy = scanFailureCopy(kind);
      assert.ok(copy.title && copy.message, kind);
    }
  });
});
