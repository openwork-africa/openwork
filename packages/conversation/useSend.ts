import type { BeforeSendValue, Draft, SlotContext } from "@openwork/kit";
import type { DeviceStore } from "@openwork/store";
import { runBeforeSend } from "./beforeSend.ts";
import { copy } from "./copy.ts";

/** Runs the before-send chain, preserves stopped drafts, then sends with fixed friendly failure feedback. */
export function useSend(
  roomId: string,
  store: DeviceStore,
  handlers: readonly BeforeSendValue[],
  ctx: SlotContext,
  closeTray: () => void,
  setValue: (value: string) => void,
) {
  return async (text: string): Promise<void> => {
    try {
      const draft: Draft | null = await runBeforeSend(handlers, { text }, ctx);
      if (!draft) return setValue(text);
      const words = draft.text.trim();
      if (!words) return;
      closeTray();
      setValue("");
      await store.send(roomId, words);
    } catch {
      ctx.notify(copy.sendFailed, { status: "error" });
    }
  };
}
