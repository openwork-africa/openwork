import { act } from "react";
import { assert, assertEquals } from "@std/assert";
import { copy } from "@openwork/shell";
import { bootProduct, click, flush } from "./harness.tsx";
import { openPlugins } from "./product.ts";

const DESKTOP = (query: string) => ({ matches: !query.includes("max-width") });
const PHONE = (query: string) => ({ matches: query.includes("max-width") });

async function withScreen<T>(matches: (query: string) => { matches: boolean }, run: () => Promise<T>): Promise<T> {
  const target = globalThis as unknown as { matchMedia?: unknown };
  const before = target.matchMedia;
  target.matchMedia = matches;
  try {
    return await run();
  } finally {
    target.matchMedia = before;
  }
}

Deno.test("desktop: / replaces itself with the most recently active room", () =>
  withScreen(DESKTOP, async () => {
    const app = await bootProduct(openPlugins, "/c/elsewhere");
    await app.store.createRoom("Older");
    app.clock.tick(10);
    const newer = await app.store.createRoom("Newer");
    await act(() => app.shell.router.navigate("/"));
    await flush();
    assertEquals(app.path(), `/c/${newer.id}`);
    assertEquals(app.history, ["/c/elsewhere", `/c/${newer.id}`], "replaced, not pushed");
    await app.stop();
  }));

Deno.test("desktop: with no rooms / stays and the window offers to start one", () =>
  withScreen(DESKTOP, async () => {
    const app = await bootProduct(openPlugins, "/");
    assertEquals(app.path(), "/");
    const frame = app.container.querySelector(".convo-loading");
    assert(frame?.textContent?.includes(copy.noRoomsTitle));
    await click(frame!.querySelector("button"));
    assert(app.path().startsWith("/c/"), app.path());
    await app.stop();
  }));

Deno.test("phone: / stays with the list drawer open, even with rooms", () =>
  withScreen(PHONE, async () => {
    const app = await bootProduct(openPlugins, "/");
    await app.store.createRoom("Older");
    await flush();
    assertEquals(app.path(), "/");
    assert(app.container.querySelector(".convo-shell")?.classList.contains("is-list-open"));
    assert(app.container.querySelector(".convo-loading")?.textContent?.includes(copy.noRoomTitle));
    await app.stop();
  }));
