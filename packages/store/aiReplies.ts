import type { AiClient, AiMessage } from "./aiClient.ts";
import type { AiBrain } from "./aiBrain.ts";
import { copy } from "./copy.ts";
import { HttpError } from "./errors.ts";
import { operatorsOf } from "./members.ts";
import type { DeviceStore } from "./ports.ts";
import { ASSISTANT, DEFAULT_KIND, type TrailMessage, YOU } from "./types.ts";

export interface RepliesOptions {
  store: DeviceStore;
  client: AiClient;
  brain: AiBrain;
  /** Only messages written at or after this time are answered, so old rooms stay quiet. */
  since: number;
  /** Told in plain words when a reply could not be had. */
  onFailure: (message: string) => void;
}

const asked = (trail: TrailMessage[]): AiMessage[] =>
  trail.filter((message) => message.state !== "failed" && (message.kind ?? DEFAULT_KIND) === DEFAULT_KIND).map(({ id, authorId, content, createdAt }) => ({
    id,
    authorId,
    content,
    createdAt,
  }));

/**
 * Answers the person in every room that has an operator member (an AI): when the newest message of such a room is theirs, the
 * room's messages go to the server's AI as a stream. The room works (the typing indicator) until the stream ends, the person's
 * message is taken once the stream says `started`, and the whole reply is saved as one message from the assistant, only at `done`.
 * A room with no operator is never asked about. Stops asking for good when the server has no AI.
 */
export function answerMessages({ store, client, brain, since, onFailure }: RepliesOptions): () => void {
  const answered = new Set<string>();
  let isAvailable = true;

  const answer = async (roomId: string, messageId: string, messages: AiMessage[]): Promise<void> => {
    const handle = brain.begin(roomId, messageId);
    try {
      const reply = await client.reply(roomId, messages, { onStarted: handle.taken });
      if (reply.status === "unavailable") isAvailable = false;
      if (reply.status === "reply") await store.send(roomId, reply.text, ASSISTANT);
    } catch (error) {
      const why = error instanceof HttpError ? error.message : copy.noReply;
      if (!handle.isTaken) handle.failed(why);
      onFailure(why);
    } finally {
      handle.end();
    }
  };

  const look = (roomId: string, trail: TrailMessage[] | undefined): void => {
    const last = trail?.at(-1);
    if (
      !isAvailable || !trail || !last || last.authorId !== YOU || (last.kind ?? DEFAULT_KIND) !== DEFAULT_KIND || last.state === "failed" ||
      last.createdAt < since || answered.has(last.id)
    ) return;
    answered.add(last.id);
    void answer(roomId, last.id, asked(trail));
  };

  const watching = new Map<string, () => void>();
  const unwatch = (roomId: string): void => {
    watching.get(roomId)?.();
    watching.delete(roomId);
  };
  const watch = (roomId: string): void => {
    const trail = store.trail(roomId);
    watching.set(roomId, trail.subscribe(() => look(roomId, trail.get())));
  };

  const rooms = store.rooms();
  const stopRooms = rooms.subscribe(() => {
    const withOperator = new Set((rooms.get() ?? []).filter((room) => operatorsOf(room).length > 0).map((room) => room.id));
    for (const roomId of [...watching.keys()]) if (!withOperator.has(roomId)) unwatch(roomId);
    for (const roomId of withOperator) if (!watching.has(roomId)) watch(roomId);
  });
  return () => {
    stopRooms();
    for (const roomId of [...watching.keys()]) unwatch(roomId);
  };
}
