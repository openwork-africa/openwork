import type { Change, FileItem, Message, PullAnswer, PushBody, Room } from "./types.ts";
import { definedOnly } from "./records.ts";

export const roomWire = (room: Room): Room =>
  definedOnly({
    id: room.id,
    name: room.name,
    description: room.description,
    picture: room.picture,
    background: room.background,
    accent: room.accent,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    activityAt: room.activityAt,
    members: room.members,
    deleted: room.deleted,
  });

export const messageWire = (message: Message): Message =>
  definedOnly({
    id: message.id,
    roomId: message.roomId,
    authorId: message.authorId,
    content: message.content,
    kind: message.kind,
    data: message.data,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    deleted: message.deleted,
  });

export const fileWire = (file: FileItem): FileItem => ({
  id: file.id,
  parentId: file.parentId,
  name: file.name,
  mimeType: file.mimeType,
  size: file.size,
  createdAt: file.createdAt,
  updatedAt: file.updatedAt,
});

const wireOf = {
  room: (change: Extract<Change, { kind: "room" }>): Change => ({ ...change, data: roomWire(change.data) }),
  message: (change: Extract<Change, { kind: "message" }>): Change => ({ ...change, data: messageWire(change.data) }),
  file: (change: Extract<Change, { kind: "file" }>): Change => ({ ...change, data: fileWire(change.data) }),
};

export function changeWire(change: Change): Change {
  const serialize: (value: Change) => Change = wireOf[change.kind] as (value: Change) => Change;
  return serialize(change);
}

export const pushBodyWire = (body: PushBody): PushBody => ({ changes: body.changes.map(changeWire) });

export const pullAnswerWire = (answer: PullAnswer): PullAnswer => ({
  changes: answer.changes.map(changeWire),
  cursor: answer.cursor,
});
