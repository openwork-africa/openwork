import { assert, assertEquals } from "@std/assert";
import { commandKey, definePlugin, type Plugin, provideCommand } from "@openwork/kit";
import { clearNotices } from "@openwork/kit/testing";
import { type Change, devicePorts, manualConnectivity } from "@openwork/store";
import { bootShell } from "./boot.ts";
import { createRouter } from "./router.ts";
import { ShellApp } from "./ShellApp.tsx";
import { flush, memoryEnv, mount } from "./testing.tsx";
import { memoryPorts, settle, until } from "@openwork/store/testing";

const ROOM = "720be805-cd6f-4430-b3e3-f120fd3773c0";
const history: Change[] = [
  {
    kind: "message",
    id: "m1",
    updatedAt: 1795077959297,
    data: { id: "m1", roomId: ROOM, authorId: "you", content: "hello", kind: "text", createdAt: 1795077959297, updatedAt: 1795077959297 },
  },
  {
    kind: "message",
    id: "m2",
    updatedAt: 1795078025531,
    data: { id: "m2", roomId: ROOM, authorId: "assistant", content: "Hey!", kind: "text", createdAt: 1795078025531, updatedAt: 1795078025531 },
  },
  {
    kind: "room",
    id: ROOM,
    updatedAt: 1795078419514,
    data: { id: ROOM, name: "New conversation", createdAt: 1795077950983, updatedAt: 1795078419514, activityAt: 1795078419514, members: [] },
  },
] as Change[];

const createRoom = commandKey<[options?: { first?: boolean }], Promise<void>>("rooms.create");
/** Stands in for the rooms plugin: the shell opens a first room through this command when the device has none. */
const roomsPlugin: Plugin = definePlugin({
  id: "rooms",
  version: "0.1.0",
  contributes: [],
  provides: [provideCommand(createRoom, async (ctx) => {
    const room = await devicePorts(ctx.ports).store.createRoom("New conversation");
    (ctx.replace ?? ctx.navigate)(`/c/${room.id}`);
  })],
});

Deno.test("a device with no rooms that opens against a server holding history shows that history and makes no room of its own", async () => {
  clearNotices();
  const ports = memoryPorts();
  const { transport, store } = ports;
  for (const change of history) transport.other(change);
  const env = memoryEnv("/");
  const shell = bootShell({
    plugins: [roomsPlugin],
    ports,
    connectivity: manualConnectivity(true),
    router: createRouter(env),
  });
  const { unmount } = await mount(<ShellApp product={shell.product} router={shell.router} regions={shell.regions} drawer={shell.drawer} />);
  await flush();
  await shell.sync.syncNow();
  await flush();
  await settle();
  const rooms = await until(store.rooms(), () => true);
  assertEquals(rooms.map((room) => room.id), [ROOM], "only the server's room: the device made none of its own");
  assertEquals(env.history.at(-1), `/c/${ROOM}`);
  assert(transport.stored.size === 3, "nothing extra was pushed");
  await unmount();
  shell.stop();
});

Deno.test("a product with a default room is asked to open it once, only after the server's rooms have arrived", async () => {
  clearNotices();
  const ports = memoryPorts();
  const { transport } = ports;
  for (const change of history) transport.other(change);
  const asked: string[][] = [];
  const openDefault = commandKey<[rooms: readonly { id: string }[], options?: { navigate?: boolean }], Promise<void>>("rooms.openDefault");
  const plugin: Plugin = definePlugin({
    id: "rooms",
    version: "0.1.0",
    contributes: [],
    provides: [provideCommand(openDefault, (ctx, rooms) => {
      asked.push(rooms.map((room) => room.id));
      (ctx.replace ?? ctx.navigate)(`/c/${rooms[0].id}`);
      return Promise.resolve();
    })],
  });
  const env = memoryEnv("/");
  const shell = bootShell({ plugins: [plugin], ports, connectivity: manualConnectivity(true), router: createRouter(env) });
  const { unmount } = await mount(<ShellApp product={shell.product} router={shell.router} regions={shell.regions} drawer={shell.drawer} />);
  await flush();
  await shell.sync.syncNow();
  await flush();
  await settle();
  assertEquals(asked, [[ROOM]], "asked once, with the pulled room");
  assertEquals(env.history.at(-1), `/c/${ROOM}`);
  await unmount();
  shell.stop();
});
