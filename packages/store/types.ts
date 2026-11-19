/** Someone else in a room (never the person themselves). `type` is an open string any plugin may define; the store keeps it as given. */
export interface Member {
  id: string;
  name: string;
  type: string;
  description?: string;
}

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
  members?: Member[];
  deleted?: boolean;
}

/** Who wrote a message: the person, or the assistant of a room. */
export type Author = "you" | "assistant";

export interface Message {
  id: string;
  roomId: string;
  authorId: Author;
  content: string;
  /** What kind of message this is: an open string that plugins define, "text" when absent. The store keeps it as given. */
  kind?: string;
  /** Extra fields a plugin keeps on the message, such as `burstGroup` and `burstIndex` of a reply sent in bursts. The store and the server keep them as given. */
  data?: Record<string, unknown>;
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
/** The kind of a message nobody gave a kind to. */
export const DEFAULT_KIND = "text";
/** The kind of the status line a room gets when someone joins it; its words are the line itself. */
export const JOINED_KIND = "member.added";
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
