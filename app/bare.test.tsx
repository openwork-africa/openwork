import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { until } from "@openwork/store/testing";
import { labelled } from "@openwork/ui/testing";
import { barePlugins } from "./bare.ts";
import { bootProduct, click, errorNotices, flush } from "./harness.tsx";
import { openPlugins } from "./product.ts";

const ids = (plugins: typeof openPlugins): string[] => plugins.map((plugin) => plugin.id);

async function send(container: HTMLElement, words: string): Promise<void> {
  const field = container.querySelector("[contenteditable]") as HTMLElement;
  field.textContent = words;
  await act(() => void field.dispatchEvent(new InputEvent("input", { bubbles: true })));
  await click(labelled(container, "Send"));
}

Deno.test("the bare product is the window, text and rooms: nothing else is in its list", () => {
  assertEquals(ids(barePlugins), ["rooms", "text"]);
  assertEquals(ids(openPlugins), ["rooms", "text", "profile", "circle", "panel", "ai"]);
});

Deno.test("bare: boots, starts a room from the window, sends a message and shows it; no list, no panel", async () => {
  const app = await bootProduct(barePlugins);
  const { container } = app;
  assertEquals(app.shell.product.problems, []);
  assert(container.querySelector(".convo-shell"), "the frame");
  assert(app.path().startsWith("/c/"), "the app opened straight into a new room");
  assertEquals((await until(app.store.rooms())).length, 1);
  await send(container, "Hello **bare**");
  const message = container.querySelector('[id^="msg-"]');
  assert(message?.textContent?.includes("Hello bare"), "in the message list");
  assert(message?.querySelector("strong"), "the text plugin drew Markdown");
  assertEquals(container.querySelector(".convo-circle"), null, "no conversation list");
  assertEquals(labelled(container, "Conversations"), null);
  assertEquals(container.querySelector(".contact-panel"), null, "no contact panel");
  assertEquals(container.querySelector(".contact-hero-body"), null, "a plugin that is not in the list does not appear");
  assertEquals(errorNotices(), []);
  await app.stop();
});

Deno.test("bare: with a room on the device the window opens the most recent one, and receives a message from the store", async () => {
  const app = await bootProduct(barePlugins);
  await app.store.createRoom("Older");
  app.clock.tick(10);
  const newer = await app.store.createRoom("Newer");
  await act(() => app.shell.router.navigate("/"));
  await flush();
  assertEquals(app.path(), `/c/${newer.id}`);
  await act(async () => void (await app.store.send(newer.id, "arrived")));
  await flush();
  assert((app.container.querySelector('[id^="msg-"]')?.textContent ?? "").includes("arrived"), "a received message is in the list");
  assertEquals(app.container.querySelector(".convo-circle"), null);
  await app.stop();
});

Deno.test("bare: with the rooms plugin out too there is still a window, and no way to start a room", async () => {
  const app = await bootProduct(barePlugins.filter((plugin) => plugin.id !== "rooms"));
  assertEquals(app.shell.product.problems, []);
  assertEquals(app.container.querySelector(".convo-loading button"), null);
  assertEquals(app.container.querySelector(".convo-circle"), null);
  await app.stop();
});

Deno.test("full: the default product still draws the list, the window and the panel", async () => {
  const app = await bootProduct(openPlugins);
  assertEquals(app.shell.product.problems, []);
  const room = await app.store.createRoom("Notes");
  await act(() => app.shell.router.navigate(`/c/${room.id}`));
  await flush();
  assert(app.container.querySelector(".convo-shell nav.convo-circle"), "the list");
  assert(app.container.querySelector("[contenteditable]"), "the window's composer");
  assert(app.container.querySelector(".contact-panel > .profile-cover"), "the panel with the profile");
  assertEquals(errorNotices(), []);
  await app.stop();
});
