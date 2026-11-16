import "fake-indexeddb/auto";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { DexieDeviceStore } from "./dexieDatabase.ts";
import { IndexedDbFileStore } from "./fileStore.ts";
import type { Live } from "./live.ts";
import { ManualClock } from "./memory.ts";
import { MemoryDeviceStore, MemoryFileStore } from "./memory.ts";
import type { DeviceStore, FileStore } from "./ports.ts";
import { MemoryTransport } from "./memoryTransport.ts";
import type { Commands, Plugin, Ports } from "@openwork/kit";
import { compose } from "@openwork/kit";
import { createElement, type ReactElement } from "react";
import { manualConnectivity } from "./connectivity.ts";
import { createSyncEngine } from "./syncEngine.ts";

export interface Device {
  name: string;
  store: DeviceStore;
  files: FileStore;
  clock: ManualClock;
  close(): void;
}

let counter = 0;

export function memoryDevice(): Device {
  const clock = new ManualClock();
  return { name: "memory", store: new MemoryDeviceStore(clock), files: new MemoryFileStore(), clock, close() {} };
}

export function dexieDevice(): Device {
  const clock = new ManualClock();
  const store = new DexieDeviceStore({ name: `openwork-test-${counter++}`, indexedDB, IDBKeyRange }, clock);
  return { name: "dexie", store, files: new IndexedDbFileStore(store.database), clock, close: () => store.close() };
}

export const devices = [memoryDevice, dexieDevice];

export function memoryPorts(
  clock = new ManualClock(),
): Ports & { store: MemoryDeviceStore; files: MemoryFileStore; transport: MemoryTransport; clock: ManualClock } {
  return { store: new MemoryDeviceStore(clock), files: new MemoryFileStore(), transport: new MemoryTransport(), clock };
}

export function rig(
  plugins: readonly Plugin[] = [],
  ports = memoryPorts(),
  options: { roomId?: string; navigate?: (path: string) => void; commands?: Commands } = {},
) {
  const product = compose(plugins, ports);
  const sync = createSyncEngine({ store: ports.store, files: ports.files, transport: ports.transport, connectivity: manualConnectivity() });
  const navigated: string[] = [];
  return {
    product,
    ports,
    store: ports.store,
    files: ports.files,
    transport: ports.transport,
    clock: ports.clock,
    syncNow: () => sync.syncNow(),
    navigated,
    view: (element: ReactElement, roomId = options.roomId) =>
      createElement(product.Root, { roomId, navigate: options.navigate ?? ((path: string) => navigated.push(path)), commands: options.commands }, element),
  };
}

/** Resolves with the first value of `live` that satisfies `accept`. */
export function until<T>(live: Live<T>, accept: (value: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => (stop(), reject(new Error("the live value never arrived"))), 2000);
    const check = () => {
      const value = live.get();
      if (value !== undefined && accept(value)) {
        clearTimeout(timer);
        queueMicrotask(stop);
        resolve(value);
      }
    };
    const stop = live.subscribe(check);
    check();
  });
}

export const settle = (): Promise<void> => new Promise((done) => setTimeout(done, 20));
