import { lazy, useMemo } from "react";
import { type RegionValue, shellRegion, useCtx, useSlot } from "@openwork/kit";
import type { Regions } from "./Frame.tsx";
import type { Region } from "./Island.tsx";

const lazies = new WeakMap<RegionValue, Region>();

const regionOf = (value: RegionValue): Region => {
  let component = lazies.get(value);
  if (!component) lazies.set(value, component = lazy(value.load));
  return component;
};

/** The islands of the frame: what the product passes in, else what plugins contribute to `shell.region`, the lowest order first. A region nobody fills is left out. */
export function useRegions(given: Regions): Regions {
  const contributed = useSlot(shellRegion, useCtx());
  return useMemo(() => {
    const found: Regions = {};
    for (const name of ["circle", "window", "panel"] as const) {
      const value = contributed.find((each) => each.region === name);
      found[name] = given[name] ?? (value && regionOf(value));
    }
    return found;
  }, [given, contributed]);
}
