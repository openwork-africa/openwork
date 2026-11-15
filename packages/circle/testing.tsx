import { Window } from "happy-dom";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  compose,
  contribute,
  definePlugin,
  type Observable,
  type Plugin,
  type Ports,
  type RowModel,
} from "@openwork/kit";
import {
  circleEmpty,
  circleRowMenu,
  circleSource,
  circleTab,
} from "@openwork/kit";

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
  target.CSS = { supports: () => false, escape: (value: string) => value };
  target.scrollTo = () => {};
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

/** A source whose rows the test sets by hand; until `set` is called it has said nothing, which is loading. */
export function fakeSource(): {
  observable: Observable<RowModel[]>;
  set(rows: RowModel[]): void;
} {
  const listeners = new Set<(rows: RowModel[]) => void>();
  let latest: RowModel[] | undefined;
  return {
    observable: {
      subscribe(listener) {
        listeners.add(listener);
        if (latest) listener(latest);
        return () => void listeners.delete(listener);
      },
    },
    set(rows) {
      latest = rows;
      listeners.forEach((listener) => listener(rows));
    },
  };
}

export const row = (
  id: string,
  title: string,
  activityAt: number,
  extra: Partial<RowModel> = {},
): RowModel => ({ id, title, activityAt, preview: `about ${title}`, ...extra });

export interface Contributions {
  sources?: { id: string; observable: Observable<RowModel[]> }[];
  tabs?: { id: string; label: string; filter: (row: RowModel) => boolean }[];
  menu?: {
    id: string;
    label: string;
    danger?: boolean;
    run: (row: RowModel) => void;
  }[];
  empty?: { id: string; text: string }[];
}

export function fakePlugin(
  { sources = [], tabs = [], menu = [], empty = [] }: Contributions,
): Plugin {
  return definePlugin({
    id: "fake",
    version: "1.0.0",
    contributes: [
      ...sources.map((source, order) =>
        contribute(circleSource, {
          id: source.id,
          order,
          rows: () => source.observable,
        })
      ),
      ...tabs.map((tab, order) => contribute(circleTab, { ...tab, order })),
      ...menu.map((item, order) =>
        contribute(circleRowMenu, {
          id: item.id,
          order,
          label: item.label,
          icon: null,
          danger: item.danger,
          run: item.run,
        })
      ),
      ...empty.map((item, order) =>
        contribute(circleEmpty, {
          id: item.id,
          order,
          render: () => <p>{item.text}</p>,
        })
      ),
    ],
  });
}

export function host(
  plugins: readonly Plugin[],
  ports: Ports,
  element: ReactElement,
  extra: {
    roomId?: string;
    commands?: Record<string, () => unknown>;
    navigate?: (path: string) => void;
  } = {},
): ReactElement {
  const product = compose(plugins, ports);
  return (
    <product.Root
      roomId={extra.roomId}
      navigate={extra.navigate ?? (() => {})}
      commands={extra.commands}
    >
      {element}
    </product.Root>
  );
}
