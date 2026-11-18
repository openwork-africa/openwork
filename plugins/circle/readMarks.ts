const KEY = "openwork.readMarks";

export interface ReadMarks {
  /** When the room was last read on this device (epoch ms), if it ever was. */
  get(roomId: string): number | undefined;
  set(roomId: string, at: number): void;
  subscribe?(listener: () => void): () => void;
}

/** Read marks kept on this device only: a room's newest read message time. An in-memory map stands in where there is no localStorage. */
export function deviceReadMarks(
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage,
): ReadMarks {
  const read = (): Record<string, number> => {
    try {
      return JSON.parse(storage?.getItem(KEY) ?? "{}");
    } catch {
      return {};
    }
  };
  let marks = read();
  const listeners = new Set<() => void>();
  return {
    get: (roomId) => marks[roomId],
    set(roomId, at) {
      marks = { ...marks, [roomId]: at };
      listeners.forEach((listener) => listener());
      try {
        storage?.setItem(KEY, JSON.stringify(marks));
      } catch { /* the marks then live for this session only */ }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
