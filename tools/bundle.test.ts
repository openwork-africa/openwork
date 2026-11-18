import { assert } from "jsr:@std/assert@^1";

/** Strings only the circle plugin's code and the panel plugin's code contain, and one the window contains. */
const CIRCLE = ["Delete this?", "convo-circle-list"];
const PANEL = ["contact-scroll"];
const WINDOW = ["conversation-empty-scroller"];

async function build(product: "bare" | "full"): Promise<{ js: string; files: string[] }> {
  const out = await Deno.makeTempDir({ prefix: `openwork-${product}-` });
  const result = await new Deno.Command("deno", {
    args: ["run", "-A", "npm:vite@^7", "build", "--logLevel", "error"],
    cwd: new URL("../app", import.meta.url).pathname,
    env: { OPENWORK_PRODUCT: product, OPENWORK_OUT: out },
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  const files: string[] = [];
  for await (const entry of Deno.readDir(`${out}/assets`)) if (entry.name.endsWith(".js")) files.push(entry.name);
  const js = (await Promise.all(files.map((name) => Deno.readTextFile(`${out}/assets/${name}`)))).join("\n");
  await Deno.remove(out, { recursive: true });
  return { js, files };
}

Deno.test({
  name: "granular bundling: the bare product's bundle has no circle or panel code, the full product's has both",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const bare = await build("bare");
    const full = await build("full");
    for (const marker of WINDOW) assert(bare.js.includes(marker), `the bare bundle has the window (${marker})`);
    for (const marker of [...CIRCLE, ...PANEL]) {
      assert(!bare.js.includes(marker), `the bare bundle must not contain "${marker}"`);
      assert(full.js.includes(marker), `the full bundle contains "${marker}"`);
    }
    assert(full.files.length > bare.files.length, "the circle and the panel are their own chunks in the full product");
    console.log(`bare: ${bare.files.length} js files, ${bare.js.length} bytes; full: ${full.files.length} js files, ${full.js.length} bytes`);
  },
});
