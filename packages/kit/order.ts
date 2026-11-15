import { copy } from "./copy.ts";
import type { Plugin } from "./plugin.ts";
import { satisfies } from "./semver.ts";

export interface Resolved {
  ordered: Plugin[];
  problems: string[];
}

function unmetRequirement(plugin: Plugin, byId: ReadonlyMap<string, Plugin>): string | null {
  for (const [needs, range] of Object.entries(plugin.requires ?? {})) {
    const found = byId.get(needs);
    if (!found) return copy.missingPlugin(plugin.id, needs, range);
    if (!satisfies(found.version, range)) return copy.mismatchedPlugin(plugin.id, needs, range, found.version);
  }
  return null;
}

function withoutDuplicates(plugins: readonly Plugin[], problems: string[]): Plugin[] {
  const seen = new Map<string, Plugin>();
  for (const plugin of plugins) {
    if (seen.has(plugin.id)) problems.push(copy.duplicatePlugin(plugin.id));
    else seen.set(plugin.id, plugin);
  }
  return [...seen.values()];
}

function withoutUnmet(plugins: Plugin[], problems: string[]): Plugin[] {
  let active = plugins;
  for (;;) {
    const byId = new Map(active.map((plugin) => [plugin.id, plugin]));
    const left = active.filter((plugin) => {
      const unmet = unmetRequirement(plugin, byId);
      if (unmet) problems.push(unmet);
      return !unmet;
    });
    if (left.length === active.length) return left;
    active = left;
  }
}

function dependenciesFirst(plugins: Plugin[], problems: string[]): Plugin[] {
  const ordered: Plugin[] = [];
  const placed = new Set<string>();
  let remaining = plugins;
  while (remaining.length) {
    const next = remaining.find((plugin) => Object.keys(plugin.requires ?? {}).every((id) => placed.has(id)));
    if (!next) {
      problems.push(copy.circularPlugins(remaining.map((plugin) => plugin.id).join(", ")));
      break;
    }
    ordered.push(next);
    placed.add(next.id);
    remaining = remaining.filter((plugin) => plugin !== next);
  }
  return ordered;
}

export function resolvePlugins(plugins: readonly Plugin[]): Resolved {
  const problems: string[] = [];
  const unique = withoutDuplicates(plugins, problems);
  const satisfied = withoutUnmet(unique, problems);
  return { ordered: dependenciesFirst(satisfied, problems), problems };
}
