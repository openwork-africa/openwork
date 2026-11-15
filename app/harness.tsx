import "./dom.ts";
import { assert } from "@std/assert";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { dismiss, getNotices, type Plugin } from "@openwork/kit";
import { type Shell, bootShell, createRouter, ShellApp } from "@openwork/shell";
import { ManualClock, manualConnectivity, MemoryDeviceStore, MemoryFileStore, MemoryTransport } from "@openwork/store";
import { openPlugins, regions } from "./product.ts";

/** Waits for lazy regions and the live queries to settle. */
export const flush = (): Promise<void> => act(async () => {
  await new Promise((done) => setTimeout(done, 150));
});

export interface Booted {
  container: HTMLElement;
  shell: Shell;
  store: MemoryDeviceStore;
  history: string[];
  path(): string;
  stop(): Promise<void>;
}

/** The real product (the given plugins and the product's regions) on in-memory ports, drawn at `start`. */
export async function bootProduct(plugins: readonly Plugin[] = openPlugins, start = "/"): Promise<Booted> {
  getNotices().forEach((notice) => dismiss(notice.id));
  const clock = new ManualClock();
  const store = new MemoryDeviceStore(clock);
  const history = [start];
  const listeners = new Set<() => void>();
  const router = createRouter({
    read: () => history.at(-1)!,
    push: (path) => void history.push(path),
    listen: (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
  });
  const shell = bootShell({
    plugins,
    regions,
    router,
    ports: { store, files: new MemoryFileStore(), transport: new MemoryTransport(), clock },
    connectivity: manualConnectivity(true),
  });
  const container = document.body.appendChild(document.createElement("section"));
  const root = createRoot(container, { onCaughtError: () => {}, onUncaughtError: () => {} });
  await act(() => root.render(<ShellApp product={shell.product} router={shell.router} regions={shell.regions} />));
  await flush();
  return {
    container,
    shell,
    store,
    history,
    path: () => history.at(-1)!,
    async stop() {
      await act(() => root.unmount());
      container.remove();
      shell.stop();
    },
  };
}

export const errorNotices = () => getNotices().filter((notice) => notice.status === "error");

export async function click(element: Element | null): Promise<void> {
  assert(element, "nothing to click");
  await act(() => void (element as HTMLElement).click());
  await flush();
}
