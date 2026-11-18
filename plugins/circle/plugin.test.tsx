import { assert, assertEquals } from "@std/assert";
import { act, type ReactElement } from "react";
import { commandKey, compose, definePlugin, type Plugin, provideCommand, type SlotContext } from "@openwork/kit";
import { circleRowMenu } from "./slots.ts";
import { devicePorts } from "@openwork/store";
import { memoryPorts } from "@openwork/store/testing";
import { createDrawer, DrawerContext } from "@openwork/shell";
import { Circle } from "./Circle.tsx";
import { copy } from "./copy.ts";
import { circlePlugin } from "./plugin.tsx";
import type { ReadMarks } from "./readMarks.ts";
import { flush, host, mount } from "./testing.tsx";

const createRoomCommand = commandKey<[], Promise<void>>("rooms.create");
const deleteRoomCommand = commandKey<[id: string], Promise<void>>("rooms.delete");

const NEW_ROOM = "New conversation";

/** Stands in for the rooms plugin, which this plugin never imports: it provides the commands the list calls. */
const fakeRooms = definePlugin({
  id: "fake-rooms",
  version: "1.0.0",
  contributes: [],
  provides: [
    provideCommand(createRoomCommand, async (ctx: SlotContext) => {
      const room = await devicePorts(ctx.ports).store.createRoom(NEW_ROOM);
      ctx.navigate(`/c/${room.id}`);
    }),
  ],
});

function setup() {
  const ports = memoryPorts();
  const { store, clock } = ports;
  const marks = new Map<string, number>();
  const readMarks: ReadMarks = {
    get: (id) => marks.get(id),
    set: (id, at) => void marks.set(id, at),
  };
  const opened: string[] = [];
  const plugin = circlePlugin(readMarks);
  const view = (roomId?: string): ReactElement =>
    host([plugin, fakeRooms], ports, <Circle />, {
      roomId,
      navigate: (path) => void opened.push(path),
    });
  return { store, clock, ports, opened, plugin, view };
}
const titles = (
  container: HTMLElement,
): string[] => [
  ...new Set(
    [...container.querySelectorAll("[aria-label]:not(time)")].map((element) => element.getAttribute("aria-label") ?? "").filter((label) =>
      !label.endsWith("actions") && label !== "Conversations" &&
      label !== "New" && !label.endsWith("unread") && !label.startsWith("Mark ")
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
  await act(() => (container.querySelector('button[aria-label="New"]') as HTMLElement).click());
  await flush();
  assertEquals(titles(container).slice(0, 2), [NEW_ROOM, "Older"]);
  assertEquals(opened.length, 1);
  assert(opened[0].startsWith("/c/"));
  await unmount();
});

Deno.test("selecting the already open room closes the list drawer", async () => {
  const { store, view } = setup();
  const room = await store.createRoom("One");
  const drawer = createDrawer();
  const mounted = await mount(<DrawerContext.Provider value={drawer}>{view(room.id)}</DrawerContext.Provider>);
  await flush();
  drawer.setDrawer("list");
  await flush();
  assert(mounted.container.querySelector(".convo-circle"));
  const row = mounted.container.querySelector('[aria-label="One"]');
  assert(row, "room row is present");
  await act(() => (row as HTMLElement).click());
  await flush();
  assertEquals(drawer.drawer(), "none");
  await mounted.unmount();
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

Deno.test("the preview says You: for the person's words and nothing for an assistant reply", async () => {
  const { store, clock, view } = setup();
  const room = await store.createRoom("Notes");
  clock.tick(10);
  await store.send(room.id, "hello");
  const { container, unmount } = await mount(view());
  await flush();
  assert((container.textContent ?? "").includes("You: hello"));
  clock.tick(10);
  await act(async () => void (await store.send(room.id, "Hi there", "assistant")));
  await flush();
  const text = container.textContent ?? "";
  assert(text.includes("Hi there") && !text.includes("You: Hi there") && !text.includes("You: hello"), text);
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

Deno.test("the delete item is a danger one, runs rooms.delete, and shows only while something provides that command", () => {
  const { ports, plugin } = setup();
  const removed: string[] = [];
  const remover = definePlugin({
    id: "fake-remover",
    version: "1.0.0",
    contributes: [],
    provides: [provideCommand(deleteRoomCommand, (_ctx: SlotContext, id: string) => void removed.push(id))],
  });
  const ctxOf = (plugins: Plugin[]): SlotContext => {
    const product = compose(plugins, ports);
    const commands: Record<string, (...args: never[]) => unknown> = {};
    const ctx = { ports, commands } as unknown as SlotContext;
    for (const [name, handler] of Object.entries(product.registry.commands())) commands[name] = (...args) => handler(ctx, ...args);
    return ctx;
  };
  const [item] = compose([plugin], ports).registry.slot(circleRowMenu);
  assertEquals([item.label, item.danger, item.icon], [copy.deleteLabel, true, null]);
  assertEquals(item.when?.(ctxOf([plugin])), false);
  const withRemover = ctxOf([plugin, remover]);
  assertEquals(item.when?.(withRemover), true);
  item.run({ id: "r1", title: "One", activityAt: 0 }, withRemover);
  assertEquals(removed, ["r1"]);
});
