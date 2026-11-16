import type { ServiceKey } from "./keys.ts";
import type { Notify } from "./notices.ts";

export type Ports = Readonly<Record<string, unknown>>;

export type Commands = Readonly<Record<string, (...args: never[]) => unknown>>;

export interface SlotContext {
  roomId: string | undefined;
  navigate: (path: string) => void;
  replace?: (path: string) => void;
  notify: Notify;
  service: <T>(key: ServiceKey<T>) => T | undefined;
  commands: Commands;
  ports: Ports;
}

export interface SetupContext {
  ports: Ports;
  notify: Notify;
  service: <T>(key: ServiceKey<T>) => T | undefined;
}
