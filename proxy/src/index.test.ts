import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.ts';

const TESTER = 'uid-tester';
const REGULAR = 'uid-regular';
const TOKENS: Record<string, string> = { 'token-tester': TESTER, 'token-regular': REGULAR };

function month(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function fakeKv(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => { store.set(k, v); },
  };
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('identitytoolkit')) {
      const { idToken } = JSON.parse(String(init?.body));
      const uid = TOKENS[idToken];
      if (!uid) return new Response('{}', { status: 400 });
      return Response.json({ users: [{ localId: uid, email: `${uid}@example.com` }] });
    }
    if (url.includes('api.groq.com')) {
      return Response.json({ choices: [{ message: { content: '{"merchant":"Cafe","amount":4.5,"line_items":[]}' } }] });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
});

afterEach(() => { globalThis.fetch = realFetch; });

function envWith(testers: string | undefined) {
  const USAGE = fakeKv({
    [`u:${TESTER}:${month()}`]: '10',
    [`u:${REGULAR}:${month()}`]: '10',
  });
  return {
    GROQ_API_KEY: 'test',
    FIREBASE_API_KEY: 'test',
    PRO_TESTER_UIDS: testers,
    USAGE,
  } as unknown as Parameters<typeof worker.fetch>[1];
}

function scan(token: string, extra: { headers?: Record<string, string>; body?: Record<string, unknown> } = {}) {
  return new Request('https://proxy.test/scan', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra.headers },
    body: JSON.stringify({ text: 'Cafe 4.50', ...extra.body }),
  });
}

function usage(token: string) {
  return new Request('https://proxy.test/usage', { headers: { Authorization: `Bearer ${token}` } });
}

describe('PRO_TESTER_UIDS', () => {
  it('blocks a non-listed user at the free limit', async () => {
    const env = envWith(` ${TESTER} , other-uid,`);
    const res = await worker.fetch(scan('token-regular'), env);
    assert.equal(res.status, 429);
    assert.equal((await res.json() as { error: string }).error, 'limit_reached');
    assert.equal(res.headers.get('X-Ai-Plan'), 'free');
    assert.equal(res.headers.get('X-Ai-Limit'), '10');
  });

  it('lets a listed user past the free limit with Pro caps', async () => {
    const env = envWith(` ${TESTER} , other-uid,`);
    const res = await worker.fetch(scan('token-tester'), env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('X-Ai-Plan'), 'paid');
    assert.equal(res.headers.get('X-Ai-Limit'), '200');
    assert.equal(res.headers.get('X-Ai-Used'), '11');
  });

  it('reports the plan on /usage', async () => {
    const env = envWith(TESTER);
    const pro = await (await worker.fetch(usage('token-tester'), env)).json() as { plan: string; limit: number };
    const free = await (await worker.fetch(usage('token-regular'), env)).json() as { plan: string; limit: number };
    assert.deepEqual([pro.plan, pro.limit], ['paid', 200]);
    assert.deepEqual([free.plan, free.limit], ['free', 10]);
  });

  it('ignores client-sent plan claims', async () => {
    const env = envWith(TESTER);
    const res = await worker.fetch(scan('token-regular', {
      headers: { 'X-Ai-Plan': 'paid' },
      body: { plan: 'pro', uid: TESTER },
    }), env);
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('X-Ai-Plan'), 'free');
  });

  it('does not match a partial uid', async () => {
    const env = envWith(`${REGULAR}-extra`);
    const res = await worker.fetch(scan('token-regular'), env);
    assert.equal(res.status, 429);
  });

  it('treats everyone as free when the secret is unset', async () => {
    const res = await worker.fetch(scan('token-tester'), envWith(undefined));
    assert.equal(res.status, 429);
  });
});
