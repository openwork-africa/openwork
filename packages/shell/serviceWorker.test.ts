import { assertEquals } from "@std/assert";
import { dismiss, getNotices } from "@openwork/kit";
import { copy } from "./copy.ts";
import { startServiceWorker } from "./serviceWorker.ts";

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
  getNotices().forEach((notice) => dismiss(notice.id));
  const waiting = new FakeWorker();
  const container = fakeContainer(waiting);
  let reloads = 0;
  const stop = startServiceWorker({ container, reload: () => reloads++ });
  await new Promise((done) => setTimeout(done, 5));
  const notices = getNotices();
  assertEquals(notices.map((notice) => [notice.text, notice.action?.label]), [[copy.updateReady, copy.update]]);

  container.dispatchEvent(new Event("controllerchange"));
  assertEquals([reloads, waiting.posted], [0, []]);

  notices[0].action?.run();
  assertEquals(waiting.posted, [{ type: "SKIP_WAITING" }]);
  container.dispatchEvent(new Event("controllerchange"));
  assertEquals(reloads, 1);
  assertEquals(getNotices(), []);
  stop();
});

Deno.test("a disabled worker registers nothing", () => {
  let registered = 0;
  const container = { register: () => (registered++, Promise.resolve()) } as unknown as ServiceWorkerContainer;
  startServiceWorker({ container, reload: () => {}, enabled: false })();
  assertEquals(registered, 0);
});
