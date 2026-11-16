import { compose, type Plugin, type Ports, type Product } from "@openwork/kit";
import {
  browserConnectivity,
  type Connectivity,
  type DevicePorts,
  createSyncEngine,
  DexieDeviceStore,
  HttpTransport,
  IndexedDbFileStore,
  stackTransport,
  type SyncEngine,
  systemClock,
} from "@openwork/store";
import type { Regions } from "./Frame.tsx";
import { createRouter, type Router } from "./router.ts";

export interface ShellOptions {
  plugins: readonly Plugin[];
  /** Replaces the default ports by name (`store`, `files`, `transport`, `clock`) and adds the product's own. */
  ports?: Ports;
  regions?: Regions;
  router?: Router;
  connectivity?: Connectivity;
  /** The server's address; the page's own origin by default. */
  baseUrl?: string;
}

export interface Shell {
  product: Product;
  ports: Ports;
  router: Router;
  regions: Regions;
  sync: SyncEngine;
  stop(): void;
}

function buildPorts(given: Ports, connectivity: Connectivity, baseUrl: string | undefined): DevicePorts & Ports {
  const dexie = given.store && given.files ? undefined : new DexieDeviceStore();
  return {
    ...given,
    store: given.store ?? dexie,
    files: given.files ?? (dexie && new IndexedDbFileStore(dexie.database)),
    transport: given.transport ?? stackTransport(new HttpTransport(baseUrl), { connectivity }),
    clock: given.clock ?? systemClock,
  } as DevicePorts & Ports;
}

/** Builds the ports, composes the plugins and starts the sync loop. It touches no page: `createApp` mounts it. */
export function bootShell(options: ShellOptions): Shell {
  const connectivity = options.connectivity ?? browserConnectivity;
  const ports = buildPorts(options.ports ?? {}, connectivity, options.baseUrl);
  const product = compose(options.plugins, ports);
  const sync = createSyncEngine({ store: ports.store, files: ports.files, transport: ports.transport, connectivity, notices: product.notices });
  sync.start();
  return {
    product,
    ports,
    router: options.router ?? createRouter(),
    regions: options.regions ?? {},
    sync,
    stop() {
      sync.stop();
      product.teardown();
    },
  };
}
