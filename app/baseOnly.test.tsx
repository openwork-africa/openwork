import { assert, assertEquals } from "@std/assert";
import { copy } from "@openwork/shell";
import { bootProduct, errorNotices, flush } from "./harness.tsx";

const labelled = (container: HTMLElement, label: string): HTMLElement | null => container.querySelector(`[aria-label="${label}"]`);

Deno.test("base only: zero plugins boot, draw the frame's empty states and raise no error notice", async () => {
  const app = await bootProduct([]);
  assertEquals(app.shell.product.problems, []);
  assert(app.container.querySelector(".convo-shell"), "the frame");
  assert(app.container.querySelector('svg[aria-label="Openwork"]'), "the logo where no room is open");
  assert(app.container.textContent?.includes(copy.circleEmptyTitle), "the empty circle");
  assertEquals(labelled(app.container, "New"), null, "no New button without rooms");
  await app.shell.router.navigate("/c/some-room");
  await flush();
  assertEquals(errorNotices(), []);
  await app.stop();
});
