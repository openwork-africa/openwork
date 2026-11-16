import type { Ports } from "@openwork/kit";
import { brainOf, type Live, useLive } from "@openwork/store";
import { useMemo } from "react";

const idle: Live<boolean> = { get: () => false, subscribe: () => () => {} };

export function useWorking(ports: Ports, roomId: string): boolean {
  const brain = brainOf(ports);
  const live = useMemo(() => brain?.isWorking(roomId) ?? idle, [brain, roomId]);
  return useLive(live) ?? false;
}
