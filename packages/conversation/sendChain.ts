import type { BeforeSendValue, Draft, SlotContext } from "@openwork/kit";

/** Chain of Responsibility: each handler may change the draft and pass it on with `next`, or answer null to stop the send. */
export function runBeforeSend(handlers: readonly BeforeSendValue[], draft: Draft, ctx: SlotContext): Promise<Draft | null> {
  const step = (index: number, current: Draft): Promise<Draft | null> =>
    index >= handlers.length ? Promise.resolve(current) : handlers[index].handle(current, ctx, (changed) => step(index + 1, changed));
  return step(0, draft);
}
