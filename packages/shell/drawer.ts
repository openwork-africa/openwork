import { useSyncExternalStore } from "react";

export type Drawer = "none" | "list" | "panel";

let drawer: Drawer = "none";
const listeners = new Set<() => void>();

/** Which phone drawer is open over the frame: the list from the left, the panel from the right. */
export const shellUi = {
  drawer: (): Drawer => drawer,
  setDrawer(next: Drawer): void {
    if (next === drawer) return;
    drawer = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

export const useDrawer = (): Drawer => useSyncExternalStore(shellUi.subscribe, shellUi.drawer, shellUi.drawer);

export function nextDrawer(current: Drawer, direction: "left" | "right", listIsDrawer = true): Drawer {
  if (direction === "right") {
    if (current === "panel") return "none";
    return listIsDrawer ? "list" : current;
  }
  return current === "list" ? "none" : "panel";
}
