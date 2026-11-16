import { assertEquals } from "@std/assert";
import type { SlotContext } from "@openwork/kit";
import type { TrailMessage } from "@openwork/store";
import { dayLabelOf, groupOf, RUN_WINDOW_MS } from "./messages.ts";
import { runBeforeSend } from "./beforeSend.ts";

const at = (createdAt: number, id = String(createdAt)): TrailMessage => ({
  id,
  roomId: "r",
  authorId: "you",
  content: id,
  createdAt,
  updatedAt: createdAt,
  state: "sent",
});

Deno.test("days are Today, Yesterday, then the weekday and date", () => {
  const now = new Date(2026, 10, 16, 12);
  assertEquals(dayLabelOf(new Date(2026, 10, 16, 1).getTime(), now), "Today");
  assertEquals(dayLabelOf(new Date(2026, 10, 15, 23).getTime(), now), "Yesterday");
  assertEquals(dayLabelOf(new Date(2026, 10, 10, 9).getTime(), now), "Tuesday, November 10");
  assertEquals(dayLabelOf(new Date(2025, 10, 10, 9).getTime(), now), "Monday, November 10, 2025");
});

Deno.test("messages close together read as one group, a long silence starts a new one", () => {
  const items = [at(0), at(1000), at(2000), at(2000 + RUN_WINDOW_MS + 1)];
  assertEquals(items.map((_, index) => groupOf(items, index)), ["first", "middle", "last", undefined]);
});

Deno.test("beforeSend handlers are a chain: each gets what the one before passed on, and one may stop it", async () => {
  const ctx = {} as SlotContext;
  const add = (suffix: string) => ({
    handle: (draft: { text: string }, _ctx: SlotContext, next: (draft: { text: string }) => Promise<{ text: string } | null>) =>
      next({ text: draft.text + suffix }),
  });
  assertEquals(await runBeforeSend([], { text: "a" }, ctx), { text: "a" });
  assertEquals(await runBeforeSend([add("b"), add("c")], { text: "a" }, ctx), { text: "abc" });
  const stop = { handle: () => Promise.resolve(null) };
  assertEquals(await runBeforeSend([add("b"), stop, add("c")], { text: "a" }, ctx), null);
});
