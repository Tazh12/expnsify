import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scanErrorKind, scanFailureCopy } from './scanErrors';

describe('scanErrorKind', () => {
  it('reads a busy Worker as busy, not a usage limit', () => {
    assert.deepEqual(scanErrorKind(503, JSON.stringify({ error: 'ai_busy', retryAfter: 30 })), { kind: 'busy' });
  });

  it('treats other failures as unavailable', () => {
    assert.deepEqual(scanErrorKind(502, JSON.stringify({ error: 'ai_unavailable' })), { kind: 'unavailable' });
    assert.deepEqual(scanErrorKind(503, JSON.stringify({ error: 'usage_unconfigured' })), { kind: 'unavailable' });
    assert.deepEqual(scanErrorKind(500, 'not json'), { kind: 'unavailable' });
    assert.deepEqual(scanErrorKind(502, 'null'), { kind: 'unavailable' });
  });

  it('asks to sign in again on auth failures', () => {
    assert.deepEqual(scanErrorKind(401, JSON.stringify({ error: 'unauthorized' })), { kind: 'auth' });
    assert.deepEqual(scanErrorKind(403, ''), { kind: 'auth' });
  });
});

describe('scanFailureCopy', () => {
  it('gives every kind a title and message', () => {
    for (const kind of ['auth', 'busy', 'unavailable', 'unreadable'] as const) {
      const copy = scanFailureCopy({ kind });
      assert.ok(copy.title && copy.message, kind);
    }
  });
});

describe('statement and unreadable scans', () => {
  it('reads a statement with its transaction count', () => {
    const error = scanErrorKind(422, JSON.stringify({ error: 'statement', transactions: 20 }));
    assert.deepEqual(error, { kind: 'statement', transactions: 20 });
    assert.equal(scanFailureCopy(error).title, 'This looks like a statement with 20 transactions');
  });

  it('reads an unreadable scan', () => {
    assert.deepEqual(scanErrorKind(422, JSON.stringify({ error: 'unreadable' })), { kind: 'unreadable' });
  });
});
