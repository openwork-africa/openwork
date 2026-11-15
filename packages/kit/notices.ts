import { useSyncExternalStore } from "react";

export type NoticeStatus = "info" | "success" | "warning" | "error";

export interface NoticeAction {
  label: string;
  run: () => void;
}

export interface Notice {
  id: string;
  text: string;
  status: NoticeStatus;
  action?: NoticeAction;
}

export interface NoticeOptions {
  status?: NoticeStatus;
  /** How long the notice stays, in ms. Without it, info and success go after a moment; warning and error stay. 0 keeps any notice. */
  holdMs?: number;
  action?: NoticeAction;
}

const DEFAULT_HOLD_MS = 2200;

let notices: readonly Notice[] = [];
let counter = 0;
const listeners = new Set<() => void>();

const publish = (next: readonly Notice[]): void => {
  notices = next;
  listeners.forEach((listener) => listener());
};

export const getNotices = (): readonly Notice[] => notices;

export function dismiss(id: string): void {
  publish(notices.filter((notice) => notice.id !== id));
}

export function notify(text: string, options: NoticeOptions = {}): string {
  const { status = "info", action } = options;
  const id = String(counter++);
  const wrapped = action && { label: action.label, run: () => (dismiss(id), action.run()) };
  publish([...notices, { id, text, status, action: wrapped }]);
  const holdMs = options.holdMs ?? (status === "info" || status === "success" ? DEFAULT_HOLD_MS : 0);
  if (holdMs > 0) setTimeout(() => dismiss(id), holdMs);
  return id;
}

const subscribe = (listener: () => void): () => void => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export const useNotices = (): readonly Notice[] => useSyncExternalStore(subscribe, getNotices, getNotices);
