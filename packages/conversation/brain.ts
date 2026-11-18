import type { SlotContext } from "@openwork/kit";
import { brainService, type MessageAnswer, noteToSelfBrain, useLive } from "@openwork/store";
import { useMemo } from "react";

/** Whether a reply is on its way in the room, from the brain the product provides (a note to self when none does). */
export function useWorking(ctx: SlotContext, roomId: string): boolean {
  const brain = ctx.service(brainService) ?? noteToSelfBrain;
  return useLive(useMemo(() => brain.isWorking(roomId), [brain, roomId])) ?? false;
}

const noAnswers: ReadonlyMap<string, MessageAnswer> = new Map();

/** What the assistant did with the person's messages in the room, by message id; nothing for a note to self. */
export function useAnswers(ctx: SlotContext, roomId: string): ReadonlyMap<string, MessageAnswer> {
  const brain = ctx.service(brainService) ?? noteToSelfBrain;
  return useLive(useMemo(() => brain.answers?.(roomId) ?? { get: () => noAnswers, subscribe: () => () => {} }, [brain, roomId])) ?? noAnswers;
}
