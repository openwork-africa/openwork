import type { Ports } from "@openwork/kit";
import { copy } from "./copy.ts";
import type { Live } from "./live.ts";
import type { Answer, Author, Change, FileItem, Member, Message, OutboxRow, PullAnswer, Room, SyncStatus, TrailMessage } from "./types.ts";

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface RoomDetails {
  /** Who is in the room from the start; each gets a member row and a status line, like `addMember`. */
  members?: Member[];
  description?: string;
  picture?: string;
  background?: string;
}

export type FileDraft = Omit<FileItem, "createdAt" | "updatedAt"> & Partial<Pick<FileItem, "createdAt" | "updatedAt">>;

/** What the sync loop reads and writes on the device: the queue of changes, the cursor, pulled records. */
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
  setRoomBackground(id: string, background: string | undefined, accent?: string): Promise<void>;
  /** Adds someone to the room and writes the status line ("<name> was added") in one step. False when they are already in it. */
  addMember(roomId: string, member: Member): Promise<boolean>;
  deleteRoom(id: string): Promise<void>;
  /** Brings back a deleted room, with its messages. Rejects if the device never had it. */
  restoreRoom(id: string): Promise<void>;
  trail(roomId: string): Live<TrailMessage[]>;
  /** Saves a message in the room, as the person by default; the assistant's replies go through here too, so they sync like any other message. */
  send(roomId: string, content: string, authorId?: Author, kind?: string): Promise<Message>;
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

/** What answers in a room; the conversation window only needs to know whether a reply is on its way. */
export interface Brain {
  isWorking(roomId: string): Live<boolean>;
  /** What the assistant did with the person's messages in the room, by message id: taken, or not (with the reason). */
  answers?(roomId: string): Live<ReadonlyMap<string, MessageAnswer>>;
}

export type MessageAnswer = "taken" | { failed: string };

const never: Live<boolean> = { get: () => false, subscribe: () => () => {} };

/** The brain of a room with nothing answering: it is never working. */
export const noteToSelfBrain: Brain = { isWorking: () => never };

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
