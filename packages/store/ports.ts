import type { Ports } from "@openwork/kit";
import { copy } from "./copy.ts";
import type { Live } from "./live.ts";
import type { Answer, Change, FileItem, Message, OutboxRow, PullAnswer, Room, SyncStatus, TrailMessage } from "./types.ts";

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface RoomDetails {
  description?: string;
  picture?: string;
  background?: string;
}

/** What the sync loop reads and writes on the device: the queue of changes, the cursor, pulled records. */
export type FileDraft = Omit<FileItem, "createdAt" | "updatedAt"> & Partial<Pick<FileItem, "createdAt" | "updatedAt">>;

export interface SyncJournal {
  pending(): Promise<OutboxRow[]>;
  changeOf(row: OutboxRow): Promise<Change | undefined>;
  acknowledge(row: OutboxRow): Promise<void>;
  fail(row: OutboxRow, message: string): Promise<void>;
  failedCount(): Promise<number>;
  cursor(): Promise<number>;
  applyPulled(changes: Change[], cursor: number): Promise<void>;
  onQueued(listener: () => void): () => void;
  setStatus(status: SyncStatus): void;
}

export interface DeviceStore {
  rooms(): Live<Room[]>;
  room(id: string): Live<Room | null>;
  createRoom(name: string, details?: RoomDetails): Promise<Room>;
  renameRoom(id: string, name: string): Promise<void>;
  setRoomDescription(id: string, description: string | undefined): Promise<void>;
  setRoomPicture(id: string, picture: string | undefined): Promise<void>;
  setRoomBackground(id: string, background: string | undefined): Promise<void>;
  deleteRoom(id: string): Promise<void>;
  /** Brings back a deleted room, with its messages. Rejects if the device never had it. */
  restoreRoom(id: string): Promise<void>;
  trail(roomId: string): Live<TrailMessage[]>;
  send(roomId: string, content: string): Promise<Message>;
  retry(messageId: string): Promise<void>;
  putFile(file: FileDraft): Promise<FileItem>;
  syncStatus(): Live<SyncStatus>;
  readonly journal: SyncJournal;
}

export interface FileStore {
  put(id: string, bytes: Blob): Promise<void>;
  get(id: string): Promise<Blob | undefined>;
  remove(id: string): Promise<void>;
}

export interface Transport {
  push(changes: Change[]): Promise<Answer[]>;
  pull(since: number): Promise<PullAnswer>;
  putFile(id: string, bytes: Blob): Promise<void>;
  getFile(id: string): Promise<Blob | undefined>;
  health(): Promise<boolean>;
}

export interface Connectivity {
  isOnline(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface DevicePorts {
  store: DeviceStore;
  files: FileStore;
  transport: Transport;
  clock: Clock;
}

/** The device ports of a composed product, for plugins reading `ctx.ports`. */
export function devicePorts(ports: Ports): DevicePorts {
  const { store, files, transport, clock } = ports as Partial<DevicePorts>;
  if (!store || !files || !transport || !clock) throw new Error(copy.missingPorts);
  return { store, files, transport, clock };
}
