// Test-only entry: the real Worker, bundled and run like production, with only
// its outbound Firebase and Groq calls stubbed. Never deployed.
import worker from '../src/index.ts';

const realFetch = globalThis.fetch;
let lastPrompt = '';

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes('identitytoolkit')) {
    return Response.json({ users: [{ localId: 'dev-user', email: 'dev-user@example.com' }] });
  }
  if (url.includes('api.groq.com')) {
    const body = JSON.parse(String(init?.body)) as { messages: { content: unknown }[] };
    lastPrompt = String(body.messages[1]?.content ?? '');
    return Response.json({
      choices: [{
        message: { content: JSON.stringify({ merchant: 'Example Plumbing GmbH', amount: 432.4, currency: 'CHF', date: '2026-10-21', line_items: [] }) },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

export default {
  async fetch(req: Request, env: Record<string, unknown>, ctx: unknown): Promise<Response> {
    if (new URL(req.url).pathname === '/__last_prompt') return new Response(lastPrompt);
    return worker.fetch(req, { ...env, GROQ_API_KEY: 'test' } as never);
  },
};
