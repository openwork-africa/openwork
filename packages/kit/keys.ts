import type { SlotContext } from "./context.ts";

export interface SlotKey<T> {
  readonly id: string;
  readonly __type?: T;
}

export interface ServiceKey<T> {
  readonly id: string;
  readonly __type?: T;
}

export interface Placed {
  id: string;
  order: number;
  when?: (ctx: SlotContext) => boolean;
}

export interface Contribution {
  slot: string;
  value: Placed;
}

export interface Provision {
  service: string;
  value: unknown;
}

export const slot = <T>(id: string): SlotKey<T> => ({ id });

export const service = <T>(id: string): ServiceKey<T> => ({ id });

export const contribute = <T>(key: SlotKey<T>, value: T & Placed): Contribution => ({ slot: key.id, value });

export const provide = <T>(key: ServiceKey<T>, value: T): Provision => ({ service: key.id, value });
