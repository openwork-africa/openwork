import { isRetryable, OfflineError } from "./errors.ts";
import type { Connectivity, Transport } from "./ports.ts";

/** Wraps every call of a transport; the decorators below differ only in what they do around it. */
function wrap(inner: Transport, around: <T>(name: string, call: () => Promise<T>) => Promise<T>): Transport {
  return {
    push: (changes) => around("push", () => inner.push(changes)),
    pull: (since) => around("pull", () => inner.pull(since)),
    putFile: (id, bytes) => around("putFile", () => inner.putFile(id, bytes)),
    getFile: (id) => around("getFile", () => inner.getFile(id)),
    health: () => around("health", () => inner.health()),
  };
}

export const withLogging = (inner: Transport, log: (line: string) => void = (line) => console.debug(line)): Transport =>
  wrap(inner, async (name, call) => {
    try {
      const result = await call();
      log(`transport ${name} ok`);
      return result;
    } catch (error) {
      log(`transport ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });

/** Refuses while the device is offline. The queue itself is the device store's outbox: nothing is lost by refusing. */
export const withOfflineQueue = (inner: Transport, connectivity: Connectivity): Transport =>
  wrap(inner, (_name, call) => (connectivity.isOnline() ? call() : Promise.reject(new OfflineError())));

export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export function withRetrying(inner: Transport, { attempts = 3, delayMs = 400, sleep = (ms) => new Promise<void>((done) => setTimeout(done, ms)) }: RetryOptions = {}): Transport {
  return wrap(inner, async (_name, call) => {
    for (let attempt = 1;; attempt++) {
      try {
        return await call();
      } catch (error) {
        if (attempt >= attempts || !isRetryable(error)) throw error;
        await sleep(delayMs * attempt);
      }
    }
  });
}

export interface StackOptions {
  connectivity: Connectivity;
  log?: (line: string) => void;
  retry?: RetryOptions;
}

/** Logging, then OfflineQueue, then Retrying, then Http: the order never changes. */
export const stackTransport = (http: Transport, { connectivity, log, retry }: StackOptions): Transport =>
  withLogging(withOfflineQueue(withRetrying(http, retry), connectivity), log);
