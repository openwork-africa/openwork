import { assertEquals } from "@std/assert";
import type { Plugin } from "@openwork/kit";
import { noAiClient } from "./aiClient.ts";
import type { AiClient, AiMessage, AiReply } from "./aiClient.ts";
import { AiBrain } from "./aiBrain.ts";
import { aiPlugin, brainService } from "./aiPlugin.ts";
import { HttpError } from "./errors.ts";
import { type Live } from "./live.ts";
import { devices, memoryPorts, rig, until } from "./testing.ts";

const valueOf = <T>(live: Live<T>) => live.get();

Deno.test("the brain is working while the server says a reply is pending, and stops polling with the last watcher", async () => {
  let pending: string[] = [];
  let asked = 0;
  const client: AiClient = { reply: noAiClient.reply, status: () => (asked++, Promise.resolve({ configured: true, pending })) };
  const brain = new AiBrain(5);
  brain.connect(client);
  const live = brain.isWorking("r1");
  assertEquals(valueOf(live), undefined);
  const stop = live.subscribe(() => {});
  assertEquals(await until(live), false);
  pending = ["r1"];
  assertEquals(await until(live, (working) => working), true);
  pending = [];
  assertEquals(await until(live, (working) => !working), false);
  stop();
  await new Promise((done) => setTimeout(done, 20));
  const settled = asked;
  await new Promise((done) => setTimeout(done, 30));
  assertEquals(asked, settled, "no polling with no watcher");
});

Deno.test("the brain is working at once for a reply begun on this device, and an unconfigured server is asked once", async () => {
  let asked = 0;
  const brain = new AiBrain(5);
  brain.connect({ reply: noAiClient.reply, status: () => (asked++, Promise.resolve({ configured: false, pending: [] })) });
  const live = brain.isWorking("r1");
  const stop = live.subscribe(() => {});
  const end = brain.begin("r1", "m1");
  assertEquals(live.get(), true);
  end.end();
  assertEquals(live.get(), false);
  await new Promise((done) => setTimeout(done, 40));
  stop();
  assertEquals(asked, 1);
});

function aiRig(client: AiClient, plugins: Plugin[] = [aiPlugin()]) {
  const ports = { ...memoryPorts(), ai: client };
  return rig(plugins, ports);
}

const settle = (ms = 30) => new Promise((done) => setTimeout(done, ms));

Deno.test("a message from the person is answered: the room's messages go out, the brain works meanwhile, and the reply is saved as the assistant's", async () => {
  const calls: { roomId: string; messages: AiMessage[] }[] = [];
  let release!: (reply: AiReply) => void;
  const client: AiClient = {
    reply: (roomId, messages) => (calls.push({ roomId, messages }), new Promise((done) => (release = done))),
    status: () => Promise.resolve({ configured: true, pending: [] }),
  };
  const { store, product } = aiRig(client);
  const brain = product.registry.service(brainService)!;
  const room = await store.createRoom("Notes");
  const working = brain.isWorking(room.id);
  const stop = working.subscribe(() => {});
  await store.send(room.id, "hello");
  await settle();
  assertEquals(calls.length, 1);
  assertEquals(calls[0].roomId, room.id);
  assertEquals(calls[0].messages.map((m) => [m.authorId, m.content]), [["you", "hello"]]);
  assertEquals(Object.keys(calls[0].messages[0]).sort(), ["authorId", "content", "createdAt", "id"]);
  assertEquals(working.get(), true);
  release({ status: "reply", text: "Hi there" });
  await settle();
  assertEquals(working.get(), false);
  const trail = await until(store.trail(room.id), (messages) => messages.length === 2);
  assertEquals(trail.map((m) => [m.authorId, m.content]), [["you", "hello"], ["assistant", "Hi there"]]);
  assertEquals(calls.length, 1, "the assistant's own message is not answered");
  stop();
  product.teardown();
});

Deno.test("with no AI on the server one status check is made, no reply is ever asked for, and the brain stays idle", async () => {
  let replies = 0;
  let statuses = 0;
  const client: AiClient = { reply: () => (replies++, Promise.resolve({ status: "unavailable" })), status: () => (statuses++, noAiClient.status()) };
  const { store, product } = aiRig(client);
  const room = await store.createRoom("Notes");
  await settle();
  await store.send(room.id, "one");
  await settle();
  await store.send(room.id, "two");
  await settle();
  assertEquals([replies, statuses], [0, 1]);
  assertEquals((await until(store.trail(room.id))).map((m) => m.content), ["one", "two"]);
  const working = product.registry.service(brainService)!.isWorking(room.id);
  const stop = working.subscribe(() => {});
  await settle();
  assertEquals(working.get(), false);
  stop();
  product.teardown();
});

Deno.test("a server that says it has AI but answers 404 to the reply is asked once more at most", async () => {
  let asked = 0;
  const client: AiClient = {
    reply: () => (asked++, Promise.resolve({ status: "unavailable" })),
    status: () => Promise.resolve({ configured: true, pending: [] }),
  };
  const { store, product } = aiRig(client);
  const room = await store.createRoom("Notes");
  await settle();
  await store.send(room.id, "one");
  await settle();
  await store.send(room.id, "two");
  await settle();
  assertEquals(asked, 1);
  product.teardown();
});

Deno.test("the brain forgets the server's pending rooms when nobody is watching", async () => {
  const brain = new AiBrain(5);
  brain.connect({ reply: noAiClient.reply, status: () => Promise.resolve({ configured: true, pending: ["r1"] }) });
  const live = brain.isWorking("r1");
  const stop = live.subscribe(() => {});
  await until(live, (working) => working);
  stop();
  await settle();
  const again = brain.isWorking("r1");
  const stopAgain = again.subscribe(() => {});
  assertEquals(again.get(), false);
  stopAgain();
});

Deno.test("a failed reply tells the person in plain words and saves nothing", async () => {
  const client: AiClient = {
    reply: () => Promise.reject(new HttpError(502, "The assistant could not answer. Try again.")),
    status: () => Promise.resolve({ configured: true, pending: [] }),
  };
  const { store, product } = aiRig(client);
  const room = await store.createRoom("Notes");
  await store.send(room.id, "hi");
  await settle();
  assertEquals(product.notices.list().map((notice) => notice.text), ["The assistant could not answer. Try again."]);
  assertEquals((await until(store.trail(room.id))).length, 1);
  product.teardown();
});

Deno.test("the room works from the first request until the stream ends, the reply is saved only at done, and the message is taken at started", async () => {
  let handlers!: { onStarted?: () => void };
  let finish!: (reply: AiReply) => void;
  const client: AiClient = {
    reply: (_roomId, _messages, given) => (handlers = given ?? {}, new Promise((done) => (finish = done))),
    status: () => Promise.resolve({ configured: true, pending: [] }),
  };
  const { store, product } = aiRig(client);
  const brain = product.registry.service(brainService)!;
  const room = await store.createRoom("Notes");
  const working = brain.isWorking(room.id);
  const answers = brain.answers!(room.id);
  const stopWorking = working.subscribe(() => {});
  const stopAnswers = answers.subscribe(() => {});
  await settle();
  const sent = await store.send(room.id, "hello");
  await settle();
  assertEquals([working.get(), answers.get()!.get(sent.id)], [true, undefined]);
  handlers.onStarted!();
  assertEquals(answers.get()!.get(sent.id), "taken");
  assertEquals((await until(store.trail(room.id))).map((m) => m.authorId), ["you"], "nothing saved before done");
  finish({ status: "reply", text: "Hi there" });
  await settle();
  assertEquals(working.get(), false);
  assertEquals((await until(store.trail(room.id))).map((m) => [m.authorId, m.content]), [["you", "hello"], ["assistant", "Hi there"]]);
  stopWorking();
  stopAnswers();
  product.teardown();
});

Deno.test("a failure before started marks the message failed with the reason; after started the ticks stay taken", async () => {
  for (const isStarted of [false, true]) {
    const client: AiClient = {
      reply: (_roomId, _messages, given) => {
        if (isStarted) given?.onStarted?.();
        return Promise.reject(new HttpError(502, "The assistant could not answer. Try again."));
      },
      status: () => Promise.resolve({ configured: true, pending: [] }),
    };
    const { store, product } = aiRig(client);
    const brain = product.registry.service(brainService)!;
    const room = await store.createRoom("Notes");
    const answers = brain.answers!(room.id);
    const stop = answers.subscribe(() => {});
    await settle();
    const sent = await store.send(room.id, "hi");
    await settle();
    assertEquals(answers.get()!.get(sent.id), isStarted ? "taken" : { failed: "The assistant could not answer. Try again." });
    assertEquals((await until(store.trail(room.id))).length, 1, "nothing is saved on an error");
    stop();
    product.teardown();
  }
});

for (const make of devices) {
  Deno.test(`${make().name}: a room created after startup answers its first message`, async () => {
    const device = make();
    const calls: string[] = [];
    const client: AiClient = {
      reply: (roomId) => (calls.push(roomId), Promise.resolve({ status: "reply", text: "Hi" })),
      status: () => Promise.resolve({ configured: true, pending: [] }),
    };
    const ports = { ...memoryPorts(device.clock), store: device.store, files: device.files, ai: client };
    const { product } = rig([aiPlugin()], ports as unknown as ReturnType<typeof memoryPorts>);
    await settle(50);
    const room = await device.store.createRoom("Fresh");
    await device.store.send(room.id, "first");
    await settle(150);
    assertEquals(calls, [room.id]);
    product.teardown();
    device.close();
  });
}

Deno.test("an older room opened after startup answers its first message, and so does the newest room that was there at startup", async () => {
  const calls: string[] = [];
  const client: AiClient = {
    reply: (roomId) => (calls.push(roomId), Promise.resolve({ status: "reply", text: "Hi" })),
    status: () => Promise.resolve({ configured: true, pending: [] }),
  };
  const ports = { ...memoryPorts(), ai: client };
  const older = await ports.store.createRoom("Older");
  ports.clock.tick(10);
  const newest = await ports.store.createRoom("Newest");
  const { product } = rig([aiPlugin()], ports);
  await settle(50);
  ports.clock.tick(10);
  await ports.store.send(newest.id, "in the newest");
  await settle();
  ports.clock.tick(10);
  await ports.store.send(older.id, "in the older one");
  await settle();
  assertEquals(calls, [newest.id, older.id]);
  product.teardown();
});

Deno.test("a status line the person's side wrote is not a message to answer and is not sent to the AI", async () => {
  const calls: AiMessage[][] = [];
  const client: AiClient = {
    reply: (_room, messages) => (calls.push(messages), Promise.resolve({ status: "none" })),
    status: () => Promise.resolve({ configured: true, pending: [] }),
  };
  const { store, product, clock } = aiRig(client);
  const room = await store.createRoom("Notes");
  await settle();
  clock.tick(1);
  await store.send(room.id, "Assistant joined", "you", "member.added");
  await settle();
  assertEquals(calls.length, 0);
  clock.tick(1);
  await store.send(room.id, "hello");
  await settle();
  assertEquals(calls.map((messages) => messages.map((message) => message.content)), [["hello"]]);
  product.teardown();
});
