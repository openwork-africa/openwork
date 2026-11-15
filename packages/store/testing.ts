import "fake-indexeddb/auto";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { DexieDeviceStore } from "./dexieDatabase.ts";
import { IndexedDbFileStore } from "./fileStore.ts";
import type { Live } from "./live.ts";
import { ManualClock } from "./memoryTransport.ts";
import { MemoryDeviceStore, MemoryFileStore } from "./memory.ts";
import type { DeviceStore, FileStore } from "./ports.ts";

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
