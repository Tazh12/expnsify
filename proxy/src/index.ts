interface Env {
  GROQ_API_KEY: string;
  FIREBASE_API_KEY: string;
  USAGE?: KVNamespace;
}

const FREE_LIMIT = 10;
const PAID_LIMIT = 300;
const PER_MINUTE = 10;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Expose-Headers': 'X-Ai-Used, X-Ai-Limit, X-Ai-Resets, X-Ai-Plan',
};

function ok(body: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });
}

function err(msg: string, status = 400): Response {
  return ok({ error: msg }, status);
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function resetsAt(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

function minuteKey(d = new Date()): string {
  return d.toISOString().slice(0, 16);
}

async function verifyUid(req: Request, env: Env): Promise<string | Response> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return err('unauthorized', 401);
  if (!env.FIREBASE_API_KEY) return err('auth_unconfigured', 503);

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!res.ok) return err('unauthorized', 401);
  const body = await res.json() as { users?: { localId?: string }[] };
  const uid = body.users?.[0]?.localId;
  if (!uid) return err('unauthorized', 401);
  return uid;
}

async function planFor(env: Env, uid: string): Promise<'free' | 'paid'> {
  if (!env.USAGE) return 'free';
  const plan = await env.USAGE.get(`plan:${uid}`);
  return plan === 'paid' ? 'paid' : 'free';
}

function limitFor(plan: 'free' | 'paid'): number {
  return plan === 'paid' ? PAID_LIMIT : FREE_LIMIT;
}

async function usedCount(env: Env, uid: string): Promise<number> {
  if (!env.USAGE) return 0;
  const raw = await env.USAGE.get(`u:${uid}:${monthKey()}`);
  return Number(raw ?? 0) || 0;
}

function usageHeaders(used: number, limit: number, plan: 'free' | 'paid'): Record<string, string> {
  return {
    'X-Ai-Used': String(used),
    'X-Ai-Limit': String(limit),
    'X-Ai-Resets': resetsAt(),
    'X-Ai-Plan': plan,
  };
}

async function gate(env: Env, uid: string): Promise<Response | null> {
  if (!env.USAGE) return err('usage_unconfigured', 503);
  try {
    const plan = await planFor(env, uid);
    const limit = limitFor(plan);
    const used = await usedCount(env, uid);
    if (used >= limit) {
      return ok({ error: 'limit_reached', used, limit, resetsAt: resetsAt() }, 429, usageHeaders(used, limit, plan));
    }
    const minute = `rl:${uid}:${minuteKey()}`;
    const hits = Number(await env.USAGE.get(minute) ?? 0) || 0;
    if (hits >= PER_MINUTE) {
      return ok({ error: 'rate_limited', used, limit, resetsAt: resetsAt() }, 429, usageHeaders(used, limit, plan));
    }
    await env.USAGE.put(minute, String(hits + 1), { expirationTtl: 120 });
    return null;
  } catch (e) {
    console.error('usage gate failed', e);
    return err('usage_unconfigured', 503);
  }
}

async function bump(env: Env, uid: string): Promise<Record<string, string>> {
  const plan = await planFor(env, uid);
  const limit = limitFor(plan);
  const key = `u:${uid}:${monthKey()}`;
  const next = (await usedCount(env, uid)) + 1;
  await env.USAGE?.put(key, String(next), { expirationTtl: 60 * 60 * 24 * 40 });
  return usageHeaders(next, limit, plan);
}

function withHeaders(res: Response, headers: Record<string, string>): Response {
  const next = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...CORS, ...headers })) next.set(k, v);
  return new Response(res.body, { status: res.status, headers: next });
}

function sanitizeLineItems(raw: unknown): { name: string; amount: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 40)
    .map(item => {
      const row = item as { name?: unknown; amount?: unknown };
      return {
        name: String(row?.name ?? '').trim().slice(0, 80),
        amount: Number(row?.amount) || 0,
      };
    })
    .filter(item => item.name);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(req.url);
    const uid = await verifyUid(req, env);
    if (uid instanceof Response) return uid;

    if (req.method === 'GET' && url.pathname === '/usage') {
      const plan = await planFor(env, uid);
      const limit = limitFor(plan);
      const used = await usedCount(env, uid);
      return ok({ used, limit, resetsAt: resetsAt(), plan }, 200, usageHeaders(used, limit, plan));
    }

    const routes: Record<string, (req: Request, env: Env) => Promise<Response>> = {
      '/scan': handleScan,
      '/transcribe': handleTranscribe,
      '/insights': handleInsights,
      '/ask': handleAsk,
    };
    const handler = req.method === 'POST' ? routes[url.pathname] : undefined;
    if (!handler) return err('Not found', 404);

    const blocked = await gate(env, uid);
    if (blocked) return blocked;

    const result = await handler(req, env);
    if (!result.ok) return withHeaders(result, {});
    return withHeaders(result, await bump(env, uid));
  },
};

interface ScanLine {
  id: string;
  name: string;
  expected: number;
  dueDay: number | null;
  section: string;
  paid: boolean;
}

async function handleScan(req: Request, env: Env): Promise<Response> {
  let body: {
    imageBase64?: string;
    mimeType?: string;
    text?: string;
    pdfBase64?: string;
    categories?: { id: string; name: string }[];
    lines?: ScanLine[];
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return err('Invalid JSON');
  }

  let text = body.text ?? '';
  let imageBase64 = body.imageBase64;
  let imageMime = body.mimeType ?? 'image/jpeg';

  if (body.pdfBase64 && !text && !imageBase64) {
    const extracted = await extractPdfText(body.pdfBase64);
    const jpeg = extractJpegFromPdf(body.pdfBase64);
    if (extracted && looksLikePaymentText(extracted)) {
      text = extracted;
    } else if (jpeg) {
      imageBase64 = jpeg;
      imageMime = 'image/jpeg';
    } else if (extracted && extracted.trim().length > 12) {
      text = extracted;
    } else {
      return err('Could not read that PDF. Try a screenshot of the confirmation.');
    }
  }

  const categories = body.categories ?? [];
  const lines = body.lines ?? [];
  const categoryList = categories.length > 0
    ? categories.map((c) => `- ${c.id}: ${c.name}`).join('\n')
    : '(none yet — invent a sensible one)';
  const lineList = lines.length > 0
    ? lines.map((l) =>
        `- ${l.id}: ${l.name} | section=${l.section} | expected=${l.expected} | dueDay=${l.dueDay ?? 'none'} | paid=${l.paid}`
      ).join('\n')
    : '(no budget lines this month)';

  const system = `You extract a single money movement from a receipt, bank screenshot, payment confirmation email/PDF, or short user note.
Return ONLY JSON with this exact shape:
{
  "merchant": string,
  "amount": number,
  "currency": "USD",
  "date": string,
  "category": {
    "id": string,
    "name": string,
    "isNew": boolean,
    "suggestedColor": string
  },
  "note": string | null,
  "confidence": number,
  "lineId": string | null,
  "matchConfidence": number,
  "isPaymentConfirmation": boolean,
  "line_items": [{ "name": string, "amount": number }]
}

Existing user categories (prefer these; only invent a new one if none truly fit):
${categoryList}

This month's budget lines (prefer matching one of these; use the line's id as lineId):
${lineList}

Rules:
- If an existing category fits, set category.id to that id and isNew=false. suggestedColor is ignored when isNew=false.
- If you must invent one, use a single short lowercase word (a-z only) as id, Title Case as name, isNew=true, and pick a tasteful hex color for suggestedColor.
- date: ISO 8601 using today's date ${new Date().toISOString().slice(0, 10)} if unclear.
- confidence: 0..1 based on image/text clarity.
- lineId: id of the best matching unpaid budget line, or null if none fit. Prefer unpaid lines whose name/merchant is close and whose expected amount is within ~5%.
- matchConfidence: 0..1 for that line match.
- isPaymentConfirmation: true if this is a bill/receipt/email confirming a payment already made (mark the line complete), false if it is a new spend to log.
- If the receipt shows itemized line items, extract them as an array of { name, amount }.
- If you can only read a total, return an empty array for line_items.
- Do not include the grand total as a line item.`;

  const messages: { role: string; content: unknown }[] = [
    { role: 'system', content: system },
  ];

  if (imageBase64) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${imageMime};base64,${imageBase64}` },
        },
        { type: 'text', text: 'Extract the payment or expense from this image.' },
      ],
    });
  } else if (text) {
    messages.push({ role: 'user', content: text });
  } else {
    return err('Provide imageBase64, pdfBase64, or text');
  }

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.6-27b',
      messages,
      temperature: 0.1,
      max_tokens: 1024,
      reasoning_effort: 'none',
      reasoning_format: 'hidden',
    }),
  });

  if (!groqRes.ok) {
    const groqText = await groqRes.text();
    console.error('groq scan failed', groqRes.status, groqText.slice(0, 300));
    return err(`Groq error: ${groqText}`, 502);
  }

  const groqJson = await groqRes.json() as {
    choices: { message: { content?: string | null; reasoning?: string | null } }[];
  };
  const msg = groqJson.choices?.[0]?.message;
  const raw = (msg?.content && msg.content.trim()) || msg?.reasoning || '';
  if (!raw) {
    console.error('groq scan empty body');
    return err('Groq returned an empty scan', 502);
  }

  try {
    const parsed = parseModelJson(raw) as { amount?: unknown; line_items?: unknown };
    if (!Number.isFinite(Number(parsed?.amount))) {
      console.error('groq scan missing amount', raw.slice(0, 300));
      return err('Groq scan had no amount', 502);
    }
    return ok({ ...parsed, line_items: sanitizeLineItems(parsed.line_items) });
  } catch {
    console.error('groq scan parse failed', raw.slice(0, 300));
    return err('Failed to parse Groq response', 502);
  }
}

function parseModelJson(raw: string): unknown {
  const trimmed = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]);
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
    throw new Error('parse failed');
  }
}

async function extractPdfText(b64: string): Promise<string | null> {
  try {
    const binary = decodeBase64(b64);
    const mod = await import('unpdf').catch(() => null);
    if (mod) {
      const pdf = await mod.getDocumentProxy(binary);
      const result = await mod.extractText(pdf, { mergePages: true });
      const text = Array.isArray(result.text) ? result.text.join('\n') : String(result.text ?? '');
      if (text.trim().length > 12) return text;
    }
  } catch (e) {
    console.error('unpdf failed', e);
  }
  return naivePdfText(b64);
}

function looksLikePaymentText(text: string): boolean {
  return /(?:\$|usd|eur|gbp|cad|mxn)?\s*\d{1,7}(?:[.,]\d{2})\b|\b(total|paid|amount|invoice|receipt)\b/i.test(text);
}

function extractJpegFromPdf(b64: string): string | null {
  try {
    const bytes = decodeBase64(b64);
    let best: Uint8Array | null = null;
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] !== 0xFF || bytes[i + 1] !== 0xD8) continue;
      for (let j = i + 2; j < bytes.length - 1; j++) {
        if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
          const slice = bytes.subarray(i, j + 2);
          if (slice.length > 8000 && (!best || slice.length > best.length)) best = slice;
          i = j;
          break;
        }
      }
    }
    return best ? encodeBase64(best) : null;
  } catch (e) {
    console.error('pdf jpeg extract failed', e);
    return null;
  }
}

function naivePdfText(b64: string): string | null {
  try {
    const raw = atob(b64);
    const strings = [...raw.matchAll(/\(([^)]{3,120})\)/g)].map(m => m[1]);
    const joined = strings.join(' ').replace(/\\n/g, ' ').trim();
    return joined.length > 20 ? joined : null;
  } catch {
    return null;
  }
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function handleTranscribe(req: Request, env: Env): Promise<Response> {
  const contentType = req.headers.get('content-type') ?? '';
  let bytes: Uint8Array | null = null;
  let filename = 'audio.m4a';
  let mime = 'audio/m4a';

  if (contentType.includes('application/json')) {
    let body: { audioBase64?: string; mimeType?: string };
    try {
      body = await req.json() as typeof body;
    } catch {
      return err('Invalid JSON');
    }
    if (!body.audioBase64) return err('No audio file');
    bytes = decodeBase64(body.audioBase64);
    mime = body.mimeType ?? 'audio/m4a';
    if (mime.includes('webm')) filename = 'audio.webm';
    else if (mime.includes('wav')) filename = 'audio.wav';
    else if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) filename = 'audio.m4a';
  } else {
    const formData = await req.formData();
    const audio = formData.get('audio');
    if (!audio || typeof audio === 'string') return err('No audio file');
    const audioFile = audio as unknown as File;
    bytes = new Uint8Array(await audioFile.arrayBuffer());
    mime = audioFile.type || 'audio/m4a';
    filename = audioFile.name || 'audio.m4a';
  }

  const groqForm = new FormData();
  groqForm.append('file', new Blob([bytes], { type: mime }), filename);
  groqForm.append('model', 'whisper-large-v3-turbo');
  groqForm.append('response_format', 'json');

  const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: groqForm,
  });

  if (!groqRes.ok) {
    const text = await groqRes.text();
    console.error('groq transcribe failed', groqRes.status, text.slice(0, 300));
    return err(`Groq transcription error: ${text}`, 502);
  }

  const json = await groqRes.json() as { text: string };
  return ok({ text: json.text });
}

async function handleInsights(req: Request, env: Env): Promise<Response> {
  let body: { expenses?: unknown; categories?: { id: string; name: string }[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return err('Invalid JSON');
  }

  const expenses = Array.isArray(body.expenses) ? body.expenses.slice(0, 200) : [];
  const categories = body.categories ?? [];
  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.6-27b',
      messages: [
        {
          role: 'system',
          content: `You summarize personal spending. Return ONLY JSON: { "insights": string[] } with 3 or 4 short sentences. Use the category names. Do not invent purchases that are not in the data. Categories: ${categories.map(c => `${c.id}=${c.name}`).join(', ') || 'none'}.`,
        },
        { role: 'user', content: JSON.stringify(expenses) },
      ],
      temperature: 0.3,
      max_tokens: 400,
      reasoning_effort: 'none',
      reasoning_format: 'hidden',
    }),
  });

  if (!groqRes.ok) return err(`Groq error: ${await groqRes.text()}`, 502);
  const groqJson = await groqRes.json() as {
    choices: { message: { content?: string | null; reasoning?: string | null } }[];
  };
  const msg = groqJson.choices?.[0]?.message;
  const raw = (msg?.content && msg.content.trim()) || msg?.reasoning || '';
  try {
    const parsed = parseModelJson(raw) as { insights?: unknown };
    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.filter(line => typeof line === 'string').slice(0, 4)
      : [];
    return ok({ insights });
  } catch {
    return err('Failed to parse Groq response', 502);
  }
}

async function handleAsk(req: Request, env: Env): Promise<Response> {
  let body: { question?: string; expenses?: { id?: string }[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return err('Invalid JSON');
  }
  const question = (body.question ?? '').slice(0, 300);
  const expenses = Array.isArray(body.expenses) ? body.expenses.slice(0, 100) : [];
  const allowed = new Set(expenses.map(e => e.id).filter((id): id is string => typeof id === 'string'));

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.6-27b',
      messages: [
        {
          role: 'system',
          content: 'Match a question to expenses. Return ONLY JSON: { "ids": string[] } using ids from the provided expenses. Match merchant, note, and item names. If nothing matches, return an empty array.',
        },
        { role: 'user', content: JSON.stringify({ question, expenses }) },
      ],
      temperature: 0.1,
      max_tokens: 400,
      reasoning_effort: 'none',
      reasoning_format: 'hidden',
    }),
  });

  if (!groqRes.ok) return err(`Groq error: ${await groqRes.text()}`, 502);
  const groqJson = await groqRes.json() as {
    choices: { message: { content?: string | null; reasoning?: string | null } }[];
  };
  const msg = groqJson.choices?.[0]?.message;
  const raw = (msg?.content && msg.content.trim()) || msg?.reasoning || '';
  try {
    const parsed = parseModelJson(raw) as { ids?: unknown };
    const ids = Array.isArray(parsed.ids)
      ? parsed.ids.filter((id): id is string => typeof id === 'string' && allowed.has(id))
      : [];
    return ok({ ids });
  } catch {
    return err('Failed to parse Groq response', 502);
  }
}
