import { assert, assertEquals } from "@std/assert";
import { act, type ReactElement } from "react";
import {
  composerAction,
  composerAddMenu,
  composerBeforeSend,
  composerTray,
  contribute,
  definePlugin,
  type Plugin,
  trailAction,
  trailBody,
  trailExtra,
} from "@openwork/kit";
import { ConversationWindow } from "./ConversationWindow.tsx";
import { copy } from "./copy.ts";
import { flush, labelled, mount, press, rig, sendButton, trailOf, write } from "./testing.tsx";

const settle = () => flush(200);
const textOf = (container: HTMLElement) => container.textContent ?? "";
const plugin = (contributes: Plugin["contributes"]): Plugin => definePlugin({ id: "fake", version: "1.0.0", contributes });

async function open(plugins: Plugin[], words: string[] = []) {
  const device = rig(plugins);
  const room = await device.store.createRoom("Notes");
  for (const content of words) await device.store.send(room.id, content);
  const { container, unmount } = await mount(device.view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  return { ...device, room, container, unmount };
}

const body = (id: string, order: number, matches: (content: string) => boolean, label: string, when?: () => boolean) =>
  contribute(trailBody, { id, order, when, kind: id, matches: (message) => matches(message.content), render: (message) => <p data-body={id}>{`${label}:${message.content}`}</p> });

Deno.test("trail.body: the first match by order draws the message, a message nothing matches is plain text", async () => {
  const { container, unmount } = await open(
    [plugin([
      body("late", 20, (content) => content.startsWith("a"), "late"),
      body("early", 10, (content) => content.startsWith("a"), "early"),
      body("off", 1, () => true, "off", () => false),
      body("only-b", 30, (content) => content.startsWith("b"), "b"),
    ])],
    ["apple", "banana", "cherry"],
  );
  const drawn = [...container.querySelectorAll("[data-body]")].map((element) => element.textContent);
  assertEquals(drawn, ["early:apple", "b:banana"]);
  assert(textOf(container).includes("cherry"), "the fallback draws the words");
  assert(!textOf(container).includes("late:") && !textOf(container).includes("off:"));
  await unmount();
});

Deno.test("trail.extra draws under the body, in order", async () => {
  const extra = (id: string, order: number) => contribute(trailExtra, { id, order, render: (message) => <p data-extra={id}>{`${id}:${message.content}`}</p> });
  const { container, unmount } = await open([plugin([extra("b", 20), extra("a", 10)])], ["hello"]);
  assertEquals([...container.querySelectorAll("[data-extra]")].map((element) => element.textContent), ["a:hello", "b:hello"]);
  await unmount();
});

const openMenu = async (container: HTMLElement) => {
  const message = container.querySelector('[id^="msg-"]') as HTMLElement;
  await act(() => void message.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
  await flush();
};

Deno.test("trail.action items fill the bubble's menu, only where appliesTo allows, and run on the message", async () => {
  const ran: string[] = [];
  const action = (id: string, order: number, appliesTo?: (content: string) => boolean) =>
    contribute(trailAction, { id, order, label: id, icon: null, appliesTo: appliesTo && ((message) => appliesTo(message.content)), run: (message) => void ran.push(`${id}:${message.content}`) });
  const { container, unmount } = await open([plugin([action("second", 20), action("first", 10), action("never", 5, () => false)])], ["hello"]);
  await openMenu(container);
  const items = [...document.querySelectorAll('[role="menuitem"]')];
  assertEquals(items.map((item) => item.textContent), ["first", "second"]);
  await press(items[0]);
  assertEquals(ran, ["first:hello"]);
  await unmount();
});

Deno.test("with no trail.action there is no menu around the message", async () => {
  const { container, unmount } = await open([], ["hello"]);
  await openMenu(container);
  assertEquals(document.querySelectorAll('[role="menuitem"]').length, 0);
  await unmount();
});

Deno.test("composer.beforeSend runs in order and can change the draft", async () => {
  const handler = (id: string, order: number, change: (text: string) => string) =>
    contribute(composerBeforeSend, { id, order, handle: (draft, _ctx, next) => next({ ...draft, text: change(draft.text) }) });
  const { container, store, room, unmount } = await open([plugin([handler("b", 20, (text) => `${text}!`), handler("a", 10, (text) => text.toUpperCase())])]);
  await write(container, "hi");
  await press(sendButton(container));
  await settle();
  assertEquals((await trailOf(store, room.id)).map((message) => message.content), ["HI!"]);
  await unmount();
});

Deno.test("composer.beforeSend answering null stops the send and keeps what was written", async () => {
  const stop = contribute(composerBeforeSend, { id: "ask", order: 1, handle: () => Promise.resolve(null) });
  const { container, store, room, unmount } = await open([plugin([stop])]);
  await write(container, "hi");
  await press(sendButton(container));
  await settle();
  assertEquals(await trailOf(store, room.id), []);
  assertEquals(container.querySelector("[contenteditable]")!.textContent, "hi");
  await unmount();
});

Deno.test("composer.action puts buttons at the start or the end, and they run", async () => {
  const ran: string[] = [];
  const action = (id: string, placement: "start" | "end") => contribute(composerAction, { id, order: 1, label: id, icon: null, placement, run: () => void ran.push(id) });
  const { container, unmount } = await open([plugin([action("attach", "start"), action("mic", "end")])]);
  await press(labelled(container, "attach"));
  await press(labelled(container, "mic"));
  assertEquals(ran, ["attach", "mic"]);
  await unmount();
});

const tray = (id: string, order: number) =>
  contribute(composerTray, { id, order, render: (_ctx, close): ReactElement => <button type="button" aria-label={`close ${id}`} onClick={close}>{`${id} tray`}</button> });

Deno.test("composer.addMenu: no items, no + button; with items the + opens the menu, a row opens its tray, and Escape closes it", async () => {
  const none = await open([plugin([tray("emoji", 1)])]);
  assertEquals(labelled(none.container, copy.addToConversation), null);
  await none.unmount();

  const ran: string[] = [];
  const item = (id: string, order: number, extra: object) => contribute(composerAddMenu, { id, order, label: id, icon: null, ...extra });
  const { container, unmount } = await open([plugin([tray("emoji", 1), item("later", 20, { run: () => void ran.push("later") }), item("emoji", 10, { opens: "emoji" })])]);
  await press(labelled(container, copy.addToConversation));
  const rows = [...container.querySelectorAll('[aria-label="Add to this conversation"] li, [aria-label="Add to this conversation"] [role="listitem"]')].map((row) => row.textContent);
  assertEquals(rows.length, 2);
  assert(rows[0]?.startsWith("emoji") && rows[1]?.startsWith("later"));
  await press([...container.querySelectorAll("button")].find((button) => button.textContent?.startsWith("emoji")) ?? null);
  assert(textOf(container).includes("emoji tray"));
  const field = container.querySelector("[contenteditable]") as HTMLElement;
  await act(() => void field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  assert(!textOf(container).includes("emoji tray"), "Escape closed the tray");
  await unmount();
});
