import { copy } from "./copy.ts";
import type { Database, Tx } from "./database.ts";
import { type Live, makeCell } from "./live.ts";
import type { Clock, DeviceStore, FileDraft, RoomDetails, SyncJournal } from "./ports.ts";
import { systemClock } from "./ports.ts";
import { editedRoom, liveRooms, newFile, newMessage, newRoom, outboxKey, trailOf } from "./records.ts";
import type { Change, FileItem, Message, Room, SyncStatus, TrailMessage } from "./types.ts";

const CURSOR = "cursor";

/** The device store's behaviour, written once over a `Database`: every write lands there first and is queued. */
export class TableDeviceStore implements DeviceStore {
  readonly journal: SyncJournal;
  readonly #database: Database;
  readonly #clock: Clock;
  readonly #status = makeCell<SyncStatus>("current");
  readonly #queued = new Set<() => void>();
  #lastQueuedAt = 0;

  constructor(database: Database, clock: Clock = systemClock) {
    this.#database = database;
    this.#clock = clock;
    this.journal = this.#journal();
  }

  rooms = (): Live<Room[]> => this.#database.watch(async (tx) => liveRooms(await tx.rooms()));

  room = (id: string): Live<Room | null> =>
    this.#database.watch(async (tx) => {
      const room = await tx.room(id);
      return room && !room.deleted ? room : null;
    });

  trail = (roomId: string): Live<TrailMessage[]> =>
    this.#database.watch(async (tx) => trailOf(await tx.messagesOf(roomId), await tx.outbox()));

  syncStatus = (): Live<SyncStatus> => this.#status;

  createRoom = (name: string, details: RoomDetails = {}): Promise<Room> =>
    this.#write(async (tx, now) => {
      const room = newRoom(name, details, now);
      await this.#save(tx, { kind: "room", id: room.id, updatedAt: room.updatedAt, data: room }, now);
      return room;
    });

  renameRoom = (id: string, name: string): Promise<void> => this.#edit(id, { name });
  setRoomDescription = (id: string, description: string | undefined): Promise<void> => this.#edit(id, { description });
  setRoomPicture = (id: string, picture: string | undefined): Promise<void> => this.#edit(id, { picture });
  setRoomBackground = (id: string, background: string | undefined): Promise<void> => this.#edit(id, { background });
  deleteRoom = (id: string): Promise<void> => this.#edit(id, { deleted: true });

  send = (roomId: string, content: string): Promise<Message> =>
    this.#write(async (tx, now) => {
      const room = await this.#existing(tx, roomId);
      const message = newMessage(roomId, content, now);
      const touched = editedRoom(room, { activityAt: message.createdAt }, now);
      await this.#save(tx, { kind: "room", id: roomId, updatedAt: touched.updatedAt, data: touched }, now);
      await this.#save(tx, { kind: "message", id: message.id, updatedAt: message.updatedAt, data: message }, now);
      return message;
    });

  retry = (messageId: string): Promise<void> =>
    this.#write(async (tx) => {
      const row = await tx.outboxRow(outboxKey("message", messageId));
      if (row?.failed !== undefined) await tx.putOutbox({ ...row, failed: undefined });
    });

  putFile = (draft: FileDraft): Promise<FileItem> =>
    this.#write(async (tx, now) => {
      const file = newFile(draft, now);
      await this.#save(tx, { kind: "file", id: file.id, updatedAt: file.updatedAt, data: file }, now);
      return file;
    });

  /** Written with `then`, not `await`: Dexie keeps a transaction open only across its own promises. */
  #existing(tx: Tx, id: string): Promise<Room> {
    return tx.room(id).then((room) => {
      if (!room || room.deleted) throw new Error(copy.noRoom(id));
      return room;
    });
  }

  #edit(id: string, patch: Partial<Room>): Promise<void> {
    return this.#write(async (tx, now) => {
      const room = editedRoom(await this.#existing(tx, id), patch, now);
      await this.#save(tx, { kind: "room", id, updatedAt: room.updatedAt, data: room }, now);
    });
  }

  #save(tx: Tx, change: Change, now: number): Promise<void> {
    this.#lastQueuedAt = Math.max(now, this.#lastQueuedAt + 1);
    const row = { key: outboxKey(change.kind, change.id), kind: change.kind, id: change.id, updatedAt: change.updatedAt, queuedAt: this.#lastQueuedAt };
    return tx.put(change).then(() => tx.putOutbox(row));
  }

  async #write<T>(work: (tx: Tx, now: number) => Promise<T>): Promise<T> {
    const result = await this.#database.transact((tx) => work(tx, this.#clock.now()));
    this.#queued.forEach((listener) => listener());
    return result;
  }

  #journal(): SyncJournal {
    const database = this.#database;
    return {
      pending: () => database.transact(async (tx) => (await tx.outbox()).filter((row) => row.failed === undefined).sort((a, b) => a.queuedAt - b.queuedAt)),
      changeOf: (row) =>
        database.transact(async (tx): Promise<Change | undefined> => {
          const data = await tx.record(row.kind, row.id);
          return data && ({ kind: row.kind, id: row.id, updatedAt: data.updatedAt, data } as Change);
        }),
      acknowledge: (row) =>
        database.transact(async (tx) => {
          const current = await tx.outboxRow(row.key);
          if (current && current.updatedAt === row.updatedAt) await tx.deleteOutbox(row.key);
        }),
      fail: (row, message) =>
        database.transact(async (tx) => {
          const current = await tx.outboxRow(row.key);
          if (current && current.updatedAt === row.updatedAt) await tx.putOutbox({ ...current, failed: message });
        }),
      failedCount: () => database.transact(async (tx) => (await tx.outbox()).filter((row) => row.failed !== undefined).length),
      cursor: () => database.transact(async (tx) => (await tx.meta(CURSOR)) ?? 0),
      applyPulled: (changes, cursor) =>
        database.transact(async (tx) => {
          for (const change of changes) {
            const local = await tx.record(change.kind, change.id);
            if (local && change.updatedAt <= local.updatedAt) continue;
            await tx.put(change);
            await tx.deleteOutbox(outboxKey(change.kind, change.id));
          }
          await tx.setMeta(CURSOR, cursor);
        }),
      onQueued: (listener) => {
        this.#queued.add(listener);
        return () => void this.#queued.delete(listener);
      },
      setStatus: (status) => this.#status.set(status),
    };
  }
}
