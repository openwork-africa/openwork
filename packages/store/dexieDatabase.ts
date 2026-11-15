import { Dexie, type EntityTable, liveQuery } from "dexie";
import type { Database, Tx } from "./database.ts";
import { type Live, makeLive } from "./live.ts";
import type { FileItem, Message, OutboxRow, Room } from "./types.ts";
import { TableDeviceStore } from "./tableStore.ts";
import { type Clock, systemClock } from "./ports.ts";

export interface BlobRow {
  id: string;
  bytes: Blob;
}

interface MetaRow {
  key: string;
  value: number;
}

export interface DexieOptions {
  name?: string;
  indexedDB?: IDBFactory;
  IDBKeyRange?: typeof IDBKeyRange;
}

export class OpenworkDb extends Dexie {
  rooms!: EntityTable<Room, "id">;
  messages!: EntityTable<Message, "id">;
  files!: EntityTable<FileItem, "id">;
  blobs!: EntityTable<BlobRow, "id">;
  outbox!: EntityTable<OutboxRow, "key">;
  meta!: EntityTable<MetaRow, "key">;

  constructor({ name = "openwork-oss", indexedDB, IDBKeyRange }: DexieOptions = {}) {
    super(name, indexedDB && IDBKeyRange ? { indexedDB, IDBKeyRange } : undefined);
    this.version(1).stores({
      rooms: "id, activityAt",
      messages: "id, roomId, [roomId+createdAt]",
      files: "id, parentId",
      blobs: "id",
      outbox: "key, queuedAt",
      meta: "key",
    });
  }
}

const OUTBOX_AND_TABLES = ["rooms", "messages", "files", "outbox", "meta"] as const;

function txOf(db: OpenworkDb): Tx {
  const tables = { room: db.rooms, message: db.messages, file: db.files } as const;
  return {
    room: (id) => db.rooms.get(id),
    rooms: () => db.rooms.toArray(),
    message: (id) => db.messages.get(id),
    messagesOf: (roomId) => db.messages.where("roomId").equals(roomId).toArray(),
    file: (id) => db.files.get(id),
    record: (kind, id) => tables[kind].get(id),
    put: (change) => tables[change.kind].put(change.data as never).then(() => undefined),
    outbox: () => db.outbox.toArray(),
    outboxRow: (key) => db.outbox.get(key),
    putOutbox: (row) => db.outbox.put(row).then(() => undefined),
    deleteOutbox: (key) => db.outbox.delete(key),
    meta: (key) => db.meta.get(key).then((row) => row?.value),
    setMeta: (key, value) => db.meta.put({ key, value }).then(() => undefined),
  };
}

export class DexieDatabase implements Database {
  readonly db: OpenworkDb;
  readonly #tx: Tx;

  constructor(options: DexieOptions = {}) {
    this.db = new OpenworkDb(options);
    this.#tx = txOf(this.db);
  }

  transact<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction("rw", OUTBOX_AND_TABLES.map((name) => this.db[name]), () => work(this.#tx));
  }

  watch<T>(read: (tx: Tx) => Promise<T>): Live<T> {
    return makeLive<T>((emit) => {
      const subscription = liveQuery(() => read(this.#tx)).subscribe({ next: emit, error: () => {} });
      return () => subscription.unsubscribe();
    });
  }
}

/** The device's records in IndexedDB (Dexie database `openwork-oss`). */
export class DexieDeviceStore extends TableDeviceStore {
  readonly database: DexieDatabase;

  constructor(options: DexieOptions = {}, clock: Clock = systemClock) {
    const database = new DexieDatabase(options);
    super(database, clock);
    this.database = database;
  }

  close(): void {
    this.database.db.close();
  }
}
