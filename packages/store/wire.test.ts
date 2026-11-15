import { assertEquals } from "@std/assert";
import { changeWire, fileWire, messageWire, pullAnswerWire, pushBodyWire, roomWire } from "./wire.ts";
import type { FileItem, Message, PullAnswer, PushBody, Room } from "./types.ts";

const path = new URL("../../server/test-vectors/entities.json", import.meta.url);
const text = Deno.readTextFileSync(path);
const vectors = JSON.parse(text) as { room: Room; message: Message; fileItem: FileItem; pushBody: PushBody; pullAnswer: PullAnswer };

const bytes = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";

Deno.test("the server's test vectors serialise from the TS types to the same bytes", () => {
  const { room, message, fileItem, pushBody, pullAnswer } = vectors;
  const rebuilt = {
    room: roomWire(room),
    message: messageWire(message),
    fileItem: fileWire(fileItem),
    pushBody: pushBodyWire(pushBody),
    pullAnswer: pullAnswerWire(pullAnswer),
  };
  assertEquals(bytes(rebuilt), text);
});

Deno.test("changes keep their kind, id and updatedAt in front of their data", () => {
  const [change] = vectors.pushBody.changes;
  assertEquals(Object.keys(changeWire(change)), ["kind", "id", "updatedAt", "data"]);
});

Deno.test("fields that are not set are left out", () => {
  assertEquals(Object.keys(roomWire({ ...vectors.room, description: undefined, picture: undefined })).includes("description"), false);
});
