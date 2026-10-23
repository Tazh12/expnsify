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

const SCAN_OK = () => Response.json({
  choices: [{ message: { content: '{"merchant":"Cafe","amount":4.5,"line_items":[]}' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 300, completion_tokens: 40 },
});

// Each Groq call takes the next canned response; the last one repeats.
let groqReplies: (() => Response)[] = [SCAN_OK];
let groqBodies: Record<string, unknown>[] = [];

beforeEach(() => {
  groqReplies = [SCAN_OK];
  groqBodies = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('identitytoolkit')) {
      const { idToken } = JSON.parse(String(init?.body));
      const uid = TOKENS[idToken];
      if (!uid) return new Response('{}', { status: 400 });
      return Response.json({ users: [{ localId: uid, email: `${uid}@example.com` }] });
    }
    if (url.includes('api.groq.com')) {
      groqBodies.push(JSON.parse(String(init?.body)));
      const reply = groqReplies.length > 1 ? groqReplies.shift()! : groqReplies[0];
      return reply();
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

function groq429(message: string, retryAfter = '0') {
  return () => new Response(JSON.stringify({ error: { message, type: 'tokens', code: 'rate_limit_exceeded' } }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'retry-after': retryAfter },
  });
}

describe('scan against Groq limits', () => {
  it('asks for few enough output tokens to fit a 1000 OTPM limit', async () => {
    const env = envWith(TESTER);
    await worker.fetch(scan('token-tester'), env);
    assert.equal(groqBodies.length, 1);
    assert.ok(Number(groqBodies[0].max_tokens) <= 700, `max_tokens ${groqBodies[0].max_tokens}`);
  });

  it('retries once after a Groq rate limit, then succeeds and counts one action', async () => {
    groqReplies = [groq429('Rate limit reached for model on tokens per minute (TPM)'), SCAN_OK];
    const env = envWith(TESTER);
    const res = await worker.fetch(scan('token-tester'), env);
    assert.equal(res.status, 200);
    assert.equal(groqBodies.length, 2);
    assert.equal(res.headers.get('X-Ai-Used'), '11');
  });

  it('returns ai_busy, not a usage limit, when Groq stays rate limited', async () => {
    groqReplies = [groq429('Rate limit reached for model on tokens per minute (TPM)')];
    const env = envWith(TESTER);
    const res = await worker.fetch(scan('token-tester'), env);
    assert.equal(res.status, 503);
    const body = await res.json() as { error: string; message?: string };
    assert.equal(body.error, 'ai_busy');
    assert.ok(!JSON.stringify(body).includes('org_'), 'leaks Groq details');
    assert.equal(groqBodies.length, 2);
    const used = await (await worker.fetch(usage('token-tester'), env)).json() as { used: number };
    assert.equal(used.used, 10);
  });

  it('does not retry a request Groq calls too large', async () => {
    groqReplies = [groq429('Request too large for model `qwen` in organization `org_x` on output tokens per minute (OTPM): Limit 1000, Requested 1024.')];
    const res = await worker.fetch(scan('token-tester'), envWith(TESTER));
    assert.equal(res.status, 503);
    assert.equal(groqBodies.length, 1);
  });

  it('does not wait out a long retry-after', async () => {
    groqReplies = [groq429('Rate limit reached', '45'), SCAN_OK];
    const started = Date.now();
    const res = await worker.fetch(scan('token-tester'), envWith(TESTER));
    assert.equal(res.status, 503);
    assert.equal(groqBodies.length, 1);
    assert.ok(Date.now() - started < 1000);
    assert.equal((await res.json() as { retryAfter?: number }).retryAfter, 45);
  });
});
