import { createContext, type ReactNode, useContext, useEffect, useSyncExternalStore } from "react";
import { defineTheme, resolveThemeToken, Theme } from "@astryxdesign/core/theme";
import { applyBase, type Base, DEFAULT_BASE, getBase, subscribeBase } from "./bases.ts";
import { type ChatDensity, DEFAULT_CHAT_DENSITY, THEME_BY_ID, type ThemeEntry } from "./registry.ts";

const rgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) as [
    number,
    number,
    number,
  ];
const luminance = (hex: string): number => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
const mix = (a: string, b: string, amount: number): string =>
  `#${
    [1, 3, 5].map((at) =>
      Math.round(parseInt(a.slice(at, at + 2), 16) * (1 - amount) + parseInt(b.slice(at, at + 2), 16) * amount).toString(16).padStart(2, "0")
    ).join("")
  }`;

export function readableAccent(base: Base, accent: string, entry: ThemeEntry = THEME_BY_ID[base]): { accent: string; onAccent: string } {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) return { accent, onAccent: "#000000" };
  const { theme, scheme } = entry;
  const mode = scheme === "system" ? "light" : scheme;
  const surface = resolveThemeToken(theme, "--color-background-body", { mode });
  let adjusted = accent;
  if (contrast(adjusted, surface) < 4.5) {
    const target = contrast("#000000", surface) >= contrast("#ffffff", surface) ? "#000000" : "#ffffff";
    for (let step = 1; step <= 100; step++) {
      const candidate = mix(accent, target, step / 100);
      if (contrast(candidate, surface) >= 4.5) {
        adjusted = candidate;
        break;
      }
    }
  }
  return { accent: adjusted, onAccent: contrast(adjusted, "#000000") >= contrast(adjusted, "#ffffff") ? "#000000" : "#ffffff" };
}

function useDeviceBase(): Base {
  return useSyncExternalStore(subscribeBase, getBase, () => DEFAULT_BASE);
}

const Shown = createContext<(ThemeEntry & { base: Base }) | null>(null);

function useChosenBase(): Base {
  const device = useDeviceBase();
  return useContext(Shown)?.base ?? device;
}

/** The theme of a base, the scheme it is shown in and how close it sets a conversation's messages. */
export function themeFor(base: Base = DEFAULT_BASE) {
  return { ...THEME_BY_ID[base], base };
}

/** The base the app is shown in: the open conversation's own when it has one, else the one chosen on this device. */
export function useBase(): Base {
  return useChosenBase();
}

/** How close the theme sets a conversation's messages: the gap between rows, and under the last one. */
export function useChatDensity(): ChatDensity {
  const shown = useContext(Shown);
  return (shown ?? THEME_BY_ID[useChosenBase()]).chat ?? DEFAULT_CHAT_DENSITY;
}

/**
 * The one place the app's theme is chosen. Everything below reads Astryx tokens, so a theme change
 * here (and a theme's own file) is the only edit a visual change ever needs. `base` overrides the device's
 * base while it is given: the shell passes the open conversation's own. `theme` is a product's own theme, passed in
 * by the app (so this package never imports one): it stands in for the device's base, and a given `base` still wins.
 */
export function ThemeProvider({ children, base, accent, theme: own }: { children: ReactNode; base?: Base; accent?: string; theme?: ThemeEntry }) {
  const device = useDeviceBase();
  const active = base || !own ? themeFor(base ?? device) : { ...own, base: DEFAULT_BASE };
  const readable = accent ? readableAccent(active.base, accent, active) : undefined;
  const theme = readable && /^#[0-9a-f]{6}$/i.test(readable.accent)
    ? defineTheme({ name: "room-accent", extends: active.theme, tokens: { "--color-accent": readable.accent, "--color-on-accent": readable.onAccent } })
    : active.theme;
  useEffect(() => {
    applyBase(active.base);
  }, [active.base]);
  return (
    <Shown.Provider value={active}>
      <Theme theme={theme} mode={active.scheme}>{children}</Theme>
    </Shown.Provider>
  );
}

/** A theme's own body and accent colours, resolved from its tokens: what a picker's swatches show. */
export function swatchOf(base: Base): { surface: string; accent: string } {
  const { theme, scheme } = THEME_BY_ID[base];
  const mode = scheme === "system" ? "light" : scheme;
  return {
    surface: resolveThemeToken(theme, "--color-background-body", { mode }),
    accent: resolveThemeToken(theme, "--color-accent", { mode }),
  };
}
