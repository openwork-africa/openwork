import type { FileDraft, RoomDetails } from "./ports.ts";
import type { FileItem, Message, MessageState, OutboxRow, Room, TrailMessage } from "./types.ts";

export const outboxKey = (kind: OutboxRow["kind"], id: string): string => `${kind}:${id}`;

export function newRoom(name: string, details: RoomDetails, now: number): Room {
  return { id: crypto.randomUUID(), name, ...definedOnly(details), createdAt: now, updatedAt: now, activityAt: now };
}

export function newMessage(roomId: string, content: string, now: number): Message {
  return { id: crypto.randomUUID(), roomId, authorId: "you", content, createdAt: now, updatedAt: now };
}

export const newFile = (file: FileDraft, now: number): FileItem => ({ ...file, createdAt: file.createdAt ?? now, updatedAt: file.updatedAt ?? now });

export const definedOnly = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;

/** A room edited at `now`: never older than what it replaces, so the newest edit wins on the server. */
export function editedRoom(room: Room, patch: Partial<Room>, now: number): Room {
  return definedOnly({ ...room, ...patch, updatedAt: Math.max(now, room.updatedAt + 1) });
}

export const newerOrEqual = (incoming: { updatedAt: number }, local: { updatedAt: number } | undefined): boolean =>
  !local || incoming.updatedAt >= local.updatedAt;

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
    .map((message) => ({ ...message, state: stateOf(rows.get(message.id)) }));
}

export const liveRooms = (rooms: readonly Room[]): Room[] =>
  rooms.filter((room) => !room.deleted).sort((a, b) => b.activityAt - a.activityAt);
