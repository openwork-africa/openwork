import { createContext, useContext, useSyncExternalStore } from "react";
import { DRAWER_PHONE_QUERY } from "@openwork/ui";

export type Drawer = "none" | "list" | "panel";

export interface DrawerState {
  drawer(): Drawer;
  setDrawer(next: Drawer): void;
  subscribe(listener: () => void): () => void;
}

export function createDrawer(): DrawerState {
  let drawer: Drawer = "none";
  const listeners = new Set<() => void>();
  return {
    drawer: () => drawer,
    setDrawer(next) {
      if (next === drawer) return;
      drawer = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export const DrawerContext = createContext<DrawerState | null>(null);

export const useDrawerState = (): DrawerState | null => useContext(DrawerContext);

export const useDrawer = (): Drawer => {
  const state = useDrawerState();
  if (!state) throw new Error("DrawerContext is missing");
  return useSyncExternalStore(state.subscribe, state.drawer, state.drawer);
};

export function nextDrawer(current: Drawer, direction: "left" | "right", listIsDrawer = true): Drawer {
  if (direction === "right") {
    if (current === "panel") return "none";
    return listIsDrawer ? "list" : current;
  }
  return current === "list" ? "none" : "panel";
}

/** On a phone the list and panel are drawers; without a media query treat the page as a phone. */
export const listIsDrawer = (): boolean => globalThis.matchMedia?.(DRAWER_PHONE_QUERY).matches ?? true;
