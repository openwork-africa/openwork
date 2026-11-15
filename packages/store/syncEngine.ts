import { dismiss, notify as kitNotify } from "@openwork/kit";
import { copy } from "./copy.ts";
import { isRetryable, OfflineError } from "./errors.ts";
import type { Connectivity, DeviceStore, FileStore, Transport } from "./ports.ts";
import type { Change, OutboxRow, SyncStatus } from "./types.ts";

export interface SyncOptions {
  store: DeviceStore;
  transport: Transport;
  files: FileStore;
  connectivity: Connectivity;
  notify?: typeof kitNotify;
  intervalMs?: number;
}

export interface SyncEngine {
  start(): void;
  stop(): void;
  /** One round: push what is queued, then pull what is new. Rounds never overlap; one asked during a round runs after it. */
  syncNow(): Promise<void>;
}

const DEFAULT_INTERVAL_MS = 5000;

export function createSyncEngine(options: SyncOptions): SyncEngine {
  const { store, transport, files, connectivity, notify = kitNotify, intervalMs = DEFAULT_INTERVAL_MS } = options;
  const { journal } = store;
  let running: Promise<void> | undefined;
  let again = false;
  let offlineNotice: string | undefined;
  let stops: (() => void)[] = [];
  let lastReported: string | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  const setOffline = (): void => {
    journal.setStatus("offline");
    offlineNotice ??= notify(copy.offline, { status: "warning", holdMs: 0 });
  };

  const reportOnce = (message: string): void => {
    if (message !== lastReported) notify(message, { status: "error" });
    lastReported = message;
  };

  const setBack = (): void => {
    if (offlineNotice === undefined) return;
    dismiss(offlineNotice);
    offlineNotice = undefined;
  };

  async function uploadAccepted(change: Change): Promise<void> {
    if (change.kind !== "file") return;
    const bytes = await files.get(change.id);
    if (bytes) await transport.putFile(change.id, bytes);
  }

  async function push(): Promise<void> {
    const rows = await journal.pending();
    const sent: { row: OutboxRow; change: Change }[] = [];
    for (const row of rows) {
      const change = await journal.changeOf(row);
      if (change) sent.push({ row, change });
      else await journal.acknowledge(row);
    }
    if (sent.length === 0) return;
    journal.setStatus("sending");
    const answers = await transport.push(sent.map(({ change }) => change));
    for (const answer of answers) {
      const item = sent.find(({ row }) => row.id === answer.id);
      if (!item) continue;
      if (answer.ok) {
        await uploadAccepted(item.change);
        await journal.acknowledge(item.row);
      } else {
        await journal.fail(item.row, answer.message);
        notify(answer.message, { status: "error" });
      }
    }
  }

  async function pull(): Promise<void> {
    journal.setStatus("catchingUp");
    const { changes, cursor } = await transport.pull(await journal.cursor());
    await journal.applyPulled(changes, cursor);
  }

  async function round(): Promise<void> {
    if (!connectivity.isOnline()) return setOffline();
    try {
      await push();
      await pull();
      setBack();
      lastReported = undefined;
      const status: SyncStatus = (await journal.failedCount()) > 0 ? "attention" : "current";
      journal.setStatus(status);
    } catch (error) {
      if (error instanceof OfflineError || isRetryable(error)) return setOffline();
      journal.setStatus("attention");
      reportOnce(error instanceof Error ? error.message : String(error));
    }
  }

  function syncNow(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        await round();
      } while (again);
    })().finally(() => (running = undefined));
    return running;
  }

  const run = (): void => void syncNow();

  return {
    start() {
      if (stops.length) return;
      stops = [journal.onQueued(run), connectivity.subscribe(run)];
      timer = setInterval(() => connectivity.isOnline() && run(), intervalMs);
      run();
    },
    stop() {
      stops.forEach((stop) => stop());
      stops = [];
      clearInterval(timer);
    },
    syncNow,
  };
}
