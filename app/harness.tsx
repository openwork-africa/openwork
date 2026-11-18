import "./dom.ts";
import { assert } from "@std/assert";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { getNotices, type Plugin } from "@openwork/kit";
import { clearNotices } from "@openwork/kit/testing";
import { bootShell, createRouter, type Shell, ShellApp } from "@openwork/shell";
import { memoryEnv } from "@openwork/shell/testing";
import { ManualClock, manualConnectivity, MemoryDeviceStore } from "@openwork/store";
import { memoryPorts } from "@openwork/store/testing";
import { openPlugins } from "./product.ts";
import { regions } from "./regions.ts";

/** Waits for lazy regions and the live queries to settle. */
export const flush = (): Promise<void> =>
  act(async () => {
    await new Promise((done) => setTimeout(done, 150));
  });

export interface Booted {
  container: HTMLElement;
  shell: Shell;
  store: MemoryDeviceStore;
  clock: ManualClock;
  history: string[];
  path(): string;
  stop(): Promise<void>;
}

/** The real product (the given plugins and the product's regions) on in-memory ports, drawn at `start`. */
export async function bootProduct(plugins: readonly Plugin[] = openPlugins, start = "/"): Promise<Booted> {
  clearNotices();
  const ports = memoryPorts();
  const { clock, store } = ports;
  const env = memoryEnv(start);
  const { history } = env;
  const router = createRouter(env);
  const shell = bootShell({
    plugins,
    regions,
    router,
    ports,
    connectivity: manualConnectivity(true),
  });
  const container = document.body.appendChild(document.createElement("section"));
  const root = createRoot(container, { onCaughtError: () => {}, onUncaughtError: () => {} });
  await act(() => root.render(<ShellApp product={shell.product} router={shell.router} regions={shell.regions} drawer={shell.drawer} />));
  await flush();
  return {
    container,
    shell,
    store,
    clock,
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
