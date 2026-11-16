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
    const app = await bootProduct(openPlugins, "/");
    await app.store.createRoom("Older");
    await flush();
    app.clock.tick(10);
    const newer = await app.store.createRoom("Newer");
    await act(() => app.shell.router.navigate("/"));
    await flush();
    assertEquals(app.path(), `/c/${newer.id}`);
    assertEquals(app.history.includes("/"), false, "home was replaced, never kept");
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

Deno.test("phone: / opens the latest room with drawers closed", () =>
  withScreen(PHONE, async () => {
    const app = await bootProduct(openPlugins, "/");
    await app.store.createRoom("Older");
    await flush();
    assert(app.path().startsWith("/c/"));
    assert(!app.container.querySelector(".convo-shell")?.classList.contains("is-list-open"));
    await app.stop();
  }));

Deno.test("zero rooms: exactly one empty card, in the window with the Start button; the circle has none and no New", () =>
  withScreen(DESKTOP, async () => {
    const app = await bootProduct(openPlugins, "/");
    await flush();
    assertEquals(app.container.querySelectorAll(".empty-card").length, 1);
    const card = app.container.querySelector(".convo-loading .conversation-empty-card > .empty-card");
    assert(card?.textContent?.includes(copy.noRoomsTitle));
    assert(card?.querySelector("button"), "the Start button");
    assert(app.container.querySelector(".convo-loading.is-empty"), "the empty frame has no dividers");
    const circle = app.container.querySelector(".convo-circle");
    assertEquals(circle?.querySelector(".empty-card"), null);
    assertEquals(circle?.querySelector('button[aria-label="New"]'), null, "New waits for the first room");
    await app.stop();
  }));

Deno.test("phone: with zero rooms the window and its card show, not a blank list drawer", () =>
  withScreen(PHONE, async () => {
    const app = await bootProduct(openPlugins, "/");
    await flush();
    assert(!app.container.querySelector(".convo-shell")?.classList.contains("is-list-open"));
    assert(app.container.querySelector(".convo-loading .empty-card"));
    await app.stop();
  }));
