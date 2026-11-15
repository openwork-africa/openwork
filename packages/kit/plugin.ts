import type { SetupContext } from "./context.ts";
import type { Contribution, Provision, SlotKey } from "./keys.ts";

export interface Plugin {
  id: string;
  version: string;
  requires?: Record<string, string>;
  slots?: readonly SlotKey<unknown>[];
  contributes: readonly Contribution[];
  provides?: readonly Provision[];
  setup?(ctx: SetupContext): void | (() => void);
}

export const definePlugin = (plugin: Plugin): Plugin => plugin;
