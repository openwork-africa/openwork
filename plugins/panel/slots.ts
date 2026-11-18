import type { ReactNode } from "react";
import { type RenderValue, slot, type SlotContext, type SlotKey } from "@openwork/kit";

export interface PanelTabValue {
  value: string;
  label: string;
  icon: ReactNode;
  render: (ctx: SlotContext) => ReactNode;
}

/** The slots the contact panel opens: the cover above the scroll, its sections, and its tabs. */
export const panelTab: SlotKey<PanelTabValue> = slot("panel.tab");
export const panelCover: SlotKey<RenderValue> = slot("panel.cover");
export const panelSection: SlotKey<RenderValue> = slot("panel.section");
