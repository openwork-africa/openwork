import { assert, assertEquals, assertRejects } from "@std/assert";
import { devices, until } from "./testing.ts";

for (const make of devices) {
  const run = (name: string, body: (device: ReturnType<typeof make>) => Promise<void>) =>
    Deno.test({
      name: `${make().name}: ${name}`,
      sanitizeOps: false,
      sanitizeResources: false,
      fn: async () => {
        const device = make();
        try {
          await body(device);
        } finally {
          device.close();
        }
      },
    });

  run("rooms are created, renamed, edited and deleted offline, and listed newest activity first", async ({ store, clock }) => {
    const rooms = store.rooms();
    const family = await store.createRoom("Family", { description: "Sunday plans" });
    clock.tick(10);
    const work = await store.createRoom("Work");
    assertEquals((await until(rooms, (list) => list.length === 2)).map((room) => room.name), ["Work", "Family"]);

    clock.tick(10);
    await store.renameRoom(family.id, "Family chat");
    await store.setRoomDescription(work.id, "Standup at nine");
    await store.setRoomPicture(work.id, "file:abc");
    await store.setRoomBackground(work.id, "white");
    const edited = await until(store.room(work.id), (room) => room?.background === "white");
    assertEquals([edited?.description, edited?.picture, edited?.background], ["Standup at nine", "file:abc", "white"]);
    assert(edited!.updatedAt > edited!.createdAt);

    await store.setRoomDescription(work.id, undefined);
    assertEquals((await until(store.room(work.id), (room) => room?.description === undefined))?.name, "Work");

    await store.deleteRoom(family.id);
    assertEquals((await until(rooms, (list) => list.length === 1)).map((room) => room.name), ["Work"]);
    assertEquals(await until(store.room(family.id), (room) => room === null), null);
    assertEquals((await store.journal.pending()).map((row) => row.kind), ["room", "room"]);
  });

  run("a deleted room is brought back with its messages, and a room the device never had is refused", async ({ store, clock }) => {
    const room = await store.createRoom("Family");
    await store.send(room.id, "Lunch?");
    clock.tick(10);
    await store.deleteRoom(room.id);
    assertEquals(await until(store.room(room.id), (found) => found === null), null);
    clock.tick(10);
    await store.restoreRoom(room.id);
    const back = await until(store.room(room.id), (found) => found !== null);
    assertEquals([back?.name, back?.deleted], ["Family", undefined]);
    assertEquals((await until(store.trail(room.id), (trail) => trail.length === 1))[0].content, "Lunch?");
    await assertRejects(() => store.restoreRoom("nope"));
  });

  run("a sent message is sending, moves its room to the top and queues room then message", async ({ store, clock }) => {
    const first = await store.createRoom("First");
    clock.tick(10);
    const second = await store.createRoom("Second");
    clock.tick(10);
    const message = await store.send(first.id, "Lunch at one?");
    const trail = await until(store.trail(first.id), (list) => list.length === 1);
    assertEquals([trail[0].content, trail[0].state, trail[0].authorId], ["Lunch at one?", "sending", "you"]);
    assertEquals((await until(store.rooms(), (list) => list.length === 2)).map((room) => room.id), [first.id, second.id]);
    assertEquals((await store.journal.pending()).map((row) => row.key), [`room:${second.id}`, `room:${first.id}`, `message:${message.id}`]);
  });

  run("the trail keeps the order messages were written in", async ({ store, clock }) => {
    const room = await store.createRoom("Order");
    for (const content of ["one", "two", "three"]) {
      clock.tick(5);
      await store.send(room.id, content);
    }
    assertEquals((await until(store.trail(room.id), (list) => list.length === 3)).map((message) => message.content), ["one", "two", "three"]);
  });

  run("a failed message can be retried and goes back to sending", async ({ store }) => {
    const room = await store.createRoom("Retry");
    const message = await store.send(room.id, "hello");
    const [row] = (await store.journal.pending()).filter((item) => item.kind === "message");
    await store.journal.fail(row, "Too long.");
    assertEquals((await until(store.trail(room.id), (list) => list[0]?.state === "failed"))[0].state, "failed");
    assertEquals((await store.journal.pending()).some((item) => item.kind === "message"), false);
    assertEquals((await until(store.trail(room.id)))[0].failureReason, "Too long.");
    await store.retry(message.id);
    assertEquals((await until(store.trail(room.id), (list) => list[0]?.state === "sending"))[0].state, "sending");
    assertEquals((await until(store.trail(room.id)))[0].failureReason, undefined);
  });

  run("sending to a room that is gone says so", async ({ store }) => {
    await assertRejects(() => store.send("nowhere", "hi"), Error, "nowhere");
  });

  run("file metadata is queued and its bytes are kept apart", async ({ store, files }) => {
    const room = await store.createRoom("Files");
    const file = await store.putFile({ id: "file-1", parentId: room.id, name: "menu.png", mimeType: "image/png", size: 3 });
    await files.put(file.id, new Blob(["abc"], { type: "image/png" }));
    assertEquals(await (await files.get(file.id))!.text(), "abc");
    assert((await store.journal.pending()).some((row) => row.key === "file:file-1"));
    await files.remove(file.id);
    assertEquals(await files.get(file.id), undefined);
  });

  run("a newer pulled record wins over the local one and drops its queued change; an older one is ignored", async ({ store, clock }) => {
    const room = await store.createRoom("Old name");
    clock.tick(100);
    await store.renameRoom(room.id, "Mine");
    const mine = (await until(store.room(room.id)))!;
    await store.journal.applyPulled([{ kind: "room", id: room.id, updatedAt: mine.updatedAt - 1, data: { ...mine, name: "Older", updatedAt: mine.updatedAt - 1 } }], 3);
    assertEquals((await until(store.room(room.id)))?.name, "Mine");
    await store.journal.applyPulled([{ kind: "room", id: room.id, updatedAt: mine.updatedAt + 1, data: { ...mine, name: "Theirs", updatedAt: mine.updatedAt + 1 } }], 4);
    assertEquals((await until(store.room(room.id), (value) => value?.name === "Theirs"))?.name, "Theirs");
    assertEquals(await store.journal.pending(), []);
    assertEquals(await store.journal.cursor(), 4);
  });
}
