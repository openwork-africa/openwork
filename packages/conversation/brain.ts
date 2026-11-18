import type { SlotContext } from "@openwork/kit";
import { brainService, noteToSelfBrain, useLive } from "@openwork/store";
import { useMemo } from "react";

/** Whether a reply is on its way in the room, from the brain the product provides (a note to self when none does). */
export function useWorking(ctx: SlotContext, roomId: string): boolean {
  const brain = ctx.service(brainService) ?? noteToSelfBrain;
  return useLive(useMemo(() => brain.isWorking(roomId), [brain, roomId])) ?? false;
}
