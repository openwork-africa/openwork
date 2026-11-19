import { copy } from "./copy.ts";

/** The network was not there (no connection, the server is down). Worth trying again later. */
export class NetworkError extends Error {
  constructor(cause?: unknown, message: string = copy.serverUnreachable) {
    super(message, { cause });
    this.name = "NetworkError";
  }
}

/** Plain words for a status the server gave no message for. The status itself never reaches the UI; it stays on `HttpError.status` and in the console.warn. */
const statusMessage = (status: number): string => {
  switch (status) {
    case 400:
      return copy.badRequest;
    case 401:
      return copy.signedOut;
    case 403:
      return copy.forbidden;
    case 404:
      return copy.notFound;
    case 413:
      return copy.tooLarge;
    case 429:
      return copy.tooManyRequests;
    case 500:
      return copy.serverBroke;
    case 502:
    case 503:
      return copy.serverUnreachable;
    case 504:
      return copy.serverTimedOut;
    default:
      return copy.requestFailed;
  }
};

/** The server answered, with something other than success. `message` is the server's own wording and always wins, unchanged; with none, the status maps to a plain message from copy. The exact status stays on `status`. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? statusMessage(status));
    this.name = "HttpError";
    this.status = status;
  }
}

/** Raised by the offline layer without touching the network. */
export class OfflineError extends NetworkError {
  constructor() {
    super(undefined, copy.offlineNow);
    this.name = "OfflineError";
  }
}

export const isRetryable = (error: unknown): boolean =>
  !(error instanceof OfflineError) && (error instanceof NetworkError || (error instanceof HttpError && error.status >= 500));
