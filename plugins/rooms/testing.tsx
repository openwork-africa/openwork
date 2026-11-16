import type { ReactElement } from "react";
import { type Plugin, type Ports } from "@openwork/kit";
import { memoryPorts, rig } from "@openwork/store/testing";
export { flush, mount } from "@openwork/ui/testing";

export function host(
  plugins: readonly Plugin[],
  ports: Ports,
  element: ReactElement,
  extra: { roomId?: string; navigate?: (path: string) => void } = {},
): ReactElement {
  return rig(plugins, { ...memoryPorts(), ...ports }, extra).view(element);
}
