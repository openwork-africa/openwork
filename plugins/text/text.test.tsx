import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { ConversationWindow } from "@openwork/conversation";
import { flush, mount, press, rig } from "@openwork/conversation/testing";
import { until } from "@openwork/store/testing";
import { text } from "./mod.ts";
import { trimmedOf } from "./trimmed.ts";

async function open(words: string[]) {
  const device = rig([text]);
  const room = await device.store.createRoom("Notes");
  for (const content of words) await device.store.send(room.id, content);
  const { container, unmount } = await mount(device.view(<ConversationWindow roomId={room.id} />, room.id));
  await flush();
  return { ...device, room, container, unmount };
}

const openMenu = async (container: HTMLElement) => {
  const message = container.querySelector('[id^="msg-"]') as HTMLElement;
  await act(() => void message.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
  await flush();
};

const itemNamed = (label: string) => [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent === label) ?? null;

Deno.test("the text plugin draws a message as Markdown", async () => {
  const { container, unmount } = await open(["Some **bold** words and a [link](https://example.com)"]);
  assertEquals(container.querySelector("strong")?.textContent, "bold");
  const link = container.querySelector("a");
  assertEquals([link?.textContent, link?.getAttribute("href")], ["link", "https://example.com"]);
  await unmount();
});

Deno.test("a long message shows its start with Show more", async () => {
  const long = "word ".repeat(300);
  assert(trimmedOf(long) !== null && trimmedOf("short") === null);
  const { container, unmount } = await open([long]);
  const more = [...container.querySelectorAll("button")].find((button) => button.textContent === "Show more");
  assert(more);
  await press(more!);
  assert([...container.querySelectorAll("button")].some((button) => button.textContent === "Show less"));
  await unmount();
});

Deno.test("Copy in the message menu puts its words on the clipboard", async () => {
  const written: string[] = [];
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: { writeText: (words: string) => (written.push(words), Promise.resolve()) },
  });
  const { container, unmount } = await open(["copy me"]);
  await openMenu(container);
  assertEquals(itemNamed("Error details"), null);
  await press(itemNamed("Copy"));
  assertEquals(written, ["copy me"]);
  await unmount();
});

Deno.test("a failed message's menu has Copy and Retry, and no generic Error details item", async () => {
  const { container, store, room, transport, syncNow, unmount } = await open(["hello"]);
  transport.refuse = () => "Too long.";
  await syncNow();
  await until(store.trail(room.id), (trail) => trail?.[0]?.state === "failed");
  await openMenu(container);
  assert(itemNamed("Copy") && itemNamed("Retry"));
  assertEquals(itemNamed("Error details"), null);
  await press(itemNamed("Retry"));
  transport.refuse = undefined;
  await syncNow();
  await until(store.trail(room.id), (trail) => trail?.[0]?.state === "sent");
  await unmount();
});
