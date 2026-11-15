import type { Ports } from "@openwork/kit";
import { type Live, useLive } from "@openwork/store";
import { useMemo } from "react";

/** The port a product fills when something answers in a room. The window only asks whether it is working, never for its words. */
export interface Brain {
  isWorking(roomId: string): Live<boolean>;
}

const idle: Live<boolean> = { get: () => false, subscribe: () => () => {} };

export function useWorking(ports: Ports, roomId: string): boolean {
  const brain = (ports as { brain?: Brain }).brain;
  const live = useMemo(() => brain?.isWorking(roomId) ?? idle, [brain, roomId]);
  return useLive(live) ?? false;
}
