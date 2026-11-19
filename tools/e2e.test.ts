import "fake-indexeddb/auto";
import { dexieDevice } from "@openwork/store/testing";
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { aiPlugin, createSyncEngine, HttpTransport, ManualClock, manualConnectivity, MemoryDeviceStore, MemoryFileStore } from "@openwork/store";
import type { Live } from "@openwork/store";
import { compose, createNotices } from "@openwork/kit";

/** Start the server (`cd server && cargo run -p ow-server -- --static ../app/dist --data <dir>`), then run this with OW_SERVER_URL=http://127.0.0.1:47410. */
const serverUrl = Deno.env.get("OW_SERVER_URL");

const PIXEL = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

function device() {
  const clock = new ManualClock();
  const store = new MemoryDeviceStore(clock);
  const files = new MemoryFileStore();
  const transport = new HttpTransport(serverUrl);
  const engine = createSyncEngine({ store, files, transport, connectivity: manualConnectivity(true), notices: createNotices() });
  return { store, files, transport, engine };
}

function until<T>(live: Live<T>, accept: (value: T) => boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => (stop(), reject(new Error("the live value never arrived"))), 3000);
    const check = () => {
      const value = live.get();
      if (value === undefined || !accept(value)) return;
      clearTimeout(timer);
      queueMicrotask(stop);
      resolve(value);
    };
    const stop = live.subscribe(check);
    check();
  });
}

Deno.test({
  name: "offline-first against the real server: device A syncs a room, a message and an image, device B pulls and fetches them",
  ignore: !serverUrl,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    assert((await fetch(`${serverUrl}/healthz`)).ok, "the server answers /healthz");
    const a = device();
    const b = device();

    const room = await a.store.createRoom(`End to end ${crypto.randomUUID()}`);
    const message = await a.store.send(room.id, "Written offline, synced later");
    await a.engine.syncNow();
    assertEquals(await a.store.journal.pending(), [], "everything A queued was accepted");

    await b.engine.syncNow();
    const rooms = await until(b.store.rooms(), (list) => list.some((row) => row.id === room.id));
    assertEquals(rooms.find((row) => row.id === room.id)?.name, room.name);
    const trail = await until(b.store.trail(room.id), (list) => list.length === 1);
    assertEquals([trail[0].id, trail[0].content], [message.id, "Written offline, synced later"]);

    const imageId = crypto.randomUUID();
    await a.files.put(imageId, new Blob([PIXEL], { type: "image/png" }));
    await a.store.putFile({ id: imageId, parentId: room.id, name: "pixel.png", mimeType: "image/png", size: PIXEL.length });
    await a.store.setRoomPicture(room.id, `file:${imageId}`);
    await a.engine.syncNow();

    await b.engine.syncNow();
    const pictured = await until(b.store.room(room.id), (row) => row?.picture === `file:${imageId}`);
    assertEquals(pictured?.picture, `file:${imageId}`);
    const fetched = await b.transport.getFile(imageId);
    assertEquals(fetched?.type, "image/png");
    assertEquals(new Uint8Array(await fetched!.arrayBuffer()), PIXEL);
    assertEquals(await b.transport.getFile(crypto.randomUUID()), undefined, "an unknown file is not found");
  },
});

function dexieDeviceOnServer() {
  const made = dexieDevice();
  const transport = new HttpTransport(serverUrl);
  const engine = createSyncEngine({ store: made.store, files: made.files, transport, connectivity: manualConnectivity(true), notices: createNotices() });
  return { store: made.store, files: made.files, clock: made.clock, transport, engine };
}

Deno.test({
  name:
    "against the real server: a member added on a device (made with the room or added later) and its status lines sync, and a message there is then answered",
  ignore: !serverUrl,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const a = dexieDeviceOnServer();
    const b = dexieDeviceOnServer();
    const helper = { id: "op-1", name: "Helper", type: "operator", description: "Answers" };
    const other = { id: "x-1", name: "Ama", type: "x-unknown-type" };
    const room = await a.store.createRoom(`Members ${crypto.randomUUID()}`, { members: [helper] });
    a.clock.tick(1);
    await a.store.addMember(room.id, other);
    await a.engine.syncNow();
    assertEquals(await a.store.journal.pending(), [], "the member row and both status lines were queued and accepted");

    await b.engine.syncNow();
    assertEquals(await b.store.journal.pending(), [], "everything B pulled was applied");
    const pulled = await until(b.store.room(room.id), (row) => row?.members?.length === 2);
    assertEquals(pulled?.members, [helper, other]);
    const lines = await until(b.store.trail(room.id), (list) => list.length === 2);
    assertEquals(lines.map((line) => [line.kind, line.content]).sort(), [["member.added", "Ama was added"], ["member.added", "Helper was added"]]);

    const asked: string[] = [];
    const ai = {
      status: () => Promise.resolve({ configured: true, pending: [] }),
      reply: (roomId: string) => (asked.push(roomId), Promise.resolve({ status: "none" as const })),
    };
    b.clock.tick(1);
    const product = compose([aiPlugin()], { store: b.store, files: b.files, transport: b.transport, clock: b.clock, ai });
    await new Promise((done) => setTimeout(done, 100));
    b.clock.tick(1);
    await b.store.send(room.id, "are you there?");
    for (let waited = 0; asked.length === 0 && waited < 2000; waited += 20) await new Promise((done) => setTimeout(done, 20));
    assertEquals(asked, [room.id], "a message in a room whose operator member synced is answered");
    product.teardown();
  },
});
