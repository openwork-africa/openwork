import type { Notices } from "@openwork/kit";
import { copy } from "./copy.ts";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const TAKEOVER_WAIT_MS = 8_000;
const RELOAD_AT_KEY = "openwork:forced-reload-at";
const RELOAD_COOLDOWN_MS = 10_000;
const UPDATE_SCREEN_ID = "ow-update";

export const isStaleImportError = (error: unknown): boolean =>
  error instanceof Error &&
  /dynamically imported module|Importing a module script failed|error loading dynamically|failed to fetch dynamically imported module/i.test(error.message);

export interface WorkerEnv {
  container: ServiceWorkerContainer;
  reload: () => void;
  notices: Pick<Notices, "notify" | "dismiss">;
  enabled?: boolean;
  /** Test seam; production uses the documented eight-second takeover window. */
  takeoverWaitMs?: number;
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
  let takeover: ReturnType<typeof setTimeout> | undefined;

  const showUpdating = (): void => {
    if (typeof document === "undefined") return;
    if (document.getElementById(UPDATE_SCREEN_ID)) return;
    const screen = document.createElement("div");
    screen.id = UPDATE_SCREEN_ID;
    screen.className = "ow-boot";
    screen.dataset.update = "";
    screen.setAttribute("role", "status");
    screen.setAttribute("aria-label", copy.updating);
    screen.innerHTML = '<div class="ow-loader"><div class="ow-loader-mark"></div><div class="ow-loader-bar"></div></div>';
    document.body.append(screen);
  };

  const startClean = async (): Promise<void> => {
    try {
      const regs = await container.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("openwork-shell-")).map((key) => caches.delete(key)));
    } catch { /* A later worker activation can prune caches that could not be removed here. */ }
    reload();
  };

  const update = (): void => {
    showUpdating();
    updating = true;
    if (!waiting) {
      void startClean();
      return;
    }
    waiting.postMessage({ type: "SKIP_WAITING" });
    takeover ??= setTimeout(() => void startClean(), env.takeoverWaitMs ?? TAKEOVER_WAIT_MS);
  };

  const announce = (worker: ServiceWorker): void => {
    waiting = worker;
    if (noticeId !== undefined) notices.dismiss(noticeId);
    noticeId = notices.notify(copy.updateReady, { status: "info", holdMs: 0, action: { label: copy.update, run: update } });
  };

  const onControllerChange = (): void => {
    if (updating) {
      if (takeover) clearTimeout(takeover);
      reload();
    }
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
    if (takeover) clearTimeout(takeover);
  };
}

/** Recover a lazy import from a build that has already been replaced, at most once per cooldown window. */
export function recoverFromStaleBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_AT_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  } catch { /* storage may be unavailable; the update path still recovers the page */ }
  globalThis.location.reload();
  return true;
}
