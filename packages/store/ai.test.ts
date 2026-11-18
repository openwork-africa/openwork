import { assert, assertEquals } from "@std/assert";
import type { Plugin } from "@openwork/kit";
import { HttpAiClient, noAiClient } from "./aiClient.ts";
import type { AiClient, AiMessage, AiReply } from "./aiClient.ts";
import { AiBrain } from "./aiBrain.ts";
import { aiPlugin, brainService } from "./aiPlugin.ts";
import { HttpError } from "./errors.ts";
import { type Live } from "./live.ts";
import { memoryPorts, rig, until } from "./testing.ts";

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.test("the AI client posts the room and its messages and reads the reply and the status", async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const answers = [json(200, { status: "reply", text: "Hi" }), json(200, { configured: true, pending: ["r1"] })];
  const client = new HttpAiClient("http://server/", (input, init) => {
    seen.push({ url: String(input), init });
    return Promise.resolve(answers.shift()!);
  });
  const messages: AiMessage[] = [{ id: "m1", authorId: "you", content: "hello", createdAt: 1 }];
  assertEquals(await client.reply("r1", messages), { status: "reply", text: "Hi" });
  assertEquals(await client.status(), { configured: true, pending: ["r1"] });
  assertEquals(seen[0].url, "http://server/api/ai/reply");
  assertEquals(seen[0].init?.method, "POST");
  assertEquals(JSON.parse(String(seen[0].init?.body)), { roomId: "r1", messages });
  assertEquals(seen[1].url, "http://server/api/ai/status");
});

Deno.test("a server with no AI plugin: reply is unavailable, status is not configured, and a refusal carries the server's own words", async () => {
  const fixed = (response: () => Response) => new HttpAiClient("", () => Promise.resolve(response()));
  assertEquals(await fixed(() => json(404, { message: "nothing" })).reply("r", []), { status: "unavailable" });
  assertEquals(await fixed(() => json(404, {})).status(), { configured: false, pending: [] });
  assertEquals(await fixed(() => json(409, {})).reply("r", []), { status: "busy" });
  const error = await fixed(() => json(502, { message: "The assistant could not answer. Try again." })).reply("r", []).catch((e) => e);
  assert(error instanceof HttpError && error.status === 502 && error.message === "The assistant could not answer. Try again.");
});

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

const sse = (...events: [string, unknown][]): Response =>
  new Response(events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join(""), {
    headers: { "Content-Type": "text/event-stream" },
  });

Deno.test("the client asks for a stream, says when the message is started, and settles with the whole reply at done", async () => {
  let accept: string | null = null;
  const client = new HttpAiClient("", (_input, init) => {
    accept = new Headers(init?.headers).get("Accept");
    return Promise.resolve(sse(["started", {}], ["delta", { text: "Hel" }], ["delta", { text: "lo" }], ["done", { text: "Hello" }]));
  });
  const order: string[] = [];
  const reply = await client.reply("r1", [], { onStarted: () => order.push("started") });
  assertEquals([accept, order, reply], ["text/event-stream", ["started"], { status: "reply", text: "Hello" }]);
});

Deno.test("an error event makes the client throw the server's words, after started if it was started", async () => {
  const client = new HttpAiClient("", () => Promise.resolve(sse(["started", {}], ["error", { message: "The assistant could not answer. Try again." }])));
  let started = 0;
  const error = await client.reply("r1", [], { onStarted: () => started++ }).catch((e) => e);
  assert(error instanceof Error && error.message === "The assistant could not answer. Try again.");
  assertEquals(started, 1);
});

Deno.test("a stream that ends with no done is a failure, and a done with no text is none", async () => {
  const cut = new HttpAiClient("", () => Promise.resolve(sse(["started", {}])));
  assert(await cut.reply("r1", []).catch((e) => e) instanceof Error);
  const empty = new HttpAiClient("", () => Promise.resolve(sse(["started", {}], ["done", { text: "" }])));
  assertEquals(await empty.reply("r1", []), { status: "none" });
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
