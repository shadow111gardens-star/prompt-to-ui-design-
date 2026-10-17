import type { ExtendedStyleGuide } from "@/redux/slice/style-guide";

type Callbacks = {
  onSuccess: (guide: ExtendedStyleGuide) => void;
  onError: (error: unknown) => void;
  reportError: (error: unknown) => void;
};

/** One effect owns one controller. Cancellation never touches a replacement effect. */
export function loadProjectStyleGuide(
  projectId: string,
  callbacks: Callbacks,
  fetcher: typeof fetch = fetch,
) {
  const controller = new AbortController();
  let active = true;
  let pending = false;

  const done = Promise.resolve().then(async () => {
    // React Strict Mode disconnects the first effect synchronously. Do not start
    // a request for that discarded effect, or reuse its signal on the second run.
    if (!active) return;
    pending = true;
    try {
      const response = await fetcher(`/api/projects/${encodeURIComponent(projectId)}/style-guide`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!active) return;
      if (!response.ok) throw new Error(`Failed to load style guide (HTTP ${response.status}).`);
      const data: { styleGuide?: ExtendedStyleGuide | null } = await response.json();
      if (!active) return;
      if (!data.styleGuide) throw new Error("No design system was found for this project.");
      callbacks.onSuccess(data.styleGuide);
    } catch (error) {
      const isAbortError = typeof error === "object" && error !== null &&
        "name" in error && error.name === "AbortError";
      const expectedCancellation = controller.signal.aborted &&
        (error === controller.signal.reason || isAbortError);
      if (expectedCancellation) return;
      // Report real failures even if they race with unmount; never write stale UI state.
      callbacks.reportError(error);
      if (active) callbacks.onError(error);
    } finally {
      pending = false;
    }
  });

  // Own the entire async task, including callback failures, rather than leaving
  // an async effect task with a discarded rejection.
  const handled = done.catch(callbacks.reportError);
  return {
    done: handled,
    cancel() {
      active = false;
      // Aborting a fully consumed request is unnecessary and can reject work
      // attached to its signal after the page's fetch/json handler has finished.
      if (pending) controller.abort();
    },
  };
}
