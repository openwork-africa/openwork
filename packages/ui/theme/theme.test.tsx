import { assert, assertEquals, assertExists } from "@std/assert";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveThemeToken } from "@astryxdesign/core/theme";
import { applyBase, BASE_SCHEME, BASES, DEFAULT_BASE, getBase, isBase, setBase, STORAGE_KEY, subscribeBase } from "./bases.ts";
import { THEME_BY_ID } from "./registry.ts";
import { readableAccent, themeFor, ThemeProvider } from "./ThemeProvider.tsx";
import { appTokens, brandFoundations, REPLY_WIDTH, replyWidthPx, shellTokens } from "./themes/openwork/brand.ts";

const COVERS = new URL("../assets/covers/", import.meta.url);

Deno.test("every base id resolves to a theme, in the scheme the base states", () => {
  assertEquals(BASES.length, 11);
  for (const base of BASES) {
    assertExists(THEME_BY_ID[base].theme, base);
    assertEquals(THEME_BY_ID[base].scheme, BASE_SCHEME[base], base);
    assertEquals(isBase(base), true);
  }
  assertEquals(isBase("nope"), false);
});

Deno.test("every base has a cover picture", () => {
  for (const base of BASES) assertEquals(Deno.statSync(new URL(`${base}.jpg`, COVERS)).isFile, true, base);
});

Deno.test("the default base is white, in light, with compact chat", () => {
  assertEquals(DEFAULT_BASE, "white");
  assertEquals(themeFor().base, "white");
  assertEquals(themeFor().scheme, "light");
  assertEquals(THEME_BY_ID.white.chat, "compact");
});

Deno.test("uploaded accents are contrast-adjusted against the base and choose readable foreground text", () => {
  const result = readableAccent("white", "#ffff00");
  assert(result.accent !== "#ffff00");
  assert(["#000000", "#ffffff"].includes(result.onAccent));
  assert(["#000000", "#ffffff"].includes(readableAccent("white", "#d14c2c").onAccent));
});

const colour = (base: keyof typeof THEME_BY_ID, token: string, mode: "light" | "dark") => resolveThemeToken(THEME_BY_ID[base].theme, token, { mode });

Deno.test("token values equal the source's", () => {
  const table: [keyof typeof THEME_BY_ID, "light" | "dark", string, string][] = [
    ["white", "light", "--color-accent", "#1397c1"],
    ["white", "light", "--color-background-body", "#f8f7f5"],
    ["white", "light", "--color-text-primary", "#000000"],
    ["midnight", "dark", "--color-accent", "#ffffff"],
    ["nightshade", "dark", "--color-accent", "#c084fc"],
    ["ember", "dark", "--color-background-body", "#210f07"],
    ["white", "light", "--radius-chat", "12px"],
  ];
  for (const [base, mode, token, expected] of table) assertEquals(colour(base, token, mode).toLowerCase(), expected, `${base} ${token}`);
});

Deno.test("brand foundations and shell proportions equal the source's", () => {
  assertEquals(appTokens, { "--radius-chat": "var(--radius-element)" });
  assertEquals(brandFoundations.typography.scale, { base: 16, ratio: 1.2 });
  assertEquals(brandFoundations.radius, { base: 6, multiplier: 1 });
  assertEquals(brandFoundations.motion, { fast: 150, medium: 320, ratio: 0.75 });
  assertEquals(shellTokens["--shell-list-width"], "max(calc(var(--spacing-12) * 6), calc(100vw * 0.2298))");
  assertEquals(shellTokens["--shell-panel-width"], "max(calc(var(--spacing-12) * 7), calc(100vw * 0.2660))");
  assertEquals(shellTokens["--shell-board-column-width"], "max(calc(var(--spacing-12) * 5), calc(100vw * 0.1781))");
  assertEquals(shellTokens["--shell-thread-width"], "50rem");
  assertEquals(REPLY_WIDTH, { share: 0.45, floorTiles: 6 });
  assertEquals(replyWidthPx(800, 1000), 360);
  assertEquals(replyWidthPx(400, 1000), 288);
  assertEquals(replyWidthPx(800, 200), 200);
});

function withStorage(initial: Record<string, string>, run: () => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = { ...initial };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => values[key] ?? null, setItem: (key: string, value: string) => void (values[key] = value) },
  });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
  }
}

Deno.test("the chosen base is kept on the device under ow-base and announced", () => {
  withStorage({}, () => {
    assertEquals(getBase(), "white");
    let heard = 0;
    const stop = subscribeBase(() => heard++);
    setBase("midnight");
    assertEquals([getBase(), heard], ["midnight", 1]);
    assertEquals(globalThis.localStorage.getItem(STORAGE_KEY), "midnight");
    stop();
    setBase("white");
    assertEquals(heard, 1);
  });
});

Deno.test("the base is put on the page as data-base", () => {
  const attributes: Record<string, string> = {};
  applyBase("gothic", { setAttribute: (name, value) => void (attributes[name] = value) });
  assertEquals(attributes, { "data-base": "gothic" });
});

Deno.test("ThemeProvider renders its children under the default theme", () => {
  assertEquals(
    renderToStaticMarkup(
      <ThemeProvider>
        <p>inside</p>
      </ThemeProvider>,
    ).includes("<p>inside</p>"),
    true,
  );
});
