import { useSyncExternalStore } from "react";

/** A value that changes over time. `get()` is `undefined` until the first value arrives (loading). */
export interface Live<T> {
  get(): T | undefined;
  subscribe(listener: () => void): () => void;
}

/** A live value fed by `start`, which is called with the first subscriber and stopped with the last. */
export function makeLive<T>(start: (emit: (value: T) => void) => () => void): Live<T> {
  let value: T | undefined;
  let stop: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const emit = (next: T): void => {
    value = next;
    listeners.forEach((listener) => listener());
  };
  return {
    get: () => value,
    subscribe(listener) {
      listeners.add(listener);
      stop ??= start(emit);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = undefined;
        }
      };
    },
  };
}

/** A live value held by hand, for state the store itself owns. */
export function makeCell<T>(initial: T): Live<T> & { set(next: T): void } {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export const useLive = <T,>(live: Live<T>): T | undefined => useSyncExternalStore(live.subscribe, live.get, live.get);
