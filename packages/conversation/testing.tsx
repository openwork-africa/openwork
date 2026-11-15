import { Window } from "happy-dom";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { type Plugin, compose, type Product } from "@openwork/kit";
import { type DeviceStore, ManualClock, MemoryDeviceStore, MemoryFileStore, MemoryTransport, type TrailMessage } from "@openwork/store";

const DOM_GLOBALS = [
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
  "MutationObserver",
] as const;

function installDom(): void {
  if (globalThis.document) return;
  const dom = new Window({ url: "http://127.0.0.1:47411/" }) as unknown as Record<string, unknown>;
  const target = globalThis as unknown as Record<string, unknown>;
  target.window = globalThis;
  for (const key of DOM_GLOBALS) target[key] = dom[key];
  target.getComputedStyle = (dom.getComputedStyle as (...args: unknown[]) => unknown).bind(dom);
  target.requestAnimationFrame = (run: () => void) => setTimeout(run, 0);
  target.cancelAnimationFrame = (handle: number) => clearTimeout(handle);
  target.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  target.getSelection = (dom.getSelection as (...args: unknown[]) => unknown).bind(dom);
}

installDom();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

export const flush = (ms = 10): Promise<void> => act(async () => {
  await new Promise((done) => setTimeout(done, ms));
});

export interface Rig {
  product: Product;
  store: MemoryDeviceStore;
  clock: ManualClock;
  navigated: string[];
  view(element: ReactElement, roomId?: string): ReactElement;
}

/** A composed product over in-memory ports: what a host or a plugin is tested against. */
export function rig(plugins: readonly Plugin[] = [], extraPorts: Record<string, unknown> = {}): Rig {
  const clock = new ManualClock();
  const store = new MemoryDeviceStore(clock);
  const product = compose(plugins, { store, files: new MemoryFileStore(), transport: new MemoryTransport(), clock, ...extraPorts });
  const navigated: string[] = [];
  const view = (element: ReactElement, roomId?: string) => <product.Root roomId={roomId} navigate={(path) => void navigated.push(path)}>{element}</product.Root>;
  return { product, store, clock, navigated, view };
}

export const labelled = (container: HTMLElement, label: string): HTMLElement | null => container.querySelector(`[aria-label="${label}"]`);

export const press = (element: Element | null): Promise<void> => Promise.resolve(act(() => void (element as HTMLElement).click()));

/** Types into the composer's field the way a person does: the field changes, then it says so. */
export async function write(container: HTMLElement, words: string): Promise<void> {
  const field = container.querySelector("[contenteditable]") as HTMLElement;
  field.textContent = words;
  await act(() => void field.dispatchEvent(new InputEvent("input", { bubbles: true })));
}

export const sendButton = (container: HTMLElement): HTMLElement | null => labelled(container, "Send");

/** The trail as it stands now. */
export function trailOf(store: DeviceStore, roomId: string): Promise<TrailMessage[]> {
  const live = store.trail(roomId);
  return new Promise((done) => {
    const stop = live.subscribe(() => {
      const value = live.get();
      if (value) queueMicrotask(stop), done(value);
    });
    const value = live.get();
    if (value) queueMicrotask(stop), done(value);
  });
}
