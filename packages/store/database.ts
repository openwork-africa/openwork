import type { Live } from "./live.ts";
import type { Change, ChangeKind, FileItem, Message, OutboxRow, Room } from "./types.ts";

export interface Tx {
  room(id: string): Promise<Room | undefined>;
  rooms(): Promise<Room[]>;
  message(id: string): Promise<Message | undefined>;
  messagesOf(roomId: string): Promise<Message[]>;
  file(id: string): Promise<FileItem | undefined>;
  record(kind: ChangeKind, id: string): Promise<Change["data"] | undefined>;
  put(change: Change): Promise<void>;
  outbox(): Promise<OutboxRow[]>;
  outboxRow(key: string): Promise<OutboxRow | undefined>;
  putOutbox(row: OutboxRow): Promise<void>;
  deleteOutbox(key: string): Promise<void>;
  meta(key: string): Promise<number | undefined>;
  setMeta(key: string, value: number): Promise<void>;
}

/** Where a device keeps its records: written in transactions, read as live values. */
export interface Database {
  transact<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
  watch<T>(read: (tx: Tx) => Promise<T>): Live<T>;
}
