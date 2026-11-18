import { assert, assertEquals } from "@std/assert";
import { compose, dismiss, getNotices, notify, type SlotContext } from "@openwork/kit";
import { clearNotices } from "@openwork/kit/testing";
import { until } from "@openwork/ui/testing";
import { memoryPorts, until as untilLive } from "@openwork/store/testing";
import { copy } from "./copy.ts";
import { rooms } from "./plugin.tsx";

function setup() {
  const ports = memoryPorts();
  const { store } = ports;
  const opened: string[] = [];
  return { store, ports, opened, plugin: rooms() };
}

Deno.test("rooms.delete removes the room and leaves it when it is the open one", async () => {
  const { store, ports, plugin, opened } = setup();
  const gone = await store.createRoom("Gone");
  await store.createRoom("Kept");
  const product = compose([plugin], ports);
  const ctx = {
    roomId: gone.id,
    navigate: (path: string) => void opened.push(path),
    notify,
    ports,
    commands: product.registry.commands(),
  } as unknown as SlotContext;
  await product.registry.commands()["rooms.delete"](ctx, gone.id as never);
  assertEquals(opened, ["/"]);
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
  await remove(ctx, room.id as never);
  await untilLive(store.room(room.id), (value) => value === null);
  const removed = getNotices().at(-1)!;
  assertEquals([removed.text, removed.action?.label, removed.status], [copy.removed, copy.undo, "info"]);
  removed.action!.run();
  const live = store.room(room.id);
  await untilLive(live, (value) => value?.name === "Gone");
  assertEquals(live.get()?.name, "Gone");
  assert(!getNotices().some((each) => each.id === removed.id));

  await store.restoreRoom(room.id);
  clearNotices();
  const failing = { ...ports, store: Object.assign(Object.create(store), { restoreRoom: () => Promise.reject(new Error("x")) }) };
  const failCtx = { ...ctx, ports: failing } as SlotContext;
  await remove(failCtx, room.id as never);
  getNotices().at(-1)!.action!.run();
  await until(() => getNotices().at(-1)?.text === copy.notBroughtBack);
  const failed = getNotices().at(-1)!;
  assertEquals([failed.text, failed.action?.label, failed.status], [copy.notBroughtBack, copy.tryAgain, "error"]);
  dismiss(failed.id);
});
