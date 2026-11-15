import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from "react";
import type { Commands, Ports, SlotContext } from "./context.ts";
import type { Placed, ServiceKey, SlotKey } from "./keys.ts";
import { notify } from "./notices.ts";
import type { Registry } from "./registry.ts";

export interface RootProps {
  roomId?: string;
  navigate: (path: string) => void;
  commands?: Commands;
  children?: ReactNode;
}

interface Kit {
  registry: Registry;
  ports: Ports;
  roomId?: string;
  navigate: (path: string) => void;
  commands: Commands;
}

const KitContext = createContext<Kit | null>(null);

const none: Commands = Object.freeze({});

export function KitProvider(
  { registry, ports, roomId, navigate, commands = none, children }: RootProps & Pick<Kit, "registry" | "ports">,
): ReactElement {
  const value = useMemo(() => ({ registry, ports, roomId, navigate, commands }), [registry, ports, roomId, navigate, commands]);
  return <KitContext.Provider value={value}>{children}</KitContext.Provider>;
}

function useKit(): Kit {
  const kit = useContext(KitContext);
  if (!kit) throw new Error("useCtx and useSlot need the product's Root above them");
  return kit;
}

export function useCtx(): SlotContext {
  const { registry, ports, roomId, navigate, commands } = useKit();
  return useMemo(() => {
    const bound: Record<string, (...args: never[]) => unknown> = { ...commands };
    const ctx: SlotContext = { roomId, navigate, notify, commands: bound, ports, service: <T,>(key: ServiceKey<T>) => registry.service(key) };
    for (const [name, handler] of Object.entries(registry.commands())) bound[name] = (...args) => handler(ctx, ...args);
    return ctx;
  }, [registry, ports, roomId, navigate, commands]);
}

export function useSlot<T>(key: SlotKey<T>, ctx: SlotContext): readonly (T & Placed)[] {
  const { registry } = useKit();
  return useMemo(() => registry.slot(key).filter((item) => item.when?.(ctx) ?? true), [registry, key, ctx]);
}
