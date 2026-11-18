import { assert, assertEquals } from "@std/assert";
import type { Plugin } from "@openwork/kit";
import { labelled } from "@openwork/ui/testing";
import { type Booted, bootProduct, errorNotices, flush } from "./harness.tsx";
import { openPlugins } from "./product.ts";

const without = (id: string): Plugin[] => openPlugins.filter((plugin) => plugin.id !== id);
const message = (app: Booted): Element | null => app.container.querySelector('[id^="msg-"]');

async function openSeededRoom(app: Booted): Promise<string> {
  const room = await app.store.createRoom("Notes");
  await app.store.send(room.id, "**hello** there");
  app.shell.router.navigate(`/c/${room.id}`);
  await flush();
  return room.id;
}

/** `deno task test:remove-each <id>` runs one removal; with no id it runs all five. */
const only = Deno.args[0];

const removals: Record<string, (app: Booted) => Promise<void>> = {
  circle: async (app) => {
    await flush();
    assert(app.path().startsWith("/c/"), "rooms: the app opens into a room");
    await openSeededRoom(app);
    assertEquals(app.container.querySelector(".convo-circle"), null, "no list");
    assert(message(app)?.querySelector("strong"), "text draws Markdown");
    assert(app.container.querySelector(".contact-hero-body"), "profile draws the panel section");
  },
  panel: async (app) => {
    await openSeededRoom(app);
    assertEquals(app.container.querySelector(".contact-panel"), null, "no panel");
    assert(app.container.querySelector(".convo-circle-list"), "the list stays");
    assert(message(app)?.querySelector("strong"), "text draws Markdown");
  },
  rooms: async (app) => {
    await openSeededRoom(app);
    assertEquals(labelled(app.container, "New"), null);
    assert(message(app)?.querySelector("strong"), "text draws Markdown");
    assert(app.container.querySelector(".contact-hero-body"), "profile draws the panel section");
  },
  text: async (app) => {
    await flush();
    assert(app.path().startsWith("/c/"), "rooms: the app opens into a room");
    await flush();
    assert(app.container.querySelector(".contact-hero-body"), "profile draws the panel section");
    await openSeededRoom(app);
    assert(message(app)?.textContent?.includes("**hello** there"), "the words are not Markdown");
    assertEquals(message(app)?.querySelector("strong"), null);
  },
  profile: async (app) => {
    await flush();
    assert(app.path().startsWith("/c/"), "rooms: the app opens into a room");
    await openSeededRoom(app);
    assertEquals(app.container.querySelector(".contact-hero-body"), null);
    assert(message(app)?.querySelector("strong"), "text draws Markdown");
  },
};

for (const [id, check] of Object.entries(removals)) {
  if (only && only !== id) continue;
  Deno.test(`remove ${id}: it boots without it, and the others still work (a notice only for the panel's profile)`, async () => {
    const app = await bootProduct(without(id));
    // The profile builds on the panel: without it the profile is skipped with a notice, and everything else boots.
    const notices = id === "panel" ? 1 : 0;
    assertEquals(app.shell.product.problems.length, notices);
    await check(app);
    assertEquals(errorNotices().length, notices);
    await app.stop();
  });
}
