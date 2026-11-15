import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { rooms } from "@openwork/plugin-rooms";
import { text } from "@openwork/plugin-text";
import { bootProduct, type Booted, click, errorNotices, flush } from "../../app/harness.tsx";
import { greeting } from "./greeting.tsx";
import { polite } from "./polite.tsx";
import { shout } from "./shout.tsx";

const messages = (app: Booted): string[] => [...app.container.querySelectorAll('[id^="msg-"]')].map((node) => node.textContent ?? "");

async function openRoom(app: Booted, ...words: string[]): Promise<string> {
  const room = await app.store.createRoom("Notes");
  for (const content of words) await app.store.send(room.id, content);
  app.shell.router.navigate(`/c/${room.id}`);
  await flush();
  return room.id;
}

Deno.test("shout: its menu item sends an uppercased copy of the message", async () => {
  const app = await bootProduct([rooms(), text, shout]);
  await openRoom(app, "hello there");
  const message = app.container.querySelector('[id^="msg-"]') as HTMLElement;
  await act(() => void message.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
  await flush();
  const items = [...document.querySelectorAll('[role="menuitem"]')];
  const shoutItem = items.find((item) => item.textContent === "Shout");
  assert(shoutItem, "Shout is in the message menu");
  await click(shoutItem);
  const shown = messages(app);
  assertEquals(shown.length, 2);
  assert(shown[0].includes("hello there") && shown[1].includes("HELLO THERE"));
  assertEquals(errorNotices(), []);
  await app.stop();
});

Deno.test("greeting and polite: a plugin opens a slot and another one fills it", async () => {
  const app = await bootProduct([rooms(), text, greeting, polite]);
  assertEquals(app.shell.product.problems, []);
  await openRoom(app, "hello");
  assert(messages(app)[0].includes("Thank you for your message."), "the line from polite is drawn by greeting");
  await app.stop();
});

Deno.test("polite without greeting is skipped with a notice and the rest still boots", async () => {
  const app = await bootProduct([rooms(), text, polite]);
  assertEquals(app.shell.product.problems.length, 1);
  assert(app.shell.product.problems[0].includes("polite") && app.shell.product.problems[0].includes("greeting"));
  await openRoom(app, "hello");
  assertEquals(messages(app).length, 1);
  assert(!messages(app)[0].includes("Thank you"));
  await app.stop();
});

Deno.test("greeting alone draws nothing, an empty slot is not an error", async () => {
  const app = await bootProduct([rooms(), text, greeting]);
  await openRoom(app, "hello");
  assert(!messages(app)[0].includes("Thank you"));
  assertEquals(errorNotices(), []);
  await app.stop();
});
