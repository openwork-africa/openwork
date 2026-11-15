import { Window } from "happy-dom";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { compose, type Plugin, type Ports } from "@openwork/kit";

const DOM_GLOBALS = [
  "document",
  "HTMLElement",
  "Element",
  "Node",
  "Text",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "HTMLIFrameElement",
  "MutationObserver",
] as const;

function installDom(): void {
  if (globalThis.document) return;
  const dom = new Window({
    url: "http://127.0.0.1:47411/",
  }) as unknown as Record<string, unknown>;
  const target = globalThis as unknown as Record<string, unknown>;
  target.window = globalThis;
  for (const key of DOM_GLOBALS) target[key] = dom[key];
  target.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  target.getComputedStyle =
    (dom.getComputedStyle as (...args: unknown[]) => unknown).bind(dom);
}

installDom();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  container: HTMLElement;
  unmount(): Promise<void>;
}

export async function mount(element: ReactElement): Promise<Mounted> {
  const container = document.body.appendChild(
    document.createElement("section"),
  );
  const root = createRoot(container, {
    onCaughtError: () => {},
    onUncaughtError: () => {},
  });
  await act(() => root.render(element));
  return {
    container,
    unmount: async () => {
      await act(() => root.unmount());
      container.remove();
    },
  };
}

export const flush = (): Promise<void> =>
  act(async () => {
    await new Promise((done) => setTimeout(done, 10));
  });

export function host(
  plugins: readonly Plugin[],
  ports: Ports,
  element: ReactElement,
  extra: { roomId?: string; navigate?: (path: string) => void } = {},
): ReactElement {
  const product = compose(plugins, ports);
  return (
    <product.Root roomId={extra.roomId} navigate={extra.navigate ?? (() => {})}>
      {element}
    </product.Root>
  );
}
