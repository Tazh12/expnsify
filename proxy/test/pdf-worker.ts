// Test-only entry: bundled by wrangler with wrangler.toml's settings, so it runs the
// PDF code exactly as the deployed Worker does (same esbuild, same workerd).
import { extractPdfText } from '../src/pdf.ts';

export default {
  async fetch(req: Request): Promise<Response> {
    return Response.json(await extractPdfText(await req.text()));
  },
};
