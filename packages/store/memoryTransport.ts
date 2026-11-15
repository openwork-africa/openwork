import { NetworkError } from "./errors.ts";
import type { Clock, Transport } from "./ports.ts";
import type { Answer, Change, PullAnswer } from "./types.ts";

interface Stored {
  change: Change;
  seq: number;
}

/** A server in memory that answers like the real one: last writer wins by `updatedAt`, the cursor is a sequence number. */
export class MemoryTransport implements Transport {
  readonly stored = new Map<string, Stored>();
  readonly blobs = new Map<string, Blob>();
  /** Set to refuse a change in plain words. */
  refuse?: (change: Change) => string | undefined;
  down = false;
  pushes = 0;
  #seq = 0;

  /** Runs `work` as a request: it fails like a network when `down`, and answers asynchronously. */
  #request<T>(work: () => T): Promise<T> {
    return this.down ? Promise.reject(new NetworkError()) : Promise.resolve().then(work);
  }

  push = (changes: Change[]): Promise<Answer[]> =>
    this.#request(() => {
      this.pushes++;
      return changes.map((change): Answer => {
        const message = this.refuse?.(change);
        if (message !== undefined) return { id: change.id, ok: false, message };
        const current = this.stored.get(`${change.kind}:${change.id}`);
        if (!current || change.updatedAt > current.change.updatedAt) this.other(change);
        return { id: change.id, ok: true };
      });
    });

  pull = (since: number): Promise<PullAnswer> =>
    this.#request(() => ({
      changes: [...this.stored.values()].filter(({ seq }) => seq > since).sort((a, b) => a.seq - b.seq).map(({ change }) => structuredClone(change)),
      cursor: this.#seq,
    }));

  putFile = (id: string, bytes: Blob): Promise<void> => this.#request(() => void this.blobs.set(id, bytes));

  getFile = (id: string): Promise<Blob | undefined> => this.#request(() => this.blobs.get(id));

  health = (): Promise<boolean> => Promise.resolve(!this.down);

  /** Writes a change as another device would have. */
  other(change: Change): void {
    this.stored.set(`${change.kind}:${change.id}`, { change: structuredClone(change), seq: ++this.#seq });
  }
}

export class ManualClock implements Clock {
  constructor(public time = 1_700_000_000_000) {}
  now = (): number => this.time;
  tick(ms = 1): number {
    return (this.time += ms);
  }
}
