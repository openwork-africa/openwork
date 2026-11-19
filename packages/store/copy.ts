export const copy = {
  syncFailed: "Could not sync your changes. Please try again.",
  offline: "You're offline. Your changes are saved on this device and will go through when you're back.",
  /** The device has no connection (OfflineError). */
  offlineNow: "You're offline. Your changes are saved on this device and will be sent when you're back online.",
  /** Network failure, 502 or 503: the server is down or cannot be reached. */
  serverUnreachable: "Oops, the server is down or can't be reached. We'll keep trying and send your messages when it's back.",
  /** 504: the server (or the proxy in front of it) answered too late. */
  serverTimedOut: "The server took too long to answer. Please try again in a moment.",
  /** 401: the session is no longer valid. */
  signedOut: "Your session has ended. Please sign in again.",
  /** 403: signed in, but not allowed to do this. */
  forbidden: "You don't have permission to do that.",
  /** 404 with no message from the server. */
  notFound: "That room or message is no longer there.",
  /** 429: too many requests in a short time. */
  tooManyRequests: "You're going a little fast. Wait a moment, then try again.",
  /** 413: what was sent is over the size limit. */
  tooLarge: "That message or file is too big to send. Try a smaller one.",
  /** 400 with no message from the server. */
  badRequest: "We couldn't understand that request. Check what you entered and try again.",
  /** 500 with no message from the server. */
  serverBroke: "Something broke on our side. Please try again; we've made a note of it.",
  /** Any other status with no message from the server. */
  requestFailed: "That didn't go through. You can try again.",
  noRoom: (id: string) => `There is no room ${id} on this device.`,
  noReply: "The assistant is unavailable right now. Please try again in a moment.",
  missingPorts: "The product was composed without the device ports.",
} as const;
