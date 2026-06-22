interface Env {
  GROQ_API_KEY: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname === '/scan') {
      return handleScan(req, env);
    }

    if (req.method === 'POST' && url.pathname === '/transcribe') {
      return handleTranscribe(req, env);
    }

    return err('Not found', 404);
  },
};

// ── /scan ─────────────────────────────────────────────────────
async function handleScan(req: Request, env: Env): Promise<Response> {
  let body: { imageBase64?: string; text?: string; categories?: { id: string; name: string }[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return err('Invalid JSON');
  }

  const categories = body.categories ?? [];
  const categoryList = categories.length > 0
    ? categories.map((c: { id: string; name: string }) => `- ${c.id}: ${c.name}`).join('\n')
    : '(none yet — invent a sensible one)';

  const system = `You extract a single expense from a receipt, bank-app screenshot, or short user note.
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
  "confidence": number
}

Existing user categories (prefer these; only invent a new one if none truly fit):
${categoryList}

Rules:
- If an existing category fits, set category.id to that id and isNew=false. suggestedColor is ignored when isNew=false.
- If you must invent one, use a single short lowercase word (a-z only) as id, Title Case as name, isNew=true, and pick a tasteful hex color for suggestedColor.
- date: ISO 8601, today if unclear.
- confidence: 0..1 based on image clarity.`;

  const messages: { role: string; content: unknown }[] = [
    { role: 'system', content: system },
  ];

  if (body.imageBase64) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${body.imageBase64}` },
        },
        { type: 'text', text: 'Extract the expense from this image.' },
      ],
    });
  } else if (body.text) {
    messages.push({ role: 'user', content: body.text });
  } else {
    return err('Provide imageBase64 or text');
  }

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!groqRes.ok) {
    const text = await groqRes.text();
    return err(`Groq error: ${text}`, 502);
  }

  const groqJson = await groqRes.json() as { choices: { message: { content: string } }[] };
  const raw = groqJson.choices?.[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(raw);
    return ok(parsed);
  } catch {
    return err('Failed to parse Groq response', 502);
  }
}

// ── /transcribe ───────────────────────────────────────────────
async function handleTranscribe(req: Request, env: Env): Promise<Response> {
  const formData = await req.formData();
  const audio = formData.get('audio');
  if (!audio || typeof audio === 'string') return err('No audio file');
  const audioFile = audio as unknown as File;

  const groqForm = new FormData();
  groqForm.append('file', audioFile, 'audio.m4a');
  groqForm.append('model', 'whisper-large-v3-turbo');
  groqForm.append('response_format', 'json');

  const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: groqForm,
  });

  if (!groqRes.ok) {
    const text = await groqRes.text();
    return err(`Groq transcription error: ${text}`, 502);
  }

  const json = await groqRes.json() as { text: string };
  return ok({ text: json.text });
}
