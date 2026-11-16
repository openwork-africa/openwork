import type { FileDraft, RoomDetails } from "./ports.ts";
import { type Change, type ChangeKind, type FileItem, type Message, type MessageState, type OutboxRow, type Room, type TrailMessage, YOU } from "./types.ts";

export const outboxKey = (kind: OutboxRow["kind"], id: string): string => `${kind}:${id}`;

export function changeOf<K extends ChangeKind>(kind: K, data: Extract<Change, { kind: K }>["data"]): Extract<Change, { kind: K }> {
  return { kind, id: data.id, updatedAt: data.updatedAt, data } as Extract<Change, { kind: K }>;
}

export function newRoom(name: string, details: RoomDetails, now: number): Room {
  return { id: crypto.randomUUID(), name, ...definedOnly(details), createdAt: now, updatedAt: now, activityAt: now };
}

export function newMessage(roomId: string, content: string, now: number): Message {
  return { id: crypto.randomUUID(), roomId, authorId: YOU, content, createdAt: now, updatedAt: now };
}

export const newFile = (file: FileDraft, now: number): FileItem => ({ ...file, createdAt: file.createdAt ?? now, updatedAt: file.updatedAt ?? now });

export const definedOnly = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;

/** A room edited at `now`: never older than what it replaces, so the newest edit wins on the server. */
export function editedRoom(room: Room, patch: Partial<Room>, now: number): Room {
  return definedOnly({ ...room, ...patch, updatedAt: Math.max(now, room.updatedAt + 1) });
}

function stateOf(row: OutboxRow | undefined): MessageState {
  if (!row) return "sent";
  return row.failed === undefined ? "sending" : "failed";
}

/** A room's messages in the order they were written, as the trail shows them. */
export function trailOf(messages: readonly Message[], outbox: readonly OutboxRow[]): TrailMessage[] {
  const rows = new Map(outbox.filter((row) => row.kind === "message").map((row) => [row.id, row]));
  return messages
    .filter((message) => !message.deleted)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((message) => {
      const row = rows.get(message.id);
      return row?.failed === undefined ? { ...message, state: stateOf(row) } : { ...message, state: stateOf(row), failureReason: row.failed };
    });
}

export const liveRooms = (rooms: readonly Room[]): Room[] => rooms.filter((room) => !room.deleted).sort((a, b) => b.activityAt - a.activityAt);
