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

const groupOf = (message: TrailMessage): string | undefined => {
  const group = message.data?.burstGroup;
  return typeof group === "string" ? group : undefined;
};

const indexOf = (message: TrailMessage): number => {
  const index = message.data?.burstIndex;
  return typeof index === "number" ? index : 0;
};

/**
 * The messages of a room as the AI is asked about them. Failed messages and messages of another kind are left out. Consecutive
 * messages of one burst group (`data.burstGroup`) go as ONE message: their words joined with a space, in `data.burstIndex` order,
 * with the id, author and time of the first. Messages with no group are as they are.
 */
export function historyOf(trail: TrailMessage[]): AiMessage[] {
  const kept = trail.filter((message) => message.state !== "failed" && (message.kind ?? DEFAULT_KIND) === DEFAULT_KIND);
  const out: AiMessage[] = [];
  for (let at = 0; at < kept.length;) {
    const group = groupOf(kept[at]);
    let end = at + 1;
    while (group !== undefined && end < kept.length && groupOf(kept[end]) === group) end++;
    const run = kept.slice(at, end).sort((a, b) => indexOf(a) - indexOf(b));
    const { id, authorId, createdAt } = run[0];
    out.push({ id, authorId, content: run.map((message) => message.content).join(" "), createdAt });
    at = end;
  }
  return out;
}

/**
 * Answers the person in every room that has an operator member (an AI): when the newest message of such a room is theirs, the
 * room's messages go to the server's AI as a stream. The room works (the typing indicator) until the stream ends, the person's
 * message is taken once the stream says `started`, and each burst of the reply is saved as its own message as it arrives (with `data.burstGroup` and `data.burstIndex`); a reply that comes whole is saved at `done`.
 * A room with no operator is never asked about. Stops asking for good when the server has no AI.
 */
export function answerMessages({ store, client, brain, since, onFailure }: RepliesOptions): () => void {
  const answered = new Set<string>();
  let isAvailable = true;

  const answer = async (roomId: string, messageId: string, messages: AiMessage[]): Promise<void> => {
    const handle = brain.begin(roomId, messageId);
    // Each burst is saved as it arrives, one after the other, so they land in order.
    let saving: Promise<unknown> = Promise.resolve();
    let streamed = 0;
    const saveBurst = (text: string, index: number, group: string): void => {
      saving = saving.then(() => store.send(roomId, text, ASSISTANT, undefined, { burstGroup: group, burstIndex: index }));
      saving.catch(() => {}); // seen here so a failure is not unhandled; it is thrown again where the chain is awaited
    };
    try {
      const reply = await client.reply(roomId, messages, {
        onStarted: handle.taken,
        onBurst: ({ text, index, group }) => {
          streamed++;
          saveBurst(text, index, group);
        },
      });
      if (reply.status === "unavailable") isAvailable = false;
      // Bursts already saved are not saved again; a reply that came whole is saved as its bursts, or as one message when it has none.
      if (reply.status === "reply" && streamed === 0) {
        if (reply.bursts && reply.group !== undefined) reply.bursts.forEach((text, index) => saveBurst(text, index, reply.group!));
        else saving = saving.then(() => store.send(roomId, reply.text, ASSISTANT));
      }
      await saving;
    } catch (error) {
      await saving.catch(() => {});
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
    void answer(roomId, last.id, historyOf(trail));
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
