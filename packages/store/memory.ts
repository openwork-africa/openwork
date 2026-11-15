import type { Database, Tx } from "./database.ts";
import { type Live, makeLive } from "./live.ts";
import { type Clock, type FileStore, systemClock } from "./ports.ts";
import { TableDeviceStore } from "./tableStore.ts";
import type { Change, FileItem, Message, OutboxRow, Room } from "./types.ts";

export class MemoryDatabase implements Database {
  readonly #rooms = new Map<string, Room>();
  readonly #messages = new Map<string, Message>();
  readonly #files = new Map<string, FileItem>();
  readonly #outbox = new Map<string, OutboxRow>();
  readonly #meta = new Map<string, number>();
  readonly #watchers = new Set<() => void>();
  #queue: Promise<unknown> = Promise.resolve();

  readonly #tx: Tx = {
    room: (id) => Promise.resolve(this.#rooms.get(id)),
    rooms: () => Promise.resolve([...this.#rooms.values()]),
    message: (id) => Promise.resolve(this.#messages.get(id)),
    messagesOf: (roomId) => Promise.resolve([...this.#messages.values()].filter((message) => message.roomId === roomId)),
    file: (id) => Promise.resolve(this.#files.get(id)),
    record: (kind, id) => Promise.resolve(this.#tables[kind].get(id) as Change["data"] | undefined),
    put: (change) => Promise.resolve(void this.#tables[change.kind].set(change.id, change.data as never)),
    outbox: () => Promise.resolve([...this.#outbox.values()]),
    outboxRow: (key) => Promise.resolve(this.#outbox.get(key)),
    putOutbox: (row) => Promise.resolve(void this.#outbox.set(row.key, row)),
    deleteOutbox: (key) => Promise.resolve(void this.#outbox.delete(key)),
    meta: (key) => Promise.resolve(this.#meta.get(key)),
    setMeta: (key, value) => Promise.resolve(void this.#meta.set(key, value)),
  };

  get #tables() {
    return { room: this.#rooms, message: this.#messages, file: this.#files } as const;
  }

  transact<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const done = this.#queue.then(() => work(this.#tx));
    this.#queue = done.catch(() => {});
    return done.finally(() => this.#watchers.forEach((watcher) => watcher()));
  }

  watch<T>(read: (tx: Tx) => Promise<T>): Live<T> {
    return makeLive<T>((emit) => {
      let active = true;
      const run = () => void read(this.#tx).then((value) => active && emit(value));
      this.#watchers.add(run);
      run();
      return () => {
        active = false;
        this.#watchers.delete(run);
      };
    });
  }
}

export class MemoryDeviceStore extends TableDeviceStore {
  constructor(clock: Clock = systemClock) {
    super(new MemoryDatabase(), clock);
  }
}

export class MemoryFileStore implements FileStore {
  readonly #blobs = new Map<string, Blob>();

  put = (id: string, bytes: Blob): Promise<void> => Promise.resolve(void this.#blobs.set(id, bytes));
  get = (id: string): Promise<Blob | undefined> => Promise.resolve(this.#blobs.get(id));
  remove = (id: string): Promise<void> => Promise.resolve(void this.#blobs.delete(id));
}
