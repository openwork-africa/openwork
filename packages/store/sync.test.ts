import { assert, assertEquals } from "@std/assert";
import { manualConnectivity } from "./connectivity.ts";
import { ManualClock, MemoryTransport } from "./memoryTransport.ts";
import type { SyncStatus } from "./types.ts";
import { createSyncEngine } from "./syncEngine.ts";
import { dexieDevice, type Device, memoryDevice, settle, until } from "./testing.ts";

interface Rig {
  device: Device;
  transport: MemoryTransport;
  connectivity: ReturnType<typeof manualConnectivity>;
  told: { text: string; status?: string }[];
  statuses: SyncStatus[];
  engine: ReturnType<typeof createSyncEngine>;
}

function rig(device: Device, transport = new MemoryTransport()): Rig {
  const connectivity = manualConnectivity();
  const told: Rig["told"] = [];
  const statuses: SyncStatus[] = [];
  device.store.syncStatus().subscribe(() => statuses.push(device.store.syncStatus().get()!));
  const notify = ((text: string, options?: { status?: string }) => (told.push({ text, status: options?.status }), String(told.length))) as never;
  const engine = createSyncEngine({ store: device.store, files: device.files, transport, connectivity, notify, intervalMs: 20 });
  return { device, transport, connectivity, told, statuses, engine };
}

for (const make of [memoryDevice, dexieDevice]) {
  const run = (name: string, body: () => Promise<void>) => Deno.test({ name: `${make().name}: ${name}`, sanitizeOps: false, sanitizeResources: false, fn: body });

  run("offline work is pushed on the next round and a second device pulls it", async () => {
    const a = rig(make());
    const room = await a.device.store.createRoom("Family");
    await a.device.store.send(room.id, "Lunch at one?");
    await a.engine.syncNow();
    assertEquals((await a.device.store.journal.pending()), []);
    assertEquals([...a.transport.stored.keys()].sort(), [`message:${(await until(a.device.store.trail(room.id)))[0].id}`, `room:${room.id}`].sort());
    assertEquals((await until(a.device.store.trail(room.id)))[0].state, "sent");
    assertEquals(await a.device.store.journal.cursor(), 2);

    const b = rig(make(), a.transport);
    await b.engine.syncNow();
    assertEquals((await until(b.device.store.rooms(), (rooms) => rooms.length === 1))[0].name, "Family");
    assertEquals((await until(b.device.store.trail(room.id), (list) => list.length === 1))[0].content, "Lunch at one?");
    a.device.close();
    b.device.close();
  });

  run("last writer wins by updatedAt and the cursor moves on", async () => {
    const a = rig(make());
    const b = rig(make(), a.transport);
    const room = await a.device.store.createRoom("Plans");
    await a.engine.syncNow();
    await b.engine.syncNow();

    b.device.clock.time = a.device.clock.time + 500;
    await b.device.store.renameRoom(room.id, "Newer");
    a.device.clock.time += 100;
    await a.device.store.renameRoom(room.id, "Older");
    await b.engine.syncNow();
    await a.engine.syncNow();
    assertEquals((await until(a.device.store.room(room.id), (r) => r?.name === "Newer"))?.name, "Newer");
    assertEquals(([...a.transport.stored.values()].find((row) => row.change.id === room.id)!.change.data as { name: string }).name, "Newer");
    assertEquals((await a.device.store.journal.pending()), []);
    const pushes = a.transport.pushes;
    await a.engine.syncNow();
    assertEquals(a.transport.pushes, pushes);
    a.device.close();
    b.device.close();
  });

  run("offline shows one notice however many actions, and everything goes through when back", async () => {
    const a = rig(make());
    a.engine.start();
    a.connectivity.set(false);
    await settle();
    for (const name of ["One", "Two", "Three"]) await a.device.store.createRoom(name);
    await settle();
    assertEquals(a.told.filter((notice) => notice.status === "warning").length, 1);
    assertEquals(a.statuses.at(-1), "offline");
    assertEquals(a.transport.stored.size, 0);

    a.connectivity.set(true);
    await until(a.device.store.syncStatus(), (status) => status === "current" && a.transport.stored.size === 3);
    assertEquals(a.transport.stored.size, 3);
    assert(a.statuses.includes("sending") && a.statuses.includes("catchingUp"));
    a.engine.stop();
    a.device.close();
  });

  run("a server that is down is offline too, and the loop recovers by itself", async () => {
    const a = rig(make());
    a.transport.down = true;
    a.engine.start();
    await a.device.store.createRoom("While down");
    await settle();
    assertEquals(a.statuses.at(-1), "offline");
    assertEquals(a.told.filter((notice) => notice.status === "warning").length, 1);
    a.transport.down = false;
    await until(a.device.store.syncStatus(), (status) => status === "current" && a.transport.stored.size === 1);
    a.engine.stop();
    a.device.close();
  });

  run("a refused change is told once in the server's words and left for attention; retry sends it again", async () => {
    const a = rig(make());
    const room = await a.device.store.createRoom("Strict");
    const message = await a.device.store.send(room.id, "no");
    a.transport.refuse = (change) => (change.kind === "message" ? "That message is not allowed." : undefined);
    await a.engine.syncNow();
    await a.engine.syncNow();
    assertEquals(a.told, [{ text: "That message is not allowed.", status: "error" }]);
    assertEquals(a.device.store.syncStatus().get(), "attention");
    assertEquals((await until(a.device.store.trail(room.id)))[0].state, "failed");
    a.transport.refuse = undefined;
    await a.device.store.retry(message.id);
    await a.engine.syncNow();
    assertEquals(a.device.store.syncStatus().get(), "current");
    assertEquals((await until(a.device.store.trail(room.id)))[0].state, "sent");
    a.device.close();
  });

  run("file bytes are uploaded after their metadata is accepted, and not if it is refused", async () => {
    const a = rig(make());
    const room = await a.device.store.createRoom("Files");
    const file = await a.device.store.putFile({ id: "f-1", parentId: room.id, name: "menu.png", mimeType: "image/png", size: 3 });
    await a.device.files.put(file.id, new Blob(["abc"], { type: "image/png" }));
    a.transport.refuse = (change) => (change.kind === "file" ? "No pictures here." : undefined);
    await a.engine.syncNow();
    assertEquals(a.transport.blobs.size, 0);
    a.transport.refuse = undefined;
    const second = await a.device.store.putFile({ id: "f-2", parentId: room.id, name: "again.png", mimeType: "image/png", size: 3 });
    await a.device.files.put(second.id, new Blob(["xyz"]));
    await a.engine.syncNow();
    assertEquals([...a.transport.blobs.keys()], ["f-2"]);
    a.device.close();
  });
}

Deno.test("a clock that stands still still orders edits", () => {
  const clock = new ManualClock(5);
  assertEquals([clock.now(), clock.tick(), clock.now()], [5, 6, 6]);
});
