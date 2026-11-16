import { createContext, type ReactNode, useContext, useEffect, useSyncExternalStore } from "react";
import { resolveThemeToken, Theme } from "@astryxdesign/core/theme";
import { applyBase, type Base, DEFAULT_BASE, getBase, subscribeBase } from "./bases.ts";
import { type ChatDensity, DEFAULT_CHAT_DENSITY, THEME_BY_ID } from "./registry.ts";

function useDeviceBase(): Base {
  return useSyncExternalStore(subscribeBase, getBase, () => DEFAULT_BASE);
}

const ShownBase = createContext<Base | null>(null);

function useChosenBase(): Base {
  const device = useDeviceBase();
  return useContext(ShownBase) ?? device;
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
  return THEME_BY_ID[useChosenBase()].chat ?? DEFAULT_CHAT_DENSITY;
}

/**
 * The one place the app's theme is chosen. Everything below reads Astryx tokens, so a theme change
 * here (and a theme's own file) is the only edit a visual change ever needs. `base` overrides the device's
 * base while it is given: the shell passes the open conversation's own.
 */
export function ThemeProvider({ children, base }: { children: ReactNode; base?: Base }) {
  const device = useDeviceBase();
  const active = themeFor(base ?? device);
  useEffect(() => {
    applyBase(active.base);
  }, [active.base]);
  return (
    <ShownBase.Provider value={active.base}>
      <Theme theme={active.theme} mode={active.scheme}>{children}</Theme>
    </ShownBase.Provider>
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
