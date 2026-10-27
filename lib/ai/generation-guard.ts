import { createHash } from 'node:crypto';
import { geminiConfiguration } from '@/lib/ai/gemini';
const inFlight = new Set<string>();
async function fingerprint(request: Request) {
  const copy = request.clone();
  let body: unknown;
  if (copy.headers.get('content-type')?.includes('multipart/form-data')) {
    const entries: [string, string][] = [];
    for (const [name, value] of await copy.formData()) {
      if (name === 'streamId') continue;
      entries.push([name, typeof value === 'string' ? value : createHash('sha256').update(new Uint8Array(await value.arrayBuffer())).digest('hex')]);
    }
    body = entries.sort(([a], [b]) => a.localeCompare(b));
  } else {
    const json = await copy.json();
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error();
    body = Object.fromEntries(Object.entries(json).filter(([name]) => name !== 'streamId').sort(([a], [b]) => a.localeCompare(b)));
  }
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}
export async function withFixedGeneration(request: Request, uid: string, handler: () => Promise<Response>) {
  try { geminiConfiguration(); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Gemini configuration is unavailable.' }, { status: 503 }); }
  let hash: string;
  try { hash = await fingerprint(request); } catch { return Response.json({ error: 'Invalid generation request.' }, { status: 400 }); }
  const key = `${uid}:${new URL(request.url).pathname}:${hash}`;
  if (inFlight.has(key)) return Response.json({ error: 'This generation is already running. Wait for it to finish.' }, { status: 409 });
  inFlight.add(key);
  const release = () => { inFlight.delete(key); };
  try {
    const response = await handler();
    if (!response.body) { release(); return response; }
    const reader = response.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) { try { const next = await reader.read(); if (next.done) { release(); controller.close(); } else controller.enqueue(next.value); } catch (error) { release(); controller.error(error); } },
      async cancel(reason) { try { await reader.cancel(reason); } finally { release(); } },
    });
    return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) { release(); throw error; }
}
