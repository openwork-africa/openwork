# Themes

Openwork ships one theme. Everything else is registered by the app that wants it, so a product's brand lives in the product and never in this repo.

## The built-in theme

`white` is the only built-in theme (`DEFAULT_BASE`, light, compact chat). It is the only id in `BASES`, `THEME_BASES` (the background picker) and `THEME_BY_ID`, and the only valid room background name.

## Registering your own

Call `registerTheme` once at startup, before `createApp`:

```ts
import { registerTheme } from "@openwork/ui";

registerTheme(id: string, entry: ThemeEntry): void;

type ThemeEntry = {
  theme: DefinedTheme;                          // an Astryx theme (defineTheme / a built theme)
  scheme: "light" | "dark" | "system";          // the colour mode it is shown in
  chat?: "compact" | "balanced" | "spacious";   // message spacing; spacious when omitted
};
```

Registering the same id again replaces it. A built-in id (`white`) throws. `registeredTheme(id)` returns the entry, or `undefined`.
A registered theme is not a base: it does not appear in the picker and cannot be a room's background.

## Selecting it

- `createApp({ ..., themeId: "bua" })` (the id given to `registerTheme`).
- Or `<ThemeProvider themeId="bua">` directly.
- `createApp({ theme: entry })` (a theme object, no registration) still works; if both `theme` and `themeId` are given, `theme` wins.

## How the choices combine

1. A room's own background that names a base (`white`) wins while that room is open.
2. Otherwise the app's theme (`theme`, else the registered `themeId`).
3. Otherwise the device base (the one stored under `ow-base`), which is `white` unless changed.

An unknown `themeId`, or a room background that is not a base, is ignored and falls through to the next rule, so the result is `white`. Nothing throws. While a registered theme is shown, `data-base` on the page is `white`.

## Example: a bua-style theme that lives in the app

```ts
// bua/app/main.tsx
import { registerTheme } from "@openwork/ui";
import { createApp } from "@openwork/shell/app";
import { themes } from "./src/astryx-themes.js"; // bua's own theme module, also loads its CSS and fonts
import { buaPlugins, regions } from "./product.ts";

registerTheme("bua", { theme: themes.bua, scheme: "system" });

createApp({ plugins: buaPlugins, regions, serviceWorker: false, themeId: "bua" });
```
