import type { Change, FileItem, Message, PullAnswer, PushBody, Room } from "./types.ts";

const present = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;

export const roomWire = (room: Room): Room =>
  present({
    id: room.id,
    name: room.name,
    description: room.description,
    picture: room.picture,
    background: room.background,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    activityAt: room.activityAt,
    deleted: room.deleted,
  });

export const messageWire = (message: Message): Message =>
  present({
    id: message.id,
    roomId: message.roomId,
    authorId: message.authorId,
    content: message.content,
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

export function changeWire(change: Change): Change {
  const head = { kind: change.kind, id: change.id, updatedAt: change.updatedAt };
  if (change.kind === "room") return { ...head, kind: "room", data: roomWire(change.data) };
  if (change.kind === "message") return { ...head, kind: "message", data: messageWire(change.data) };
  return { ...head, kind: "file", data: fileWire(change.data) };
}

export const pushBodyWire = (body: PushBody): PushBody => ({ changes: body.changes.map(changeWire) });

export const pullAnswerWire = (answer: PullAnswer): PullAnswer => ({
  changes: answer.changes.map(changeWire),
  cursor: answer.cursor,
});
