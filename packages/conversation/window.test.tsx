import { assert, assertEquals } from "@std/assert";
import { act } from "react";
import { addressAction, addressAddressee, contribute, definePlugin, provide, trailBody, windowBanner, windowEmpty } from "@openwork/kit";
import { type AiClient, aiPlugin, type AiReply, brainService, HttpError, makeCell } from "@openwork/store";
import { until } from "@openwork/store/testing";
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
  const { store, syncNow, view } = rig();
  const room = await store.createRoom("Notes");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  assert(textOf(container).includes(copy.emptyTitle) && textOf(container).includes(copy.emptyDescription));
  assert(container.querySelector(".conversation-empty-card > .empty-card"), "the card sits in the wrapper");
  assertEquals(container.querySelectorAll('[aria-label="Add to this conversation"]').length, 0, "no + without add-menu items");

  await write(container, "Lunch at one?");
  await press(sendButton(container));
  await settle();
  const sent = await trailOf(store, room.id);
  assertEquals([sent.length, sent[0].content, sent[0].state], [1, "Lunch at one?", "sending"]);
  assert(textOf(container).includes("Lunch at one?") && !textOf(container).includes(copy.emptyTitle));
  assert(labelled(container, copy.saved), "one tick while sending");

  await syncNow();
  await settle();
  assertEquals((await trailOf(store, room.id))[0].state, "sent");
  assert(labelled(container, copy.received), "two ticks once the server has it");
  assertEquals(container.querySelectorAll("[contenteditable]")[0].textContent, "", "the field is cleared");
  await unmount();
});

Deno.test("a failed message says so and Send again puts it back to sending", async () => {
  const { store, transport, syncNow, view } = rig();
  const room = await store.createRoom("Notes");
  await store.send(room.id, "hello");
  transport.refuse = () => "Too long.";
  await syncNow();
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  assertEquals((await trailOf(store, room.id))[0].state, "failed");
  assert(textOf(container).includes(copy.notDelivered));
  await press(labelled(container, copy.sendAgain));
  await settle();
  assertEquals((await trailOf(store, room.id))[0].state, "sending");
  transport.refuse = undefined;
  await syncNow();
  assert(!textOf(container).includes(copy.notDelivered));
  await unmount();
});

Deno.test("a failed message shows a friendly explanation before Send again", async () => {
  const { store, transport, syncNow, view } = rig();
  const room = await store.createRoom("Notes");
  await store.send(room.id, "hello");
  transport.refuse = () => "That message is not allowed.";
  await syncNow();
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  const details = labelled(container, copy.errorDetails)!;
  const again = labelled(container, copy.sendAgain)!;
  assert(details && again);
  assert(details.compareDocumentPosition(again) & 4, "Error details comes before Send again");
  assert(labelled(container, copy.notDeliveredTryAgain), "the failed tick carries a friendly explanation");
  await unmount();
});

Deno.test("catching up with no messages shows Still loading and not the empty card", async () => {
  const { store, transport, syncNow, view } = rig();
  const room = await store.createRoom("Notes");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  assert(!textOf(container).includes("Still loading…"));
  assert(textOf(container).includes(copy.emptyTitle));
  let release!: () => void;
  transport.pull = () =>
    new Promise((resolve) => {
      release = () => resolve({ changes: [], cursor: 0 });
    });
  const syncing = syncNow();
  await until(store.syncStatus(), (status) => status === "catchingUp");
  while (!release) await flush(5);
  assert(textOf(container).includes("Still loading…"));
  assert(!textOf(container).includes(copy.emptyTitle));
  release();
  await syncing;
  await unmount();
});

Deno.test("the empty card's slot is a row, so the card centres", async () => {
  const { store, view } = rig();
  const room = await store.createRoom("Notes");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  const slot = container.querySelector(".conversation-empty-card") as HTMLElement;
  assert(slot && slot.querySelector(".empty-card, [class*=empty]"));
  assert(!slot.className.includes("vstack") && !slot.getAttribute("data-direction")?.includes("column"));
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
  const fakeBrain = definePlugin({ id: "fake-brain", version: "1.0.0", contributes: [], provides: [provide(brainService, { isWorking: () => working })] });
  const { store, view } = rig([fakeBrain]);
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

Deno.test("the address bar shows the room name; it has no picture; with no addressee there is no picker", async () => {
  const { store, view, navigated } = rig();
  const room = await store.createRoom("Family");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  const bar = container.querySelector(".address-field")!;
  assertEquals(bar.textContent, "Family");
  assertEquals(bar.querySelectorAll("button, img, [role=img]").length, 0, "no avatar, no button");
  assertEquals(navigated, []);
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

Deno.test("with no brain provided the window is a note to self: no typing indicator", async () => {
  const { store, view } = rig();
  const room = await store.createRoom("Notes");
  await store.send(room.id, "hi");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  assertEquals(labelled(container, copy.typing), null);
  await unmount();
});

function aiWindow(reply: AiClient["reply"]) {
  const client: AiClient = { reply, status: () => Promise.resolve({ configured: true, pending: [] }) };
  return rig([aiPlugin()], { ai: client });
}

Deno.test("while a reply streams the window shows only the typing indicator, the message has blue ticks once started, and the reply appears whole at done", async () => {
  let started!: () => void;
  let finish!: (reply: AiReply) => void;
  const { store, view, syncNow } = aiWindow((_room, _messages, handlers) => (started = handlers!.onStarted!, new Promise((done) => (finish = done))));
  const room = await store.createRoom("Notes");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  await write(container, "hello");
  await press(sendButton(container));
  await settle();
  assert(labelled(container, copy.typing), "typing while the reply is on its way");
  assert(labelled(container, copy.saved), "grey: saved on this device");
  await syncNow();
  await settle();
  assert(labelled(container, copy.received) && !labelled(container, copy.accepted), "grey: the server has it");
  await act(() => started());
  await settle();
  assert(labelled(container, copy.accepted), "blue: taken");
  assert(!textOf(container).includes("Hi there"));
  await act(() => finish({ status: "reply", text: "Hi there" }));
  await settle();
  assertEquals(labelled(container, copy.typing), null);
  assert(textOf(container).includes("Hi there"), "the whole reply, as one message");
  await unmount();
});

Deno.test("a failure before started shows red ticks with the reason and saves no reply", async () => {
  const { store, view } = aiWindow(() => Promise.reject(new HttpError(502, "The assistant could not answer. Try again.")));
  const room = await store.createRoom("Notes");
  const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
  await settle();
  await write(container, "hello");
  await press(sendButton(container));
  await settle();
  assert(labelled(container, copy.notDeliveredTryAgain), "red ticks with the reason");
  assertEquals(labelled(container, copy.accepted), null);
  assertEquals(labelled(container, copy.typing), null);
  assertEquals((await trailOf(store, room.id)).length, 1);
  await unmount();
});

const pollPlugin = definePlugin({
  id: "poll",
  version: "1.0.0",
  contributes: [
    contribute(trailBody, {
      id: "poll",
      order: 50,
      kind: "x-poll",
      matches: (message) => message.kind === "x-poll",
      render: (message) => <p>poll: {message.content}</p>,
    }),
  ],
});

Deno.test("a second kind a plugin contributes is drawn through trail.body; without that plugin the same message shows the not-supported notice", async () => {
  for (const [plugins, expected] of [[[pollPlugin], "poll: four options"], [[], copy.unsupportedKind]] as const) {
    const { store, view } = rig([...plugins]);
    const room = await store.createRoom("Notes");
    await store.send(room.id, "four options", "you", "x-poll");
    const { container, unmount } = await mount(view(<ConversationWindow roomId={room.id} />, room.id));
    await settle();
    assert(textOf(container).includes(expected), textOf(container));
    if (plugins.length === 0) assert(!textOf(container).includes("four options"), "the words of a kind nobody draws are not shown as text");
    await unmount();
  }
});
