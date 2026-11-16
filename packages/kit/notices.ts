import { useSyncExternalStore } from "react";
import { createCell } from "./cell.ts";

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

export type Notify = (text: string, options?: NoticeOptions) => string;

export interface Notices {
  notify: Notify;
  dismiss(id: string): void;
  list(): readonly Notice[];
  subscribe(listener: () => void): () => void;
}

const DEFAULT_HOLD_MS = 2200;

export function createNotices(): Notices {
  const cell = createCell<readonly Notice[]>([]);
  let counter = 0;

  const dismiss = (id: string): void => cell.set(cell.get().filter((notice) => notice.id !== id));

  const notify: Notify = (text, options = {}) => {
    const { status = "info", action } = options;
    const id = String(counter++);
    const wrapped = action && { label: action.label, run: () => (dismiss(id), action.run()) };
    cell.set([...cell.get(), { id, text, status, action: wrapped }]);
    const holdMs = options.holdMs ?? (status === "info" || status === "success" ? DEFAULT_HOLD_MS : 0);
    if (holdMs > 0) setTimeout(() => dismiss(id), holdMs);
    return id;
  };

  return { notify, dismiss, list: cell.get, subscribe: cell.subscribe };
}

export const defaultNotices: Notices = createNotices();

export const { notify, dismiss } = defaultNotices;

export const getNotices = (): readonly Notice[] => defaultNotices.list();

export const useNotices = (notices: Notices = defaultNotices): readonly Notice[] =>
  useSyncExternalStore(notices.subscribe, notices.list, notices.list);
