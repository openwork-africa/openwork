import { assert, assertEquals } from "@std/assert";
import type { Plugin } from "@openwork/kit";
import { bootProduct, type Booted, click, errorNotices, flush } from "./harness.tsx";
import { openPlugins } from "./product.ts";

const labelled = (container: HTMLElement, label: string): HTMLElement | null => container.querySelector(`[aria-label="${label}"]`);
const without = (id: string): Plugin[] => openPlugins.filter((plugin) => plugin.id !== id);
const message = (app: Booted): Element | null => app.container.querySelector('[id^="msg-"]');

async function openSeededRoom(app: Booted): Promise<string> {
  const room = await app.store.createRoom("Notes");
  await app.store.send(room.id, "**hello** there");
  app.shell.router.navigate(`/c/${room.id}`);
  await flush();
  return room.id;
}

/** `deno task test:remove-each <id>` runs one removal; with no id it runs all three. */
const only = Deno.args[0];

const removals: Record<string, (app: Booted) => Promise<void>> = {
  rooms: async (app) => {
    await openSeededRoom(app);
    assertEquals(labelled(app.container, "New"), null);
    assert(message(app)?.querySelector("strong"), "text draws Markdown");
    assert(app.container.querySelector(".contact-hero-body"), "profile draws the panel section");
  },
  text: async (app) => {
    await click(app.container.querySelector(".convo-loading button"));
    assert(app.path().startsWith("/c/"), "rooms: New opens a room");
    await flush();
    assert(app.container.querySelector(".contact-hero-body"), "profile draws the panel section");
    await openSeededRoom(app);
    assert(message(app)?.textContent?.includes("**hello** there"), "the words are not Markdown");
    assertEquals(message(app)?.querySelector("strong"), null);
  },
  profile: async (app) => {
    await click(app.container.querySelector(".convo-loading button"));
    assert(app.path().startsWith("/c/"), "rooms: New opens a room");
    await openSeededRoom(app);
    assertEquals(app.container.querySelector(".contact-hero-body"), null);
    assert(message(app)?.querySelector("strong"), "text draws Markdown");
  },
};

for (const [id, check] of Object.entries(removals)) {
  if (only && only !== id) continue;
  Deno.test(`remove ${id}: it boots without it, raises no error notice, and the other two still work`, async () => {
    const app = await bootProduct(without(id));
    assertEquals(app.shell.product.problems, []);
    await check(app);
    assertEquals(errorNotices(), []);
    await app.stop();
  });
}
