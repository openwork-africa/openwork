export interface Room {
  id: string;
  name: string;
  description?: string;
  picture?: string;
  background?: string;
  accent?: string;
  createdAt: number;
  updatedAt: number;
  activityAt: number;
  deleted?: boolean;
}

/** Who wrote a message: the person, or the assistant of a room. */
export type Author = "you" | "assistant";

export interface Message {
  id: string;
  roomId: string;
  authorId: Author;
  content: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface FileItem {
  id: string;
  parentId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
  updatedAt: number;
}

export type Change =
  | { kind: "room"; id: string; updatedAt: number; data: Room }
  | { kind: "message"; id: string; updatedAt: number; data: Message }
  | { kind: "file"; id: string; updatedAt: number; data: FileItem };

export type ChangeKind = Change["kind"];

export type Answer = { id: string; ok: true } | { id: string; ok: false; message: string };

export interface PushBody {
  changes: Change[];
}

export interface PullAnswer {
  changes: Change[];
  cursor: number;
}

export type SyncStatus = "offline" | "sending" | "catchingUp" | "attention" | "current";

export interface MessageView extends Message {
  state?: "sending" | "sent" | "failed";
  failureReason?: string;
}

export type MessageState = NonNullable<MessageView["state"]>;

export const YOU = "you" as const;
export const ASSISTANT = "assistant" as const;

export interface TrailMessage extends MessageView {
  state: MessageState;
}

/** A change waiting to go to the server: one per record, replaced when the record changes again. */
export interface OutboxRow {
  key: string;
  kind: ChangeKind;
  id: string;
  updatedAt: number;
  queuedAt: number;
  failed?: string;
}
