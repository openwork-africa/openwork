import type { Notices } from "@openwork/kit";
import { copy } from "./copy.ts";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export interface WorkerEnv {
  container: ServiceWorkerContainer;
  reload: () => void;
  notices: Pick<Notices, "notify" | "dismiss">;
  enabled?: boolean;
}

export const browserWorkerEnv = (notices: WorkerEnv["notices"]): WorkerEnv | undefined =>
  "serviceWorker" in globalThis.navigator ? { container: globalThis.navigator.serviceWorker, reload: () => globalThis.location.reload(), notices } : undefined;

const ignoreOffline = (): void => {};

/**
 * Registers `/sw.js`. A new version installs in the background and waits; the person is told once ("New version
 * ready.") and the Update button is what lets it take over, and only then does the page reload. Never forced.
 */
export function startServiceWorker(env: WorkerEnv | undefined): () => void {
  if (!env || env.enabled === false) return () => {};
  const { container, reload, notices } = env;
  let waiting: ServiceWorker | undefined;
  let noticeId: string | undefined;
  let updating = false;
  let registration: ServiceWorkerRegistration | undefined;

  const update = (): void => {
    if (!waiting) return;
    updating = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  const announce = (worker: ServiceWorker): void => {
    waiting = worker;
    if (noticeId !== undefined) notices.dismiss(noticeId);
    noticeId = notices.notify(copy.updateReady, { status: "info", holdMs: 0, action: { label: copy.update, run: update } });
  };

  const onControllerChange = (): void => {
    if (updating) reload();
  };
  container.addEventListener("controllerchange", onControllerChange);

  const check = (): void => void registration?.update().catch(ignoreOffline);
  const onVisible = (): void => {
    if (globalThis.document?.visibilityState === "visible") check();
  };

  void container.register("/sw.js", { updateViaCache: "none" }).then((registered) => {
    registration = registered;
    if (registered.waiting && container.controller) announce(registered.waiting);
    registered.addEventListener("updatefound", () => {
      const worker = registered.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && container.controller) announce(worker);
      });
    });
  }).catch(ignoreOffline);

  globalThis.document?.addEventListener("visibilitychange", onVisible);
  const interval = setInterval(check, CHECK_INTERVAL_MS);
  return () => {
    container.removeEventListener("controllerchange", onControllerChange);
    globalThis.document?.removeEventListener("visibilitychange", onVisible);
    clearInterval(interval);
  };
}
