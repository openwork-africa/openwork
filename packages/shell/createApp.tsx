import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@openwork/ui/css";
import { createRoot } from "react-dom/client";
import { bootShell, type Shell, type ShellOptions } from "./boot.ts";
import { ShellApp } from "./ShellApp.tsx";
import { browserWorkerEnv, startServiceWorker } from "./serviceWorker.ts";

export interface AppOptions extends ShellOptions {
  /** Where to mount; `#root` by default. */
  element?: HTMLElement;
  /** The service worker is off while developing. */
  serviceWorker?: boolean;
}

export interface App {
  shell: Shell;
  stop(): void;
}

const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

/** Boots the product: default ports, compose, the sync loop, the theme and notices, the service worker. */
export function createApp(options: AppOptions): App {
  const element = options.element ?? document.getElementById("root");
  if (!element) throw new Error("There is no #root element to mount the app in.");
  const shell = bootShell(options);
  const root = createRoot(element);
  root.render(<ShellApp product={shell.product} router={shell.router} regions={shell.regions} />);
  const stopWorker = options.serviceWorker ?? !isDev ? startServiceWorker(browserWorkerEnv(shell.product.notices)) : () => {};
  return {
    shell,
    stop() {
      stopWorker();
      root.unmount();
      shell.stop();
    },
  };
}
