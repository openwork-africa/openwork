import { assertEquals } from "@std/assert";
import { createNotices } from "@openwork/kit";
import { copy } from "./copy.ts";
import { isStaleImportError, startServiceWorker } from "./serviceWorker.ts";

Deno.test("lazy import errors are recognized for stale-build recovery", () => {
  assertEquals(isStaleImportError(new TypeError("Failed to fetch dynamically imported module")), true);
  assertEquals(isStaleImportError(new Error("ordinary render error")), false);
});

class FakeWorker extends EventTarget {
  state = "installed";
  posted: unknown[] = [];
  postMessage(message: unknown): void {
    this.posted.push(message);
  }
}

function fakeContainer(waiting: FakeWorker) {
  const container = new EventTarget() as EventTarget & Record<string, unknown>;
  const registration = Object.assign(new EventTarget(), { waiting, installing: null, update: () => Promise.resolve() });
  container.controller = {};
  container.register = () => Promise.resolve(registration);
  return container as unknown as ServiceWorkerContainer & EventTarget;
}

Deno.test("a waiting version is told once as a notice with an Update action, and nothing reloads until it is pressed", async () => {
  const kitNotices = createNotices();
  const waiting = new FakeWorker();
  const container = fakeContainer(waiting);
  let reloads = 0;
  const stop = startServiceWorker({ container, reload: () => reloads++, notices: kitNotices });
  await new Promise((done) => setTimeout(done, 5));
  const notices = kitNotices.list();
  assertEquals(notices.map((notice) => [notice.text, notice.action?.label]), [[copy.updateReady, copy.update]]);

  container.dispatchEvent(new Event("controllerchange"));
  assertEquals([reloads, waiting.posted], [0, []]);

  notices[0].action?.run();
  assertEquals(waiting.posted, [{ type: "SKIP_WAITING" }]);
  container.dispatchEvent(new Event("controllerchange"));
  assertEquals(reloads, 1);
  assertEquals(kitNotices.list(), []);
  stop();
});

Deno.test("a disabled worker registers nothing", () => {
  let registered = 0;
  const container = { register: () => (registered++, Promise.resolve()) } as unknown as ServiceWorkerContainer;
  startServiceWorker({ container, reload: () => {}, notices: createNotices(), enabled: false })();
  assertEquals(registered, 0);
});

Deno.test("a waiting worker that never takes control falls back to a clean start after the takeover window", async () => {
  const notices = createNotices();
  const container = fakeContainer(new FakeWorker());
  let unregistered = 0;
  (container as unknown as { getRegistrations: () => Promise<ServiceWorkerRegistration[]> }).getRegistrations = () =>
    Promise.resolve([Object.assign({}, { unregister: () => (unregistered++, Promise.resolve(true)) }) as ServiceWorkerRegistration]);
  let reloads = 0;
  const stop = startServiceWorker({ container, reload: () => reloads++, notices, takeoverWaitMs: 1 });
  await new Promise((done) => setTimeout(done, 5));
  notices.list()[0]?.action?.run();
  await new Promise((done) => setTimeout(done, 50));
  assertEquals([unregistered, reloads], [1, 1]);
  stop();
});
