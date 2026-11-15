import { dismiss, notify } from "@openwork/kit";
import { copy } from "./copy.ts";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export interface WorkerEnv {
  container: ServiceWorkerContainer;
  reload: () => void;
  enabled?: boolean;
}

const browserEnv = (): WorkerEnv | undefined =>
  "serviceWorker" in globalThis.navigator ? { container: globalThis.navigator.serviceWorker, reload: () => globalThis.location.reload() } : undefined;

/**
 * Registers `/sw.js`. A new version installs in the background and waits; the person is told once ("New version
 * ready.") and the Update button is what lets it take over, and only then does the page reload. Never forced.
 */
export function startServiceWorker(env: WorkerEnv | undefined = browserEnv()): () => void {
  if (!env || env.enabled === false) return () => {};
  const { container, reload } = env;
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
    if (noticeId !== undefined) dismiss(noticeId);
    noticeId = notify(copy.updateReady, { status: "info", holdMs: 0, action: { label: copy.update, run: update } });
  };

  const onControllerChange = (): void => {
    if (updating) reload();
  };
  container.addEventListener("controllerchange", onControllerChange);

  const check = (): void => void registration?.update().catch(() => {});
  const onVisible = (): void => {
    if (globalThis.document?.visibilityState === "visible") check();
  };

  void container.register("/sw.js", { updateViaCache: "none" }).then((reg) => {
    registration = reg;
    if (reg.waiting && container.controller) announce(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && container.controller) announce(worker);
      });
    });
  }).catch(() => {});

  globalThis.document?.addEventListener("visibilitychange", onVisible);
  const interval = setInterval(check, CHECK_INTERVAL_MS);
  return () => {
    container.removeEventListener("controllerchange", onControllerChange);
    globalThis.document?.removeEventListener("visibilitychange", onVisible);
    clearInterval(interval);
  };
}
