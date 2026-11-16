import { assertEquals } from "jsr:@std/assert@^1";
import { checkFitness } from "./fitness.ts";

const repositoryRoot = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function plant(files: Record<string, string>): string {
  const root = Deno.makeTempDirSync();
  for (const [path, text] of Object.entries(files)) {
    const full = `${root}/${path}`;
    Deno.mkdirSync(full.slice(0, full.lastIndexOf("/")), { recursive: true });
    Deno.writeTextFileSync(full, text);
  }
  return root;
}

const manifest = (name: string) => JSON.stringify({ name, version: "0.1.0", exports: "./mod.ts" });

function rulesFor(files: Record<string, string>): string[] {
  const root = plant(files);
  try {
    return checkFitness(root).map((violation) => `${violation.rule}:${violation.file}`).sort();
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
}

Deno.test("the repository passes its own fitness rules", () => {
  assertEquals(checkFitness(repositoryRoot), []);
});

Deno.test("a clean workspace has no violations", () => {
  assertEquals(
    rulesFor({
      "packages/kit/deno.json": manifest("@openwork/kit"),
      "packages/kit/mod.ts": 'export const answer = 42;\n',
      "plugins/a/deno.json": manifest("@openwork/plugin-a"),
      "plugins/a/plugin.ts": 'import { answer } from "@openwork/kit";\nexport const a = answer;\n',
    }),
    [],
  );
});

Deno.test("a package importing a plugin or the app is caught", () => {
  assertEquals(
    rulesFor({
      "packages/kit/deno.json": manifest("@openwork/kit"),
      "packages/kit/mod.ts": 'import "../../plugins/a/plugin.ts";\nimport "@openwork/app";\n',
    }),
    ["frame-imports:packages/kit/mod.ts", "frame-imports:packages/kit/mod.ts"],
  );
});

Deno.test("a plugin reaching into another plugin is caught, slots.ts with requires is allowed", () => {
  const base = {
    "plugins/a/deno.json": manifest("@openwork/plugin-a"),
    "plugins/b/deno.json": manifest("@openwork/plugin-b"),
    "plugins/b/slots.ts": "export const slot = 1;\n",
    "plugins/b/internal.ts": "export const hidden = 1;\n",
  };
  assertEquals(rulesFor({ ...base, "plugins/a/plugin.ts": 'import { hidden } from "../b/internal.ts";\nexport const a = hidden;\n' }), [
    "plugin-imports:plugins/a/plugin.ts",
  ]);
  assertEquals(rulesFor({ ...base, "plugins/a/plugin.ts": 'import { slot } from "@openwork/plugin-b/slots.ts";\nexport const a = slot;\n' }), [
    "plugin-imports:plugins/a/plugin.ts",
  ]);
  assertEquals(
    rulesFor({ ...base, "plugins/a/plugin.ts": 'import { slot } from "../b/slots.ts";\nexport const requires = { requires: { b: "^1" } };\nexport const a = slot;\n' }),
    [],
  );
});

Deno.test("references to closed products are caught", () => {
  const closed = ["std", "openwork", "africa"].join(".");
  assertEquals(
    rulesFor({ "packages/kit/deno.json": manifest("@openwork/kit"), "packages/kit/mod.ts": `import "../../../${closed}/model/mod.ts";\n` }),
    ["frame-imports:packages/kit/mod.ts", "no-closed-references:packages/kit/mod.ts"],
  );
});

Deno.test("a file over 300 lines is caught", () => {
  assertEquals(
    rulesFor({ "packages/kit/deno.json": manifest("@openwork/kit"), "packages/kit/long.ts": "export const a = 1;\n".repeat(301) }),
    ["file-length:packages/kit/long.ts"],
  );
});

Deno.test("raw layout elements, hex colours and px values are caught, comments and tests are not", () => {
  const raw = "<" + "div>";
  assertEquals(
    rulesFor({
      "packages/kit/deno.json": manifest("@openwork/kit"),
      "packages/kit/View.tsx": `export const View = () => ${raw};\n`,
      "packages/kit/colour.ts": 'export const colour = "#ff0000";\n',
      "packages/kit/size.ts": 'export const size = "16px";\n',
      "packages/kit/note.ts": "// a 16px note about #ff0000\nexport const quiet = 1;\n",
      "packages/kit/View.test.tsx": `export const test = ${raw};\n`,
    }),
    ["no-hex:packages/kit/colour.ts", "no-px:packages/kit/size.ts", "no-raw-layout:packages/kit/View.tsx"],
  );
});

Deno.test("a package manifest without name, version or exports is caught", () => {
  assertEquals(
    rulesFor({ "packages/kit/deno.json": JSON.stringify({ name: "@openwork/kit" }) }),
    ["manifest:packages/kit/deno.json", "manifest:packages/kit/deno.json"],
  );
});

Deno.test("Rust files are held to the length limit and the closed-reference rule", () => {
  const closed = ["std", "openwork", "africa"].join(".");
  assertEquals(
    rulesFor({
      "server/crates/a/src/long.rs": "const A: u8 = 1;\n".repeat(301),
      "server/crates/a/src/closed.rs": `// see ${closed}\n`,
      "server/crates/a/src/fine.rs": "const A: u8 = 1;\n",
    }),
    ["file-length:server/crates/a/src/long.rs", "no-closed-references:server/crates/a/src/closed.rs"],
  );
});
