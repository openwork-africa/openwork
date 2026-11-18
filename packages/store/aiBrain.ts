import type { AiClient } from "./aiClient.ts";
import { type Live, makeLive } from "./live.ts";
import type { Brain } from "./ports.ts";

const POLL_MS = 2_000;

/**
 * A brain built from the server's AI status: a room is working while a reply is pending there, on the
 * server (the status, polled while someone is looking) or from this device (`begin`, at once).
 * Until it is connected to a client it is idle.
 */
export class AiBrain implements Brain {
  #client: AiClient | undefined;
  readonly #pollMs: number;
  readonly #local = new Map<string, number>();
  #remote = new Set<string>();
  readonly #listeners = new Set<() => void>();
  #watchers = 0;
  #running = false;
  #wake: (() => void) | undefined;
  #configured = true;

  constructor(pollMs = POLL_MS) {
    this.#pollMs = pollMs;
  }

  connect(client: AiClient): void {
    this.#client = client;
    this.#configured = true;
    if (this.#watchers > 0) void this.#loop();
  }

  /** A reply started on this device; call the result when it is over. */
  begin(roomId: string): () => void {
    this.#local.set(roomId, (this.#local.get(roomId) ?? 0) + 1);
    this.#changed();
    return () => {
      const left = (this.#local.get(roomId) ?? 1) - 1;
      if (left > 0) this.#local.set(roomId, left);
      else this.#local.delete(roomId);
      this.#changed();
    };
  }

  isWorking(roomId: string): Live<boolean> {
    return makeLive<boolean>((emit) => {
      const publish = (): void => emit(this.#local.has(roomId) || this.#remote.has(roomId));
      this.#listeners.add(publish);
      publish();
      this.#watch(1);
      return () => {
        this.#listeners.delete(publish);
        this.#watch(-1);
      };
    });
  }

  #changed(): void {
    this.#listeners.forEach((listener) => listener());
  }

  #watch(change: 1 | -1): void {
    this.#watchers += change;
    if (this.#watchers > 0) void this.#loop();
    else {
      this.#wake?.();
      this.#remote = new Set();
    }
  }

  async #loop(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    while (this.#watchers > 0 && this.#client && this.#configured) {
      try {
        const status = await this.#client.status();
        this.#configured = status.configured;
        this.#remote = new Set(status.pending);
      } catch {
        // The server could not be asked this time; ask again later.
      }
      this.#changed();
      await this.#sleep();
    }
    this.#running = false;
  }

  #sleep(): Promise<void> {
    return new Promise((done) => {
      const timer = setTimeout(() => done(), this.#pollMs);
      this.#wake = () => {
        clearTimeout(timer);
        done();
      };
    });
  }
}
