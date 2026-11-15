import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { definePlugin, contribute, windowBanner, windowEmpty, addressAddressee, addressAction } from "@openwork/kit";
import { makeCell } from "@openwork/store";
import { ConversationWindow } from "./ConversationWindow.tsx";
import { copy } from "./copy.ts";
import { flush, labelled, mount, press, rig, sendButton, trailOf, write } from "./testing.tsx";

const settle = () => flush(200);
const textOf = (container: HTMLElement) => container.textContent ?? "";

Deno.test("with no room open the window draws nothing", async () => {
  const { view } = rig();
  const { container, unmount } = await mount(view(<ConversationWindow />));
  assertEquals(container.innerHTML, "");
  await unmount();
});

Deno.test("with zero plugins an empty room shows Notes to self, and a sent message is plain text that goes from sending to sent", async () => {
  const { store, view } = rig();
  const room = await store.createRoom("Notes");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  assert(textOf(container).includes(copy.emptyTitle) && textOf(container).includes(copy.emptyDescription));
  assertEquals(container.querySelectorAll('[aria-label="Add to this conversation"]').length, 0, "no + without add-menu items");

  await write(container, "Lunch at one?");
  await press(sendButton(container));
  await settle();
  const sent = (await trailOf(store, room.id));
  assertEquals([sent.length, sent[0].content, sent[0].state], [1, "Lunch at one?", "sending"]);
  assert(textOf(container).includes("Lunch at one?") && !textOf(container).includes(copy.emptyTitle));
  assert(labelled(container, copy.saved), "one tick while sending");

  const [row] = (await store.journal.pending()).filter((item) => item.kind === "message");
  await store.journal.acknowledge(row);
  await settle();
  assertEquals((await trailOf(store, room.id))[0].state, "sent");
  assert(labelled(container, copy.received), "two ticks once the server has it");
  assertEquals(container.querySelectorAll("[contenteditable]")[0].textContent, "", "the field is cleared");
  await unmount();
});

Deno.test("a failed message says so and Send again puts it back to sending", async () => {
  const { store, view } = rig();
  const room = await store.createRoom("Notes");
  await store.send(room.id, "hello");
  const [row] = (await store.journal.pending()).filter((item) => item.kind === "message");
  await store.journal.fail(row, "Too long.");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  assertEquals((await trailOf(store, room.id))[0].state, "failed");
  assert(textOf(container).includes(copy.notDelivered));
  await press(labelled(container, copy.sendAgain));
  await settle();
  assertEquals((await trailOf(store, room.id))[0].state, "sending");
  assert(!textOf(container).includes(copy.notDelivered));
  await unmount();
});

Deno.test("the day separator labels the day, and nothing else is added between messages of one day", async () => {
  const { store, view } = rig();
  const room = await store.createRoom("Notes");
  await store.send(room.id, "one");
  await store.send(room.id, "two");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  assertEquals(container.querySelectorAll('[id^="day-"]').length, 1);
  assertEquals(container.querySelectorAll('[id^="msg-"]').length, 2);
  await unmount();
});

Deno.test("window.empty replaces the Notes to self card, the first match by order, and window.banner draws above the trail", async () => {
  const empty = (id: string, order: number, label: string, when?: () => boolean) => contribute(windowEmpty, { id, order, when, render: () => <p>{label}</p> });
  const plugin = definePlugin({
    id: "fake",
    version: "1.0.0",
    contributes: [
      empty("late", 20, "late card"),
      empty("hidden", 5, "hidden card", () => false),
      empty("early", 10, "early card"),
      contribute(windowBanner, { id: "network", order: 1, render: () => <p>network is down</p> }),
    ],
  });
  const { store, view } = rig([plugin]);
  const room = await store.createRoom("Notes");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  const text = textOf(container);
  assert(text.includes("early card") && !text.includes("late card") && !text.includes("hidden card") && !text.includes(copy.emptyTitle), text);
  assert(text.indexOf("network is down") < text.indexOf("early card"));
  await unmount();
});

Deno.test("only a Brain that says it is working shows the typing indicator, never any words", async () => {
  const working = makeCell(false);
  const { store, view } = rig([], { brain: { isWorking: () => working } });
  const room = await store.createRoom("Notes");
  await store.send(room.id, "hi");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  assertEquals(labelled(container, copy.typing), null);
  await act(() => working.set(true));
  await settle();
  assert(labelled(container, copy.typing));
  await act(() => working.set(false));
  await settle();
  assertEquals(labelled(container, copy.typing), null);
  await unmount();
});

Deno.test("the address bar shows the room name; its picture opens the panel; with no addressee there is no picker", async () => {
  const { store, view, navigated } = rig();
  const room = await store.createRoom("Family");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  const bar = container.querySelector(".address-field")!;
  assertEquals(bar.textContent, "Family");
  assertEquals(bar.querySelectorAll("button").length, 1, "just the avatar");
  await press(labelled(container, copy.openPanel));
  assertEquals(navigated, [`/c/${room.id}/profile`]);
  await unmount();
});

Deno.test("address.action buttons sit in the bar, and an address.addressee turns the name into the way in to the picker", async () => {
  const ran: string[] = [];
  const plugin = definePlugin({
    id: "fake",
    version: "1.0.0",
    contributes: [
      contribute(addressAction, { id: "search", order: 1, label: "Search", icon: <p>s</p>, run: () => void ran.push("search") }),
      contribute(addressAddressee, { id: "people", order: 1, suggest: () => [{ id: "p1", label: "Ada" }], add: () => {} }),
    ],
  });
  const { store, view } = rig([plugin]);
  const room = await store.createRoom("Family");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  await press(labelled(container, "Search"));
  assertEquals(ran, ["search"]);
  const name = [...container.querySelectorAll("button")].find((button) => button.textContent === "Family");
  assert(name, "the name is a button");
  await press(name!);
  await settle();
  assert(labelled(container, copy.back), "the editing bar opens");
  assert(container.querySelector(`[aria-label="${copy.searchAddressee}"], input`), "with its picker");
  await unmount();
});
