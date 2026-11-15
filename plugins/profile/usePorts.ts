import { useCtx } from "@openwork/kit";
import { type DevicePorts, devicePorts } from "@openwork/store";

export const usePorts = (): DevicePorts => devicePorts(useCtx().ports);
