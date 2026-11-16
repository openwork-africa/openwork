import { assert, assertEquals } from "@std/assert";
import { act, type ReactElement } from "react";
import { circleRowMenu, compose, dismiss, getNotices, notify, type SlotContext } from "@openwork/kit";
import { Circle } from "@openwork/circle";
import {
  ManualClock,
  MemoryDeviceStore,
  MemoryFileStore,
  MemoryTransport,
} from "@openwork/store";
import { flush, host, mount } from "./testing.tsx";
import { copy } from "./copy.ts";
import { rooms } from "./plugin.tsx";
import type { ReadMarks } from "./readMarks.ts";

function setup() {
  const clock = new ManualClock();
  const store = new MemoryDeviceStore(clock);
  const marks = new Map<string, number>();
  const readMarks: ReadMarks = {
    get: (id) => marks.get(id),
    set: (id, at) => void marks.set(id, at),
  };
  const ports = {
    store,
    files: new MemoryFileStore(),
    transport: new MemoryTransport(),
    clock,
  };
  const opened: string[] = [];
  const plugin = rooms(readMarks);
  const view = (roomId?: string): ReactElement =>
    host([plugin], ports, <Circle />, {
      roomId,
      navigate: (path) => void opened.push(path),
    });
  return { store, clock, ports, opened, plugin, view };
}

const titles = (
  container: HTMLElement,
): string[] => [
  ...new Set(
    [...container.querySelectorAll("[aria-label]:not(time)")].map((element) =>
      element.getAttribute("aria-label") ?? ""
    ).filter((label) =>
      !label.endsWith("actions") && label !== "Conversations" &&
      label !== "New" && !label.endsWith("unread")
    ),
  ),
];

Deno.test("New creates a room that appears first and opens it", async () => {
  const { store, clock, opened, view } = setup();
  const { container, unmount } = await mount(view());
  await flush();
  assertEquals(container.querySelector(".convo-circle-list")?.textContent, "");
  assertEquals(container.querySelector('button[aria-label="New"]'), null, "with no rooms the window's card starts one");
  await store.createRoom("Older");
  clock.tick(10);
  await flush();
  assert(container.querySelector('button[aria-label="New"]'), "New comes back with the first room");
  await act(() =>
    (container.querySelector('button[aria-label="New"]') as HTMLElement).click()
  );
  await flush();
  assertEquals(titles(container).slice(0, 2), [copy.newRoomName, "Older"]);
  assertEquals(opened.length, 1);
  assert(opened[0].startsWith("/c/"));
  await unmount();
});

Deno.test("sending sets the preview and moves the room to the top", async () => {
  const { store, clock, view } = setup();
  const older = await store.createRoom("Older");
  clock.tick(10);
  await store.createRoom("Newer");
  const { container, unmount } = await mount(view());
  await flush();
  assertEquals(titles(container).slice(0, 2), ["Newer", "Older"]);
  clock.tick(10);
  await act(async () => void (await store.send(older.id, "  hello\nworld  ")));
  await flush();
  assertEquals(titles(container).slice(0, 2), ["Older", "Newer"]);
  assert((container.textContent ?? "").includes("You: hello world"));
  await unmount();
});

Deno.test("unread counts messages after the room's last read mark, and the open room is read", async () => {
  const { store, clock, view } = setup();
  const a = await store.createRoom("Alpha");
  const b = await store.createRoom("Beta");
  const { container, unmount } = await mount(view(b.id));
  await flush();
  clock.tick(10);
  await act(async () => {
    await store.send(a.id, "one");
    clock.tick(1);
    await store.send(a.id, "two");
  });
  await flush();
  assert(container.querySelector('[aria-label="2 unread"]'));
  await unmount();
  const open = await mount(view(a.id));
  await flush();
  assert(!open.container.querySelector('[aria-label="2 unread"]'));
  await open.unmount();
  const back = await mount(view(b.id));
  await flush();
  assert(
    !back.container.querySelector('[aria-label="2 unread"]'),
    "reading it cleared the mark",
  );
  await back.unmount();
});

Deno.test("rooms.delete removes the room and leaves it when it is the open one; the menu item is a danger one", async () => {
  const { store, ports, plugin, opened } = setup();
  const gone = await store.createRoom("Gone");
  await store.createRoom("Kept");
  const product = compose([plugin], ports);
  const item = product.registry.slot(circleRowMenu)[0];
  assertEquals([item.label, item.danger], [copy.deleteLabel, true]);
  const ctx = {
    roomId: gone.id,
    navigate: (path: string) => void opened.push(path),
    notify,
    ports,
    commands: product.registry.commands(),
  } as unknown as SlotContext;
  await product.registry.commands()["rooms.delete"](ctx, gone.id as never);
  assertEquals(opened, ["/"]);
  assertEquals(item.icon, null);
  const live = store.rooms();
  const list = await new Promise<{ name: string }[]>((done) => {
    const stop = live.subscribe(() => {
      if (live.get()) {
        stop();
        done(live.get()!);
      }
    });
  });
  assertEquals(list.map((room) => room.name), ["Kept"]);
});

Deno.test("deleting a room shows Removed with Undo, which brings it back; a failed restore says so with Try again", async () => {
  const { store, ports, plugin } = setup();
  const room = await store.createRoom("Gone");
  const product = compose([plugin], ports);
  const ctx = { roomId: undefined, navigate: () => {}, notify, ports, commands: product.registry.commands() } as unknown as SlotContext;
  const remove = product.registry.commands()["rooms.delete"];
  const wait = () => new Promise((done) => setTimeout(done, 20));
  await remove(ctx, room.id as never);
  const removed = getNotices().at(-1)!;
  assertEquals([removed.text, removed.action?.label, removed.status], [copy.removed, copy.undo, "info"]);
  removed.action!.run();
  await wait();
  const live = store.room(room.id);
  const stop = live.subscribe(() => {});
  await wait();
  assertEquals(live.get()?.name, "Gone");
  stop();
  assert(!getNotices().some((each) => each.id === removed.id));

  await store.restoreRoom(room.id);
  getNotices().forEach((each) => dismiss(each.id));
  const failing = { ...ports, store: Object.assign(Object.create(store), { restoreRoom: () => Promise.reject(new Error("x")) }) };
  const failCtx = { ...ctx, ports: failing } as SlotContext;
  await remove(failCtx, room.id as never);
  getNotices().at(-1)!.action!.run();
  await wait();
  const failed = getNotices().at(-1)!;
  assertEquals([failed.text, failed.action?.label, failed.status], [copy.notBroughtBack, copy.tryAgain, "error"]);
  dismiss(failed.id);
});
