import { copy } from "./copy.ts";

/** The network was not there (no connection, the server is down). Worth trying again later. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super(copy.offlineNow, { cause });
    this.name = "NetworkError";
  }
}

/** The server answered, with something other than success. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string = copy.serverRefused(status)) {
    super(message);
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

export const isOfflineFailure = (error: unknown): boolean => error instanceof NetworkError;
