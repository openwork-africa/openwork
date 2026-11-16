import type { ReactElement } from "react";
import { type Plugin, type Product } from "@openwork/kit";
import { type DeviceStore, ManualClock, MemoryDeviceStore, MemoryTransport, type TrailMessage } from "@openwork/store";
import { memoryPorts, rig as storeRig, until as untilLive } from "@openwork/store/testing";
import { labelled, typeInto } from "@openwork/ui/testing";
export { flush, labelled, mount, press, until } from "@openwork/ui/testing";

export interface Rig {
  product: Product;
  store: MemoryDeviceStore;
  clock: ManualClock;
  transport: MemoryTransport;
  syncNow(): Promise<void>;
  navigated: string[];
  view(element: ReactElement, roomId?: string): ReactElement;
}

/** A composed product over in-memory ports: what a host or a plugin is tested against. */
export function rig(plugins: readonly Plugin[] = [], extraPorts: Record<string, unknown> = {}): Rig {
  const clock = new ManualClock();
  const ports = { ...memoryPorts(clock), ...extraPorts };
  const shared = storeRig(plugins, ports);
  return shared;
}

/** Types into the composer's field the way a person does: the field changes, then it says so. */
export async function write(container: HTMLElement, words: string): Promise<void> {
  const field = container.querySelector("[contenteditable]") as HTMLElement;
  await typeInto(field, words);
}

export const sendButton = (container: HTMLElement): HTMLElement | null => labelled(container, "Send");

/** The trail as it stands now. */
export function trailOf(store: DeviceStore, roomId: string): Promise<TrailMessage[]> {
  return untilLive(store.trail(roomId));
}
