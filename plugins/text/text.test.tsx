import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { getNotices } from "@openwork/kit";
import { ConversationWindow } from "@openwork/conversation";
import { flush, labelled, mount, press, rig, trailOf } from "@openwork/conversation/testing";
import { text } from "./mod.ts";
import { trimmedOf } from "./trimmed.ts";

const settle = () => flush(200);

async function open(words: string[]) {
  const device = rig([text]);
  const room = await device.store.createRoom("Notes");
  for (const content of words) await device.store.send(room.id, content);
  const { container, unmount } = await mount(device.view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
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
  Object.defineProperty(globalThis.navigator, "clipboard", { configurable: true, value: { writeText: (words: string) => (written.push(words), Promise.resolve()) } });
  const { container, unmount } = await open(["copy me"]);
  await openMenu(container);
  assertEquals(itemNamed("Error details"), null, "not offered on a message that went through");
  await press(itemNamed("Copy"));
  assertEquals(written, ["copy me"]);
  await unmount();
});

Deno.test("a failed message offers Error details, which says why in a notice, beside Send again", async () => {
  const { container, store, room, unmount } = await open(["hello"]);
  const [row] = (await store.journal.pending()).filter((item) => item.kind === "message");
  await store.journal.fail(row, "Too long.");
  await settle();
  await openMenu(container);
  assert(itemNamed("Send again") && itemNamed("Copy"));
  await press(itemNamed("Error details"));
  assert(getNotices().some((notice) => notice.status === "error" && notice.text.includes("could not be delivered")));
  await press(labelled(container, "Send again"));
  await settle();
  assertEquals((await trailOf(store, room.id))[0].state, "sending");
  await unmount();
});
