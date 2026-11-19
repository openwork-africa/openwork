export type Scheme = "light" | "dark" | "system";

export const BASE_SCHEME = {
  white: "light",
} as const satisfies Record<string, Scheme>;

export type Base = keyof typeof BASE_SCHEME;
export const BASES = Object.keys(BASE_SCHEME) as Base[];
export const THEME_BASES: readonly Base[] = BASES;
const BASE_LABELS: Partial<Record<Base, string>> = { white: "White" };
export const baseLabel = (base: Base): string => BASE_LABELS[base] ?? base.charAt(0).toUpperCase() + base.slice(1);

export const DEFAULT_BASE: Base = "white";
export const STORAGE_KEY = "ow-base";
export const BASE_ATTR = "data-base";

export function isBase(value: unknown): value is Base {
  return typeof value === "string" && Object.hasOwn(BASE_SCHEME, value);
}

function readStored(): Base | null {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isBase(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeStored(base: Base): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, base);
  } catch {
    // Storage blocked or full: the choice lasts until the page closes.
  }
}

const listeners = new Set<() => void>();
let live: Base | null = null;

export function subscribeBase(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The base chosen on this device: the one stored under `ow-base`, else the default. */
export function getBase(): Base {
  return live ??= readStored() ?? DEFAULT_BASE;
}

export function applyBase(base: Base, root: { setAttribute(name: string, value: string): void } = document.documentElement): void {
  root.setAttribute(BASE_ATTR, base);
}

export function setBase(base: Base): void {
  if (!isBase(base)) throw new Error(`Unknown base: ${String(base)}`);
  live = base;
  writeStored(base);
  listeners.forEach((listener) => listener());
}
