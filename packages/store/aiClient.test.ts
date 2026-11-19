import { assert, assertEquals } from "@std/assert";
import { HttpAiClient } from "./aiClient.ts";
import type { AiSession } from "./aiClient.ts";
import type { AiMessage } from "./aiClient.ts";
import { HttpError } from "./errors.ts";

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
  assertEquals(JSON.parse(String(seen[0].init?.body)), { roomId: "r1", messages, bursts: true });
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

Deno.test("the client sends the session it keeps and keeps the one the server hands back, from JSON and from a stream", async () => {
  let kept: string | undefined = "old";
  const session: AiSession = { get: () => kept, set: (value) => (kept = value) };
  const bodies: unknown[] = [];
  const answers = [json(200, { status: "reply", text: "Hi", session: "s1" }), sse(["started", {}], ["done", { text: "Yo", session: "s2" }]), json(200, { status: "none" })];
  const client = new HttpAiClient("", (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Promise.resolve(answers.shift()!);
  }, session);
  assertEquals(await client.reply("r", []), { status: "reply", text: "Hi" });
  assertEquals(kept, "s1");
  assertEquals(await client.reply("r", []), { status: "reply", text: "Yo" });
  assertEquals(kept, "s2");
  assertEquals(await client.reply("r", []), { status: "none" });
  assertEquals(kept, "s2");
  assertEquals(bodies, [{ roomId: "r", messages: [], session: "old", bursts: true }, { roomId: "r", messages: [], session: "s1", bursts: true }, { roomId: "r", messages: [], session: "s2", bursts: true }]);
});

Deno.test("burst events are handed over as they arrive, and done carries the bursts and the group", async () => {
  const client = new HttpAiClient("", () =>
    Promise.resolve(sse(
      ["started", {}],
      ["burst", { text: "One.", index: 0, group: "g1" }],
      ["burst", { text: "Two?", index: 1, group: "g1" }],
      ["done", { text: "One. Two?", bursts: ["One.", "Two?"], group: "g1" }],
    )));
  const seen: unknown[] = [];
  const reply = await client.reply("r1", [], { onBurst: (burst) => seen.push(burst) });
  assertEquals(seen, [{ text: "One.", index: 0, group: "g1" }, { text: "Two?", index: 1, group: "g1" }]);
  assertEquals(reply, { status: "reply", text: "One. Two?", bursts: ["One.", "Two?"], group: "g1" });
});
