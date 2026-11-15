import type { ReactElement } from "react";
import { copy } from "./copy.ts";
import type { Ports, SetupContext } from "./context.ts";
import { notify } from "./notices.ts";
import { resolvePlugins } from "./order.ts";
import type { Plugin } from "./plugin.ts";
import { buildRegistry, type Override, type Registry } from "./registry.ts";
import { frameSlotIds } from "./slots.ts";
import { KitProvider, type RootProps } from "./react.tsx";

export interface ComposeOptions {
  override?: Override;
}

export interface Product {
  registry: Registry;
  ports: Ports;
  /** Everything that went wrong at boot, in plain words. Each one is also shown as a notice. */
  problems: readonly string[];
  Root: (props: RootProps) => ReactElement;
  teardown: () => void;
}

export function compose(plugins: readonly Plugin[], ports: Ports, options: ComposeOptions = {}): Product {
  const { ordered, problems } = resolvePlugins(plugins);
  const registry = buildRegistry(ordered, frameSlotIds, options.override ?? {}, problems);
  const setup: SetupContext = { ports, notify, service: registry.service };
  const teardowns: (() => void)[] = [];

  for (const plugin of ordered) {
    try {
      const teardown = plugin.setup?.(setup);
      if (teardown) teardowns.push(teardown);
    } catch (error) {
      problems.push(copy.setupFailed(plugin.id, error instanceof Error ? error.message : String(error)));
    }
  }
  for (const problem of problems) notify(problem, { status: "error" });

  return Object.freeze({
    registry,
    ports,
    problems: Object.freeze(problems),
    Root: (props: RootProps) => <KitProvider registry={registry} ports={ports} {...props} />,
    teardown: () => teardowns.splice(0).reverse().forEach((teardown) => teardown()),
  });
}
