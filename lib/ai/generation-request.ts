/** One parsed body per Request. Shared by authorization, duplicate guard,
 * and image context; the endpoint retains its original body stream. */
export type GenerationBody = FormData | Record<string, unknown>;
const bodies = new WeakMap<Request, Promise<GenerationBody>>();
export class GenerationRequestError extends Error {
  constructor(public readonly reason: 'body_unavailable' | 'invalid_multipart' | 'invalid_json' | 'invalid_payload', message: string) {
    super(message); this.name = 'GenerationRequestError';
  }
}
export function readGenerationBody(request: Request): Promise<GenerationBody> {
  const existing = bodies.get(request); if (existing) return existing;
  const parsed = (async (): Promise<GenerationBody> => {
    if (request.bodyUsed || request.body?.locked) throw new GenerationRequestError('body_unavailable', 'The generation request body is unavailable. Please send the request again.');
    let copy: Request;
    try { copy = request.clone(); } catch { throw new GenerationRequestError('body_unavailable', 'The generation request body is unavailable. Please send the request again.'); }
    if (request.headers.get('content-type')?.toLowerCase().includes('multipart/form-data')) {
      try { return await copy.formData(); }
      catch { throw new GenerationRequestError('invalid_multipart', 'Could not read the generation form or image upload. Please retry the request.'); }
    }
    let body: unknown;
    try { body = await copy.json(); }
    catch { throw new GenerationRequestError('invalid_json', 'Could not read the generation JSON. Please resend the request.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GenerationRequestError('invalid_payload', 'The generation request must contain a JSON object.');
    return body as Record<string, unknown>;
  })();
  bodies.set(request, parsed); return parsed;
}
export function generationRequestFailure(request: Request, error: unknown, stage: 'body' | 'fingerprint'): Response {
  const known = error instanceof GenerationRequestError;
  // Never log the request body, uploaded content, raw exception, UID or key.
  console.warn(JSON.stringify({ event: 'generation_request_rejected', route: new URL(request.url).pathname,
    stage, reason: known ? error.reason : 'fingerprint_failed', requestAborted: request.signal.aborted }));
  return Response.json({ error: known ? error.message : 'Could not prepare this generation request. Please resend it.',
    code: known ? error.reason : 'fingerprint_failed' }, { status: 400 });
}
