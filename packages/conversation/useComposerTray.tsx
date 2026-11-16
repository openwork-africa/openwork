import { useState } from "react";
import type { AddMenuValue, Placed, SlotContext, TrayValue } from "@openwork/kit";
import { AddMenu } from "./AddMenu.tsx";

type Tray = { id?: string } | null;

/** State and rendered drawer content for the composer's + menu and contributed trays. */
export function useComposerTray(addItems: readonly (AddMenuValue & Placed)[], trays: readonly (TrayValue & Placed)[], ctx: SlotContext) {
  const [tray, setTray] = useState<Tray>(null);
  const isAdding = tray !== null;
  const closeTray = (): void => setTray(null);
  const openTray = (isOpen: boolean): void => setTray(isOpen ? {} : null);
  const open = trays.find((candidate) => candidate.id === tray?.id);
  const content = tray && !tray.id
    ? <AddMenu items={addItems} onPick={(item) => item.opens ? setTray({ id: item.opens }) : (closeTray(), item.run?.(ctx))} />
    : open?.render(ctx, closeTray);
  return { content, isAdding, closeTray, openTray };
}
