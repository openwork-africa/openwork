import { copy } from "./copy.ts";

/** The network was not there (no connection, the server is down). Worth trying again later. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super(copy.offlineNow, { cause });
    this.name = "NetworkError";
  }
}

/** Statuses that mean the server (or the proxy in front of it) is not there right now. */
const unreachableStatuses: readonly number[] = [502, 503, 504];

/** The server answered, with something other than success. `message` is the server's own plain words; with none, a 502, 503 or 504 reads as unreachable and anything else as a generic failure; the exact status stays on `status`. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? (unreachableStatuses.includes(status) ? copy.serverUnreachable : copy.serverRefused(status)));
    this.name = "HttpError";
    this.status = status;
  }
}

/** Raised by the offline layer without touching the network. */
export class OfflineError extends NetworkError {
  constructor() {
    super();
    this.name = "OfflineError";
  }
}

export const isRetryable = (error: unknown): boolean =>
  !(error instanceof OfflineError) && (error instanceof NetworkError || (error instanceof HttpError && error.status >= 500));
