/**
 * Every selectable theme, in picker order: Worklyn's own first, then the Astryx set.
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
import type { Base, Scheme } from "./bases.ts";

export type ChatDensity = "compact" | "balanced" | "spacious";
export const DEFAULT_CHAT_DENSITY: ChatDensity = "spacious";

export const THEME_BY_ID: Record<Base, { theme: DefinedTheme; scheme: Scheme; chat?: ChatDensity }> = {
  white: { theme: whiteTheme, scheme: "light", chat: "compact" },
  midnight: { theme: midnightTheme, scheme: "dark" },
  nightshade: { theme: nightshadeTheme, scheme: "dark", chat: "compact" },
  ember: { theme: emberTheme, scheme: "dark" },
  neutral: { theme: withAppTokens(neutralTheme), scheme: "system" },
  butter: { theme: withAppTokens(butterTheme), scheme: "system" },
  chocolate: { theme: withAppTokens(chocolateTheme, legibleSecondaryText(80)), scheme: "system" },
  gothic: { theme: withAppTokens(gothicTheme), scheme: "dark" },
  matcha: { theme: withAppTokens(matchaTheme, legibleSecondaryText(90)), scheme: "system" },
  stone: { theme: withAppTokens(stoneTheme), scheme: "system" },
  y2k: { theme: withAppTokens(y2kTheme, legibleSecondaryText(80)), scheme: "system" },
};
