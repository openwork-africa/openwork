import { assertEquals, assertRejects } from "@std/assert";
import { manualConnectivity } from "./connectivity.ts";
import { stackTransport, withRetrying } from "./decorators.ts";
import { HttpError, NetworkError, OfflineError } from "./errors.ts";
import { HttpTransport } from "./httpTransport.ts";
import { MemoryTransport } from "./memoryTransport.ts";
import type { Transport } from "./ports.ts";

const flaky = (failures: Error[]): { transport: Transport; calls: () => number } => {
  const inner = new MemoryTransport();
  let calls = 0;
  const transport: Transport = {
    ...inner,
    pull: (since) => {
      calls++;
      const next = failures.shift();
      return next ? Promise.reject(next) : inner.pull(since);
    },
  };
  return { transport, calls: () => calls };
};

const noSleep = { sleep: () => Promise.resolve(), delayMs: 0 };

Deno.test("retrying tries again after a network failure or a server error, then gives the answer", async () => {
  const { transport, calls } = flaky([new NetworkError(), new HttpError(503)]);
  assertEquals((await withRetrying(transport, noSleep).pull(0)).cursor, 0);
  assertEquals(calls(), 3);
});

Deno.test("retrying gives up after its attempts, and never retries a refusal", async () => {
  const down = flaky([new NetworkError(), new NetworkError(), new NetworkError(), new NetworkError()]);
  await assertRejects(() => withRetrying(down.transport, noSleep).pull(0), NetworkError);
  assertEquals(down.calls(), 3);
  const refused = flaky([new HttpError(400, "No.")]);
  await assertRejects(() => withRetrying(refused.transport, noSleep).pull(0), HttpError, "No.");
  assertEquals(refused.calls(), 1);
});

Deno.test("the stack refuses offline without calling through, and logs outermost", async () => {
  const connectivity = manualConnectivity(false);
  const { transport, calls } = flaky([]);
  const lines: string[] = [];
  const stack = stackTransport(transport, { connectivity, log: (line) => lines.push(line), retry: noSleep });
  await assertRejects(() => stack.pull(0), OfflineError);
  assertEquals([calls(), lines], [0, ["transport pull failed: No connection right now."]]);
  connectivity.set(true);
  await stack.pull(0);
  assertEquals([calls(), lines.at(-1)], [1, "transport pull ok"]);
});

Deno.test("HttpTransport speaks the server's paths and turns a refusal into the server's words", async () => {
  const seen: string[] = [];
  const fetcher = ((input: string, init?: RequestInit) => {
    seen.push(`${init?.method ?? "GET"} ${input}`);
    if (input.endsWith("/api/push")) return Promise.resolve(Response.json({ answers: [{ id: "a", ok: true }] }));
    if (input.includes("/api/pull")) return Promise.resolve(Response.json({ message: "Not now." }, { status: 503 }));
    if (input.includes("/api/files/gone")) return Promise.resolve(new Response("", { status: 404 }));
    return Promise.reject(new TypeError("offline"));
  }) as unknown as typeof fetch;
  const http = new HttpTransport("http://127.0.0.1:47410/", fetcher);
  assertEquals(await http.push([]), [{ id: "a", ok: true }]);
  await assertRejects(() => http.pull(7), HttpError, "Not now.");
  assertEquals(await http.getFile("gone"), undefined);
  await assertRejects(() => http.putFile("x", new Blob(["a"])), NetworkError);
  assertEquals(await http.health(), false);
  assertEquals(seen.slice(0, 3), ["POST http://127.0.0.1:47410/api/push", "GET http://127.0.0.1:47410/api/pull?since=7", "GET http://127.0.0.1:47410/api/files/gone"]);
});
