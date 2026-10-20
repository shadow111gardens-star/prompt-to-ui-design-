export type WorkspaceKeyStatus = { configured: boolean; suffix?: string };

/** A single effect owns this request, including response-body consumption. */
export function loadWorkspaceKey(
  callbacks: {
    onSuccess: (status: WorkspaceKeyStatus) => void;
    onError: (error: unknown) => void;
    reportError: (error: unknown) => void;
  },
  fetcher: typeof fetch = fetch,
) {
  const controller = new AbortController();
  let active = true;
  let pending = false;
  const task = Promise.resolve().then(async () => {
    // Strict Mode can disconnect this effect before its first microtask.
    if (!active) return;
    pending = true;
    try {
      const response = await fetcher('/api/workspace-key', { signal: controller.signal, cache: 'no-store' });
      if (!active) return;
      const body: unknown = await response.json();
      if (!active) return;
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Unable to load API key';
        throw new Error(message);
      }
      if (!body || typeof body !== 'object' || !('configured' in body) || typeof body.configured !== 'boolean') throw new Error('Invalid API key status response.');
      callbacks.onSuccess({ configured: body.configured, suffix: 'suffix' in body && typeof body.suffix === 'string' ? body.suffix : undefined });
    } catch (error) {
      const abort = error !== null && typeof error === 'object' && 'name' in error && error.name === 'AbortError';
      if (controller.signal.aborted && (error === controller.signal.reason || abort)) return;
      callbacks.reportError(error);
      if (active) callbacks.onError(error);
    } finally { pending = false; }
  });
  return {
    done: task.catch(callbacks.reportError),
    cancel() {
      active = false;
      // Do not abort a consumed response: framework observers may still own its signal.
      if (pending && !controller.signal.aborted) controller.abort();
    },
  };
}
