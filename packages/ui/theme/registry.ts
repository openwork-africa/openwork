/**
 * Theme definitions keyed by their base identifier; scheme and chat density travel with the theme.
 * `scheme` is the colour mode the theme is shown in; dark-only themes never follow the OS.
 * `chat` is how close a conversation's messages sit (Astryx's chat density); a theme that does not say is spacious.
 */
import type { DefinedTheme } from "@astryxdesign/core/theme";
import { whiteTheme } from "./themes/openwork/openworkThemes.ts";
import { type Base, BASE_SCHEME, type Scheme } from "./bases.ts";

export type ChatDensity = "compact" | "balanced" | "spacious";
export const DEFAULT_CHAT_DENSITY: ChatDensity = "spacious";

/** A theme with the scheme it is shown in; a product passes its own one to the shell instead of adding to `THEME_BY_ID`. */
export type ThemeEntry = { theme: DefinedTheme; scheme: Scheme; chat?: ChatDensity };

const registered = new Map<string, ThemeEntry>();

/**
 * Adds a product's own theme under `id`, so the app can select it by id (`ThemeProvider themeId`, `createApp themeId`) without
 * this package importing it. Call once at startup, before the app mounts. A registered theme is not a base: it is not in the
 * picker and not a room background. Registering the same id again replaces it; a built-in base id is refused.
 */
export function registerTheme(id: string, entry: ThemeEntry): void {
  if (Object.hasOwn(THEME_BY_ID, id)) throw new Error(`Theme id is a built-in base: ${id}`);
  registered.set(id, entry);
}

/** The theme registered under `id`, or undefined when none is (built-in bases are not looked up here). */
export function registeredTheme(id: string): ThemeEntry | undefined {
  return registered.get(id);
}

export const THEME_BY_ID: Record<Base, ThemeEntry> = {
  white: { theme: whiteTheme, scheme: BASE_SCHEME.white, chat: "compact" },
};
