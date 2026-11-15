import type { Connectivity } from "./ports.ts";

/** The browser's own word on whether the device is online, and its online/offline events. */
export const browserConnectivity: Connectivity = {
  isOnline: () => globalThis.navigator?.onLine !== false,
  subscribe(listener) {
    globalThis.addEventListener("online", listener);
    globalThis.addEventListener("offline", listener);
    return () => {
      globalThis.removeEventListener("online", listener);
      globalThis.removeEventListener("offline", listener);
    };
  },
};

/** Connectivity set by hand, for tests. */
export function manualConnectivity(online = true): Connectivity & { set(next: boolean): void } {
  const listeners = new Set<() => void>();
  return {
    isOnline: () => online,
    set(next) {
      online = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
