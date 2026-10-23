import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unstable_dev, type Unstable_DevWorker } from 'wrangler';

// Node runs the TypeScript unbundled. Production runs wrangler's bundle in workerd,
// which is where unpdf broke, so these go through that bundle.
let worker: Unstable_DevWorker;

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url)).toString('base64');
}

async function extract(name: string): Promise<{ text: string | null; error?: string }> {
  const res = await worker.fetch('/', { method: 'POST', body: fixture(name) });
  return await res.json() as { text: string | null; error?: string };
}

describe('PDF text in the Workers runtime', { timeout: 60_000 }, () => {
  before(async () => {
    worker = await unstable_dev(new URL('./pdf-worker.ts', import.meta.url).pathname, {
      config: new URL('../wrangler.toml', import.meta.url).pathname,
      experimental: { disableExperimentalWarning: true },
      logLevel: 'error',
    });
  });

  after(async () => { await worker?.stop(); });

  it('reads every transaction from a two-page statement', async () => {
    const { text, error } = await extract('statement.pdf');
    assert.equal(error, undefined);
    assert.match(text ?? '', /01\.10\.2026 Coop Pronto Bern -12\.40/);
    assert.match(text ?? '', /20\.10\.2026 Coop City Test -15\.85/);
  });

  it('reads the total from a single invoice', async () => {
    const { text } = await extract('invoice.pdf');
    assert.match(text ?? '', /Total due CHF 432\.40/);
  });

  it('reports an error for bytes that are not a PDF', async () => {
    const res = await worker.fetch('/', { method: 'POST', body: Buffer.from('not a pdf at all').toString('base64') });
    const { text, error } = await res.json() as { text: string | null; error?: string };
    assert.equal(text, null);
    assert.ok(error, 'expected an error');
  });
});

describe('/scan with PDFs in the Workers runtime', { timeout: 60_000 }, () => {
  let scanWorker: Unstable_DevWorker;

  before(async () => {
    scanWorker = await unstable_dev(new URL('./scan-worker.ts', import.meta.url).pathname, {
      config: new URL('../wrangler.toml', import.meta.url).pathname,
      experimental: { disableExperimentalWarning: true },
      logLevel: 'error',
    });
  });

  after(async () => { await scanWorker?.stop(); });

  function scanPdf(pdfBase64: string) {
    return scanWorker.fetch('/scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64 }),
    });
  }

  it('flags the statement with its 20 transactions', async () => {
    const res = await scanPdf(fixture('statement.pdf'));
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { error: 'statement', transactions: 20 });
  });

  it('sends the invoice text to the model and returns its amount', async () => {
    const res = await scanPdf(fixture('invoice.pdf'));
    assert.equal(res.status, 200);
    assert.equal((await res.json() as { amount: number }).amount, 432.4);
    assert.match(await (await scanWorker.fetch('/__last_prompt')).text(), /Total due CHF 432\.40/);
  });

  it('says a broken PDF could not be read', async () => {
    const res = await scanPdf(Buffer.from('%PDF-1.4 broken bytes').toString('base64'));
    assert.equal(res.status, 422);
    assert.equal((await res.json() as { error: string }).error, 'pdf_unreadable');
  });
});
