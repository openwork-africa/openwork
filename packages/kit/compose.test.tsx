import { assert, assertEquals, assertThrows } from "@std/assert";
import { renderToStaticMarkup } from "react-dom/server";
import { compose, contribute, definePlugin, getNotices, provide, provideCommand, service, slot, useCtx, useSlot } from "./mod.ts";
import { clearNotices, type Item, itemsSlot, placed, pluginWith } from "./testing.ts";

const labelsOf = (product: ReturnType<typeof compose>): string[] => product.registry.slot(itemsSlot).map((item) => item.label);

Deno.test("items come back sorted by order, ties in registration order", () => {
  const product = compose(
    [pluginWith("a", [placed("a1", 30), placed("a2", 10)]), pluginWith("b", [placed("b1", 20), placed("b2", 10)])],
    {},
  );
  assertEquals(labelsOf(product), ["a2", "b2", "b1", "a1"]);
  assertEquals(product.problems, []);
});

Deno.test("a missing requirement skips the plugin, names it in a notice and boots the rest", () => {
  clearNotices();
  const product = compose(
    [pluginWith("stickers", [placed("s", 1)], { requires: { emoji: "^1" } }), pluginWith("text", [placed("t", 2)])],
    {},
  );
  assertEquals(labelsOf(product), ["t"]);
  assertEquals(product.problems.length, 1);
  assert(product.problems[0].includes("stickers") && product.problems[0].includes("emoji"));
  const notices = getNotices();
  assertEquals(notices.map((notice) => [notice.status, notice.text]), [["error", product.problems[0]]]);
  clearNotices();
});

Deno.test("a version mismatch skips the plugin and says which version was found", () => {
  const product = compose(
    [pluginWith("emoji", [placed("e", 1)], { version: "2.0.0" }), pluginWith("stickers", [placed("s", 2)], { requires: { emoji: "^1" } })],
    {},
  );
  assertEquals(labelsOf(product), ["e"]);
  assert(product.problems[0].includes("2.0.0") && product.problems[0].includes("^1"));
  clearNotices();
});

Deno.test("skipping a plugin skips what required it, transitively", () => {
  const product = compose(
    [
      pluginWith("c", [placed("c", 3)], { requires: { b: "^1" } }),
      pluginWith("b", [placed("b", 2)], { requires: { a: "^1" } }),
    ],
    {},
  );
  assertEquals(labelsOf(product), []);
  assertEquals(product.problems.length, 2);
  clearNotices();
});

Deno.test("dependencies register before the plugins that require them", () => {
  const product = compose(
    [pluginWith("late", [placed("l", 5)], { requires: { early: "^1" } }), pluginWith("early", [placed("e", 5)])],
    {},
  );
  assertEquals(labelsOf(product), ["e", "l"]);
});

Deno.test("plugins that need each other are left out with a notice", () => {
  const product = compose(
    [
      pluginWith("a", [placed("a", 1)], { requires: { b: "^1" } }),
      pluginWith("b", [placed("b", 1)], { requires: { a: "^1" } }),
      pluginWith("c", [placed("c", 1)]),
    ],
    {},
  );
  assertEquals(labelsOf(product), ["c"]);
  assertEquals(product.problems.length, 1);
  clearNotices();
});

Deno.test("a duplicate id in one slot is a boot error naming both plugins, and the first one stays", () => {
  const product = compose([pluginWith("first", [placed("same", 1)]), pluginWith("second", [placed("same", 2)])], {});
  assertEquals(labelsOf(product), ["same"]);
  assertEquals(product.registry.slot(itemsSlot)[0].order, 1);
  assertEquals(product.problems.length, 1);
  assert(product.problems[0].includes('"first"') && product.problems[0].includes('"second"') && product.problems[0].includes("test.items"));
  assertEquals(getNotices()[0].status, "error");
  clearNotices();
});

Deno.test("two plugins with one id: the second is left out", () => {
  const product = compose([pluginWith("personality", [placed("one", 1)]), pluginWith("personality", [placed("two", 2)])], {});
  assertEquals(labelsOf(product), ["one"]);
  assertEquals(product.problems.length, 1);
  clearNotices();
});

Deno.test("a product overrides a contribution by slot and id, and only existing ones", () => {
  const product = compose([pluginWith("a", [placed("row", 10)])], {}, {
    override: { "test.items/row": { label: "Changed", order: 5 }, "test.items/missing": { label: "x" } },
  });
  assertEquals(product.registry.slot(itemsSlot).map((item) => [item.label, item.order]), [["Changed", 5]]);
  assertEquals(product.problems.length, 1);
  clearNotices();
});

Deno.test("the registry is frozen after boot", () => {
  const product = compose([pluginWith("a", [placed("row", 1)])], {});
  const items = product.registry.slot(itemsSlot);
  assert(Object.isFrozen(items) && Object.isFrozen(items[0]));
  assertThrows(() => (items as unknown as Item[]).push({ label: "late" }), TypeError);
  assertThrows(() => ((items[0] as Item).label = "late"), TypeError);
  assertEquals("register" in product.registry, false);
  assertEquals(product.registry.slot(slot("test.unused")), []);
});

Deno.test("setup runs once at boot, in order, and teardown runs in reverse", () => {
  const log: string[] = [];
  const make = (id: string, extra = {}) =>
    definePlugin({ id, version: "1.0.0", contributes: [], setup: () => (log.push(`up ${id}`), () => log.push(`down ${id}`)), ...extra });
  const product = compose([make("late", { requires: { early: "^1" } }), make("early")], {});
  assertEquals(log, ["up early", "up late"]);
  product.teardown();
  assertEquals(log, ["up early", "up late", "down late", "down early"]);
  product.teardown();
  assertEquals(log.length, 4);
});

Deno.test("a setup that throws is reported and does not stop the others", () => {
  const log: string[] = [];
  const product = compose([
    definePlugin({ id: "bad", version: "1.0.0", contributes: [], setup: () => { throw new Error("no disk"); } }),
    definePlugin({ id: "good", version: "1.0.0", contributes: [], setup: () => void log.push("good") }),
  ], {});
  assertEquals(log, ["good"]);
  assert(product.problems[0].includes("bad") && product.problems[0].includes("no disk"));
  clearNotices();
});

const emojiTab = slot<{ label: string }>("emoji.tab");

Deno.test("a plugin opens a slot and another plugin contributes to it", () => {
  const emoji = definePlugin({ id: "emoji", version: "1.0.0", slots: [emojiTab], contributes: [contribute(emojiTab, { id: "faces", order: 1, label: "Faces" })] });
  const stickers = definePlugin({
    id: "stickers",
    version: "1.0.0",
    requires: { emoji: "^1" },
    contributes: [contribute(emojiTab, { id: "stickers", order: 2, label: "Stickers" })],
  });
  const product = compose([stickers, emoji], {});
  assertEquals(product.registry.slot(emojiTab).map((tab) => tab.label), ["Faces", "Stickers"]);
  assertEquals(product.problems, []);
});

Deno.test("with the opener removed, the dependent plugin is skipped with a notice and the build still boots", () => {
  const stickers = definePlugin({
    id: "stickers",
    version: "1.0.0",
    requires: { emoji: "^1" },
    contributes: [contribute(emojiTab, { id: "stickers", order: 2, label: "Stickers" })],
  });
  const product = compose([stickers, pluginWith("text", [placed("t", 1)])], {});
  assertEquals(product.registry.slot(emojiTab), []);
  assertEquals(labelsOf(product), ["t"]);
  clearNotices();
});

Deno.test("a contribution to a slot nobody opens is reported", () => {
  const stray = definePlugin({ id: "stray", version: "1.0.0", contributes: [contribute(emojiTab, { id: "x", order: 1, label: "X" })] });
  const product = compose([stray], {});
  assertEquals(product.registry.slot(emojiTab), []);
  assert(product.problems[0].includes("emoji.tab"));
  clearNotices();
});

interface Player {
  play: () => string;
}
const playerKey = service<Player>("voice.player");

Deno.test("a service is provided by one plugin and read by key", () => {
  const voice = definePlugin({ id: "voice", version: "1.0.0", contributes: [], provides: [provide(playerKey, { play: () => "playing" })] });
  const product = compose([voice], {});
  assertEquals(product.registry.service(playerKey)?.play(), "playing");
  assertEquals(compose([], {}).registry.service(playerKey), undefined);
});

Deno.test("two providers of one service: the second is reported", () => {
  const make = (id: string) => definePlugin({ id, version: "1.0.0", contributes: [], provides: [provide(playerKey, { play: () => id })] });
  const product = compose([make("one"), make("two")], {});
  assertEquals(product.registry.service(playerKey)?.play(), "one");
  assertEquals(product.problems.length, 1);
  clearNotices();
});

Deno.test("setup can read services of plugins before it", () => {
  let seen = "";
  const voice = definePlugin({ id: "voice", version: "1.0.0", contributes: [], provides: [provide(playerKey, { play: () => "hi" })] });
  const user = definePlugin({
    id: "user",
    version: "1.0.0",
    requires: { voice: "^1" },
    contributes: [],
    setup: (ctx) => void (seen = ctx.service(playerKey)?.play() ?? ""),
  });
  compose([user, voice], {});
  assertEquals(seen, "hi");
});

Deno.test("hooks read slots sorted, filtered by when, and the service through ctx", () => {
  const voice = definePlugin({ id: "voice", version: "1.0.0", contributes: [], provides: [provide(playerKey, { play: () => "hi" })] });
  const product = compose([
    voice,
    pluginWith("a", [
      placed("late", 20),
      placed("early", 10),
      placed("inRoom", 15, { when: (ctx) => ctx.roomId !== undefined }),
    ]),
  ], {});

  function Probe() {
    const ctx = useCtx();
    const labels = useSlot(itemsSlot, ctx).map((item) => item.label).join(",");
    return <p>{`${labels}|${ctx.service(playerKey)?.play()}|${ctx.roomId}`}</p>;
  }
  const render = (roomId?: string) =>
    renderToStaticMarkup(<product.Root roomId={roomId} navigate={() => {}}><Probe /></product.Root>);
  assertEquals(render(), "<p>early,late|hi|undefined</p>");
  assertEquals(render("r1"), "<p>early,inRoom,late|hi|r1</p>");
  assertThrows(() => renderToStaticMarkup(<Probe />));
});

Deno.test("contribute keeps the slot id of its key", () => {
  assertEquals(contribute(itemsSlot, placed("x", 1)).slot, "test.items");
});

Deno.test("a provided command is on ctx.commands, bound to the context, and a given command stays", () => {
  const seen: unknown[] = [];
  const product = compose(
    [definePlugin({ id: "doer", version: "1.0.0", contributes: [], provides: [provideCommand("do.it", (ctx, word: string) => seen.push([ctx.roomId, word]))] })],
    {},
  );
  const Probe = () => {
    const ctx = useCtx();
    (ctx.commands["do.it"] as (word: string) => void)("now");
    return <p>{Object.keys(ctx.commands).join(",")}</p>;
  };
  const html = renderToStaticMarkup(<product.Root roomId="r1" navigate={() => {}} commands={{ other: () => 1 }}><Probe /></product.Root>);
  assertEquals(seen, [["r1", "now"]]);
  assert(html.includes("other,do.it"));
});
