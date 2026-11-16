import { contribute, definePlugin, type Placed, type Plugin, slot, type SlotKey } from "./mod.ts";
import { dismiss, getNotices } from "./mod.ts";

export interface Item {
  label: string;
}

export const itemsSlot: SlotKey<Item> = slot<Item>("test.items");

export const placed = (id: string, order: number, extra: Partial<Placed> = {}): Item & Placed => ({ id, order, label: id, ...extra });

export function pluginWith(id: string, items: (Item & Placed)[], extra: Partial<Plugin> = {}): Plugin {
  return definePlugin({
    id,
    version: "1.2.0",
    slots: [itemsSlot],
    contributes: items.map((item) => contribute(itemsSlot, item)),
    ...extra,
  });
}

export function clearNotices(): void {
  getNotices().forEach((notice) => dismiss(notice.id));
}
