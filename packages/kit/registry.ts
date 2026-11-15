import { COMMAND_PREFIX, type CommandHandler } from "./commands.ts";
import type { Placed, ServiceKey, SlotKey } from "./keys.ts";
import type { Plugin } from "./plugin.ts";
import { copy } from "./copy.ts";

export interface Registry {
  slot<T>(key: SlotKey<T>): readonly (T & Placed)[];
  service<T>(key: ServiceKey<T>): T | undefined;
  /** The commands plugins provide, by name. */
  commands(): Readonly<Record<string, CommandHandler>>;
}

export type Override = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

interface Entry {
  plugin: string;
  value: Placed;
}

export function buildRegistry(
  ordered: readonly Plugin[],
  frameSlots: ReadonlySet<string>,
  override: Override,
  problems: string[],
): Registry {
  const opened = new Set(frameSlots);
  for (const plugin of ordered) plugin.slots?.forEach((key) => opened.add(key.id));
  const slots = new Map<string, Map<string, Entry>>();
  const services = new Map<string, { plugin: string; value: unknown }>();

  for (const plugin of ordered) {
    for (const { slot, value } of plugin.contributes) {
      if (!opened.has(slot)) {
        problems.push(copy.unknownSlot(plugin.id, slot));
        continue;
      }
      const entries = slots.get(slot) ?? new Map<string, Entry>();
      const first = entries.get(value.id);
      if (first) problems.push(copy.duplicateContribution(slot, value.id, first.plugin, plugin.id));
      else entries.set(value.id, { plugin: plugin.id, value });
      slots.set(slot, entries);
    }
    for (const { service, value } of plugin.provides ?? []) {
      const first = services.get(service);
      if (first) problems.push(copy.duplicateService(service, first.plugin, plugin.id));
      else services.set(service, { plugin: plugin.id, value });
    }
  }

  for (const [target, fields] of Object.entries(override)) {
    const split = target.indexOf("/");
    const entry = slots.get(target.slice(0, split))?.get(target.slice(split + 1));
    if (split < 0 || !entry) problems.push(copy.unknownOverride(target));
    else entry.value = { ...entry.value, ...fields };
  }

  const frozen = new Map<string, readonly Placed[]>();
  for (const [slot, entries] of slots) {
    const sorted = [...entries.values()].map((entry) => Object.freeze({ ...entry.value })).sort((a, b) => a.order - b.order);
    frozen.set(slot, Object.freeze(sorted));
  }
  const none: readonly Placed[] = Object.freeze([]);
  const commands = Object.freeze(
    Object.fromEntries(
      [...services].filter(([id]) => id.startsWith(COMMAND_PREFIX)).map(([id, { value }]) => [id.slice(COMMAND_PREFIX.length), value as CommandHandler]),
    ),
  );

  return Object.freeze({
    slot: <T>(key: SlotKey<T>) => (frozen.get(key.id) ?? none) as readonly (T & Placed)[],
    service: <T>(key: ServiceKey<T>) => services.get(key.id)?.value as T | undefined,
    commands: () => commands,
  });
}
