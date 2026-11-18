import { assert, assertEquals } from "@std/assert";
import { copy } from "@openwork/shell";
import { labelled } from "@openwork/ui/testing";
import { bootProduct, errorNotices, flush } from "./harness.tsx";

Deno.test("base only: zero plugins boot, draw the frame's empty states and raise no error notice", async () => {
  const app = await bootProduct([]);
  assertEquals(app.shell.product.problems, []);
  assert(app.container.querySelector(".convo-shell"), "the frame");
  assert(app.container.querySelector(".convo-loading")?.textContent?.includes(copy.noRoomsTitle), "the empty state in the window frame");
  assertEquals(app.container.querySelector(".convo-loading button"), null, "no way to start one without the rooms plugin");
  assertEquals(app.container.querySelector(".convo-circle"), null, "no list without the circle plugin");
  assertEquals(labelled(app.container, "New"), null, "no New button without rooms");
  await app.shell.router.navigate("/c/some-room");
  await flush();
  assertEquals(errorNotices(), []);
  await app.stop();
});
