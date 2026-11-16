import { Window } from "happy-dom";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

export const TEST_ORIGIN = "http://127.0.0.1:47411/";
const GLOBALS = [
  "document",
  "HTMLElement",
  "Element",
  "Node",
  "Text",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "InputEvent",
  "HTMLIFrameElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "MutationObserver",
] as const;

/** Install the one shared happy-dom environment used by UI and package tests. */
export function installDom(): void {
  if (globalThis.document) return;
  const dom = new Window({ url: TEST_ORIGIN }) as unknown as Record<string, unknown>;
  const target = globalThis as unknown as Record<string, unknown>;
  target.window = globalThis;
  for (const key of GLOBALS) target[key] = dom[key];
  target.requestAnimationFrame = (run: (time: number) => void) => setTimeout(() => run(Date.now()), 0);
  target.cancelAnimationFrame = (handle: number) => clearTimeout(handle);
  target.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  target.CSS = { supports: () => false, escape: (value: string) => value };
  target.scrollTo = () => {};
  target.getComputedStyle = (dom.getComputedStyle as (...args: unknown[]) => unknown).bind(dom);
  target.getSelection = (dom.getSelection as (...args: unknown[]) => unknown).bind(dom);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

installDom();

export interface Mounted {
  container: HTMLElement;
  unmount(): Promise<void>;
}

export async function mount(element: ReactElement): Promise<Mounted> {
  const container = document.body.appendChild(document.createElement("section"));
  const root = createRoot(container, { onCaughtError: () => {}, onUncaughtError: () => {} });
  await act(() => root.render(element));
  return {
    container,
    unmount: async () => {
      await act(() => root.unmount());
      container.remove();
    },
  };
}

export const flush = (ms = 10): Promise<void> =>
  act(async () => {
    await new Promise((done) => setTimeout(done, ms));
  });

export const labelled = (container: HTMLElement, label: string): HTMLElement | null => container.querySelector(`[aria-label="${label}"]`);

export const press = (element: Element | null): Promise<void> => Promise.resolve(act(() => void (element as HTMLElement).click()));

export async function typeInto(field: HTMLElement, text: string): Promise<void> {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    await act(() => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")!.set!.call(field, text);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // React observes happy-dom's input on the following keyboard event.
    await act(() => void field.dispatchEvent(new KeyboardEvent("keyup", { key: "x", bubbles: true })));
    await flush();
    return;
  }
  field.textContent = text;
  await act(() => void field.dispatchEvent(new InputEvent("input", { bubbles: true })));
}

export async function until(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Condition was not met before timeout.");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
