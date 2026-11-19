import { act } from "react";
import { assert, assertEquals } from "@std/assert";
import { rooms } from "@openwork/plugin-rooms";
import { text } from "@openwork/plugin-text";
import { until } from "@openwork/store/testing";
import { bootProduct, flush } from "./harness.tsx";
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

Deno.test("desktop: with no rooms the app opens into one new room, drawn in the list", () =>
  withScreen(DESKTOP, async () => {
    const app = await bootProduct(openPlugins, "/");
    await flush();
    assert(app.path().startsWith("/c/"), app.path());
    assertEquals(app.container.querySelector(".convo-loading.is-empty"), null);
    assertEquals((await until(app.store.rooms())).length, 1, "exactly one room");
    await app.stop();
  }));

Deno.test("desktop: an existing room is opened as before and no second room is made", () =>
  withScreen(DESKTOP, async () => {
    let room = "";
    const app = await bootProduct(openPlugins, "/", async (store) => void (room = (await store.createRoom("Mine")).id));
    await flush();
    assertEquals(app.path(), `/c/${room}`);
    assertEquals((await until(app.store.rooms())).length, 1);
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

Deno.test("zero rooms: no empty card and no Start button, the first room is already open", () =>
  withScreen(DESKTOP, async () => {
    const app = await bootProduct(openPlugins, "/");
    await flush();
    assertEquals(app.container.querySelectorAll(".empty-card .convo-loading button").length, 0);
    assertEquals(app.container.querySelector(".convo-loading.is-empty"), null);
    assert(app.path().startsWith("/c/"));
    await app.stop();
  }));

Deno.test("phone: with zero rooms the window opens in a new room, not a blank list drawer", () =>
  withScreen(PHONE, async () => {
    const app = await bootProduct(openPlugins, "/");
    await flush();
    assert(!app.container.querySelector(".convo-shell")?.classList.contains("is-list-open"));
    assert(app.path().startsWith("/c/"));
    await app.stop();
  }));

Deno.test("a device with no rooms opens into the product's default room, with its members already in it; without the option the room has none", () =>
  withScreen(DESKTOP, async () => {
    const operator = { id: "fake-op", name: "Fake operator", type: "operator" };
    const given = await bootProduct([rooms({ defaultRoom: { members: [operator] } }), text], "/");
    await flush();
    const [room] = await until(given.store.rooms(), (list) => list.length === 1);
    assertEquals(room.members, [operator]);
    assertEquals((await until(given.store.trail(room.id))).map((line) => line.content), ["Fake operator was added"]);
    await given.stop();
    const plain = await bootProduct([rooms(), text], "/");
    await flush();
    const [bare] = await until(plain.store.rooms(), (list) => list.length === 1);
    assertEquals(bare.members, undefined);
    assertEquals((await until(plain.store.trail(bare.id), () => true)).length, 0);
    await plain.stop();
  }));
