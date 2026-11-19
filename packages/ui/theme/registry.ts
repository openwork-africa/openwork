/**
 * Theme definitions keyed by their base identifier; scheme and chat density travel with the theme.
 * `scheme` is the colour mode the theme is shown in; dark-only themes never follow the OS.
 * `chat` is how close a conversation's messages sit (Astryx's chat density); a theme that does not say is spacious.
 */
import type { DefinedTheme } from "@astryxdesign/core/theme";
import { legibleSecondaryText, withAppTokens } from "./themes/openwork/brand.ts";
import { emberTheme, midnightTheme, nightshadeTheme, whiteTheme } from "./themes/openwork/openworkThemes.ts";
import { neutralTheme } from "./themes/neutral/neutralTheme.ts";
import { butterTheme } from "./themes/butter/butterTheme.ts";
import { chocolateTheme } from "./themes/chocolate/chocolateTheme.ts";
import { gothicTheme } from "./themes/gothic/gothicTheme.ts";
import { matchaTheme } from "./themes/matcha/matchaTheme.ts";
import { stoneTheme } from "./themes/stone/stoneTheme.ts";
import { y2kTheme } from "./themes/y2k/y2kTheme.ts";
import { type Base, BASE_SCHEME, type Scheme } from "./bases.ts";

export type ChatDensity = "compact" | "balanced" | "spacious";
export const DEFAULT_CHAT_DENSITY: ChatDensity = "spacious";

/** A theme with the scheme it is shown in; a product passes its own one to the shell instead of adding to `THEME_BY_ID`. */
export type ThemeEntry = { theme: DefinedTheme; scheme: Scheme; chat?: ChatDensity };

export const THEME_BY_ID: Record<Base, ThemeEntry> = {
  white: { theme: whiteTheme, scheme: BASE_SCHEME.white, chat: "compact" },
  midnight: { theme: midnightTheme, scheme: BASE_SCHEME.midnight },
  nightshade: { theme: nightshadeTheme, scheme: BASE_SCHEME.nightshade, chat: "compact" },
  ember: { theme: emberTheme, scheme: BASE_SCHEME.ember },
  neutral: { theme: withAppTokens(neutralTheme), scheme: BASE_SCHEME.neutral },
  butter: { theme: withAppTokens(butterTheme), scheme: BASE_SCHEME.butter },
  chocolate: { theme: withAppTokens(chocolateTheme, legibleSecondaryText(80)), scheme: BASE_SCHEME.chocolate },
  gothic: { theme: withAppTokens(gothicTheme), scheme: BASE_SCHEME.gothic },
  matcha: { theme: withAppTokens(matchaTheme, legibleSecondaryText(90)), scheme: BASE_SCHEME.matcha },
  stone: { theme: withAppTokens(stoneTheme), scheme: BASE_SCHEME.stone },
  y2k: { theme: withAppTokens(y2kTheme, legibleSecondaryText(80)), scheme: BASE_SCHEME.y2k },
};
